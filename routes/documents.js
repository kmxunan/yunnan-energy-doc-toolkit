// routes/documents.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Document = require('../models/docModel');
const authMiddleware = require('../middleware/authMiddleware');

// 确保导入的是修正后的存根
const conversionService = require('../services/conversionService');
const thumbnailService = require('../services/thumbnailService');

const isAuthenticated = authMiddleware.isAuthenticated;
const isAdmin = authMiddleware.isAdmin;

const uploadsDir = path.join(__dirname, '..', 'uploads');
const originalUploadsPath = path.join(uploadsDir, 'original');
const htmlUploadsPath = path.join(uploadsDir, 'html');
const publicThumbnailsPath = path.join(__dirname, '..', 'public', 'uploads', 'thumbnails');

[uploadsDir, originalUploadsPath, htmlUploadsPath, publicThumbnailsPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            // console.log(`[routes/documents.js] Created directory: ${dir}`);
        } catch (mkdirErr) {
            console.error(`[routes/documents.js] Failed to create directory ${dir}:`, mkdirErr);
        }
    }
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, originalUploadsPath);
    },
    filename: function (req, file, cb) {
        const randomName = crypto.randomBytes(16).toString('hex');
        const extension = path.extname(file.originalname);
        cb(null, `${randomName}${extension}`);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.md', '.html', '.htm'];
        const extension = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(extension)) {
            cb(null, true);
        } else {
            cb(new Error('文件类型不支持。仅支持: ' + allowedTypes.join(', ')), false);
        }
    }
});

router.post('/upload', isAuthenticated, isAdmin, upload.single('documentFile'), async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ message: '没有选择文件或文件类型不支持。' });
    }
    // **关键检查: req.file.path 和 req.file.filename (由 multer.diskStorage 生成)**
    if (!req.file.path || !req.file.filename) {
        console.error('[routes/documents.js POST /upload] 错误: req.file.path 或 req.file.filename 缺失。req.file:', req.file);
        if (req.file.path && fs.existsSync(req.file.path)) { // 如果路径存在但filename缺失，也尝试清理
            fs.unlink(req.file.path, (err) => { if (err) console.error('删除不完整上传的文件失败:', err); });
        }
        return res.status(500).json({ message: '文件上传处理失败，无法获取完整文件信息。' });
    }

    const { title, description, keywords, author, classification_id, is_public } = req.body;

    let effectiveTitle = title;
    if (!effectiveTitle || String(effectiveTitle).trim() === '') {
        effectiveTitle = path.basename(req.file.originalname, path.extname(req.file.originalname));
    }

    let newDocumentRecord;

    try {
        const docData = {
            title: effectiveTitle,
            description: description || null,
            keywords: keywords || null,
            author: author || null,
            uploader_id: req.user.id,
            classification_id: classification_id ? parseInt(classification_id) : null,
            original_filename: req.file.originalname,
            stored_filename: req.file.filename, // 这个是 multer 生成的磁盘上的文件名
            file_type: path.extname(req.file.originalname).substring(1).toLowerCase(),
            file_size: req.file.size,
            is_public: is_public === 'true' || is_public === '1' || Number(is_public) === 1 ? 1 : 0,
            is_html_converted: 0,
            html_filename: null,
            thumbnail_path: null,
            is_deleted: 0
        };

        newDocumentRecord = await Document.create(docData);
        // console.log('[routes/documents.js] 文档记录已创建, ID:', newDocumentRecord.id, 'Stored filename:', newDocumentRecord.stored_filename);

        res.status(201).json({ message: '文档上传成功，正在后台处理。', document: newDocumentRecord });

        // --- 后台处理 ---
        (async () => {
            const docId = newDocumentRecord.id;
            // **使用 req.file.path (上传文件的完整路径) 和 newDocumentRecord.stored_filename (数据库中存储的唯一文件名)**
            const uploadedFileFullPath = req.file.path;
            const dbStoredFilename = newDocumentRecord.stored_filename;

            // console.log(`[routes/documents.js BG] 开始为文档 ${docId} 进行后台处理。`);
            // console.log(`[routes/documents.js BG]   Uploaded File Full Path: ${uploadedFileFullPath}`);
            // console.log(`[routes/documents.js BG]   DB Stored Filename: ${dbStoredFilename}`);

            if (!uploadedFileFullPath || !fs.existsSync(uploadedFileFullPath)) {
                console.error(`[routes/documents.js BG] 错误: 文档 ${docId} 的原始文件路径 ${uploadedFileFullPath} 无效或文件不存在，无法进行后台处理。`);
                return;
            }
            if (!dbStoredFilename) { // stored_filename 用于生成HTML和缩略图文件名，确保其存在
                console.error(`[routes/documents.js BG] 错误: 文档 ${docId} 的 stored_filename 未定义，无法进行后台处理。`);
                return;
            }

            try {
                let htmlUpdate = {};
                let thumbUpdate = {};

                if (conversionService && typeof conversionService.convertToHtml === 'function') {
                    // console.log(`[routes/documents.js BG] 调用 conversionService.convertToHtml for doc ${docId}`);
                    // 传递 uploadedFileFullPath (原始文件路径) 和 dbStoredFilename (用于生成输出文件名)
                    const generatedHtmlFilename = await conversionService.convertToHtml(docId, uploadedFileFullPath, dbStoredFilename);
                    if (generatedHtmlFilename) {
                        // console.log(`[routes/documents.js BG] HTML 转换成功: ${generatedHtmlFilename}`);
                        htmlUpdate = { html_filename: generatedHtmlFilename, is_html_converted: 1 };
                    } else {
                        // console.warn(`[routes/documents.js BG] HTML 转换服务返回 null/falsy for doc ${docId}.`);
                    }
                } else {
                    console.error(`[routes/documents.js BG] conversionService.convertToHtml (doc ${docId}) 不是一个函数或未定义.`);
                }

                if (thumbnailService && typeof thumbnailService.generateThumbnail === 'function') {
                    // console.log(`[routes/documents.js BG] 调用 thumbnailService.generateThumbnail for doc ${docId}`);
                    // 传递 uploadedFileFullPath (原始文件路径) 和 dbStoredFilename (用于生成输出文件名)
                    const generatedThumbnailPath = await thumbnailService.generateThumbnail(docId, uploadedFileFullPath, dbStoredFilename);
                    if (generatedThumbnailPath) {
                        // console.log(`[routes/documents.js BG] 缩略图生成成功: ${generatedThumbnailPath}`);
                        thumbUpdate = { thumbnail_path: generatedThumbnailPath };
                    } else {
                        // console.warn(`[routes/documents.js BG] 缩略图生成服务返回 null/falsy for doc ${docId}.`);
                    }
                } else {
                    console.error(`[routes/documents.js BG] thumbnailService.generateThumbnail (doc ${docId}) 不是一个函数或未定义.`);
                }

                const finalUpdates = { ...htmlUpdate, ...thumbUpdate };
                if (Object.keys(finalUpdates).length > 0) {
                    // console.log(`[routes/documents.js BG] 更新数据库文档 ${docId} 使用:`, finalUpdates);
                    await Document.update(docId, finalUpdates);
                    // console.log(`[routes/documents.js BG] 文档 ${docId} 后台处理更新完成。`);
                    // console.log(`[routes/documents.js BG] 后台处理完成，文档ID: ${docId}。前端应收到通知或刷新列表。`);
                } else {
                    // console.log(`[routes/documents.js BG] 文档 ${docId} 无需后台更新 (HTML和缩略图均未生成)。`);
                }

            } catch (bgTaskError) {
                console.error(`[routes/documents.js BG] 文档 ${docId} 后台处理时发生严重错误: ${bgTaskError.message}`, bgTaskError.stack);
            }
        })();

    } catch (error) {
        console.error('文档上传处理失败 (主 try-catch):', error.message, error.stack);
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('数据库操作失败后，删除临时文件也失败:', req.file.path, unlinkErr);
            });
        }
        if (!error.status) error.status = 500;
        next(error);
    }
});

