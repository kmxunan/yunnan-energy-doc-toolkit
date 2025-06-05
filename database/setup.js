// database/setup.js
console.log('[db setup v3.1] 文件开始加载...'); // 新增日志

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'main.db');
// console.log(`[db setup v3.1] 数据库文件路径: ${dbPath}`);

let dbConnectionError = null;
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        dbConnectionError = err; // Store error to be checked later
        console.error('[db setup v3.1] 关键错误: 连接到 SQLite 数据库失败:', err.message);
        // throw err; // Avoid throwing here as it might be too early for www to catch
    } else {
        // console.log('[db setup v3.1] 成功连接到 SQLite 数据库 (main.db) 实例已创建。');
    }
});

const BCRYPT_SALT_ROUNDS = 10;

const createTablesQueries = [
    { name: 'users', query: `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, email TEXT UNIQUE, role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, is_active INTEGER DEFAULT 1, failed_login_attempts INTEGER DEFAULT 0, lockout_until DATETIME);`},
    { name: 'classifications', query: `CREATE TABLE IF NOT EXISTS classifications (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`},
    { name: 'documents', query: `CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, keywords TEXT, author TEXT, uploader_id INTEGER NOT NULL, classification_id INTEGER, original_filename TEXT NOT NULL, stored_filename TEXT UNIQUE NOT NULL, file_type TEXT, file_size INTEGER, upload_date DATETIME DEFAULT CURRENT_TIMESTAMP, last_modified_date DATETIME DEFAULT CURRENT_TIMESTAMP, is_public INTEGER DEFAULT 0, is_html_converted INTEGER DEFAULT 0, html_filename TEXT, thumbnail_path TEXT, is_deleted INTEGER DEFAULT 0, deleted_at DATETIME, FOREIGN KEY (uploader_id) REFERENCES users (id), FOREIGN KEY (classification_id) REFERENCES classifications (id) ON DELETE SET NULL);`},
    { name: 'economic_scenarios', query: `CREATE TABLE IF NOT EXISTS economic_scenarios (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, project_id INTEGER, user_id INTEGER, description TEXT, parameters TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id));`},
    { name: 'password_reset_tokens', query: `CREATE TABLE IF NOT EXISTS password_reset_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);`},
    { name: 'site_selection_projects', query: `CREATE TABLE IF NOT EXISTS site_selection_projects (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, project_name TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'pending', parameters TEXT, result_summary TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);`},
    { name: 'data_layers', query: `CREATE TABLE IF NOT EXISTS data_layers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, type TEXT NOT NULL, source_info TEXT, description TEXT, category TEXT, user_uploaded INTEGER DEFAULT 0, user_id INTEGER, style_config TEXT, is_public INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL);`},
    { name: 'candidate_sites', query: `CREATE TABLE IF NOT EXISTS candidate_sites (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, site_name TEXT, geojson_geometry TEXT NOT NULL, suitability_score REAL, ranking INTEGER, details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (project_id) REFERENCES site_selection_projects(id) ON DELETE CASCADE);`}
];

function initializeDatabase() {
    // console.log("[db setup v3.1] 调用 initializeDatabase 函数...");
    return new Promise((resolve, reject) => {
        if (dbConnectionError) {
            console.error("[db setup v3.1] 数据库连接已失败，无法初始化表。");
            return reject(dbConnectionError);
        }
        // console.log("[db setup v3.1] initializeDatabase Promise 开始执行。");
        db.serialize(() => {
            // console.log("[db setup v3.1] 进入 db.serialize 回调。");
            db.run("BEGIN TRANSACTION;", (err) => {
                if (err) {
                    console.error("[db setup v3.1] 开始事务失败:", err.message);
                    return reject(err);
                }
                // console.log("[db setup v3.1] 事务已开始。");
            });

            let completedQueries = 0;
            const totalQueries = createTablesQueries.length;
            let queryHasFailed = false;

            createTablesQueries.forEach((table, index) => {
                if (queryHasFailed) return; // 如果之前的查询已失败，则不继续
                // console.log(`[db setup v3.1] 准备创建/检查表: ${table.name} (Query ${index + 1}/${totalQueries})`);
                db.run(table.query, function(errRun) {
                    if (queryHasFailed) return; // 再次检查，以防在异步回调中状态改变
                    if (errRun) {
                        queryHasFailed = true;
                        console.error(`[db setup v3.1] 创建表 '${table.name}' 失败:`, errRun.message);
                        db.run("ROLLBACK;", (rollbackErr) => {
                            if (rollbackErr) console.error("[db setup v3.1] 回滚事务失败:", rollbackErr.message);
                            else console.log("[db setup v3.1] 事务已因错误回滚。");
                            reject(errRun); // 拒绝主Promise
                        });
                        return;
                    }
                    // console.log(`[db setup v3.1] 表 '${table.name}' 已检查/创建成功。`);
                    completedQueries++;
                    // console.log(`[db setup v3.1] 已完成查询: ${completedQueries}/${totalQueries}`);
                    if (completedQueries === totalQueries) {
                        // console.log("[db setup v3.1] 所有表结构创建/检查完毕。准备插入默认数据...");
                        insertDefaultData().then(() => {
                            // console.log("[db setup v3.1] 默认数据插入完成。准备提交事务...");
                            db.run("COMMIT;", (errCommit) => {
                                if (errCommit) {
                                    console.error("[db setup v3.1] 提交事务失败:", errCommit.message);
                                    return reject(errCommit);
                                }
                                // console.log("[db setup v3.1] 数据库表结构初始化完成，事务已提交。");
                                resolve();
                            });
                        }).catch(defaultDataErr => {
                            queryHasFailed = true; // 标记失败
                            console.error("[db setup v3.1] 插入默认数据时出错:", defaultDataErr);
                            db.run("ROLLBACK;", (rollbackErrOnDefaultData) => {
                                if (rollbackErrOnDefaultData) console.error("[db setup v3.1] 因默认数据错误导致的回滚事务失败:", rollbackErrOnDefaultData.message);
                                else console.log("[db setup v3.1] 事务已因默认数据错误回滚。");
                                reject(defaultDataErr);
                            });
                        });
                    }
                });
            });
        });
    });
}

