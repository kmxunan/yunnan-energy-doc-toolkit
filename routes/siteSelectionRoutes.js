const express = require('express');
const router = express.Router();
const SiteSelectionProject = require('../models/siteSelectionProjectModel');
const DataLayer = require('../models/dataLayerModel');
const CandidateSite = require('../models/candidateSiteModel'); // New require
const { isAuthenticated } = require('../middleware/authMiddleware');

// Middleware to check project ownership (add this towards the top of the file)
async function checkProjectOwnership(req, res, next) {
    const projectId = parseInt(req.params.projectId, 10); // Ensure this matches the route param name
    if (isNaN(projectId)) {
        return res.status(400).json({ message: "无效的项目ID格式。" });
    }
    SiteSelectionProject.findById(projectId, req.session.user.id, (err, project) => {
        if (err) {
            console.error(`验证项目 ${projectId} 所有权出错:`, err);
            return res.status(500).json({ message: "验证项目所有权时出错。" });
        }
        if (!project) {
            return res.status(403).json({ message: "项目未找到或您无权访问此项目。" }); // 403 Forbidden
        }
        req.project = project; // Attach project to request object
        next();
    });
}

// === Site Selection Projects ===
// POST /api/toolkit/site-selection/projects - Create a new project
router.post('/projects', isAuthenticated, (req, res) => {
    const { project_name, description, base_map_settings_json } = req.body;
    const user_id = req.session.user.id;
    if (!project_name) {
        return res.status(400).json({ message: '项目名称 (project_name) 不能为空。' });
    }
    SiteSelectionProject.create({ user_id, project_name, description, base_map_settings_json }, (err, project) => {
        if (err) {
            console.error("创建选址项目失败:", err);
            return res.status(500).json({ message: '创建选址项目失败。' });
        }
        res.status(201).json(project);
    });
});


// === Candidate Sites ===
// Base path for these routes: /api/toolkit/site-selection/projects/:projectId/sites

// POST /projects/:projectId/sites - Create a candidate site
router.post('/projects/:projectId/sites', isAuthenticated, checkProjectOwnership, (req, res) => {
    const { site_name, location_geometry_geojson, notes_json, analysis_criteria_snapshot_json } = req.body;
    const project_id = req.project.id; // From checkProjectOwnership middleware

    if (!site_name || !location_geometry_geojson) {
        return res.status(400).json({ message: '站点名称 (site_name) 和位置几何 (location_geometry_geojson) 不能为空。' });
    }
    try { JSON.parse(location_geometry_geojson); } catch (e) { return res.status(400).json({message: '位置几何 (location_geometry_geojson) 不是有效的JSON。'}); }
    if (notes_json) { try { JSON.parse(notes_json); } catch (e) { return res.status(400).json({message: '备注 (notes_json) 不是有效的JSON。'}); } }
    if (analysis_criteria_snapshot_json) { try { JSON.parse(analysis_criteria_snapshot_json); } catch (e) { return res.status(400).json({message: '分析快照 (analysis_criteria_snapshot_json) 不是有效的JSON。'}); } }

    CandidateSite.create({ project_id, site_name, location_geometry_geojson, notes_json, analysis_criteria_snapshot_json }, (err, site) => {
        if (err) {
            console.error(`为项目 ${project_id} 创建候选站点失败:`, err);
            return res.status(500).json({ message: '创建候选站点失败。' });
        }
        res.status(201).json(site);
    });
});

// GET /projects/:projectId/sites - List candidate sites for a project
router.get('/projects/:projectId/sites', isAuthenticated, checkProjectOwnership, (req, res) => {
    CandidateSite.findByProjectId(req.project.id, (err, sites) => {
        if (err) {
            console.error(`获取项目 ${req.project.id} 的候选站点列表失败:`, err);
            return res.status(500).json({ message: '获取候选站点列表失败。' });
        }
        res.status(200).json(sites);
    });
});

// GET /projects/:projectId/sites/:siteId - Get a specific candidate site
router.get('/projects/:projectId/sites/:siteId', isAuthenticated, checkProjectOwnership, (req, res) => {
    const siteId = parseInt(req.params.siteId, 10);
    if (isNaN(siteId)) {
        return res.status(400).json({ message: '无效的站点ID格式。'});
    }
    CandidateSite.findById(siteId, req.project.id, (err, site) => {
        if (err) {
            console.error(`获取项目 ${req.project.id} 的候选站点 ${siteId} 失败:`, err);
            return res.status(500).json({ message: '获取候选站点详情失败。' });
        }
        if (!site) {
            return res.status(404).json({ message: '候选站点未找到。' });
        }
        res.status(200).json(site);
    });
});

// PUT /projects/:projectId/sites/:siteId - Update a candidate site
router.put('/projects/:projectId/sites/:siteId', isAuthenticated, checkProjectOwnership, (req, res) => {
    const siteId = parseInt(req.params.siteId, 10);
    if (isNaN(siteId)) {
        return res.status(400).json({ message: '无效的站点ID格式。'});
    }
    const { site_name, location_geometry_geojson, suitability_score, notes_json, analysis_criteria_snapshot_json } = req.body;

    if (!site_name || !location_geometry_geojson) {
        return res.status(400).json({ message: '站点名称和位置几何不能为空。' });
    }
    try { JSON.parse(location_geometry_geojson); } catch (e) { return res.status(400).json({message: '位置几何 (location_geometry_geojson) 不是有效的JSON。'}); }
    if (notes_json) { try { JSON.parse(notes_json); } catch (e) { return res.status(400).json({message: '备注 (notes_json) 不是有效的JSON。'}); } }
    if (analysis_criteria_snapshot_json) { try { JSON.parse(analysis_criteria_snapshot_json); } catch (e) { return res.status(400).json({message: '分析快照 (analysis_criteria_snapshot_json) 不是有效的JSON。'}); } }
    if (suitability_score !== undefined && (typeof suitability_score !== 'number' || isNaN(suitability_score))) {
        return res.status(400).json({ message: '适宜性评分 (suitability_score) 必须是数字。'});
    }


    CandidateSite.update(siteId, req.project.id,
        { site_name, location_geometry_geojson, suitability_score, notes_json, analysis_criteria_snapshot_json },
        (err, result) => {
        if (err) {
            console.error(`更新项目 ${req.project.id} 的候选站点 ${siteId} 失败:`, err);
            return res.status(500).json({ message: '更新候选站点失败。' });
        }
        if (result.changes === 0) {
            return res.status(404).json({ message: '候选站点未找到或数据未改变。' });
        }
        res.status(200).json({ message: '候选站点更新成功。' });
    });
});

