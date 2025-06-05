/**
 * routes/toolkitRoutes.js
 *
 * 功能：
 * - 定义与“云南储能电站项目开发工具集”相关的API端点。
 * - 目前主要包含经济测算模块的API。
 * - (未来可以扩展到选址辅助、项目信息管理、在线信息搜集等模块的API)
 *
 * 依赖：
 * - express: Express 框架。
 * - ../services/economicAnalysisService: 经济测算服务。
 * - ../middleware/authMiddleware: 认证中间件 (某些操作可能需要用户登录)。
 * - ../models/economicScenarioModel.js (将在下一步创建，用于保存/加载方案)
 */
const express = require('express');
const router = express.Router();
const EconomicAnalysisService = require('../services/economicAnalysisService'); // 确保路径正确
const SensitivityAnalysisService = require('../services/SensitivityAnalysisService'); // Added
const { isAuthenticated, hasRole } = require('../middleware/authMiddleware'); // 确保路径正确
const db = require('../database/setup'); // 直接使用db操作economic_scenarios表

// --- 经济测算模块 (SRS FUR-TK-001) ---

/**
 * POST /api/toolkit/economics/calculate
 * 执行经济测算。
 * 请求体应包含所有必要的输入参数 (参照 EconomicAnalysisService.calculateEconomics 的 @param)。
 * 需要用户登录才能执行计算。
 */
