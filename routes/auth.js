// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt =require('jsonwebtoken');
const User = require('../models/userModel');
const PasswordResetToken = require('../models/passwordResetTokenModel');
const crypto = require('crypto');
const mailService = require('../services/mailService');

const authMiddleware = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'your_very_secret_key_here_12345';
const BCRYPT_SALT_ROUNDS = 10;

// 用户注册
router.post('/register', async (req, res, next) => {
    const { username, password, email } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: '用户名和密码是必填项。' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: '密码长度至少为6位。' });
    }
    if (email && !/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ message: '请输入有效的邮箱地址。' });
    }
    try {
        if (!User || typeof User.findByUsername !== 'function') {
            console.error('FATAL: User.findByUsername is not a function in POST /register');
            return next(new Error('用户模型或其方法未正确加载。'));
        }
        const existingUserByUsername = await User.findByUsername(username);
        if (existingUserByUsername) {
            return res.status(409).json({ message: '用户名已存在。' });
        }
        if (email) {
            if (!User || typeof User.findByEmail !== 'function') {
                console.error('FATAL: User.findByEmail is not a function in POST /register');
                return next(new Error('用户模型或其方法未正确加载。'));
            }
            const existingUserByEmail = await User.findByEmail(email);
            if (existingUserByEmail) {
                return res.status(409).json({ message: '邮箱已被注册。' });
            }
        }
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
        const userRole = 'user';
        const newUser = await User.create({
            username, password: hashedPassword, email: email || null,
            role: userRole, is_active: 1
        });
        // 从 newUser（User.create的解析值）中移除密码
        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json({ message: '用户注册成功。', user: userWithoutPassword });
    } catch (error) {
        console.error('注册错误:', error);
        next(error);
    }
});

// 用户登录 (POST /api/auth/login)
router.post('/login', async (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: '用户名和密码是必填项。' });
    }
    try {
        if (!User || typeof User.findByUsername !== 'function') {
            const errMsg = '登录错误: User.findByUsername 不是一个函数 (在路由处理前检查)。';
            console.error(errMsg, 'typeof User:', typeof User);
            return res.status(500).json({ message: '服务器内部错误：用户认证服务配置问题。' });
        }

        const user = await User.findByUsername(username);
        if (!user) {
            // console.log(`[routes/auth.js POST /login] 用户 ${username} 未找到.`);
            return res.status(401).json({ message: '认证失败：用户名或密码错误。' });
        }
        if (!user.is_active) {
            // console.log(`[routes/auth.js POST /login] 用户 ${username} 未激活.`);
            return res.status(403).json({ message: '认证失败：账户未激活或已被锁定。' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            // console.log(`[routes/auth.js POST /login] 用户 ${username} 密码不匹配.`);
            return res.status(401).json({ message: '认证失败：用户名或密码错误。' });
        }
        const tokenPayload = { userId: user.id, username: user.username, role: user.role };
        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
        res.cookie('token', token, {
            httpOnly: true, secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000
        });

        // 从原始的 user 对象（从数据库查询得到）中移除密码字段
        // user 对象应该包含 id, username, role, email, created_at, is_active 等字段
        const { password: _, ...userWithoutPassword } = user;

        // --- 关键日志：检查将要发送的 userWithoutPassword 对象 ---
        // console.log(`[routes/auth.js POST /login] 登录成功，准备发送的用户信息 (userWithoutPassword): id=${userWithoutPassword.id}, username=${userWithoutPassword.username}, role=${userWithoutPassword.role}, email=${userWithoutPassword.email}`);

        res.json({ message: '登录成功。', token, user: userWithoutPassword });
    } catch (error) {
        console.error('登录错误 (catch block):', error);
        next(error);
    }
});

// 获取当前认证用户信息
router.get('/me', authMiddleware.isAuthenticated, (req, res) => {
    if (!req.user) {
        // console.error("[routes/auth.js GET /me] req.user 未定义，即使 isAuthenticated 通过。");
        return res.status(401).json({ message: '用户未认证或Token无效。' });
    }
    // console.log("[routes/auth.js GET /me] 返回用户信息:", req.user.username, "ID:", req.user.id, "Role:", req.user.role);
    const { password, ...userWithoutPassword } = req.user; // req.user 由 isAuthenticated 中间件设置
    res.json(userWithoutPassword);
});

// 用户登出
router.post('/logout', (req, res) => {
    res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.status(200).json({ message: '登出成功。' });
});

// 获取所有用户列表
router.get('/users',
    authMiddleware.isAuthenticated,
    authMiddleware.hasRole(['admin']),
    async (req, res, next) => {
        try {
            if (!User || typeof User.findAll !== 'function') {
                const errMsg = '获取用户列表错误: User.findAll 不是一个函数。';
                console.error(errMsg);
                return next(new Error(errMsg));
            }
            const users = await User.findAll();
            const usersWithoutPasswords = users.map(user => {
                const { password, ...rest } = user;
                return rest;
            });
            res.json(usersWithoutPasswords);
        } catch (error) {
            console.error('获取用户列表错误:', error);
            next(error);
        }
    });

