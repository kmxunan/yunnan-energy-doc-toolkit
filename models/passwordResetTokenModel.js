// models/passwordResetTokenModel.js
const db = require('../database/setup');

const PasswordResetToken = {
    create: (userId, token, expiresAt, callback) => {
        const sql = 'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)';
        db.run(sql, [userId, token, expiresAt], function(err) {
            if (err) return callback(err);
            callback(null, { id: this.lastID });
        });
    },
    findByToken: (token, callback) => {
        const sql = 'SELECT * FROM password_reset_tokens WHERE token = ?';
        db.get(sql, [token], callback);
    },
    deleteByToken: (token, callback) => {
        const sql = 'DELETE FROM password_reset_tokens WHERE token = ?';
        db.run(sql, [token], function(err) {
            callback(err, { changes: this.changes });
        });
    },
    deleteByUserId: (userId, callback) => { // Useful for cleaning up tokens after a successful password change
        const sql = 'DELETE FROM password_reset_tokens WHERE user_id = ?';
        db.run(sql, [userId], function(err) {
            callback(err, { changes: this.changes });
        });
    }
};
module.exports = PasswordResetToken;
