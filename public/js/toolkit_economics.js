/**
 * public/js/toolkit_economics.js
 */

// Helper functions for button loading state
function showButtonLoading(buttonElement, loadingText = "处理中...") {
    if (!buttonElement) return;
    buttonElement.dataset.originalText = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${loadingText}`;
}

function hideButtonLoading(buttonElement) {
    if (!buttonElement || buttonElement.dataset.originalText === undefined) return;
    buttonElement.disabled = false;
    if (buttonElement.dataset.originalText) {
       buttonElement.innerHTML = buttonElement.dataset.originalText;
    }
}

// Ensure escapeHTML is available
if (typeof escapeHTML !== 'function') {
    window.escapeHTML = function(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };
}

// 优先使用 auth.js 中暴露的 fetchAPI 和 getCurrentUser
const localFetchAPI = (typeof window.AuthModule !== 'undefined' && typeof window.AuthModule.fetchAPI === 'function')
    ? window.AuthModule.fetchAPI
    : async function fallbackFetchAPI(url, method, body = null) {
        console.warn("Toolkit_Economics: AuthModule.fetchAPI not found. Using fallback fetchAPI.");
        const options = { method, headers: {'Content-Type': 'application/json'} };
        if (body) options.body = JSON.stringify(body);
        const response = await fetch(url, options);
        const responseData = await response.json().catch(e => {
            console.error(`Fallback fetchAPI: API ${method} ${url} 响应非JSON或解析错误:`, e);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}, Body was not valid JSON.`);
            return { message: 'Response was not valid JSON but request might have been successful.'};
        });
        if (!response.ok) {
            const errorMessage = responseData.message || `HTTP error! status: ${response.status}`;
            const error = new Error(errorMessage); error.status = response.status; error.data = responseData; throw error;
        }
        return responseData;
    };

const localGetCurrentUser = (typeof window.AuthModule !== 'undefined' && typeof window.AuthModule.getCurrentUser === 'function')
    ? window.AuthModule.getCurrentUser
    : function fallbackGetCurrentUser() {
        console.warn("Toolkit_Economics: AuthModule.getCurrentUser not found. Using fallback getCurrentUser.");
        return null;
    };

