/**
 * services/economicAnalysisService.js
 * (核心逻辑填充 - 阶段10: 优化AGC里程与性能指标计算)
 */

let financial;
try {
    financial = require('financial');
    console.log("EconomicAnalysisService: 'financial' package loaded successfully.");
} catch (e) {
    console.warn("EconomicAnalysisService: 'financial' package not found or failed to load. IRR and NPV calculations will use basic fallback methods and may be inaccurate. Consider running 'npm install financial'.");
    financial = null;
}

// 辅助函数
function parsePercent(value, defaultValue = 0) {
    if (typeof value === 'string' && value.endsWith('%')) {
        return parseFloat(value.replace('%', '')) / 100;
    }
    if (typeof value === 'number') { return value / 100; } // 假设前端传入5代表5%
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num / 100;
}
function toNumber(value, defaultValue = 0) {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
}
function calculateEqualPrincipalPayments(loanAmount, annualRate, loanTermYears, year) {
    if (year <= 0 || year > loanTermYears || loanAmount <= 0.01 || annualRate < 0 || loanTermYears <= 0) {
        return { interest: 0, principal: 0, remainingBalance: loanAmount > 0.01 ? loanAmount - ( (loanAmount/loanTermYears) * Math.max(0, year-1) ) : 0 };
    }
    const annualPrincipalPayment = loanAmount / loanTermYears;
    const remainingBalanceAtStartOfYear = loanAmount - (annualPrincipalPayment * (year - 1));
    const interestPayment = remainingBalanceAtStartOfYear * annualRate;
    const principalPayment = Math.min(annualPrincipalPayment, remainingBalanceAtStartOfYear);
    const remainingBalanceAtEndOfYear = remainingBalanceAtStartOfYear - principalPayment;
    return { interest: interestPayment, principal: principalPayment, remainingBalance: remainingBalanceAtEndOfYear };
}