router.post('/economics/calculate', isAuthenticated, async (req, res) => {
    const inputParams = req.body;
    const validationErrors = [];

    if (!inputParams || typeof inputParams !== 'object' || Object.keys(inputParams).length === 0) {
        return res.status(400).json({ success: false, error: "请求体中缺少输入参数。" });
    }

    // Helper to check if a value is a positive number
    const isPositiveNumber = (val, fieldName) => {
        if (typeof val !== 'number' || isNaN(val) || val <= 0) {
            validationErrors.push(`${fieldName} 必须是大于0的数字。`);
            return false;
        }
        return true;
    };
    // Helper to check if a value is a non-negative number
    const isNonNegativeNumber = (val, fieldName) => {
        if (typeof val !== 'number' || isNaN(val) || val < 0) {
            validationErrors.push(`${fieldName} 必须是大于或等于0的数字。`);
            return false;
        }
        return true;
    };
    // Helper to check if a value is a number within a specific range (inclusive)
    const isNumberInRange = (val, fieldName, min, max) => {
        if (typeof val !== 'number' || isNaN(val) || val < min || val > max) {
            validationErrors.push(`${fieldName} 必须是 ${min} 到 ${max} 之间的数字。`);
            return false;
        }
        return true;
    };

    // Validate critical parameters
    isPositiveNumber(inputParams.p_rated_mw, '额定功率 (p_rated_mw)');
    isPositiveNumber(inputParams.e_rated_mwh, '额定容量 (e_rated_mwh)');
    if (typeof inputParams.life_span_years !== 'number' || !Number.isInteger(inputParams.life_span_years) || inputParams.life_span_years <= 0) {
        validationErrors.push('项目寿命 (life_span_years) 必须是大于0的整数。');
    }

    isNumberInRange(inputParams.eta_rt_percent, '往返效率 (eta_rt_percent)', 0, 100);

    if (!isNonNegativeNumber(inputParams.capex_per_kwh, '单位能量投资成本 (capex_per_kwh)') ||
        !isNonNegativeNumber(inputParams.capex_per_kw, '单位功率投资成本 (capex_per_kw)')) {
        // Errors already pushed by helper
    } else if (inputParams.capex_per_kwh === 0 && inputParams.capex_per_kw === 0) {
        // Only add this if both are zero and previous checks passed (i.e., they are numbers >= 0)
        if ((typeof inputParams.capex_per_kwh === 'number' && inputParams.capex_per_kwh >=0) &&
            (typeof inputParams.capex_per_kw === 'number' && inputParams.capex_per_kw >=0)) {
            validationErrors.push('总初始投资 (CAPEX) 不能为零。至少提供单位能量或单位功率投资成本之一。');
        }
    }


    isNumberInRange(inputParams.loan_percent_input, '贷款比例 (loan_percent_input)', 0, 100);
    isNonNegativeNumber(inputParams.interest_rate_annual_percent, '贷款年利率 (interest_rate_annual_percent)');

    if (inputParams.loan_percent_input > 0) {
        if (typeof inputParams.loan_term_years !== 'number' || !Number.isInteger(inputParams.loan_term_years) || inputParams.loan_term_years <= 0) {
            validationErrors.push('贷款期限 (loan_term_years) 在有贷款时必须是大于0的整数。');
        }
    } else { // If no loan, loan_term_years can be 0 or not provided, service layer handles default.
        if (inputParams.loan_term_years !== undefined && (typeof inputParams.loan_term_years !== 'number' || !Number.isInteger(inputParams.loan_term_years) || inputParams.loan_term_years < 0) ){
             validationErrors.push('贷款期限 (loan_term_years) 如果提供，则必须是大于或等于0的整数。');
        }
    }

    isNonNegativeNumber(inputParams.discount_rate_wacc_percent, '折现率 (discount_rate_wacc_percent)');
    isNonNegativeNumber(inputParams.price_peak_kwh, '峰时电价 (price_peak_kwh)');
    isNonNegativeNumber(inputParams.price_valley_kwh, '谷时电价 (price_valley_kwh)');
    if (inputParams.price_flat_kwh !== undefined) isNonNegativeNumber(inputParams.price_flat_kwh, '平时电价 (price_flat_kwh)');


    if (inputParams.include_battery_replacement === true || inputParams.include_battery_replacement === 'true') {
        if (typeof inputParams.replacement_year !== 'number' || !Number.isInteger(inputParams.replacement_year) || inputParams.replacement_year <= 0) {
            validationErrors.push('电池更换年份 (replacement_year) 在启用电池更换时必须是大于0的整数。');
        } else if (inputParams.life_span_years && inputParams.replacement_year >= inputParams.life_span_years) {
             validationErrors.push('电池更换年份 (replacement_year) 必须小于项目寿命。');
        }
        isNonNegativeNumber(inputParams.replacement_cost_per_kwh, '更换成本 (replacement_cost_per_kwh)');
    }

    // Add more checks as needed for other fields based on your service logic
    // Example: deg_rate_annual_percent, opex_rate_on_epc_percent, n_cycles_per_year, dod_percent etc.
    isNumberInRange(inputParams.deg_rate_annual_percent, '年性能衰减率 (deg_rate_annual_percent)', 0, 100); // Example: Max 100%
    isNonNegativeNumber(inputParams.opex_rate_on_epc_percent, '运维成本占EPC比例 (opex_rate_on_epc_percent)');
    isPositiveNumber(inputParams.n_cycles_per_year, '年循环次数 (n_cycles_per_year)');
    isNumberInRange(inputParams.dod_percent, '放电深度 (dod_percent)', 0, 100);


    if (validationErrors.length > 0) {
        return res.status(400).json({
            success: false,
            error: "输入参数校验失败。",
            validationErrors
        });
    }

    try {
        console.log("ToolkitRoute: /economics/calculate - Received params for calculation, proceeding after validation.");
        const result = await EconomicAnalysisService.calculateEconomics(inputParams);
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json({ success: false, error: result.error || "经济测算执行失败。" });
        }
    } catch (error) {
        console.error("ToolkitRoute: /economics/calculate - Error during calculation:", error);
        res.status(500).json({ success: false, error: `服务器内部错误: ${error.message}` });
    }
});

/**
 * POST /api/toolkit/economics/scenarios
 * 保存一个经济测算方案 (输入参数和结果) 到数据库 (SRS FUR-TK-001.4)。
 * 需要用户登录。
 */
