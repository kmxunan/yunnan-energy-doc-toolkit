// models/docModel.js
const { db } = require('../database/setup'); // 改为解构赋值

// 模块加载时进行诊断
// console.log('[docModel.js] 模块加载。 typeof db:', typeof db);
// if (db) {
//   console.log('[docModel.js] db 对象键名:', Object.keys(db).join(', '));
//   console.log('[docModel.js] typeof db.all:', typeof db.all);
//   console.log('[docModel.js] typeof db.run:', typeof db.run);
//   console.log('[docModel.js] typeof db.get:', typeof db.get);
// } else {
//   console.error('[docModel.js] 致命错误: db 对象未从 databaseSetup 正确导入或未定义!');
// }

class Document {
    static async create(docData) {
        // 移除 checkDb('create');
        if (!db || typeof db.run !== 'function') {
            const errMsg = 'Document.create: db 或 db.run 方法不可用。';
            console.error(errMsg);
            throw new Error(errMsg);
        }
        const {
            title, description, keywords, author, uploader_id, classification_id,
            original_filename, stored_filename, file_type, file_size,
            is_public = 0, is_html_converted = 0, html_filename = null, thumbnail_path = null
        } = docData;

        const sql = `
            INSERT INTO documents (
                title, description, keywords, author, uploader_id, classification_id,
                original_filename, stored_filename, file_type, file_size,
                is_public, is_html_converted, html_filename, thumbnail_path, is_deleted, deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
        `;
        const params = [
            title, description, keywords, author, uploader_id, classification_id,
            original_filename, stored_filename, file_type, file_size,
            is_public, is_html_converted, html_filename, thumbnail_path
        ];

        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) {
                    console.error('Error in Document.create:', err.message);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...docData });
                }
            });
        });
    }

    static async findById(id) {
        // 移除 checkDb('findById');
        if (!db || typeof db.get !== 'function') {
            const errMsg = 'Document.findById: db 或 db.get 方法不可用。';
            console.error(errMsg);
            throw new Error(errMsg);
        }
        const sql = `
            SELECT d.*, u.username as uploader_name, c.name as classification_name
            FROM documents d
                     JOIN users u ON d.uploader_id = u.id
                     LEFT JOIN classifications c ON d.classification_id = c.id
            WHERE d.id = ? AND d.is_deleted = 0
        `;
        return new Promise((resolve, reject) => {
            db.get(sql, [id], (err, row) => {
                if (err) {
                    console.error('Error in Document.findById:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    static async update(id, updates) {
        // 移除 checkDb('update');
        if (!db || typeof db.run !== 'function') {
            const errMsg = 'Document.update: db 或 db.run 方法不可用。';
            console.error(errMsg);
            throw new Error(errMsg);
        }
        const { title, description, keywords, author, classification_id, is_public, is_html_converted, html_filename, thumbnail_path } = updates;
        const fields = [];
        const params = [];

        if (title !== undefined) { fields.push('title = ?'); params.push(title); }
        if (description !== undefined) { fields.push('description = ?'); params.push(description); }
        if (keywords !== undefined) { fields.push('keywords = ?'); params.push(keywords); }
        if (author !== undefined) { fields.push('author = ?'); params.push(author); }
        if (classification_id !== undefined) { fields.push('classification_id = ?'); params.push(classification_id); }
        if (is_public !== undefined) { fields.push('is_public = ?'); params.push(is_public); }
        if (is_html_converted !== undefined) { fields.push('is_html_converted = ?'); params.push(is_html_converted); }
        if (html_filename !== undefined) { fields.push('html_filename = ?'); params.push(html_filename); }
        if (thumbnail_path !== undefined) { fields.push('thumbnail_path = ?'); params.push(thumbnail_path); }

        if (fields.length === 0) {
            return Promise.resolve({ changes: 0 });
        }

        const sql = `UPDATE documents SET ${fields.join(', ')} WHERE id = ? AND is_deleted = 0`;
        params.push(id);

        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) {
                    console.error('Error in Document.update:', err.message);
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    static async findAllPublic(sortBy = 'upload_date', sortOrder = 'DESC', filters = {}) {
        // 移除 checkDb('findAllPublic');
        if (!db || typeof db.all !== 'function') {
            const errMsg = 'Document.findAllPublic: db 或 db.all 方法不可用。';
            console.error(errMsg);
            // 这个错误应该由调用者（路由）捕获并传递给 next(error)
            return Promise.reject(new Error(errMsg));
        }

        const safeSortOrder = (typeof sortOrder === 'string' && (sortOrder.toUpperCase() === 'ASC' || sortOrder.toUpperCase() === 'DESC')) ? sortOrder.toUpperCase() : 'DESC';
        const validSortColumns = ['upload_date', 'title', 'author'];
        const safeSortBy = (typeof sortBy === 'string' && validSortColumns.includes(sortBy)) ? sortBy : 'upload_date';

        let sql = `
            SELECT d.id, d.title, d.upload_date, d.thumbnail_path, d.html_filename, d.original_filename,
                   c.name as classification_name, d.description, d.keywords, d.author
            FROM documents d
                     LEFT JOIN classifications c ON d.classification_id = c.id
            WHERE d.is_public = 1 AND d.html_filename IS NOT NULL AND d.is_html_converted = 1 AND d.is_deleted = 0
        `;
        const queryParams = [];

        if (filters.classification_id) {
            sql += ' AND d.classification_id = ?';
            queryParams.push(filters.classification_id);
        }
        if (filters.searchTerm) {
            sql += ' AND (d.title LIKE ? OR d.description LIKE ? OR d.keywords LIKE ? OR d.author LIKE ?)';
            const searchTerm = `%${filters.searchTerm}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ` ORDER BY d.${safeSortBy} ${safeSortOrder}`;

        // console.log('[docModel.js -> findAllPublic] SQL:', sql, queryParams);

        return new Promise((resolve, reject) => {
            db.all(sql, queryParams, (err, rows) => {
                if (err) {
                    console.error('[docModel.js -> findAllPublic] Error in db.all callback:', err.message, err);
                    reject(err);
                } else {
                    // console.log('[docModel.js -> findAllPublic] db.all rows:', rows);
                    resolve(rows || []); // 确保在没有行时也返回空数组
                }
            });
        });
    }

    static async findAllAdmin(sortBy = 'upload_date', sortOrder = 'DESC', filters = {}) {
        // 移除 checkDb('findAllAdmin');
        if (!db || typeof db.all !== 'function') {
            const errMsg = 'Document.findAllAdmin: db 或 db.all 方法不可用。';
            console.error(errMsg);
            return Promise.reject(new Error(errMsg));
        }
        const safeSortOrder = (typeof sortOrder === 'string' && (sortOrder.toUpperCase() === 'ASC' || sortOrder.toUpperCase() === 'DESC')) ? sortOrder.toUpperCase() : 'DESC';
        const validSortColumns = ['upload_date', 'title', 'uploader_name', 'classification_name', 'is_public', 'is_html_converted', 'author', 'id'];
        const safeSortBy = (typeof sortBy === 'string' && validSortColumns.includes(sortBy)) ? sortBy : 'upload_date';

        let sql = `
            SELECT d.*, u.username as uploader_name, c.name as classification_name
            FROM documents d
                     JOIN users u ON d.uploader_id = u.id
                     LEFT JOIN classifications c ON d.classification_id = c.id
            WHERE d.is_deleted = 0
        `;
        const queryParams = [];

        if (filters.classification_id) { sql += ' AND d.classification_id = ?'; queryParams.push(filters.classification_id); }
        if (filters.uploader_id) { sql += ' AND d.uploader_id = ?'; queryParams.push(filters.uploader_id); }
        if (filters.is_public !== undefined) { sql += ' AND d.is_public = ?'; queryParams.push(filters.is_public); }
        if (filters.is_html_converted !== undefined) { sql += ' AND d.is_html_converted = ?'; queryParams.push(filters.is_html_converted); }
        if (filters.searchTerm) {
            sql += ' AND (d.title LIKE ? OR d.original_filename LIKE ? OR u.username LIKE ? OR d.keywords LIKE ? OR d.author LIKE ?)';
            const searchTerm = `%${filters.searchTerm}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (safeSortBy === 'uploader_name' || safeSortBy === 'classification_name') {
            sql += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;
        } else {
            sql += ` ORDER BY d.${safeSortBy} ${safeSortOrder}`;
        }
        return new Promise((resolve, reject) => {
            db.all(sql, queryParams, (err, rows) => {
                if (err) { console.error('Error in Document.findAllAdmin:', err.message, err); reject(err); }
                else { resolve(rows || []); }
            });
        });
    }

    static async softDeleteById(id) {
        // 移除 checkDb('softDeleteById');
        if (!db || typeof db.run !== 'function') {
            const errMsg = 'Document.softDeleteById: db 或 db.run 方法不可用。';
            console.error(errMsg);
            throw new Error(errMsg);
        }
        const sql = `UPDATE documents SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?`;
        return new Promise((resolve, reject) => {
            db.run(sql, [id], function (err) {
                if (err) { console.error('Error in Document.softDeleteById:', err.message); reject(err); }
                else { resolve({ changes: this.changes }); }
            });
        });
    }

    static async hardDeleteById(id) {
        // 移除 checkDb('hardDeleteById');
        if (!db || typeof db.run !== 'function') {
            const errMsg = 'Document.hardDeleteById: db 或 db.run 方法不可用。';
            console.error(errMsg);
            throw new Error(errMsg);
        }
        const sql = `DELETE FROM documents WHERE id = ?`;
        return new Promise((resolve, reject) => {
            db.run(sql, [id], function (err) {
                if (err) { console.error('Error in Document.hardDeleteById:', err.message); reject(err); }
                else { resolve({ changes: this.changes }); }
            });
        });
    }

    static async restoreById(id) {
        // 移除 checkDb('restoreById');
        if (!db || typeof db.run !== 'function') {
            const errMsg = 'Document.restoreById: db 或 db.run 方法不可用。';
            console.error(errMsg);
            throw new Error(errMsg);
        }
        const sql = `UPDATE documents SET is_deleted = 0, deleted_at = NULL WHERE id = ? AND is_deleted = 1`;
        return new Promise((resolve, reject) => {
            db.run(sql, [id], function (err) {
                if (err) { console.error('Error in Document.restoreById:', err.message); reject(err); }
                else { resolve({ changes: this.changes }); }
            });
        });
    }

    static async findAllDeleted(sortBy = 'deleted_at', sortOrder = 'DESC') {
        // 移除 checkDb('findAllDeleted');
        if (!db || typeof db.all !== 'function') {
            const errMsg = 'Document.findAllDeleted: db 或 db.all 方法不可用。';
            console.error(errMsg);
            return Promise.reject(new Error(errMsg));
        }
        const safeSortOrder = (typeof sortOrder === 'string' && (sortOrder.toUpperCase() === 'ASC' || sortOrder.toUpperCase() === 'DESC')) ? sortOrder.toUpperCase() : 'DESC';
        const validSortColumns = ['deleted_at', 'title', 'upload_date'];
        const safeSortBy = (typeof sortBy === 'string' && validSortColumns.includes(sortBy)) ? sortBy : 'deleted_at';
        const sql = `
            SELECT d.*, u.username as uploader_name, c.name as classification_name
            FROM documents d
                     JOIN users u ON d.uploader_id = u.id
                     LEFT JOIN classifications c ON d.classification_id = c.id
            WHERE d.is_deleted = 1
            ORDER BY d.${safeSortBy} ${safeSortOrder}
        `;
        return new Promise((resolve, reject) => {
            db.all(sql, [], (err, rows) => {
                if (err) { console.error('Error in Document.findAllDeleted:', err.message); reject(err); }
                else { resolve(rows || []); }
            });
        });
    }

    static async findByStoredFilename(storedFilename) {
        // 移除 checkDb('findByStoredFilename');
        if (!db || typeof db.get !== 'function') {
            const errMsg = 'Document.findByStoredFilename: db 或 db.get 方法不可用。';
            console.error(errMsg);
            throw new Error(errMsg);
        }
        const sql = `SELECT * FROM documents WHERE stored_filename = ? AND is_deleted = 0`;
        return new Promise((resolve, reject) => {
            db.get(sql, [storedFilename], (err, row) => {
                if (err) { console.error('Error in Document.findByStoredFilename:', err.message); reject(err); }
                else { resolve(row); }
            });
        });
    }

    static async updateHtmlConversionStatus(id, htmlFilename, thumbnailPath) {
        // 移除 checkDb('updateHtmlConversionStatus');
        if (!db || typeof db.run !== 'function') {
            const errMsg = 'Document.updateHtmlConversionStatus: db 或 db.run 方法不可用。';
            console.error(errMsg);
            throw new Error(errMsg);
        }
        const sql = `
            UPDATE documents
            SET is_html_converted = 1, html_filename = ?, thumbnail_path = ?
            WHERE id = ?
        `;
        return new Promise((resolve, reject) => {
            db.run(sql, [htmlFilename, thumbnailPath, id], function(err) {
                if (err) { console.error('Error in Document.updateHtmlConversionStatus:', err.message); reject(err); }
                else { resolve({ changes: this.changes }); }
            });
        });
    }

    static async countAllAdmin(filters = {}) {
        // 移除 checkDb('countAllAdmin');
        if (!db || typeof db.get !== 'function') {
            const errMsg = 'Document.countAllAdmin: db 或 db.get 方法不可用。';
            console.error(errMsg);
            return Promise.reject(new Error(errMsg));
        }
        let sql = `
            SELECT COUNT(*) as count
            FROM documents d
                JOIN users u ON d.uploader_id = u.id
                LEFT JOIN classifications c ON d.classification_id = c.id
            WHERE d.is_deleted = 0
        `;
        const queryParams = [];
        if (filters.classification_id) { sql += ' AND d.classification_id = ?'; queryParams.push(filters.classification_id); }
        if (filters.uploader_id) { sql += ' AND d.uploader_id = ?'; queryParams.push(filters.uploader_id); }
        if (filters.is_public !== undefined) { sql += ' AND d.is_public = ?'; queryParams.push(filters.is_public); }
        if (filters.is_html_converted !== undefined) { sql += ' AND d.is_html_converted = ?'; queryParams.push(filters.is_html_converted); }
        if (filters.searchTerm) {
            sql += ' AND (d.title LIKE ? OR d.original_filename LIKE ? OR u.username LIKE ? OR d.keywords LIKE ? OR d.author LIKE ?)';
            const searchTerm = `%${filters.searchTerm}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }
        return new Promise((resolve, reject) => {
            db.get(sql, queryParams, (err, row) => {
                if (err) { console.error('Error in Document.countAllAdmin:', err.message); reject(err); }
                else { resolve(row ? row.count : 0); }
            });
        });
    }

    static async countAllPublic(filters = {}) {
        // 移除 checkDb('countAllPublic');
        if (!db || typeof db.get !== 'function') {
            const errMsg = 'Document.countAllPublic: db 或 db.get 方法不可用。';
            console.error(errMsg);
            return Promise.reject(new Error(errMsg));
        }
        let sql = `
            SELECT COUNT(*) as count
            FROM documents d
                LEFT JOIN classifications c ON d.classification_id = c.id
            WHERE d.is_public = 1 AND d.html_filename IS NOT NULL AND d.is_html_converted = 1 AND d.is_deleted = 0
        `;
        const queryParams = [];
        if (filters.classification_id) { sql += ' AND d.classification_id = ?'; queryParams.push(filters.classification_id); }
        if (filters.searchTerm) {
            sql += ' AND (d.title LIKE ? OR d.description LIKE ? OR d.keywords LIKE ? OR d.author LIKE ?)';
            const searchTerm = `%${filters.searchTerm}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        return new Promise((resolve, reject) => {
            db.get(sql, queryParams, (err, row) => {
                if (err) { console.error('Error in Document.countAllPublic:', err.message); reject(err); }
                else { resolve(row ? row.count : 0); }
            });
        });
    }
}

module.exports = Document;
