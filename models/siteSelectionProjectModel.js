const db = require('../database/setup');
const SiteSelectionProject = {
    create: (data, callback) => {
        const { user_id, project_name, description, base_map_settings_json } = data;
        const sql = 'INSERT INTO site_selection_projects (user_id, project_name, description, base_map_settings_json) VALUES (?, ?, ?, ?)';
        db.run(sql, [user_id, project_name, description, base_map_settings_json], function(err) {
            if (err) return callback(err);
            callback(null, { id: this.lastID, ...data });
        });
    },
    findByUserId: (userId, callback) => {
        db.all('SELECT * FROM site_selection_projects WHERE user_id = ? ORDER BY created_at DESC', [userId], callback);
    },
    findById: (id, userId, callback) => { // Ensure user owns the project
        db.get('SELECT * FROM site_selection_projects WHERE id = ? AND user_id = ?', [id, userId], callback);
    },
    update: (id, userId, data, callback) => {
        const { project_name, description, base_map_settings_json } = data;
        // As per plan, updated_at is not in the schema for now.
        const updateSql = 'UPDATE site_selection_projects SET project_name = ?, description = ?, base_map_settings_json = ? WHERE id = ? AND user_id = ?';
        db.run(updateSql, [project_name, description, base_map_settings_json, id, userId], function(err) {
            callback(err, { changes: this.changes });
        });
    },
    delete: (id, userId, callback) => {
        db.run('DELETE FROM site_selection_projects WHERE id = ? AND user_id = ?', [id, userId], function(err) {
            callback(err, { changes: this.changes });
        });
    }
};
module.exports = SiteSelectionProject;