let activeUser = null;
window.latestEconomicResults = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Toolkit Economics JS: DOMContentLoaded. Initializing page logic.");

    const economicAnalysisForm = document.getElementById('economicAnalysisForm');
    const calculationStatusP = document.getElementById('calculationStatus');
    const resultsSection = document.getElementById('resultsSection');
    const saveScenarioButton = document.getElementById('saveScenarioButton');
    const scenarioNameInput = document.getElementById('scenario_name');
    const scenarioNotesTextarea = document.getElementById('scenario_notes');
    const savedScenariosListUl = document.getElementById('savedScenariosList');
    const savedScenariosStatusP = document.getElementById('savedScenariosStatus');

    const resTotalInitialInvestment = document.getElementById('res_total_initial_investment');
    const resInitialVatCredit = document.getElementById('res_initial_vat_credit');
    const resNetInitialInvestment = document.getElementById('res_net_initial_investment');
    const resEquityInvestment = document.getElementById('res_equity_investment');
    const resLoanAmount = document.getElementById('res_loan_amount');
    const resProjectIrrPreTax = document.getElementById('res_project_irr_pre_tax');
    const resProjectIrrPostTax = document.getElementById('res_project_irr_post_tax');
    const resEquityIrrPostTax = document.getElementById('res_equity_irr_post_tax');
    const resProjectNpv = document.getElementById('res_project_npv');
    const resEquityNpv = document.getElementById('res_equity_npv');
    const resStaticPbpEquity = document.getElementById('res_static_pbp_equity');
    const resDynamicPbpEquity = document.getElementById('res_dynamic_pbp_equity');
    const resLcos = document.getElementById('res_lcos');
    const cashFlowTableBody = document.getElementById('cashFlowTableBody');
    const includeBatteryReplacementCheckbox = document.getElementById('include_battery_replacement');
    const replacementFields = document.querySelectorAll('.replacement-fields');

    const sensitivityAnalysisForm = document.getElementById('sensitivityAnalysisForm');
    // const sensitivityParamSelect = document.getElementById('sensitivityParam'); // Old one
    // const sensitivityVariationTypeSelect = document.getElementById('sensitivityVariationType'); // Old one
    // const sensitivityRangeInput = document.getElementById('sensitivityRange'); // Old one
    const sensitivityStatusP = document.getElementById('sensitivityStatus'); // Old status P
    const sensitivityResultsDisplay = document.getElementById('sensitivityResultsDisplay'); // New display area for structured results

    const useCurrentInputsForSensitivityButton = document.getElementById('useCurrentInputsForSensitivity');
    const sensitivityBaseInputsJsonTextarea = document.getElementById('sensitivityBaseInputsJson');
    const sensitivityVar1NameSelect = document.getElementById('sensitivityVar1Name');
    const sensitivityVar1DisplayNameInput = document.getElementById('sensitivityVar1DisplayName');
    const sensitivityVar1VariationsInput = document.getElementById('sensitivityVar1Variations');
    const outputMetricsCheckboxes = document.querySelectorAll('input[name="outputMetrics"]');
    const sensitivityMessageArea = document.getElementById('sensitivityMessageArea');

    let sensitivityBaseParams = null;
    const messageArea = document.getElementById('toolkitMessageArea');

    function clearGlobalMessages() { if (messageArea) messageArea.innerHTML = ''; }
    function displayGlobalMessage(message, type, targetArea = messageArea, duration = 5000) {
        const area = targetArea || messageArea;
        if (area) {
            area.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
                                ${escapeHTML(message)}
                                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                              </div>`;
            area.style.display = 'block';
            if (duration > 0) {
                setTimeout(() => {
                    if (area.firstChild && area.firstChild.textContent.includes(message)) { // Basic check
                        area.innerHTML = '';
                        area.style.display = 'none';
                    }
                }, duration);
            }
        } else { alert(message); }
    }
    function clearAllFieldErrors() { /* ... (same as before) ... */ }
    function displayFieldErrors(errors) { /* ... (same as before, ensure uses new displayGlobalMessage for summary) ... */ }
    function formatNumber(num, decimals = 2) { /* ... (same as before) ... */ }
    function toggleReplacementFields() { /* ... (same as before) ... */ }
    async function loadSavedScenarios() { /* ... (same as before) ... */ }
    async function checkAuthAndUpdateUI() { /* ... (same as before) ... */ }
    function displayResults(results, isSensitivityRun = false) { /* ... (same as before) ... */ }
    async function handleLoadScenarioClick(event) { /* ... (same as before, might need button state if it loads form) ... */ }
    async function handleDeleteScenarioClick(event) { /* ... (needs button state) ... */
        const button = event.target.closest('button');
        const scenarioId = button.dataset.id;
        if (!confirm(`确定要删除方案 ID: ${scenarioId} 吗?`)) return;

        showButtonLoading(button, "删除中...");
        if (savedScenariosStatusP) {
            savedScenariosStatusP.textContent = `正在删除方案 ${scenarioId}...`;
            savedScenariosStatusP.className = 'alert alert-info';
            savedScenariosStatusP.style.display = 'block';
        }
        try {
            await localFetchAPI(`/api/toolkit/economics/scenarios/${scenarioId}`, 'DELETE');
            if (savedScenariosStatusP) {
                savedScenariosStatusP.textContent = '方案已删除。';
                savedScenariosStatusP.className = 'alert alert-success';
                setTimeout(() => { savedScenariosStatusP.style.display = 'none'; }, 3000);
            }
            loadSavedScenarios(); // Refresh list
        } catch (error) {
            console.error("删除方案失败:", error);
            if (savedScenariosStatusP) {
                savedScenariosStatusP.textContent = `删除方案失败: ${error.message}`;
                savedScenariosStatusP.className = 'alert alert-danger';
            }
        } finally {
            hideButtonLoading(button); // Button will be removed on refresh, but good practice
        }
    }
    function validateEconomicInputs(inputs) { /* ... (same as before) ... */ }

    if (includeBatteryReplacementCheckbox) {
        includeBatteryReplacementCheckbox.addEventListener('change', toggleReplacementFields);
    }

    if (economicAnalysisForm) {
        const calcSubmitButton = economicAnalysisForm.querySelector('button[type="submit"]');
        economicAnalysisForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearGlobalMessages();
            clearAllFieldErrors();
            if(calcSubmitButton) showButtonLoading(calcSubmitButton, '计算中...');
            if (calculationStatusP) {
                calculationStatusP.textContent = '正在验证输入...';
                calculationStatusP.className = 'alert alert-info';
                calculationStatusP.style.display = 'block';
            }
            if (resultsSection) resultsSection.style.display = 'none';
            const inputParams = collectInputParams();
            const validationFailures = validateEconomicInputs(inputParams);
            if (validationFailures.length > 0) {
                displayFieldErrors(validationFailures);
                if (calculationStatusP) {
                    calculationStatusP.textContent = '输入参数校验失败，请修正后再试。';
                    calculationStatusP.className = 'alert alert-danger';
                }
                if(calcSubmitButton) hideButtonLoading(calcSubmitButton);
                return;
            }
            if (calculationStatusP) calculationStatusP.textContent = '正在测算中，请稍候...';
            window.latestEconomicResults = null;
            try {
                const responseData = await localFetchAPI('/api/toolkit/economics/calculate', 'POST', inputParams);
                if (responseData.success && responseData.results) {
                    window.latestEconomicResults = responseData.results;
                    displayResults(responseData.results);
                    if (calculationStatusP) {
                        calculationStatusP.textContent = responseData.message || '测算完成！';
                        calculationStatusP.className = 'alert alert-success';
                    }
                } else {
                    const errorMsg = responseData.error || responseData.message || '测算返回数据格式不正确。';
                    if (responseData.validationErrors && responseData.validationErrors.length > 0) {
                        const backendErrors = responseData.validationErrors.map(msg => ({ message: msg }));
                        displayFieldErrors(backendErrors);
                         if (calculationStatusP) calculationStatusP.textContent = '后端校验失败，请修正。';
                    } else {
                        displayGlobalMessage(errorMsg, 'danger');
                        if (calculationStatusP) calculationStatusP.textContent = `测算失败: ${errorMsg}`;
                    }
                    if (calculationStatusP) calculationStatusP.className = 'alert alert-danger';
                }
            } catch (error) {
                console.error("Toolkit_Economics: 经济测算API调用失败:", error);
                const errorMsg = error.data?.error || error.message || "未知服务器错误";
                if (error.data?.validationErrors && error.data.validationErrors.length > 0) {
                     const backendErrors = error.data.validationErrors.map(msg => ({ message: msg }));
                     displayFieldErrors(backendErrors);
                     if (calculationStatusP) calculationStatusP.textContent = '后端校验失败，请修正。';
                } else {
                    displayGlobalMessage(`测算API调用失败: ${errorMsg}`, 'danger');
                    if (calculationStatusP) calculationStatusP.textContent = `测算API调用失败: ${errorMsg}`;
                }
                 if (calculationStatusP) calculationStatusP.className = 'alert alert-danger';
                if (resultsSection) resultsSection.style.display = 'none';
            } finally {
                if(calcSubmitButton) hideButtonLoading(calcSubmitButton);
            }
        });
    }

    if (saveScenarioButton) {
        saveScenarioButton.addEventListener('click', async () => {
            const user = activeUser;
            if (!user) {
                alert("请先登录后再保存方案。");
                // Potentially re-check auth or guide to login
                return;
            }
            const scenarioName = scenarioNameInput.value.trim();
            if (!scenarioName) {
                displayGlobalMessage("请输入方案名称。", "warning", calculationStatusP, 3000);
                scenarioNameInput.focus(); return;
            }
            const notes = scenarioNotesTextarea.value.trim();
            const input_parameters = collectInputParams();
            if (!window.latestEconomicResults) {
                displayGlobalMessage("请先执行一次测算以生成结果，然后再保存方案。", "warning", calculationStatusP, 3000);
                return;
            }
            showButtonLoading(saveScenarioButton, '保存中...');
            if (calculationStatusP) {
                calculationStatusP.textContent = '正在保存方案...';
                calculationStatusP.className = 'alert alert-info';
                calculationStatusP.style.display = 'block';
            }
            try {
                const payload = { scenario_name: scenarioName, input_parameters: input_parameters, results: window.latestEconomicResults, notes: notes };
                const responseData = await localFetchAPI('/api/toolkit/economics/scenarios', 'POST', payload);
                if (calculationStatusP) {
                    calculationStatusP.textContent = responseData.message || '方案保存成功！';
                    calculationStatusP.className = 'alert alert-success';
                }
                if (scenarioNameInput) scenarioNameInput.value = '';
                if (scenarioNotesTextarea) scenarioNotesTextarea.value = '';
                loadSavedScenarios();
            } catch (error) {
                console.error("保存方案失败:", error);
                let errorMessage = error.data?.message || error.message || "保存方案时发生未知错误。";
                if (error.data && error.data.error_code === "DUPLICATE_SCENARIO_NAME") {
                    if(scenarioNameInput) scenarioNameInput.focus();
                }
                displayGlobalMessage(errorMessage, 'danger', calculationStatusP, 0); // Show error in calculationStatusP
            } finally {
                hideButtonLoading(saveScenarioButton);
            }
        });
    }

    function collectInputParams() { /* ... (same as before) ... */ }

    const metricDisplayNames = { /* ... (same as before) ... */ };
    function getMetricDisplayName(metricKey) { /* ... (same as before) ... */ }
    function formatMetricValue(value, metricKey) { /* ... (same as before) ... */ }
    function renderSensitivityBaseCase(baseCaseResults, outputMetricsToShow) { /* ... (same as before) ... */ }
    function renderSensitivityTable(sensitivityResults, outputMetricsToShow, analysisTitle) { /* ... (same as before) ... */ }
    function populateSensitivityVariableSelect() { /* ... (same as before) ... */ }

    if (useCurrentInputsForSensitivityButton) { /* ... (same as before, consider message display target) ... */ }

    if (sensitivityAnalysisForm) {
        const submitButtonSA = sensitivityAnalysisForm.querySelector('button[type="submit"]');
        sensitivityAnalysisForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (sensitivityMessageArea) sensitivityMessageArea.innerHTML = '';
            if (sensitivityResultsDisplay) {
                 sensitivityResultsDisplay.innerHTML = '';
                 sensitivityResultsDisplay.style.display = 'none';
            }
            const validationErrorsSA = [];
            if (!sensitivityBaseParams) validationErrorsSA.push("请先点击“使用当前主表单参数作为敏感性分析基准”按钮加载基准参数。");
            const selectedVariableName = sensitivityVar1NameSelect ? sensitivityVar1NameSelect.value : '';
            const selectedDisplayName = sensitivityVar1DisplayNameInput ? sensitivityVar1DisplayNameInput.value : selectedVariableName;
            const variationsString = sensitivityVar1VariationsInput ? sensitivityVar1VariationsInput.value.trim() : '';
            if (!selectedVariableName) validationErrorsSA.push("请选择一个敏感性分析变量。");
            if (!variationsString) validationErrorsSA.push("请输入变量的百分比变化值序列（例如: -20,-10,0,10,20）。");
            const parsedVariations = variationsString.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
            if (variationsString && parsedVariations.length === 0 && validationErrorsSA.findIndex(e => e.includes("百分比变化值序列")) === -1) {
                validationErrorsSA.push("变量的百分比变化值格式不正确或未提供有效数字。");
            }
            let finalSensitivityVariables = [];
            if (selectedVariableName && parsedVariations.length > 0) {
                finalSensitivityVariables.push({
                    variableName: selectedVariableName,
                    displayName: selectedDisplayName || selectedVariableName,
                    variations: parsedVariations.map(val => ({ type: "percentage", value: val }))
                });
            }
            const finalOutputMetrics = [];
            if(outputMetricsCheckboxes) {
                outputMetricsCheckboxes.forEach(checkbox => { if (checkbox.checked) finalOutputMetrics.push(checkbox.value); });
            }
            if (finalOutputMetrics.length === 0) validationErrorsSA.push("请至少选择一个输出指标。");
            if (validationErrorsSA.length > 0) {
                let errorHtml = '<strong>敏感性分析输入错误:</strong><ul>';
                validationErrorsSA.forEach(err => errorHtml += `<li>${escapeHTML(err)}</li>`);
                errorHtml += '</ul>';
                displayGlobalMessage(errorHtml, 'danger', sensitivityMessageArea, 0);
                return;
            }
            if(sensitivityBaseParams){
                const baseInputErrors = validateEconomicInputs(sensitivityBaseParams);
                if(baseInputErrors.length > 0){
                    displayFieldErrors(baseInputErrors); // This will use general toolkitMessageArea
                    displayGlobalMessage("敏感性分析的基准参数未通过校验，请修正主表单中的错误。", "warning", sensitivityMessageArea, 0);
                    return;
                }
            }
            const requestPayload = { baseInputs: sensitivityBaseParams, sensitivityVariables: finalSensitivityVariables, outputMetrics: finalOutputMetrics };
            if(submitButtonSA) showButtonLoading(submitButtonSA, '运行中...');
            displayGlobalMessage('正在运行敏感性分析 (API)...', 'info', sensitivityMessageArea, 0);
            try {
                const resultData = await localFetchAPI('/api/toolkit/economics/sensitivity-analysis', 'POST', requestPayload);
                if (sensitivityMessageArea) sensitivityMessageArea.innerHTML = '';
                if (resultData.success) {
                    displayGlobalMessage(resultData.message || "敏感性分析已成功完成。", "success", sensitivityMessageArea, 3000);
                    let resultsHtml = renderSensitivityBaseCase(resultData.baseCaseResults, finalOutputMetrics);
                    resultsHtml += renderSensitivityTable(resultData.sensitivityResults, finalOutputMetrics, resultData.analysisTitle);
                    if (sensitivityResultsDisplay) {
                        sensitivityResultsDisplay.innerHTML = resultsHtml;
                        sensitivityResultsDisplay.style.display = 'block';
                    }
                } else {
                    displayGlobalMessage(resultData.error || "敏感性分析请求失败。", "danger", sensitivityMessageArea, 0);
                }
            } catch (error) {
                console.error("敏感性分析API调用失败:", error);
                displayGlobalMessage(`敏感性分析请求出错: ${error.message || '未知服务器错误'}`, "danger", sensitivityMessageArea, 0);
            } finally {
                if(submitButtonSA) hideButtonLoading(submitButtonSA);
            }
        });
    }

    function displaySensitivityResults(resultsData) { /* ... (same as before, but not directly called by new SA logic) ... */ }

    if (includeBatteryReplacementCheckbox) toggleReplacementFields();
    checkAuthAndUpdateUI();
    populateSensitivityVariableSelect();

    document.addEventListener('userLoggedIn', (event) => {
        activeUser = event.detail.user;
        loadSavedScenarios();
    });
    document.addEventListener('userLoggedOut', () => {
        activeUser = null;
        if (savedScenariosStatusP) savedScenariosStatusP.textContent = '请登录以查看您保存的方案。';
        if (savedScenariosListUl) savedScenariosListUl.innerHTML = '';
    });
});