const EconomicAnalysisService = {
    calculateEconomics: async function(inputParams) {
        console.log("EconomicAnalysisService: Calculation started with input (阶段10 - AGC优化)...");

        try {
            // --- 1. 解析和标准化输入参数 ---
            const base_p_rated_mw = toNumber(inputParams.p_rated_mw, 100);
            const base_e_rated_mwh = toNumber(inputParams.e_rated_mwh, 200);

            const params = {
                p_rated_mw: base_p_rated_mw,
                e_rated_mwh: base_e_rated_mwh,
                life_span_years: parseInt(inputParams.life_span_years, 10) || 15,
                eta_rt_percent: toNumber(inputParams.eta_rt_percent, 88),
                deg_rate_annual_percent: toNumber(inputParams.deg_rate_annual_percent, 1.5),
                tech_type: inputParams.tech_type || 'LiFePO4',
                capex_per_kwh: toNumber(inputParams.capex_per_kwh, 750),
                capex_per_kw: toNumber(inputParams.capex_per_kw, 0),
                other_capex_rate_percent: toNumber(inputParams.other_capex_rate_percent, 5),
                opex_rate_on_epc_percent: toNumber(inputParams.opex_rate_on_epc_percent, 1.5),
                opex_annual_fixed_other: toNumber(inputParams.opex_annual_fixed_other, 0),
                include_battery_replacement: inputParams.include_battery_replacement === true || String(inputParams.include_battery_replacement).toLowerCase() === 'true',
                replacement_year: parseInt(inputParams.replacement_year, 10) || 10,
                replacement_cost_per_kwh: toNumber(inputParams.replacement_cost_per_kwh, 250),
                loan_percent_input: toNumber(inputParams.loan_percent_input, 70),
                interest_rate_annual_percent: toNumber(inputParams.interest_rate_annual_percent, 3.0),
                loan_term_years: parseInt(inputParams.loan_term_years, 10) || 10,
                vat_rate_output_percent: toNumber(inputParams.vat_rate_output_percent, 6),
                vat_rate_capex_input_percent: toNumber(inputParams.vat_rate_capex_input_percent, 13),
                vat_rate_opex_input_percent: toNumber(inputParams.vat_rate_opex_input_percent, 6),
                surtax_rate_on_vat_percent: toNumber(inputParams.surtax_rate_on_vat_percent, 12),
                income_tax_rate_standard_percent: toNumber(inputParams.income_tax_rate_standard_percent, 25),
                use_western_dev_tax: inputParams.use_western_dev_tax === true || String(inputParams.use_western_dev_tax).toLowerCase() === 'true',
                max_loss_carry_forward_years: parseInt(inputParams.max_loss_carry_forward_years, 10) || 5,
                discount_rate_wacc_percent: toNumber(inputParams.discount_rate_wacc_percent, 5.38),
                equity_discount_rate_percent: toNumber(inputParams.equity_discount_rate_percent, 10.0),
                n_cycles_per_year: parseInt(inputParams.n_cycles_per_year, 10) || 700,
                dod_percent: toNumber(inputParams.dod_percent, 80),
                price_peak_kwh: toNumber(inputParams.price_peak_kwh, 0.5037),
                price_valley_kwh: toNumber(inputParams.price_valley_kwh, 0.1679),
                pfr_capacity_mw: toNumber(inputParams.pfr_capacity_mw, base_p_rated_mw * 0.5),
                pfr_annual_service_hours: toNumber(inputParams.pfr_annual_service_hours, 8000),
                pfr_compensation_price_mw_hour: toNumber(inputParams.pfr_compensation_price_mw_hour, 10),
                pfr_availability_factor_percent: toNumber(inputParams.pfr_availability_factor_percent, 95),
                agc_capacity_mw: toNumber(inputParams.agc_capacity_mw, base_p_rated_mw),
                agc_annual_effective_service_days: toNumber(inputParams.agc_annual_effective_service_days, 300),
                agc_compensation_fixed_price_mw_day: toNumber(inputParams.agc_compensation_fixed_price_mw_day, 150),
                agc_mileage_price_mwh: toNumber(inputParams.agc_mileage_price_mwh, 200),
                agc_k_value: toNumber(inputParams.agc_k_value, 1.0),
                agc_response_time_s: toNumber(inputParams.agc_response_time_s, 30),
                agc_regulation_accuracy_percent: toNumber(inputParams.agc_regulation_accuracy_percent, 95),
                agc_regulation_rate_mw_min: toNumber(inputParams.agc_regulation_rate_mw_min, base_p_rated_mw * 0.1),
                agc_daily_calls: toNumber(inputParams.agc_daily_calls, 20),
                agc_avg_duration_per_call_min: toNumber(inputParams.agc_avg_duration_per_call_min, 5),
                agc_regulation_depth_percent: toNumber(inputParams.agc_regulation_depth_percent, 20),
                // 新增/确认：AGC标准性能参数 (参考V3.html，可设为常量或未来作为高级输入)
                agc_standard_response_time_s_ref: toNumber(inputParams.agc_standard_response_time_s_ref, 60), // V3.html T标准=1min=60s
                agc_standard_accuracy_ref_percent: toNumber(inputParams.agc_standard_accuracy_ref_percent, 90), // V3.html D标准=90%
                agc_standard_regulation_rate_ratio_ref_percent: toNumber(inputParams.agc_standard_regulation_rate_ratio_ref_percent, 10), // R标准=10% Pmax / min

                capacity_market_participation_mw: toNumber(inputParams.capacity_market_participation_mw, base_p_rated_mw),
                capacity_market_price_mw_month: toNumber(inputParams.capacity_market_price_mw_month, 0),
                aux_services_annual_revenue_input_before_vat: toNumber(inputParams.aux_services_annual_revenue_input_before_vat, 0),
                capacity_lease_annual_revenue_input_before_vat: toNumber(inputParams.capacity_lease_annual_revenue_input_before_vat, 0),
                depreciation_years_initial: parseInt(inputParams.depreciation_years_initial, 10) || 10,
                depreciation_years_replacement: parseInt(inputParams.depreciation_years_replacement, 10) || 5,
                salvage_rate_percent: toNumber(inputParams.salvage_rate_percent, 5),
            };

            // --- 1b. 将百分比转换为小数 ---
            const eta_rt = params.eta_rt_percent / 100;
            const deg_rate_annual = params.deg_rate_annual_percent / 100;
            const other_capex_rate = params.other_capex_rate_percent / 100;
            const opex_rate_on_epc = params.opex_rate_on_epc_percent / 100;
            const loan_percent = params.loan_percent_input / 100;
            const interest_rate_annual = params.interest_rate_annual_percent / 100;
            const vat_rate_output = params.vat_rate_output_percent / 100;
            const vat_rate_capex_input = params.vat_rate_capex_input_percent / 100;
            const vat_rate_opex_input = params.vat_rate_opex_input_percent / 100;
            const surtax_rate_on_vat = params.surtax_rate_on_vat_percent / 100;
            const income_tax_rate = params.use_western_dev_tax ? 0.15 : (params.income_tax_rate_standard_percent / 100);
            const discount_rate_wacc = params.discount_rate_wacc_percent / 100;
            const equity_discount_rate = params.equity_discount_rate_percent / 100;
            const dod = params.dod_percent / 100;
            const salvage_rate = params.salvage_rate_percent / 100;
            const pfr_availability_factor = params.pfr_availability_factor_percent / 100;
            const agc_regulation_accuracy = params.agc_regulation_accuracy_percent / 100; // 实际精度 (小数)
            const agc_regulation_depth = params.agc_regulation_depth_percent / 100; // 调节深度 (小数)
            const agc_standard_accuracy_ref = params.agc_standard_accuracy_ref_percent / 100; // 标准精度 (小数)
            const agc_standard_regulation_rate_ratio_ref = params.agc_standard_regulation_rate_ratio_ref_percent / 100; // 标准调节速率占比 (小数)


            // --- 2. 计算初始投资 (CAPEX) ---
            const e_rated_kwh = params.e_rated_mwh * 1000;
            const p_rated_kw = params.p_rated_mw * 1000;
            let initial_epc_cost = (params.capex_per_kwh * e_rated_kwh) + (params.capex_per_kw * p_rated_kw);
            if (initial_epc_cost <= 0) initial_epc_cost = params.capex_per_kwh > 0 ? (params.capex_per_kwh * e_rated_kwh) : (params.capex_per_kw > 0 ? (params.capex_per_kw * p_rated_kw) : (750 * e_rated_kwh));
            const other_initial_cost = initial_epc_cost * other_capex_rate;
            const total_construction_cost_before_vat = initial_epc_cost + other_initial_cost;
            const initial_investment_vat_credit = total_construction_cost_before_vat * vat_rate_capex_input;
            const total_initial_investment_for_financing_and_depreciation = total_construction_cost_before_vat;
            const loan_amount = total_initial_investment_for_financing_and_depreciation * loan_percent;
            const equity_investment = total_initial_investment_for_financing_and_depreciation - loan_amount;

            // --- 3. 计算年度运营数据 ---
            const annualCashFlows = [];
            let remaining_loan_balance = loan_amount;
            let cumulative_fcfe_for_payback = -equity_investment + initial_investment_vat_credit;
            let cumulative_discounted_fcfe_for_payback = -equity_investment + initial_investment_vat_credit;
            let staticPaybackPeriodEquity = null;
            let dynamicPaybackPeriodEquity = null;
            const annual_opex_from_epc_before_vat = initial_epc_cost * opex_rate_on_epc;
            const annual_opex_total_before_vat = annual_opex_from_epc_before_vat + params.opex_annual_fixed_other;
            const initial_depreciable_asset_value = total_initial_investment_for_financing_and_depreciation * (1 - salvage_rate);
            const annual_depreciation_initial = initial_depreciable_asset_value / params.depreciation_years_initial;
            let replacement_cost_total_before_vat = 0;
            let replacement_depreciable_asset_value = 0;
            let annual_depreciation_replacement = 0;
            let replacement_vat_credit = 0;
            if (params.include_battery_replacement && params.replacement_year > 0 && params.replacement_year < params.life_span_years) {
                replacement_cost_total_before_vat = params.replacement_cost_per_kwh * e_rated_kwh;
                replacement_vat_credit = replacement_cost_total_before_vat * vat_rate_capex_input;
                replacement_depreciable_asset_value = replacement_cost_total_before_vat * (1 - salvage_rate);
                const replacement_actual_dep_years = Math.min(params.depreciation_years_replacement, params.life_span_years - params.replacement_year);
                if (replacement_actual_dep_years > 0) {
                    annual_depreciation_replacement = replacement_depreciable_asset_value / replacement_actual_dep_years;
                }
            }
            const project_pre_tax_cash_flow_series = [-total_initial_investment_for_financing_and_depreciation + initial_investment_vat_credit];
            let tax_losses_carry_forward = [];

            for (let year = 0; year <= params.life_span_years; year++) {
                const cashFlowYear = { year };
                if (year === 0) {
                    cashFlowYear.capex = -total_initial_investment_for_financing_and_depreciation;
                    cashFlowYear.vat_input_initial_credit = initial_investment_vat_credit;
                    cashFlowYear.equity_contribution = -equity_investment;
                    cashFlowYear.debt_drawdown = loan_amount;
                    cashFlowYear.fcff = -total_initial_investment_for_financing_and_depreciation + initial_investment_vat_credit;
                    cashFlowYear.fcfe = -equity_investment + initial_investment_vat_credit;
                    ['total_revenue_before_vat', 'revenue_arbitrage', 'revenue_pfr', 'revenue_agc_capacity', 'revenue_agc_mileage', 'revenue_capacity_market', 'revenue_aux_other_input', 'opex_before_vat', 'vat_payable_net', 'surtax_on_vat', 'ebitda',
                        'depreciation', 'ebit', 'interest', 'ebt', 'income_tax', 'net_profit', 'loss_offset', 'taxable_income_final',
                        'principal_repayment', 'project_pre_tax_cash_flow', 'current_year_replacement_vat_credit'].forEach(k => cashFlowYear[k] = cashFlowYear[k] || 0);
                } else {
                    const current_year_capacity_factor = Math.pow(1 - deg_rate_annual, year -1);
                    const current_p_rated_mw_effective = params.p_rated_mw * current_year_capacity_factor;
                    const current_e_rated_kwh_effective = e_rated_kwh * current_year_capacity_factor;

                    // a. 年收入 (不含增值税)
                    const annual_discharge_kwh_total = params.n_cycles_per_year * current_e_rated_kwh_effective * dod;
                    const annual_charge_kwh_total = annual_discharge_kwh_total / eta_rt;
                    cashFlowYear.revenue_arbitrage = (annual_discharge_kwh_total * params.price_peak_kwh) - (annual_charge_kwh_total * params.price_valley_kwh);

                    const actual_pfr_capacity_mw = Math.min(params.pfr_capacity_mw, current_p_rated_mw_effective);
                    cashFlowYear.revenue_pfr = actual_pfr_capacity_mw * params.pfr_annual_service_hours * params.pfr_compensation_price_mw_hour * pfr_availability_factor;

                    const actual_agc_capacity_mw = Math.min(params.agc_capacity_mw, current_p_rated_mw_effective);
                    cashFlowYear.revenue_agc_capacity = actual_agc_capacity_mw * params.agc_annual_effective_service_days * params.agc_compensation_fixed_price_mw_day;

                    // AGC里程收益计算 (进一步细化，参考V3.html思路)
                    const kt_response_factor = Math.min(1, params.agc_response_time_s > 0 ? params.agc_standard_response_time_s_ref / params.agc_response_time_s : 1);
                    const kd_accuracy_factor = Math.min(1, agc_standard_accuracy_ref > 0 ? agc_regulation_accuracy / agc_standard_accuracy_ref : 1);
                    // R标准 = 标准调节速率占比 * 实际参与AGC容量
                    const agc_standard_regulation_rate_mw_min_ref = actual_agc_capacity_mw * agc_standard_regulation_rate_ratio_ref;
                    const kr_rate_factor = Math.min(1, params.agc_regulation_rate_mw_min > 0 && agc_standard_regulation_rate_mw_min_ref > 0 ? params.agc_regulation_rate_mw_min / agc_standard_regulation_rate_mw_min_ref : 1);

                    // 储能自身性能指标 Kp_performance = K_T * K_D * K_R
                    const kp_performance_factor = kt_response_factor * kd_accuracy_factor * kr_rate_factor;
                    // 市场或用户定义的综合调整系数 K_market = params.agc_k_value
                    // 最终里程补偿的综合系数 K_overall = K_market * Kp_performance
                    const k_overall_agc = params.agc_k_value * kp_performance_factor;

                    // 日均等效里程 (MWh) = 申报调节容量P_AGC(MW) * 日调用次数N * 平均单次调用时长T_avg(小时) * 调节深度D(%) * 2 (如果双向都算里程)
                    // 这里的 "调节深度" D_reg_depth 是指储能以其申报功率P_AGC，在平均单次调用时长T_avg内，实际贡献的能量占 (P_AGC * T_avg) 的百分比。
                    // 假设里程补偿是基于单向的有效调节电量。
                    const daily_equivalent_mileage_mwh = actual_agc_capacity_mw * params.agc_daily_calls * (params.agc_avg_duration_per_call_min / 60) * agc_regulation_depth;
                    // V3.html 中有乘以2的因子，这里暂时不乘，因为云南规则可能按单向调节量。如果需要，可以乘以2。
                    // const daily_equivalent_mileage_mwh = actual_agc_capacity_mw * params.agc_daily_calls * (params.agc_avg_duration_per_call_min / 60) * agc_regulation_depth * 2;

                    const annual_theoretical_mileage_mwh = daily_equivalent_mileage_mwh * params.agc_annual_effective_service_days;
                    const annual_effective_mileage_mwh_final = annual_theoretical_mileage_mwh * k_overall_agc; // K值调整后的有效里程

                    cashFlowYear.revenue_agc_mileage = annual_effective_mileage_mwh_final * params.agc_mileage_price_mwh;

                    const actual_capacity_market_participation_mw = Math.min(params.capacity_market_participation_mw, current_p_rated_mw_effective);
                    cashFlowYear.revenue_capacity_market = actual_capacity_market_participation_mw * params.capacity_market_price_mw_month * 12;

                    let total_calculated_aux_revenue = cashFlowYear.revenue_pfr + cashFlowYear.revenue_agc_capacity + cashFlowYear.revenue_agc_mileage;
                    cashFlowYear.revenue_aux_other_input = 0;
                    if (Math.abs(total_calculated_aux_revenue) < 1 && params.aux_services_annual_revenue_input_before_vat > 0) {
                        cashFlowYear.revenue_aux_other_input = params.aux_services_annual_revenue_input_before_vat * current_year_capacity_factor;
                        cashFlowYear.revenue_pfr = 0; cashFlowYear.revenue_agc_capacity = 0; cashFlowYear.revenue_agc_mileage = 0;
                    }
                    if (Math.abs(cashFlowYear.revenue_capacity_market) < 1 && params.capacity_lease_annual_revenue_input_before_vat > 0) {
                        cashFlowYear.revenue_capacity_market = params.capacity_lease_annual_revenue_input_before_vat * current_year_capacity_factor;
                    }

                    cashFlowYear.total_revenue_before_vat = cashFlowYear.revenue_arbitrage +
                        cashFlowYear.revenue_pfr +
                        cashFlowYear.revenue_agc_capacity +
                        cashFlowYear.revenue_agc_mileage +
                        cashFlowYear.revenue_aux_other_input +
                        cashFlowYear.revenue_capacity_market;

                    cashFlowYear.opex_before_vat = annual_opex_total_before_vat;
                    const vat_output_annual = cashFlowYear.total_revenue_before_vat * vat_rate_output;
                    let vat_input_annual_opex = cashFlowYear.opex_before_vat * vat_rate_opex_input;
                    let vat_input_annual_replacement = 0;
                    if (params.include_battery_replacement && year === params.replacement_year) {
                        vat_input_annual_replacement = replacement_cost_total_before_vat * vat_rate_capex_input;
                    }
                    const current_year_total_vat_input = vat_input_annual_opex + vat_input_annual_replacement;
                    cashFlowYear.vat_payable_net = Math.max(0, vat_output_annual - current_year_total_vat_input);
                    cashFlowYear.surtax_on_vat = cashFlowYear.vat_payable_net * surtax_rate_on_vat;
                    cashFlowYear.ebitda = cashFlowYear.total_revenue_before_vat - cashFlowYear.opex_before_vat - cashFlowYear.surtax_on_vat;

                    cashFlowYear.depreciation = 0;
                    if (year <= params.depreciation_years_initial) cashFlowYear.depreciation += annual_depreciation_initial;
                    if (params.include_battery_replacement && year > params.replacement_year) {
                        const replacement_actual_dep_years = Math.min(params.depreciation_years_replacement, params.life_span_years - params.replacement_year);
                        if (year <= params.replacement_year + replacement_actual_dep_years) cashFlowYear.depreciation += annual_depreciation_replacement;
                    }
                    cashFlowYear.ebit = cashFlowYear.ebitda - cashFlowYear.depreciation;
                    const payment = calculateEqualPrincipalPayments(loan_amount, interest_rate_annual, params.loan_term_years, year);
                    cashFlowYear.interest = payment.interest;
                    cashFlowYear.principal_repayment = payment.principal;
                    remaining_loan_balance = payment.remainingBalance;
                    cashFlowYear.ebt = cashFlowYear.ebit - cashFlowYear.interest;

                    let taxable_income_after_loss_offset = cashFlowYear.ebt;
                    let loss_offset_this_year = 0;
                    if (taxable_income_after_loss_offset > 0 && tax_losses_carry_forward.length > 0) {
                        tax_losses_carry_forward.sort((a, b) => a.year_generated - b.year_generated);
                        for (let i = 0; i < tax_losses_carry_forward.length; i++) {
                            if (taxable_income_after_loss_offset <= 0) break;
                            const offset_amount = Math.min(taxable_income_after_loss_offset, tax_losses_carry_forward[i].loss);
                            taxable_income_after_loss_offset -= offset_amount;
                            tax_losses_carry_forward[i].loss -= offset_amount;
                            loss_offset_this_year += offset_amount;
                        }
                        tax_losses_carry_forward = tax_losses_carry_forward.filter(l => l.loss > 0.01);
                    }
                    cashFlowYear.loss_offset = loss_offset_this_year;
                    cashFlowYear.taxable_income_final = taxable_income_after_loss_offset;
                    cashFlowYear.income_tax = Math.max(0, taxable_income_after_loss_offset * income_tax_rate);

                    if (cashFlowYear.ebt < 0) {
                        tax_losses_carry_forward.push({ loss: Math.abs(cashFlowYear.ebt), year_generated: year, remaining_years: params.max_loss_carry_forward_years });
                    }
                    for(let i = tax_losses_carry_forward.length - 1; i >= 0; i--) {
                        if (tax_losses_carry_forward[i].year_generated < year) {
                            tax_losses_carry_forward[i].remaining_years--;
                        }
                        if (tax_losses_carry_forward[i].remaining_years < 0) {
                            tax_losses_carry_forward.splice(i, 1);
                        }
                    }

                    cashFlowYear.net_profit = cashFlowYear.ebt - cashFlowYear.income_tax;

                    cashFlowYear.capex = 0;
                    cashFlowYear.current_year_replacement_vat_credit = 0;
                    if (params.include_battery_replacement && year === params.replacement_year) {
                        cashFlowYear.capex = -replacement_cost_total_before_vat;
                        cashFlowYear.current_year_replacement_vat_credit = replacement_vat_credit;
                    }

                    cashFlowYear.project_pre_tax_cash_flow = cashFlowYear.total_revenue_before_vat - cashFlowYear.opex_before_vat + cashFlowYear.capex + cashFlowYear.current_year_replacement_vat_credit;
                    let current_year_salvage_value_initial = 0; let current_year_salvage_value_replacement = 0;
                    if (year === params.life_span_years) {
                        if (params.life_span_years >= params.depreciation_years_initial) current_year_salvage_value_initial = total_initial_investment_for_financing_and_depreciation * salvage_rate;
                        else current_year_salvage_value_initial = total_initial_investment_for_financing_and_depreciation - (annual_depreciation_initial * params.life_span_years);
                        if (params.include_battery_replacement && params.replacement_year < params.life_span_years) {
                            const r_life = params.life_span_years - params.replacement_year; const r_dep_y = Math.min(params.depreciation_years_replacement, r_life);
                            if (r_life >= r_dep_y) current_year_salvage_value_replacement = replacement_cost_total_before_vat * salvage_rate;
                            else current_year_salvage_value_replacement = replacement_cost_total_before_vat - (annual_depreciation_replacement * r_life);
                        }
                        const total_salvage = Math.max(0,current_year_salvage_value_initial) + Math.max(0,current_year_salvage_value_replacement);
                        cashFlowYear.project_pre_tax_cash_flow += total_salvage;
                    }
                    project_pre_tax_cash_flow_series.push(cashFlowYear.project_pre_tax_cash_flow);

                    const nopat = cashFlowYear.ebit * (1 - income_tax_rate);
                    const net_vat_and_surtax_cash_outflow = cashFlowYear.vat_payable_net + cashFlowYear.surtax_on_vat;

                    cashFlowYear.fcff = nopat + cashFlowYear.depreciation + cashFlowYear.capex + cashFlowYear.current_year_replacement_vat_credit - net_vat_and_surtax_cash_outflow;
                    if (year === params.life_span_years) {
                        cashFlowYear.fcff += Math.max(0,current_year_salvage_value_initial) + Math.max(0,current_year_salvage_value_replacement);
                    }

                    cashFlowYear.fcfe = cashFlowYear.net_profit + cashFlowYear.depreciation + cashFlowYear.capex + cashFlowYear.current_year_replacement_vat_credit - cashFlowYear.principal_repayment - net_vat_and_surtax_cash_outflow;
                    if (year === params.life_span_years) {
                        cashFlowYear.fcfe += Math.max(0,current_year_salvage_value_initial) + Math.max(0,current_year_salvage_value_replacement);
                    }

                    if (staticPaybackPeriodEquity === null && cashFlowYear.fcfe > 0) {
                        cumulative_fcfe_for_payback += cashFlowYear.fcfe;
                        if (cumulative_fcfe_for_payback >= 0) {
                            let prev_cumulative_fcfe = -equity_investment + initial_investment_vat_credit;
                            for(let k=1; k < year; k++) { prev_cumulative_fcfe += annualCashFlows[k].fcfe; }
                            staticPaybackPeriodEquity = (year - 1) + (Math.abs(prev_cumulative_fcfe) / cashFlowYear.fcfe);
                        }
                    }
                    if (dynamicPaybackPeriodEquity === null && cashFlowYear.fcfe > 0) {
                        const discountedFcfe = cashFlowYear.fcfe / Math.pow(1 + equity_discount_rate, year);
                        cumulative_discounted_fcfe_for_payback += discountedFcfe;
                        if (cumulative_discounted_fcfe_for_payback >= 0) {
                            let prev_cumulative_discounted_fcfe = -equity_investment + initial_investment_vat_credit;
                            for(let k=1; k < year; k++) { prev_cumulative_discounted_fcfe += annualCashFlows[k].fcfe / Math.pow(1 + equity_discount_rate, k); }
                            dynamicPaybackPeriodEquity = (year - 1) + (Math.abs(prev_cumulative_discounted_fcfe) / discountedFcfe);
                        }
                    }
                }
                annualCashFlows.push(cashFlowYear);
            }

            // --- 4. 计算财务指标 ---
            const cleanAndEnsureNumeric = (series) => series.map(cf => toNumber(cf, 0)).filter(cf => isFinite(cf));
            const projectIRRPreTax = this.calculateIRR(cleanAndEnsureNumeric(project_pre_tax_cash_flow_series));
            const fcffSeries = cleanAndEnsureNumeric(annualCashFlows.map(cf => cf.fcff));
            const fcfeSeries = cleanAndEnsureNumeric(annualCashFlows.map(cf => cf.fcfe));
            const projectIRRPostTax = this.calculateIRR(fcffSeries);
            const equityIRRPostTax = this.calculateIRR(fcfeSeries);
            let projectNPV = null;
            if (financial && typeof financial.NPV === 'function' && fcffSeries.length > 0) {
                try { projectNPV = financial.NPV(discount_rate_wacc, ...fcffSeries); }
                catch (e) { console.error("Error calculating Project NPV with financial.NPV:", e); projectNPV = this._simpleNPV(discount_rate_wacc, fcffSeries); }
            } else { projectNPV = this._simpleNPV(discount_rate_wacc, fcffSeries); }
            let equityNPV = null;
            if (financial && typeof financial.NPV === 'function' && fcfeSeries.length > 0) {
                try { equityNPV = financial.NPV(equity_discount_rate, ...fcfeSeries); }
                catch (e) { console.error("Error calculating Equity NPV with financial.NPV:", e); equityNPV = this._simpleNPV(equity_discount_rate, fcfeSeries); }
            } else { equityNPV = this._simpleNPV(equity_discount_rate, fcfeSeries); }

            let totalLifecycleCost_lcos = total_initial_investment_for_financing_and_depreciation - initial_investment_vat_credit;
            let totalDischargedEnergyMWh_lcos = 0;
            for (let y = 1; y <= params.life_span_years; y++) {
                totalLifecycleCost_lcos += annualCashFlows[y].opex_before_vat;
                totalLifecycleCost_lcos += annualCashFlows[y].surtax_on_vat;
                if (params.include_battery_replacement && y === params.replacement_year) {
                    totalLifecycleCost_lcos += (replacement_cost_total_before_vat - replacement_vat_credit);
                }
                if (y === params.life_span_years) {
                    let salvage_value_initial_asset_lcos = 0;
                    if (params.life_span_years >= params.depreciation_years_initial) salvage_value_initial_asset_lcos = total_initial_investment_for_financing_and_depreciation * salvage_rate;
                    else salvage_value_initial_asset_lcos = total_initial_investment_for_financing_and_depreciation - (annual_depreciation_initial * params.life_span_years);
                    let salvage_value_replacement_asset_lcos = 0;
                    if (params.include_battery_replacement && params.replacement_year < params.life_span_years) {
                        const r_life = params.life_span_years - params.replacement_year; const r_dep_y = Math.min(params.depreciation_years_replacement, r_life);
                        if (r_life >= r_dep_y) salvage_value_replacement_asset_lcos = replacement_cost_total_before_vat * salvage_rate;
                        else salvage_value_replacement_asset_lcos = replacement_cost_total_before_vat - (annual_depreciation_replacement * r_life);
                    }
                    totalLifecycleCost_lcos -= (Math.max(0,salvage_value_initial_asset_lcos) + Math.max(0,salvage_value_replacement_asset_lcos));
                }
                const current_e_rated_mwh_for_lcos = params.e_rated_mwh * Math.pow(1 - deg_rate_annual, y - 1);
                totalDischargedEnergyMWh_lcos += params.n_cycles_per_year * current_e_rated_mwh_for_lcos * dod;
            }
            const lcos = totalDischargedEnergyMWh_lcos > 0 ? (totalLifecycleCost_lcos / (totalDischargedEnergyMWh_lcos * 1000)) : null;

            const results = {
                projectIRRPreTax: projectIRRPreTax !== null ? parseFloat((projectIRRPreTax * 100).toFixed(2)) : null,
                projectIRRPostTax: projectIRRPostTax !== null ? parseFloat((projectIRRPostTax * 100).toFixed(2)) : null,
                equityIRRPostTax: equityIRRPostTax !== null ? parseFloat((equityIRRPostTax * 100).toFixed(2)) : null,
                projectNPV: projectNPV !== null ? parseFloat(projectNPV.toFixed(2)) : null,
                equityNPV: equityNPV !== null ? parseFloat(equityNPV.toFixed(2)) : null,
                staticPaybackPeriodEquity: staticPaybackPeriodEquity !== null ? parseFloat(staticPaybackPeriodEquity.toFixed(2)) : null,
                dynamicPaybackPeriodEquity: dynamicPaybackPeriodEquity !== null ? parseFloat(dynamicPaybackPeriodEquity.toFixed(2)) : null,
                lcos: lcos !== null ? parseFloat(lcos.toFixed(4)) : null,
                annualCashFlows: annualCashFlows,
                summary: {
                    totalInitialInvestment: parseFloat(total_initial_investment_for_financing_and_depreciation.toFixed(2)),
                    netInitialInvestmentAfterVATCredit: parseFloat((total_initial_investment_for_financing_and_depreciation - initial_investment_vat_credit).toFixed(2)),
                    equityInvestment: parseFloat(equity_investment.toFixed(2)),
                    loanAmount: parseFloat(loan_amount.toFixed(2)),
                    totalRevenueYear1: annualCashFlows[1] ? parseFloat(annualCashFlows[1].total_revenue_before_vat.toFixed(2)) : 0,
                    totalOpexYear1: annualCashFlows[1] ? parseFloat(annualCashFlows[1].opex_before_vat.toFixed(2)) : 0,
                }
            };

            console.log("EconomicAnalysisService: Calculation completed successfully (阶段11).");
            return { success: true, message: "经济测算已完成 (阶段11)。", results };

        } catch (error) {
            console.error("EconomicAnalysisService: Calculation error (阶段11):", error, error.stack);
            return { success: false, error: `计算失败: ${error.message}` };
        }
    },

    calculateIRR: function(cashFlowsUnfiltered, guess = 0.1) {
        const cashFlows = cashFlowsUnfiltered.filter(cf => typeof cf === 'number' && !isNaN(cf) && isFinite(cf));
        if (!cashFlows || cashFlows.length < 1 || (cashFlows.length > 0 && cashFlows[0] === 0 && cashFlows.slice(1).every(cf => cf === 0))) return 0;
        if (cashFlows.length === 1 && cashFlows[0] < 0) return -1.0;
        if (cashFlows.length > 0 && cashFlows[0] > 0 && cashFlows.slice(1).every(cf => cf >=0)) return Infinity;
        if (cashFlows.length > 0 && cashFlows[0] === 0 && cashFlows.slice(1).some(cf => cf > 0) && cashFlows.slice(1).every(cf => cf >=0)) return Infinity;
        if (cashFlows.every(cf => cf <= 0) && cashFlows.some(cf => cf < 0)) return -1;
        if (cashFlows.length < 2 || (cashFlows[0] >= 0 && !cashFlows.slice(1).some(cf => cf < 0) && cashFlows.slice(1).every(cf => cf >=0))) {
            if (cashFlows[0] >=0 && cashFlows.slice(1).every(cf => cf === 0)) return 0;
        }
        if (financial && typeof financial.IRR === 'function') {
            try {
                const irrResult = financial.IRR(cashFlows, guess);
                if (irrResult === null || isNaN(irrResult) || !isFinite(irrResult)) {
                    console.warn("'financial.IRR' returned an invalid value or failed to converge. Cashflows (first 5):", cashFlows.slice(0,5), "Result:", irrResult, "Attempting fallback.");
                    return this._simpleIRR(cashFlows, guess);
                }
                return irrResult;
            } catch (e) {
                console.error("'financial.IRR' calculation error:", e, "Cashflows (first 5):", cashFlows.slice(0,5), "Attempting fallback.");
                return this._simpleIRR(cashFlows, guess);
            }
        } else {
            return this._simpleIRR(cashFlows, guess);
        }
    },
    _simpleIRR: function(cashFlows, guess = 0.1) {
        const npv = (rate) => cashFlows.reduce((acc, val, i) => acc + val / Math.pow(1 + rate, i), 0);
        let rate = guess; const MAX_ITERATIONS = 100; const TOLERANCE = 1e-7;
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            let npvAtRate = npv(rate); if (Math.abs(npvAtRate) < TOLERANCE) return rate;
            let derivative = 0;
            for(let t=1; t < cashFlows.length; t++) { if (cashFlows[t] === 0) continue; derivative -= t * cashFlows[t] / Math.pow(1 + rate, t + 1); }
            if (Math.abs(derivative) < 1e-10) {
                let low = -0.99, high = 2.0;
                for (let j = 0; j < 100; j++) { let mid = (low + high) / 2; if (Math.abs(high-low) < TOLERANCE || mid === low || mid === high) break; let npvMid = npv(mid); if (Math.abs(npvMid) < TOLERANCE) return mid; if (npv(low) * npvMid < 0) high = mid; else low = mid;}
                return null;
            }
            let newRate = rate - npvAtRate / derivative; if (Math.abs(newRate - rate) < TOLERANCE) return newRate;
            rate = newRate; if (rate < -0.9999 || rate > 5) { /* return null; */ }
        }
        return null;
    },
    _simpleNPV: function(rate, cashFlows) {
        if (!cashFlows || cashFlows.length === 0) return 0;
        return cashFlows.reduce((acc, val, i) => {
            if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return acc;
            return acc + val / Math.pow(1 + rate, i);
        }, 0);
    }
};

module.exports = EconomicAnalysisService;