// DELETE /projects/:projectId/sites/:siteId - Delete a candidate site
router.delete('/projects/:projectId/sites/:siteId', isAuthenticated, checkProjectOwnership, (req, res) => {
    const siteId = parseInt(req.params.siteId, 10);
    if (isNaN(siteId)) {
        return res.status(400).json({ message: '无效的站点ID格式。'});
    }
    CandidateSite.delete(siteId, req.project.id, (err, result) => {
        if (err) {
            console.error(`删除项目 ${req.project.id} 的候选站点 ${siteId} 失败:`, err);
            return res.status(500).json({ message: '删除候选站点失败。' });
        }
        if (result.changes === 0) {
            return res.status(404).json({ message: '候选站点未找到。' });
        }
        res.status(200).json({ message: '候选站点删除成功。' });
    });
});

// === Basic Site Analysis (Placeholder) ===
// POST /projects/:projectId/analyze-site
router.post('/projects/:projectId/analyze-site', isAuthenticated, checkProjectOwnership, (req, res) => {
    const { location_geometry_geojson, criteria } = req.body;

    if (!location_geometry_geojson) {
        return res.status(400).json({ message: "位置几何 (location_geometry_geojson) 不能为空。" });
    }
    try { JSON.parse(location_geometry_geojson); } catch (e) { return res.status(400).json({message: '位置几何 (location_geometry_geojson) 不是有效的JSON。'}); }

    res.status(200).json({
        success: true,
        message: "站点分析占位符成功返回。",
        site_name: "分析的站点 (占位符)",
        location_geometry_geojson: location_geometry_geojson,
        suitability_score: parseFloat((Math.random() * 100).toFixed(2)),
        analysis_details: "基于占位符标准的模拟分析。",
        criteria_used: criteria || { note: "无特定标准提供，使用默认模拟逻辑。" }
    });
});

// GET /api/toolkit/site-selection/projects - List projects for current user
router.get('/projects', isAuthenticated, (req, res) => {
    SiteSelectionProject.findByUserId(req.session.user.id, (err, projects) => {
        if (err) {
            console.error("获取选址项目列表失败:", err);
            return res.status(500).json({ message: '获取选址项目列表失败。' });
        }
        res.status(200).json(projects);
    });
});

// GET /api/toolkit/site-selection/projects/:id - Get a specific project
router.get('/projects/:id', isAuthenticated, (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
        return res.status(400).json({ message: '无效的项目ID格式。'});
    }
    SiteSelectionProject.findById(projectId, req.session.user.id, (err, project) => {
        if (err) {
            console.error(`获取选址项目 ${projectId} 失败:`, err);
            return res.status(500).json({ message: '获取选址项目详情失败。' });
        }
        if (!project) {
            return res.status(404).json({ message: '选址项目未找到或无权访问。' });
        }
        res.status(200).json(project);
    });
});

// PUT /api/toolkit/site-selection/projects/:id - Update a project
router.put('/projects/:id', isAuthenticated, (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
        return res.status(400).json({ message: '无效的项目ID格式。'});
    }
    const { project_name, description, base_map_settings_json } = req.body;
    if (!project_name) {
        return res.status(400).json({ message: '项目名称 (project_name) 不能为空。' });
    }
    SiteSelectionProject.update(projectId, req.session.user.id, { project_name, description, base_map_settings_json }, (err, result) => {
        if (err) {
            console.error(`更新选址项目 ${projectId} 失败:`, err);
            return res.status(500).json({ message: '更新选址项目失败。' });
        }
        if (result.changes === 0) {
            return res.status(404).json({ message: '选址项目未找到、无权访问或数据未改变。' });
        }
        res.status(200).json({ message: '选址项目更新成功。' });
    });
});

// DELETE /api/toolkit/site-selection/projects/:id - Delete a project
router.delete('/projects/:id', isAuthenticated, (req, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
        return res.status(400).json({ message: '无效的项目ID格式。'});
    }
    SiteSelectionProject.delete(projectId, req.session.user.id, (err, result) => {
        if (err) {
            console.error(`删除选址项目 ${projectId} 失败:`, err);
            return res.status(500).json({ message: '删除选址项目失败。' });
        }
        if (result.changes === 0) {
            return res.status(404).json({ message: '选址项目未找到或无权删除。' });
        }
        res.status(200).json({ message: '选址项目删除成功。' });
    });
});

// === Data Layers ===
// GET /api/toolkit/site-selection/layers - List all data layers
router.get('/layers', isAuthenticated, (req, res) => {
    DataLayer.getAll((err, layers) => {
        if (err) {
            console.error("获取数据图层列表失败:", err);
            return res.status(500).json({ message: '获取数据图层列表失败。' });
        }
        res.status(200).json(layers);
    });
});

module.exports = router;
