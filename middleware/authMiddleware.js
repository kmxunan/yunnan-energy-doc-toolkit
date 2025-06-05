// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const JWT_SECRET = process.env.JWT_SECRET || 'your_very_secret_key_here_12345';

async function isAuthenticated(req, res, next) {
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // 定义公开API路由，这些路由即使没有token也应允许访问（除非特别处理，如/api/auth/me）
    const publicApiRoutes = [
        '/api/documents/public',
        '/api/classifications/public',
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/request-password-reset',
        '/api/auth/reset-password'
        // 注意：/api/auth/me 不是完全公开的，它需要检查token，如果不存在则返回401
    ];

    // 检查是否为公开API路由且不是 /api/auth/me
    const isPublicApiRoute = publicApiRoutes.some(route => req.originalUrl.startsWith(route));

    if (isPublicApiRoute) {
        // 如果是公开API路由，并且有token，则尝试验证，否则直接next()
        if (token) {
            // console.log(`AuthMiddleware: Public API route ${req.originalUrl} with token, attempting verification.`);
        } else {
            // console.log(`AuthMiddleware: Public API route ${req.originalUrl}, no token, proceeding.`);
            return next();
        }
    } else if (!token) { // 对于非以上指定的公开API路由
        // console.log(`AuthMiddleware: No token provided for protected route ${req.originalUrl}`);
        if (req.originalUrl.startsWith('/api/')) { // 包括 /api/auth/me
            return res.status(401).json({ message: '用户未认证或Token无效。' });
        }
        // 对于非API的页面请求，如果需要保护，则应重定向到登录页
        // 但通常isAuthenticated用于API，页面级保护由前端路由或服务器端渲染逻辑处理
        return next(); // 允许继续，但 req.user 将是 undefined
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId || decoded.id); // 兼容 userId 和 id

        if (!user || !user.is_active) {
            // console.log('AuthMiddleware: User not found or not active for token.');
            if (req.originalUrl.startsWith('/api/')) {
                return res.status(401).json({ message: '未授权：用户不存在或账户未激活。' });
            }
            res.clearCookie('token');
            return next();
        }
        req.user = user;
        // console.log('AuthMiddleware: User authenticated:', req.user.username, 'for route:', req.originalUrl);
        next();
    } catch (error) {
        console.error('AuthMiddleware: Token verification failed for', req.originalUrl, 'Error:', error.message);
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(401).json({ message: '未授权：Token无效或已过期。' });
        }
        res.clearCookie('token');
        next();
    }
}

function isAdmin(req, res, next) {
    // console.log('[isAdmin Middleware] Checking user:', req.user ? req.user.username : 'No user', 'Role:', req.user ? req.user.role : 'N/A');
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        // console.log('[isAdmin Middleware] Access Denied. User:', req.user ? req.user.username : 'No user', 'Role:', req.user ? req.user.role : 'N/A');
        res.status(403).json({ message: '禁止访问：此操作需要管理员权限。' });
    }
}

function hasRole(roles) {
    if (!Array.isArray(roles)) {
        roles = [roles]; // 确保 roles 是一个数组
    }
    return (req, res, next) => {
        // console.log('[hasRole Middleware] User:', req.user ? req.user.username : 'No user', 'Required roles:', roles, 'User role:', req.user ? req.user.role : 'N/A');
        if (!req.user) { // isAuthenticated 应该已经处理了这个问题
            return res.status(401).json({ message: '未授权：请先登录。' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: `禁止访问：需要 ${roles.join(' 或 ')} 权限。` });
        }
        next();
    };
}

// console.log('[authMiddleware.js] Exporting: typeof isAuthenticated:', typeof isAuthenticated, '; typeof isAdmin:', typeof isAdmin, '; typeof hasRole:', typeof hasRole);

module.exports = {
    isAuthenticated,
    isAdmin,
    hasRole,
};