// GET /api/documents/public (保持不变)
router.get('/public', async (req, res, next) => {
    try {
        const { sortBy, sortOrder, classification_id, searchTerm } = req.query;
        const filters = {};
        if (classification_id) filters.classification_id = parseInt(classification_id);
        if (searchTerm) filters.searchTerm = searchTerm;
        const documents = await Document.findAllPublic(sortBy, sortOrder, filters);
        res.json(documents || []);
    } catch (error) {
        console.error('[routes/documents.js -> /public] Error:', error);
        next(error);
    }
});

// GET /api/documents/admin (保持不变)
router.get('/admin', isAuthenticated, isAdmin, async (req, res, next) => {
    try {
        const { sortBy, sortOrder, classification_id, uploader_id, is_public, is_html_converted, searchTerm } = req.query;
        const filters = {};
        if (classification_id) filters.classification_id = parseInt(classification_id);
        if (uploader_id) filters.uploader_id = parseInt(uploader_id);
        if (is_public !== undefined) filters.is_public = (String(is_public).toLowerCase() === 'true' || is_public === '1' || Number(is_public) === 1);
        if (is_html_converted !== undefined) filters.is_html_converted = (String(is_html_converted).toLowerCase() === 'true' || is_html_converted === '1' || Number(is_html_converted) === 1);
        if (searchTerm) filters.searchTerm = searchTerm;

        const documents = await Document.findAllAdmin(sortBy, sortOrder, filters);
        res.json(documents || []);
    } catch (error) {
        console.error('[routes/documents.js -> /admin] Error:', error);
        next(error);
    }
});

// GET /api/documents/:id (保持不变)
router.get('/:id', isAuthenticated, async (req, res, next) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ message: '文档未找到。' });
        }
        if (document.is_public !== 1 && (!req.user || (req.user.id !== document.uploader_id && req.user.role !== 'admin'))) {
            return res.status(403).json({ message: '禁止访问：您没有权限查看此文档。'});
        }
        res.json(document);
    } catch (error) {
        next(error);
    }
});

