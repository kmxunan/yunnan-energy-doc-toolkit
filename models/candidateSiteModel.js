const db = require('../database/setup');

const CandidateSite = {
    create: (data, callback) => {
        const { project_id, site_name, location_geometry_geojson, notes_json, analysis_criteria_snapshot_json } = data;
        // suitability_score is initially null or not provided by user
        const sql = `INSERT INTO candidate_sites
                     (project_id, site_name, location_geometry_geojson, notes_json, analysis_criteria_snapshot_json, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        db.run(sql, [project_id, site_name, location_geometry_geojson, notes_json, analysis_criteria_snapshot_json], function(err) {
            if (err) return callback(err);
            callback(null, { id: this.lastID, ...data });
        });
    },
    findByProjectId: (projectId, callback) => {
        db.all('SELECT * FROM candidate_sites WHERE project_id = ? ORDER BY created_at DESC', [projectId], callback);
    },
    findById: (id, projectId, callback) => { // Ensure site belongs to the project
        db.get('SELECT * FROM candidate_sites WHERE id = ? AND project_id = ?', [id, projectId], callback);
    },
    update: (id, projectId, data, callback) => {
        const { site_name, location_geometry_geojson, suitability_score, notes_json, analysis_criteria_snapshot_json } = data;
        const sql = `UPDATE candidate_sites SET
                     site_name = ?,
                     location_geometry_geojson = ?,
                     suitability_score = ?,
                     notes_json = ?,
                     analysis_criteria_snapshot_json = ?,
                     updated_at = CURRENT_TIMESTAMP
                     WHERE id = ? AND project_id = ?`;
        db.run(sql, [site_name, location_geometry_geojson, suitability_score, notes_json, analysis_criteria_snapshot_json, id, projectId], function(err) {
            callback(err, { changes: this.changes });
        });
    },
    delete: (id, projectId, callback) => {
        db.run('DELETE FROM candidate_sites WHERE id = ? AND project_id = ?', [id, projectId], function(err) {
            callback(err, { changes: this.changes });
        });
    }
    // Add updateScore(id, projectId, score, criteriaSnapshot, callback) later if needed for specific score updates
};
module.exports = CandidateSite;
