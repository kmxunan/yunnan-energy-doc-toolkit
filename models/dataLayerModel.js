const db = require('../database/setup');
const DataLayer = {
    getAll: (callback) => {
        // Returns all fields for now, client can decide what to use.
        db.all('SELECT * FROM data_layers ORDER BY layer_name ASC', [], callback);
    },
    findById: (id, callback) => {
        db.get('SELECT * FROM data_layers WHERE id = ?', [id], callback);
    }
};
module.exports = DataLayer;
