// models/classificationModel.js
const { db } = require('../database/setup'); // 确保从正确的路径导入db实例

class Classification {
    // 创建新分类
    static async create(name, description = '') {
        const sql = `INSERT INTO classifications (name, description) VALUES (?, ?)`;
        return new Promise((resolve, reject) => {
            db.run(sql, [name, description], function (err) {
                if (err) {
                    console.error('Error in Classification.create:', err.message);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, name, description });
                }
            });
        });
    }

    // 根据ID查找分类
    static async findById(id) {
        const sql = `SELECT * FROM classifications WHERE id = ?`;
        return new Promise((resolve, reject) => {
            db.get(sql, [id], (err, row) => {
                if (err) {
                    console.error('Error in Classification.findById:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // 查找所有分类
    static async getAll() {
        const sql = `SELECT * FROM classifications ORDER BY name`;
        return new Promise((resolve, reject) => {
            // **** 错误修复：确保 db 对象上有 all 方法 ****
            // 原日志显示 "db.all is not a function"。
            // 这通常意味着 db 没有被正确初始化或者导入方式有误。
            // 确保 const { db } = require('../database/setup'); 正确导入了数据库实例。
            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error in Classification.getAll:', err.message, err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // 更新分类信息
    static async update(id, name, description) {
        const sql = `UPDATE classifications SET name = ?, description = ? WHERE id = ?`;
        return new Promise((resolve, reject) => {
            db.run(sql, [name, description, id], function (err) {
                if (err) {
                    console.error('Error in Classification.update:', err.message);
                    reject(err);
                } else {
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    // 删除分类
    static async delete(id) {
        // 首先检查是否有文档关联到此分类
        const checkSql = `SELECT COUNT(*) as count FROM documents WHERE classification_id = ? AND is_deleted = 0`;
        return new Promise((resolve, reject) => {
            db.get(checkSql, [id], (err, row) => {
                if (err) {
                    console.error('Error checking documents for classification before delete:', err.message);
                    return reject(err);
                }
                if (row && row.count > 0) {
                    return reject(new Error(`无法删除分类，因为仍有 ${row.count} 个文档属于此分类。`));
                }

                // 如果没有文档关联，则执行删除
                const deleteSql = `DELETE FROM classifications WHERE id = ?`;
                db.run(deleteSql, [id], function (err) {
                    if (err) {
                        console.error('Error in Classification.delete:', err.message);
                        reject(err);
                    } else {
                        if (this.changes === 0) {
                            // 可能分类ID不存在
                            resolve({ changes: 0, message: '未找到要删除的分类或已被删除。' });
                        } else {
                            resolve({ changes: this.changes, message: '分类已成功删除。' });
                        }
                    }
                });
            });
        });
    }
}

module.exports = Classification;