router.post('/economics/scenarios', isAuthenticated, async (req, res) => {
    const { scenario_name, input_parameters, results, notes } = req.body;
    const userId = req.session.user.id;

    if (!scenario_name || !input_parameters) {
        return res.status(400).json({ message: "方案名称和输入参数不能为空。" });
    }

    const checkSql = "SELECT id FROM economic_scenarios WHERE user_id = ? AND scenario_name = ?";
    db.get(checkSql, [userId, scenario_name], (errCheck, row) => {
        if (errCheck) {
            console.error("检查方案名重复出错:", errCheck);
            return res.status(500).json({ message: "检查方案名称时服务器出错。" });
        }
        if (row) { // Duplicate found
            return res.status(400).json({
                message: "方案名称已存在，请使用其他名称。",
                error_code: "DUPLICATE_SCENARIO_NAME"
            });
        }

        // If no duplicate, proceed to insert:
        const inputParamsString = JSON.stringify(input_parameters);
        const resultsString = results ? JSON.stringify(results) : null;
        const insertSql = `INSERT INTO economic_scenarios (user_id, scenario_name, input_parameters, results, notes, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        db.run(insertSql, [userId, scenario_name, inputParamsString, resultsString, notes || null], function (errInsert) {
            if (errInsert) {
                console.error("保存经济测算方案失败:", errInsert);
                return res.status(500).json({ message: "保存方案时服务器出错。" });
            }
            res.status(201).json({ message: "经济测算方案已保存。", scenarioId: this.lastID });
        });
    });
});

// --- 敏感性分析接口 (FUR-TK-001.5) ---
router.post('/economics/sensitivity-analysis', isAuthenticated, async (req, res) => {
    const { baseInputs, sensitivityVariables, outputMetrics } = req.body;
    const validationErrors = [];

    // 1. Validate baseInputs
    if (!baseInputs || typeof baseInputs !== 'object' || Object.keys(baseInputs).length === 0) {
        validationErrors.push('baseInputs is required and must be a non-empty object.');
    }
    // TODO: Optionally, add more detailed validation for key fields within baseInputs
    // similar to the /calculate route if necessary, or assume they are validated by frontend/client
    // For now, just checking its existence and type.

    // 2. Validate sensitivityVariables
    if (!Array.isArray(sensitivityVariables) || sensitivityVariables.length === 0) {
        validationErrors.push('sensitivityVariables is required and must be a non-empty array.');
    } else {
        sensitivityVariables.forEach((sv, index) => {
            if (!sv.variableName || typeof sv.variableName !== 'string' || sv.variableName.trim() === '') {
                validationErrors.push(`sensitivityVariables[${index}].variableName is required and must be a non-empty string.`);
            }
            if (!sv.displayName || typeof sv.displayName !== 'string' || sv.displayName.trim() === '') {
                validationErrors.push(`sensitivityVariables[${index}].displayName is required and must be a non-empty string.`);
            }
            if (!Array.isArray(sv.variations) || sv.variations.length === 0) {
                validationErrors.push(`sensitivityVariables[${index}].variations is required and must be a non-empty array.`);
            } else {
                sv.variations.forEach((v, vIndex) => {
                    if (!v.type || typeof v.type !== 'string' || v.type.trim() === '') {
                        validationErrors.push(`sensitivityVariables[${index}].variations[${vIndex}].type is required and must be a non-empty string (e.g., "percentage", "absolute").`);
                    }
                    // Allow 0 as a valid value, so check for type 'number' and not just truthiness
                    if (typeof v.value !== 'number' || isNaN(v.value)) {
                        validationErrors.push(`sensitivityVariables[${index}].variations[${vIndex}].value is required and must be a number.`);
                    }
                });
            }
        });
    }

    // 3. Validate outputMetrics
    if (!Array.isArray(outputMetrics) || outputMetrics.length === 0) {
        validationErrors.push('outputMetrics is required and must be a non-empty array.');
    } else {
        outputMetrics.forEach((metric, index) => {
            if (!metric || typeof metric !== 'string' || metric.trim() === '') {
                validationErrors.push(`outputMetrics[${index}] must be a non-empty string.`);
            }
        });
    }

    if (validationErrors.length > 0) {
        return res.status(400).json({
            success: false,
            error: "Sensitivity analysis input validation failed.",
            validationErrors
        });
    }

    // If client-side validation passed, proceed to call the service
    try {
        const analysisResult = await SensitivityAnalysisService.performAnalysis(baseInputs, sensitivityVariables, outputMetrics);

        if (analysisResult.success) {
            res.status(200).json(analysisResult);
        } else {
            // Determine appropriate status code based on service error
            // For now, using 400 for known errors from service, 500 for unexpected internal service errors
            let statusCode = 400;
            if (analysisResult.error && analysisResult.error.toLowerCase().includes("基准案例计算失败")) {
                statusCode = 500; // Or a more specific error if the base calculation itself had an issue
            } else if (analysisResult.error && analysisResult.error.toLowerCase().includes("意外错误")) {
                statusCode = 500;
            }
             console.error("Sensitivity Analysis Service reported failure:", analysisResult.error);
             res.status(statusCode).json({
                success: false,
                error: analysisResult.error || "敏感性分析服务发生错误。"
             });
        }
    } catch (error) {
        console.error("敏感性分析API路由意外错误:", error);
        res.status(500).json({ success: false, error: `服务器意外错误: ${error.message}` });
    }
});

/**
 * GET /api/toolkit/economics/scenarios
 * 获取当前登录用户的所有已保存经济测算方案。
 * 需要用户登录。
 */
router.get('/economics/scenarios', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    const sql = "SELECT id, scenario_name, notes, created_at, updated_at FROM economic_scenarios WHERE user_id = ? ORDER BY updated_at DESC";

    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error("获取已保存方案列表失败:", err);
            return res.status(500).json({ message: "获取方案列表时服务器出错。" });
        }
        res.status(200).json(rows);
    });
});

/**
 * GET /api/toolkit/economics/scenarios/:id
 * 获取特定ID的经济测算方案详情 (包括输入参数和结果)。
 * 需要用户登录，并验证该方案是否属于当前用户。
 */
router.get('/economics/scenarios/:id', isAuthenticated, async (req, res) => {
    const scenarioId = parseInt(req.params.id, 10);
    const userId = req.session.user.id;

    if (isNaN(scenarioId)) {
        return res.status(400).json({ message: "无效的方案ID格式。" });
    }

    const sql = "SELECT * FROM economic_scenarios WHERE id = ? AND user_id = ?";
    db.get(sql, [scenarioId, userId], (err, row) => {
        if (err) {
            console.error(`获取方案 ${scenarioId} 详情失败:`, err);
            return res.status(500).json({ message: "获取方案详情时服务器出错。" });
        }
        if (!row) {
            return res.status(404).json({ message: "方案未找到或您无权访问。" });
        }
        // 将JSON字符串解析回对象
        try {
            row.input_parameters = JSON.parse(row.input_parameters);
            if (row.results) {
                row.results = JSON.parse(row.results);
            }
        } catch (parseError) {
            console.error(`解析方案 ${scenarioId} 数据失败:`, parseError);
            return res.status(500).json({ message: "解析方案数据时出错。" });
        }
        res.status(200).json(row);
    });
});

/**
 * PUT /api/toolkit/economics/scenarios/:id
 * 更新一个已保存的经济测算方案。
 * 需要用户登录，并验证该方案是否属于当前用户。
 */
router.put('/economics/scenarios/:id', isAuthenticated, async (req, res) => {
    const scenarioId = parseInt(req.params.id, 10);
    const userId = req.session.user.id;
    const { scenario_name, input_parameters, results, notes } = req.body;

    if (isNaN(scenarioId)) {
        return res.status(400).json({ message: "无效的方案ID格式。" });
    }
    if (!scenario_name || !input_parameters) { // 至少需要名称和参数
        return res.status(400).json({ message: "方案名称和输入参数不能为空。" });
    }

    const inputParamsString = JSON.stringify(input_parameters);
    const resultsString = results ? JSON.stringify(results) : null;

    const sql = `UPDATE economic_scenarios 
                 SET scenario_name = ?, input_parameters = ?, results = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND user_id = ?`;
    db.run(sql, [scenario_name, inputParamsString, resultsString, notes || null, scenarioId, userId], function (err) {
        if (err) {
            console.error(`更新方案 ${scenarioId} 失败:`, err);
            return res.status(500).json({ message: "更新方案时服务器出错。" });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "方案未找到或您无权修改，或者数据未发生变化。" });
        }
        res.status(200).json({ message: "经济测算方案已更新。" });
    });
});

/**
 * DELETE /api/toolkit/economics/scenarios/:id
 * 删除一个已保存的经济测算方案。
 * 需要用户登录，并验证该方案是否属于当前用户。
 */
router.delete('/economics/scenarios/:id', isAuthenticated, async (req, res) => {
    const scenarioId = parseInt(req.params.id, 10);
    const userId = req.session.user.id;

    if (isNaN(scenarioId)) {
        return res.status(400).json({ message: "无效的方案ID格式。" });
    }

    const sql = "DELETE FROM economic_scenarios WHERE id = ? AND user_id = ?";
    db.run(sql, [scenarioId, userId], function (err) {
        if (err) {
            console.error(`删除方案 ${scenarioId} 失败:`, err);
            return res.status(500).json({ message: "删除方案时服务器出错。" });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "方案未找到或您无权删除。" });
        }
        res.status(200).json({ message: "经济测算方案已删除。" });
    });
});


// TODO: 后续添加选址辅助、项目信息管理、在线信息搜集等模块的API路由

module.exports = router;
