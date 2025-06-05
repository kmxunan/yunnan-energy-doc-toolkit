/**
 * services/SensitivityAnalysisService.js
 *
 * 功能：
 * - 执行敏感性分析计算。
 * - 接收基准输入参数、敏感性变量定义和期望的输出指标。
 * - 调用 EconomicAnalysisService 进行多次计算。
 * - 结构化返回分析结果。
 */

const EconomicAnalysisService = require('./economicAnalysisService'); // Uncommented

function deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
        return obj.map(deepCopy);
    }
    const copy = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            copy[key] = deepCopy(obj[key]);
        }
    }
    return copy;
}

const SensitivityAnalysisService = {
    /**
     * 执行敏感性分析。
     * @param {object} baseInputs - 包含所有经济测算所需参数的基准对象。
     * @param {Array<object>} sensitivityVariables - 定义要改变的变量及其变化方式。
     *                                            Example: [{ variableName: 'capex_per_kwh', displayName: '资本金', variations: [{type: 'percentage', value: -10}, ...] }]
     * @param {Array<string>} outputMetrics - 用户希望看到的输出指标键名数组 (e.g., ['equityIRRPostTax', 'projectNPV']).
     * @returns {Promise<object>} 包含分析结果的对象 (baseCaseResults, sensitivityResults)。
     */
    performAnalysis: async function(baseInputs, sensitivityVariables, outputMetrics) {
        if (!baseInputs || typeof baseInputs !== 'object') {
            return { success: false, error: "基准输入参数 (baseInputs) 无效或缺失。" };
        }
        if (!Array.isArray(sensitivityVariables) || sensitivityVariables.length === 0) {
            return { success: false, error: "敏感性变量定义 (sensitivityVariables) 无效或缺失。" };
        }
        if (!Array.isArray(outputMetrics) || outputMetrics.length === 0) {
            return { success: false, error: "输出指标定义 (outputMetrics) 无效或缺失。" };
        }

        console.log("SensitivityAnalysisService.performAnalysis called.");

        let baseCaseResultsForOutput = {};
        try {
            // Use deepCopy for base case to prevent modification if EconomicAnalysisService alters inputs
            const baseCaseCalcFull = await EconomicAnalysisService.calculateEconomics(deepCopy(baseInputs));
            if (!baseCaseCalcFull.success) {
                return { success: false, error: `基准案例计算失败: ${baseCaseCalcFull.error || '未知错误'}`, baseCaseResults: null, sensitivityResults: [] };
            }
            outputMetrics.forEach(metric => {
                if (baseCaseCalcFull.results && baseCaseCalcFull.results.hasOwnProperty(metric)) {
                    baseCaseResultsForOutput[metric] = baseCaseCalcFull.results[metric];
                } else {
                    baseCaseResultsForOutput[metric] = 'Metric not available';
                }
            });
        } catch (e) {
            console.error("Error during base case calculation in sensitivity analysis:", e);
            return { success: false, error: `基准案例计算时发生意外错误: ${e.message}`, baseCaseResults: null, sensitivityResults: [] };
        }

        const calculatedSensitivityResults = [];
        // For now, assume only one sensitivity variable is processed (1D analysis)
        const mainVariable = sensitivityVariables[0];

        if (!mainVariable || !mainVariable.variableName || !Array.isArray(mainVariable.variations)) {
            return { success: false, error: "第一个敏感性变量的定义无效。" };
        }
        if (typeof baseInputs[mainVariable.variableName] === 'undefined') {
             return { success: false, error: `敏感性变量 '${mainVariable.variableName}' 在基准输入参数中未找到。`};
        }

        for (const variation of mainVariable.variations) {
            const currentInputs = deepCopy(baseInputs);
            const originalParamValue = baseInputs[mainVariable.variableName]; // Get from original baseInputs
            let variedValue;

            if (typeof originalParamValue !== 'number' && (variation.type === 'percentage' || variation.type === 'increment')) {
                console.warn(`Sensitivity Analysis: Variable ${mainVariable.variableName} base value '${originalParamValue}' is not a number. Skipping variation type '${variation.type}'.`);
                calculatedSensitivityResults.push({
                    variableName: mainVariable.variableName, displayName: mainVariable.displayName,
                    variationType: variation.type, variationValue: variation.value,
                    variedInputParameter: { [mainVariable.variableName]: `错误: 基础值 '${originalParamValue}' 不是数字` },
                    outputs: { error: `无法对非数字基础值应用 '${variation.type}' 型变化。` }
                });
                continue;
            }

            switch (variation.type) {
                case 'percentage':
                    variedValue = originalParamValue * (1 + (variation.value / 100));
                    break;
                case 'absolute':
                    variedValue = variation.value;
                    break;
                case 'increment':
                    variedValue = originalParamValue + variation.value;
                    break;
                default:
                    console.warn(`Unknown variation type: ${variation.type} for variable ${mainVariable.variableName}`);
                    calculatedSensitivityResults.push({
                        variableName: mainVariable.variableName, displayName: mainVariable.displayName,
                        variationType: variation.type, variationValue: variation.value,
                        variedInputParameter: { [mainVariable.variableName]: `错误: 未知变化类型 '${variation.type}'`},
                        outputs: { error: `未知变化类型 '${variation.type}'。` }
                    });
                    continue; // Skip this variation
            }
            currentInputs[mainVariable.variableName] = variedValue;

            const resultEntry = {
                variableName: mainVariable.variableName, displayName: mainVariable.displayName,
                variationType: variation.type, variationValue: variation.value, // This is the % or absolute value of change
                variedInputParameterValue: variedValue, // This is the actual new value of the parameter
                outputs: {}
            };

            try {
                const iterationCalcFull = await EconomicAnalysisService.calculateEconomics(currentInputs);
                if (iterationCalcFull.success && iterationCalcFull.results) {
                    outputMetrics.forEach(metric => {
                        if (iterationCalcFull.results.hasOwnProperty(metric)) {
                            resultEntry.outputs[metric] = iterationCalcFull.results[metric];
                        } else {
                            resultEntry.outputs[metric] = 'Metric not available';
                        }
                    });
                } else {
                    resultEntry.outputs.error = iterationCalcFull.error || '此变化计算失败。';
                }
            } catch (e) {
                console.error(`Error during sensitivity iteration for ${mainVariable.variableName} (${variation.value}):`, e);
                resultEntry.outputs.error = `计算意外错误: ${e.message}`;
            }
            calculatedSensitivityResults.push(resultEntry);
        }

        return {
            success: true,
            message: `对 "${mainVariable.displayName}" 进行的敏感性分析已完成。`,
            analysisTitle: `对 "${mainVariable.displayName}" 进行的敏感性分析`,
            baseCaseResults: baseCaseResultsForOutput,
            sensitivityResults: calculatedSensitivityResults
        };
    }
};

module.exports = SensitivityAnalysisService;
