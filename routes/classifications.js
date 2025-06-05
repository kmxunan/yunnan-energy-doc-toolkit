// routes/classifications.js
const express = require('express');
const router = express.Router();
const Classification = require('../models/classificationModel');
const authMiddleware = require('../middleware/authMiddleware');

// 诊断日志
// console.log('[routes/classifications.js] 模块加载时: typeof authMiddleware:', typeof authMiddleware);
// if (authMiddleware) {
//   console.log('[routes/classifications.js] typeof authMiddleware.isAuthenticated:', typeof authMiddleware.isAuthenticated);
//   console.log('[routes/classifications.js] typeof authMiddleware.isAdmin:', typeof authMiddleware.isAdmin);
// } else {
//   console.error('[routes/classifications.js] 致命错误: authMiddleware 模块未加载!');
// }

// GET all classifications (for admin purposes, requires authentication)
router.get('/',
    (req, res, next) => {
        if (typeof authMiddleware.isAuthenticated !== 'function') {
            console.error('FATAL: authMiddleware.isAuthenticated is not a function in GET /');
            return next(new Error('认证中间件 (isAuthenticated) 未正确加载。'));
        }
        authMiddleware.isAuthenticated(req, res, next);
    },
    async (req, res, next) => {
        try {
            const classifications = await Classification.getAll();
            // console.log('[routes/classifications.js -> / (admin)] Classifications from model:', classifications); // 关键日志
            if (!Array.isArray(classifications)) {
                console.error('[routes/classifications.js -> / (admin)] getAll did not return an array. Got:', typeof classifications, classifications);
                return res.status(500).json({ message: '获取分类列表时服务器内部格式错误。' });
            }
            res.json(classifications);
        } catch (error) {
            console.error('Error fetching classifications (admin):', error);
            if (!error.status) error.status = 500;
            if (!error.message) error.message = '获取分类列表时出错。';
            next(error);
        }
    });

// GET all classifications (for public display, no authentication needed)
router.get('/public', async (req, res, next) => {
    try {
        const classifications = await Classification.getAll();
        // console.log('[routes/classifications.js -> /public] Classifications from model:', classifications); // 关键日志
        if (!Array.isArray(classifications)) {
            console.error('[routes/classifications.js -> /public] getAll did not return an array. Got:', typeof classifications, classifications);
            return res.status(500).json({ message: '获取公开分类列表时服务器内部格式错误。' });
        }
        res.json(classifications);
    } catch (error) {
        console.error('Error fetching public classifications:', error);
        if (!error.status) error.status = 500;
        if (!error.message) error.message = '获取公开分类列表时出错。';
        next(error);
    }
});

// POST a new classification (admin only)
router.post('/',
    (req, res, next) => {
        if (typeof authMiddleware.isAuthenticated !== 'function') return next(new Error('FATAL: isAuthenticated is not a function in POST /'));
        authMiddleware.isAuthenticated(req, res, next);
    },
    (req, res, next) => {
        if (typeof authMiddleware.isAdmin !== 'function') return next(new Error('FATAL: isAdmin is not a function in POST /'));
        authMiddleware.isAdmin(req, res, next);
    },
    async (req, res, next) => {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ message: '分类名称是必填项。' });
        }
        try {
            const newClassification = await Classification.create(name, description);
            res.status(201).json(newClassification);
        } catch (error) {
            console.error('Error creating classification:', error);
            if (error.message && error.message.includes('UNIQUE constraint failed')) {
                error.status = 409;
                error.message = `分类名称 "${name}" 已存在。`;
            } else {
                if (!error.status) error.status = 500;
                if (!error.message) error.message = '创建分类时出错。';
            }
            next(error);
        }
    });

// PUT to update a classification (admin only)
router.put('/:id',
    (req, res, next) => {
        if (typeof authMiddleware.isAuthenticated !== 'function') return next(new Error('FATAL: isAuthenticated is not a function in PUT /:id'));
        authMiddleware.isAuthenticated(req, res, next);
    },
    (req, res, next) => {
        if (typeof authMiddleware.isAdmin !== 'function') return next(new Error('FATAL: isAdmin is not a function in PUT /:id'));
        authMiddleware.isAdmin(req, res, next);
    },
    async (req, res, next) => {
        const { id } = req.params;
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ message: '分类名称是必填项。' });
        }
        try {
            const result = await Classification.update(id, name, description);
            if (result.changes === 0) {
                return res.status(404).json({ message: '未找到要更新的分类。' });
            }
            res.json({ id: parseInt(id), name, description, message: '分类已成功更新。' });
        } catch (error) {
            console.error(`Error updating classification ${id}:`, error);
            if (error.message && error.message.includes('UNIQUE constraint failed')) {
                error.status = 409;
                error.message = `分类名称 "${name}" 已存在。`;
            } else {
                if (!error.status) error.status = 500;
                if (!error.message) error.message = '更新分类时出错。';
            }
            next(error);
        }
    });

// DELETE a classification (admin only)
router.delete('/:id',
    (req, res, next) => {
        if (typeof authMiddleware.isAuthenticated !== 'function') return next(new Error('FATAL: isAuthenticated is not a function in DELETE /:id'));
        authMiddleware.isAuthenticated(req, res, next);
    },
    (req, res, next) => {
        if (typeof authMiddleware.isAdmin !== 'function') return next(new Error('FATAL: isAdmin is not a function in DELETE /:id'));
        authMiddleware.isAdmin(req, res, next);
    },
    async (req, res, next) => {
        const { id } = req.params;
        try {
            const result = await Classification.delete(id);
            if (result.changes === 0) {
                return res.status(404).json({ message: result.message || '未找到要删除的分类或无法删除。' });
            }
            res.status(200).json({ message: '分类已成功删除。' });
        } catch (error) {
            console.error(`Error deleting classification ${id}:`, error);
            if (error.message && error.message.startsWith('无法删除分类')) {
                error.status = 409;
            } else {
                if (!error.status) error.status = 500;
                if (!error.message) error.message = '删除分类时出错。';
            }
            next(error);
        }
    });

module.exports = router;