// 更新用户角色
router.put('/users/:id/role',
    authMiddleware.isAuthenticated,
    authMiddleware.isAdmin,
    async (req, res, next) => {
        const { id } = req.params;
        const { role } = req.body;
        if (!role || !['user', 'admin'].includes(role)) {
            return res.status(400).json({ message: '无效的角色。' });
        }
        if (req.user && parseInt(id) === req.user.id && req.user.role === 'admin' && role !== 'admin') {
            return res.status(400).json({ message: '管理员不能降级自己的角色。' });
        }
        try {
            if (!User || typeof User.updateRole !== 'function' || typeof User.findById !== 'function') {
                const errMsg = '更新用户角色错误: User.updateRole 或 User.findById 不是函数。';
                console.error(errMsg);
                return next(new Error(errMsg));
            }
            const result = await User.updateRole(id, role);
            if (result.changes === 0) {
                return res.status(404).json({ message: '用户未找到。' });
            }
            const updatedUser = await User.findById(id);
            const { password, ...userWithoutPassword } = updatedUser;
            res.json({ message: '用户角色更新成功。', user: userWithoutPassword });
        } catch (error) {
            console.error('更新用户角色错误:', error);
            next(error);
        }
    });

// 激活/禁用用户
router.put('/users/:id/status',
    authMiddleware.isAuthenticated,
    authMiddleware.isAdmin,
    async (req, res, next) => {
        const { id } = req.params;
        const { is_active } = req.body;
        if (is_active === undefined || typeof is_active !== 'boolean' && ![0,1,'0','1','true','false'].includes(String(is_active).toLowerCase()) ) {
            return res.status(400).json({ message: '无效的状态值。' });
        }
        if (req.user && parseInt(id) === req.user.id) {
            return res.status(400).json({ message: '管理员不能禁用自己的账户。' });
        }
        const newStatus = (String(is_active).toLowerCase() === 'true' || Number(is_active) === 1);
        try {
            if (!User || typeof User.updateStatus !== 'function' || typeof User.findById !== 'function') {
                const errMsg = '更新用户状态错误: User.updateStatus 或 User.findById 不是函数。';
                console.error(errMsg);
                return next(new Error(errMsg));
            }
            const result = await User.updateStatus(id, newStatus ? 1 : 0);
            if (result.changes === 0) {
                return res.status(404).json({ message: '用户未找到。' });
            }
            const updatedUser = await User.findById(id);
            const { password, ...userWithoutPassword } = updatedUser;
            res.json({ message: `用户账户状态已更新为 ${newStatus ? '激活' : '禁用'}。`, user: userWithoutPassword });
        } catch (error) {
            console.error('更新用户状态错误:', error);
            next(error);
        }
    });

// 请求密码重置
router.post('/request-password-reset', async (req, res, next) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: '邮箱地址是必填项。' });
    }
    try {
        if (!User || typeof User.findByEmail !== 'function' ||
            !PasswordResetToken || typeof PasswordResetToken.create !== 'function' ||
            !mailService || typeof mailService.sendPasswordResetEmail !== 'function') {
            const errMsg = '请求密码重置错误: 依赖模块或方法未正确加载。';
            console.error(errMsg);
            return next(new Error(errMsg));
        }
        const user = await User.findByEmail(email);
        if (!user) {
            // console.log(`Password reset request for non-existent email: ${email}`);
            return res.status(200).json({ message: '如果该邮箱已注册，密码重置链接已发送。' });
        }
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000);
        await PasswordResetToken.create(user.id, token, expiresAt);
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
        await mailService.sendPasswordResetEmail(user.email, user.username, resetLink);
        res.status(200).json({ message: '如果该邮箱已注册，密码重置链接已发送。' });
    } catch (error) {
        console.error('请求密码重置错误:', error);
        next(error);
    }
});

// 重置密码
router.post('/reset-password', async (req, res, next) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token 和新密码是必填项。' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: '新密码长度至少为6位。' });
    }
    try {
        if (!PasswordResetToken || typeof PasswordResetToken.findByToken !== 'function' || typeof PasswordResetToken.delete !== 'function' ||
            !User || typeof User.updatePassword !== 'function') {
            const errMsg = '重置密码错误: 依赖模块或方法未正确加载。';
            console.error(errMsg);
            return next(new Error(errMsg));
        }
        const resetToken = await PasswordResetToken.findByToken(token);
        if (!resetToken || new Date() > new Date(resetToken.expires_at)) {
            if(resetToken) await PasswordResetToken.delete(token);
            return res.status(400).json({ message: '无效或已过期的密码重置Token。请重新请求。' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
        await User.updatePassword(resetToken.user_id, hashedPassword);
        await PasswordResetToken.delete(token);
        res.status(200).json({ message: '密码已成功重置。请使用新密码登录。' });
    } catch (error) {
        console.error('重置密码错误:', error);
        next(error);
    }
});

module.exports = router;