async function insertDefaultData() {
    // console.log("[db setup v3.1] 开始 insertDefaultData 函数...");
    try {
        const adminUser = await new Promise((resolve, reject) => {
            db.get("SELECT id FROM users WHERE username = 'admin'", (err, row) => {
                if (err) { /* console.error("[db setup v3.1] 检查admin用户时出错:", err); */ reject(err); }
                else resolve(row);
            });
        });

        if (!adminUser) {
            const hashedPassword = await bcrypt.hash('adminpassword', BCRYPT_SALT_ROUNDS);
            await new Promise((resolve, reject) => {
                db.run("INSERT INTO users (username, password, email, role, is_active) VALUES (?, ?, ?, ?, ?)",
                    ['admin', hashedPassword, 'admin@example.com', 'admin', 1],
                    function(err) {
                        if (err) {
                            console.error("[db setup v3.1] 插入默认管理员用户失败:", err.message);
                            reject(err);
                        } else {
                            // console.log("[db setup v3.1] 默认管理员用户 'admin' 已创建 (ID: " + this.lastID + ").");
                            resolve();
                        }
                    }
                );
            });
        } else {
            // console.log("[db setup v3.1] 默认管理员用户 'admin' 已存在。");
        }
    } catch (err) {
        console.error("[db setup v3.1] 处理默认管理员用户时发生异常:", err.message);
        throw err; // 重新抛出错误以确保 initializeDatabase 的 catch 能捕获
    }

    try {
        const defaultLayers = [
            { name: '云南省电网 (示例)', type: 'geojson', source_info: 'data/sample_grid.geojson', description: '云南省主要输电网络（示例数据）', category: '电网数据', is_public: 1 },
            { name: '生态保护红线 (示例)', type: 'geojson', source_info: 'data/sample_eco_redline.geojson', description: '云南省生态保护红线区域（示例数据）', category: '生态保护', is_public: 1 },
            { name: 'OpenStreetMap 瓦片图层', type: 'vector_tile_url', source_info: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', description: 'OpenStreetMap 标准瓦片图层', category: '基础底图', is_public: 1, style_config: JSON.stringify({ "type": "raster", "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], "tileSize": 256, "attribution": "© OpenStreetMap contributors" }) }
        ];

        for (const layer of defaultLayers) {
            const layerExists = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM data_layers WHERE name = ?", [layer.name], (err, row) => {
                    if (err) reject(err); else resolve(row);
                });
            });
            if (!layerExists) {
                await new Promise((resolve, reject) => {
                    db.run("INSERT INTO data_layers (name, type, source_info, description, category, is_public, style_config) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [layer.name, layer.type, layer.source_info, layer.description, layer.category, layer.is_public, layer.style_config || null],
                        function(err) {
                            if (err) {
                                console.error(`[db setup v3.1] 插入示例图层 '${layer.name}' 失败:`, err.message);
                                reject(err);
                            } else {
                                // console.log(`[db setup v3.1] 示例图层 '${layer.name}' 已插入。`);
                                resolve();
                            }
                        }
                    );
                });
            }
        }
        // console.log("[db setup v3.1] 默认图层数据检查/插入完成。");
    } catch (err) {
        console.error("[db setup v3.1] 处理默认图层数据时发生异常:", err.message);
        throw err; // 重新抛出错误
    }
    // console.log("[db setup v3.1] 默认数据插入流程成功结束。");
}


module.exports = {
    db,
    initializeDatabase
};
