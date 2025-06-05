// models/userModel.js
const { db } = require('../database/setup'); // 使用解构赋值获取db实例
const bcrypt = require('bcrypt');
const BCRYPT_SALT_ROUNDS = 10;

// 模块加载时进行诊断，确保db对象及其方法可用
if (!db || typeof db.get !== 'function' || typeof db.run !== 'function' || typeof db.all !== 'function') {
    const errorMessage = '[userModel.js] 致命错误: 数据库对象 (db) 或其核心方法 (get, run, all) 未从 databaseSetup 正确导入或未定义!';
    console.error(errorMessage, 'typeof db:', typeof db);
    // 如果db无效，抛出错误以阻止应用以潜在错误状态启动
    // 注意：这可能会使应用在某些测试或构建环境中崩溃，如果db此时尚未完全初始化。
    // 但对于运行时，这是必要的检查。
    // throw new Error(errorMessage);
}

class User {
    static async create(userData) {
        if (!db || typeof db.run !== 'function') throw new Error('User.create: 数据库连接或方法不可用。');
        const { username, password, email, role = 'user', is_active = 1 } = userData;
        const sql = `INSERT INTO users (username, password, email, role, is_active) VALUES (?, ?, ?, ?, ?)`;
        return new Promise((resolve, reject) => {
            db.run(sql, [username, password, email, role, is_active], function (err) {
                if (err) {
                    console.error('Error in User.create:', err.message);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, username, email, role, is_active });
                }
            });
        });
    }

    static async findByUsername(username) {
        if (!db || typeof db.get !== 'function') {
            const errMsg = 'User.findByUsername: 数据库连接或 get 方法不可用。';
            console.error(errMsg, '(typeof db:', typeof db, ')');
            return Promise.reject(new Error(errMsg));
        }
        // console.log(`[userModel.js] Attempting to find user by username: ${username}`);
        const sql = `SELECT * FROM users WHERE username = ?`;
        return new Promise((resolve, reject) => {
            db.get(sql, [username], (err, row) => {
                if (err) {
                    console.error(`Error in User.findByUsername for ${username}:`, err.message);
                    reject(err);
                } else {
                    // console.log(`[userModel.js] User.findByUsername result for ${username}:`, row ? 'User found' : 'User not found');
                    resolve(row);
                }
            });
        });
    }

    static async findById(id) {
        if (!db || typeof db.get !== 'function') throw new Error('User.findById: 数据库连接或 get 方法不可用。');
        const sql = `SELECT id, username, email, role, created_at, is_active, failed_login_attempts, lockout_until FROM users WHERE id = ?`;
        return new Promise((resolve, reject) => {
            db.get(sql, [id], (err, row) => {
                if (err) { console.error('Error in User.findById:', err.message); reject(err); }
                else { resolve(row); }
            });
        });
    }

    static async findByEmail(email) {
        if (!db || typeof db.get !== 'function') throw new Error('User.findByEmail: 数据库连接或 get 方法不可用。');
        const sql = `SELECT * FROM users WHERE email = ?`;
        return new Promise((resolve, reject) => {
            db.get(sql, [email], (err, row) => {
                if (err) { console.error('Error in User.findByEmail:', err.message); reject(err); }
                else { resolve(row); }
            });
        });
    }

    static async updatePassword(userId, newPassword) {
        if (!db || typeof db.run !== 'function') throw new Error('User.updatePassword: 数据库连接或 run 方法不可用。');
        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
        const sql = `UPDATE users SET password = ? WHERE id = ?`;
        return new Promise((resolve, reject) => {
            db.run(sql, [hashedPassword, userId], function(err) {
                if (err) { console.error('Error in User.updatePassword:', err.message); reject(err); }
                else { resolve({ changes: this.changes }); }
            });
        });
    }

    static async findAll() {
        if (!db || typeof db.all !== 'function') throw new Error('User.findAll: 数据库连接或 all 方法不可用。');
        const sql = `SELECT id, username, email, role, created_at, is_active, failed_login_attempts, lockout_until FROM users ORDER BY username`;
        return new Promise((resolve, reject) => {
            db.all(sql, [], (err, rows) => {
                if (err) { console.error('Error in User.findAll:', err.message); reject(err); }
                else { resolve(rows || []); }
            });
        });
    }

    static async updateRole(userId, newRole) {
        if (!db || typeof db.run !== 'function') throw new Error('User.updateRole: 数据库连接或 run 方法不可用。');
        const sql = `UPDATE users SET role = ? WHERE id = ?`;
        return new Promise((resolve, reject) => {
            db.run(sql, [newRole, userId], function(err) {
                if (err) { console.error('Error in User.updateRole:', err.message); reject(err); }
                else { resolve({ changes: this.changes }); }
            });
        });
    }

    static async updateStatus(userId, isActive) {
        if (!db || typeof db.run !== 'function') throw new Error('User.updateStatus: 数据库连接或 run 方法不可用。');
        const statusValue = isActive ? 1 : 0;
        const sql = `UPDATE users SET is_active = ? WHERE id = ?`;
        return new Promise((resolve, reject) => {
            db.run(sql, [statusValue, userId], function(err) {
                if (err) { console.error('Error in User.updateStatus:', err.message); reject(err); }
                else { resolve({ changes: this.changes }); }
            });
        });
    }

    static async incrementFailedLoginAttempts(userId) {
        if (!db || typeof db.run !== 'function') throw new Error('User.incrementFailedLoginAttempts: 数据库连接或 run 方法不可用。');
        const sql = `UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?`;
        return new Promise((resolve, reject) => {
            db.run(sql, [userId], function (err) {
                if (err) reject(err); else resolve({ changes: this.changes });
            });
        });
    }

    static async resetFailedLoginAttempts(userId) {
        if (!db || typeof db.run !== 'function') throw new Error('User.resetFailedLoginAttempts: 数据库连接或 run 方法不可用。');
        const sql = `UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?`;
        return new Promise((resolve, reject) => {
            db.run(sql, [userId], function (err) {
                if (err) reject(err); else resolve({ changes: this.changes });
            });
        });
    }

    static async lockAccount(userId, lockoutDurationMinutes = 15) {
        if (!db || typeof db.run !== 'function') throw new Error('User.lockAccount: 数据库连接或 run 方法不可用。');
        const lockoutUntil = new Date(Date.now() + lockoutDurationMinutes * 60000).toISOString();
        const sql = `UPDATE users SET lockout_until = ? WHERE id = ?`;
        return new Promise((resolve, reject) => {
            db.run(sql, [lockoutUntil, userId], function (err) {
                if (err) reject(err); else resolve({ changes: this.changes });
            });
        });
    }
}

module.exports = User;