// PUT /api/documents/:id (保持不变)
router.put('/:id', isAuthenticated, isAdmin, async (req, res, next) => {
    const { id } = req.params;
    const { title, description, keywords, author, classification_id, is_public } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (keywords !== undefined) updates.keywords = keywords;
    if (author !== undefined) updates.author = author;
    if (classification_id !== undefined) updates.classification_id = classification_id === '' ? null : parseInt(classification_id);
    if (is_public !== undefined) updates.is_public = (is_public === 'true' || is_public === true || Number(is_public) === 1) ? 1 : 0;

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: '没有提供可更新的字段。' });
    }

    try {
        const document = await Document.findById(id);
        if (!document) {
            return res.status(404).json({ message: '文档未找到。' });
        }

        const result = await Document.update(id, updates);
        if (result.changes === 0) {
            const currentDoc = await Document.findById(id);
            if(!currentDoc) return res.status(404).json({ message: '文档未找到或已被删除。' });
            return res.status(200).json({ message: '文档信息无变化。', document: currentDoc });
        }
        const updatedDocument = await Document.findById(id);
        res.json({ message: '文档更新成功。', document: updatedDocument });
    } catch (error) {
        console.error(`[routes/documents.js PUT /:id] Error updating document ${id}:`, error);
        next(error);
    }
});

// DELETE /api/documents/:id (保持不变)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res, next) => {
    const { id } = req.params;
    try {
        const document = await Document.findById(id);
        if (!document) { return res.status(404).json({ message: '文档未找到。' }); }
        const result = await Document.softDeleteById(id);
        if (result.changes === 0) { return res.status(404).json({ message: '文档未找到或已被删除。' }); }
        res.status(200).json({ message: '文档已成功移至回收站。' });
    } catch (error) {
        next(error);
    }
});

// POST /api/documents/:id/restore (保持不变)
router.post('/:id/restore', isAuthenticated, isAdmin, async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await Document.restoreById(id);
        if (result.changes === 0) { return res.status(404).json({ message: '未找到要恢复的文档，或者文档未被删除。' }); }
        const restoredDocument = await Document.findById(id);
        res.status(200).json({ message: '文档已成功恢复。', document: restoredDocument });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/documents/:id/permanent (保持不变)
const { db } = require('../database/setup');
router.delete('/:id/permanent', isAuthenticated, isAdmin, async (req, res, next) => {
    const { id } = req.params;
    try {
        let docDetails = await Document.findById(id);
        if (!docDetails) {
            docDetails = await new Promise((resolve, reject) => {
                db.get("SELECT stored_filename, html_filename, thumbnail_path, is_deleted FROM documents WHERE id = ? AND is_deleted = 1", [id], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });
            if (!docDetails) return res.status(404).json({ message: '文档未找到(包括回收站)。' });
        }

        if (docDetails.stored_filename) {
            const originalFilePath = path.join(originalUploadsPath, docDetails.stored_filename);
            if (fs.existsSync(originalFilePath)) fs.unlinkSync(originalFilePath);
        }
        if (docDetails.html_filename) {
            const htmlFilePath = path.join(htmlUploadsPath, docDetails.html_filename);
            if (fs.existsSync(htmlFilePath)) fs.unlinkSync(htmlFilePath);
        }
        if (docDetails.thumbnail_path) {
            const thumbnailFullPath = path.join(__dirname, '..', 'public', docDetails.thumbnail_path);
            if (fs.existsSync(thumbnailFullPath)) fs.unlinkSync(thumbnailFullPath);
        }

        const result = await Document.hardDeleteById(id);
        if (result.changes === 0) {
            return res.status(404).json({ message: '文档记录未找到或已被删除 (DB)。' });
        }
        res.status(200).json({ message: '文档已永久删除。' });
    } catch (error) {
        console.error(`[routes/documents.js DELETE /:id/permanent] Error:`, error);
        next(error);
    }
});

// GET /api/documents/download/:id (保持不变)
router.get('/download/:id', isAuthenticated, async (req, res, next) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) { return res.status(404).json({ message: '文档未找到。' }); }

        if (document.is_public !== 1 && (!req.user || (req.user.id !== document.uploader_id && req.user.role !== 'admin'))) {
            return res.status(403).json({ message: '禁止访问：您没有权限下载此文档。'});
        }
        const filePath = path.join(originalUploadsPath, document.stored_filename);
        if (fs.existsSync(filePath)) {
            res.download(filePath, document.original_filename, (err) => {
                if (err) {
                    console.error('下载文件时出错:', err);
                    if (!res.headersSent) {
                        return next(err);
                    }
                }
            });
        } else {
            console.error('请求下载的文件不存在于服务器:', filePath);
            return res.status(404).json({ message: '请求的文件不存在于服务器。' });
        }
    } catch (error) {
        next(error);
    }
});

module.exports = router;
