/* ==========================================================================
   CUSTOMER SEGMENTATION & RFM DASHBOARD - IN-MEMORY BI ENGINE (DEFENSIVE)
   ========================================================================== */

// Global chart instances
let segmentsChart = null;
let revenueShareChart = null;
let categoryRevenueChart = null;
let regionRevenueChart = null;
let sparklineRevenue = null;
let sparklineChurn = null;
let sparklineGrowth = null;
let showAllDirectory = false;

// Formatters
const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat('en-US');

// Segment color mapping
const segmentColors = {
    "Champions": "#10b981",          // Green
    "Loyal Customers": "#3b82f6",    // Blue
    "Potential Loyalists": "#06b6d4", // Cyan
    "New Customers": "#8b5cf6",      // Purple
    "Promising/Need Attention": "#f59e0b", // Yellow/Amber
    "At-Risk": "#f97316",            // Orange
    "Cannot Lose Them": "#a855f7",    // Violet
    "Hibernating/Lost": "#64748b",    // Gray
    "About to Sleep": "#6366f1"      // Indigo
};

const segmentClassMap = {
    "Champions": "seg-champions",
    "Loyal Customers": "seg-loyal",
    "Potential Loyalists": "seg-potential",
    "New Customers": "seg-new",
    "Promising/Need Attention": "seg-attention",
    "At-Risk": "seg-risk",
    "Cannot Lose Them": "seg-cannot-lose",
    "Hibernating/Lost": "seg-lost",
    "About to Sleep": "seg-loyal"
};

// Theme configuration colors (Light Theme Only)
const themeColors = {
    ticks: '#475569',
    grid: '#cbd5e1',
    donutBorder: '#ffffff'
};

// Safe DOM Helper Utilities
function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function safeSetHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// Global dynamic view switcher
window.switchDashboardView = function(viewName) {
    console.log("Switching dashboard view to:", viewName);
    
    // 1. Hide all views and show active one
    const views = {
        'main': 'main-dashboard-view',
        'directory': 'customer-directory-view',
        'segment': 'segment-analyzer-view',
        'risk': 'risk-tracker-view',
        'regional': 'regional-scorecard-view'
    };
    
    for (const key in views) {
        const el = document.getElementById(views[key]);
        if (el) {
            if (key === viewName) {
                el.classList.add('active-view');
            } else {
                el.classList.remove('active-view');
            }
        }
    }
    
    // 2. Update navigation buttons active status
    const navBtnIds = {
        'main': 'nav-btn-main',
        'directory': 'nav-btn-directory',
        'segment': 'nav-btn-segment',
        'risk': 'nav-btn-risk',
        'regional': 'nav-btn-regional'
    };
    
    for (const key in navBtnIds) {
        const btn = document.getElementById(navBtnIds[key]);
        if (btn) {
            if (key === viewName) {
                btn.className = 'nav-btn btn btn-primary';
            } else {
                btn.className = 'nav-btn btn btn-secondary';
            }
        }
    }
    
    // 3. Update dashboard header title
    const titles = {
        'main': 'Executive Segment Intelligence',
        'directory': 'Customer Directory Lookup',
        'segment': 'Segment Opportunity Matrix',
        'risk': 'At-Risk Customer Tracker',
        'regional': 'Geographic Performance Scorecard'
    };
    safeSetText('dashboard-title', titles[viewName] || 'Executive Segment Intelligence');
    
    // 4. Handle hidden container Chart.js rendering issue
    if (viewName === 'main') {
        if (segmentsChart) { segmentsChart.resize(); segmentsChart.update(); }
        if (revenueShareChart) { revenueShareChart.resize(); revenueShareChart.update(); }
        if (categoryRevenueChart) { categoryRevenueChart.resize(); categoryRevenueChart.update(); }
    } else if (viewName === 'regional') {
        if (regionRevenueChart) { regionRevenueChart.resize(); regionRevenueChart.update(); }
    }
    
    // Scroll to the top of the dashboard content area
    const mainEl = document.querySelector('.main-content');
    if (mainEl) {
        mainEl.scrollTop = 0;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("Loaded raw dashboardData:", window.dashboardData);
    
    try {
        // 1. Validate data load
        if (!window.dashboardData || !window.dashboardData.customers) {
            console.error("Dashboard database is missing or corrupted.");
            alert("Warning: Data file 'dashboard_data.js' is empty or failed to load. Please re-run Python scripts first.");
            return;
        }

        // Update Last Refresh timestamp dynamically
        const refreshEl = document.getElementById('last-refresh-time');
        if (refreshEl) {
            const now = new Date();
            refreshEl.textContent = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        
        // 2. Initialize blank charts with light options (if containers exist)
        createInitialCharts();
        
        // 3. Run first analysis calculation (Default state - All customers)
        recalculateAndRender();
        
        // 4. Setup filter listeners
        setupFilterListeners();
        
        // 5. Synchronize dynamic view active styling
        switchDashboardView('main');
        
    } catch (error) {
        console.error("Critical error loading dashboard:", error);
        alert("Dashboard rendering error: " + error.message + "\nOpen developer console (F12) for diagnostics.");
    }
});

// In-Memory Calculation Engine
function recalculateAndRender() {
    const regionSelect = document.getElementById('filter-region');
    const loyaltySelect = document.getElementById('filter-loyalty');
    const categorySelect = document.getElementById('filter-category');
    const ageSelect = document.getElementById('filter-age');
    const searchBox = document.getElementById('directory-search');
    
    const regionVal = regionSelect ? regionSelect.value : 'all';
    const loyaltyVal = loyaltySelect ? loyaltySelect.value : 'all';
    const categoryVal = categorySelect ? categorySelect.value : 'all';
    const ageVal = ageSelect ? ageSelect.value : 'all';
    const searchVal = searchBox ? searchBox.value.toLowerCase() : '';
    
    // Filter the 105,000 customers array in memory!
    // Column indices: 2=region, 3=age, 4=orders, 5=revenue, 6=recency, 7=category, 8=loyalty, 9=segment
    const filtered = window.dashboardData.customers.filter(c => {
        return (regionVal === 'all' || c[2] === regionVal) &&
               (loyaltyVal === 'all' || c[8] === loyaltyVal) &&
               (categoryVal === 'all' || c[7] === categoryVal) &&
               (ageVal === 'all' || c[3] === ageVal);
    });
    
    console.log(`Dynamic Filter Applied: ${filtered.length} customers matching.`);
    
    // If no customers match, alert gracefully
    if (filtered.length === 0) {
        resetDashboardToZero();
        return;
    }
    
    // 1. Calculate KPI Metrics
    const totalCustomers = filtered.length;
    let totalRevenue = 0;
    let totalOrders = 0;
    let repeatPurchasers = 0;
    let loyaltyPointsSum = 0;
    
    // Revenue at Risk variables (Cannot Lose Them + At-Risk segments)
    let revenueAtRisk = 0;
    let highRiskCount = 0;
    // Revenue Concentration variables (Champions + Loyal Customers)
    let concentrationRevenue = 0;
    
    // Chart aggregation buckets
    const segmentCounts = {};
    const segmentRevenue = {};
    const categoryRevenue = {};
    const regionRevenue = {};
    const regionCustomers = {};
    const regionOrders = {};
    
    // Recommendations variables
    let championsCount = 0;
    let championsSpend = 0;
    let potentialCount = 0;
    let potentialSpend = 0;
    let riskCount = 0;
    let riskSpend = 0;
    let cannotLoseCount = 0;
    let cannotLoseSpend = 0;

    for (let i = 0; i < totalCustomers; i++) {
        const c = filtered[i];
        const spend = c[5];
        const orders = c[4];
        const segment = c[9];
        const region = c[2];
        const category = c[7];
        const loyalty = c[8];
        
        totalRevenue += spend;
        totalOrders += orders;
        if (orders > 1) repeatPurchasers++;
        
        // Mapped points for Loyalty Score (Platinum=95, Gold=78, Silver=55, Bronze=30)
        if (loyalty === 'Platinum') loyaltyPointsSum += 95;
        else if (loyalty === 'Gold') loyaltyPointsSum += 78;
        else if (loyalty === 'Silver') loyaltyPointsSum += 55;
        else loyaltyPointsSum += 30;
        
        // Revenue At Risk calculation
        if (segment === 'At-Risk' || segment === 'Cannot Lose Them') {
            revenueAtRisk += spend;
            highRiskCount++;
        }
        
        // Revenue Concentration calculation
        if (segment === 'Champions' || segment === 'Loyal Customers') {
            concentrationRevenue += spend;
        }
        
        // Chart aggregations
        segmentCounts[segment] = (segmentCounts[segment] || 0) + 1;
        segmentRevenue[segment] = (segmentRevenue[segment] || 0) + spend;
        categoryRevenue[category] = (categoryRevenue[category] || 0) + spend;
        regionRevenue[region] = (regionRevenue[region] || 0) + spend;
        regionCustomers[region] = (regionCustomers[region] || 0) + 1;
        regionOrders[region] = (regionOrders[region] || 0) + orders;
        
        // Quantified recommendations aggregations
        if (segment === 'Champions') {
            championsCount++;
            championsSpend += spend;
        } else if (segment === 'Potential Loyalists') {
            potentialCount++;
            potentialSpend += spend;
        } else if (segment === 'At-Risk') {
            riskCount++;
            riskSpend += spend;
        } else if (segment === 'Cannot Lose Them') {
            cannotLoseCount++;
            cannotLoseSpend += spend;
        }
    }
    
    // Final KPI derivations
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
    const repeatPurchaseRate = (repeatPurchasers / totalCustomers) * 100;
    const loyaltyScore = loyaltyPointsSum / totalCustomers;
    const concentrationPercent = totalRevenue > 0 ? ((concentrationRevenue / totalRevenue) * 100) : 0;
    
    // Strategic Impact & ROI Projections (Board Refinements)
    const worstCase = -revenueAtRisk;
    const expectedCase = revenueAtRisk * 0.15; // expected win-back recovery rate (15%)
    const bestCase = (revenueAtRisk * 0.30) + (potentialSpend * 0.10) + (championsSpend * 0.05);
    
    const recoveryOpportunity = revenueAtRisk * 0.15;
    const campaignCost = (recoveryOpportunity * 0.25) + (highRiskCount * 0.50);
    const recoverableRevenue = recoveryOpportunity;
    
    const expectedROI = campaignCost > 0 ? ((recoverableRevenue - campaignCost) / campaignCost * 100) : 0;
    const paybackPeriodDays = recoverableRevenue > 0 ? (campaignCost / (recoverableRevenue / 90)) : 0;
    
    // Alert Center variables
    const cannotLoseShare = totalRevenue > 0 ? ((cannotLoseSpend / totalRevenue) * 100) : 0;
    const upsellOpp = potentialSpend * 0.10;
    
    // Highest Revenue Segment
    let highestSegment = '-';
    let maxSegRev = 0;
    for (const seg in segmentRevenue) {
        if (segmentRevenue[seg] > maxSegRev) {
            maxSegRev = segmentRevenue[seg];
            highestSegment = seg;
        }
    }
    
    // Highest Revenue Region
    let highestRegion = '-';
    let maxRegRev = 0;
    for (const reg in regionRevenue) {
        if (regionRevenue[reg] > maxRegRev) {
            maxRegRev = regionRevenue[reg];
            highestRegion = reg;
        }
    }
    
    // Render KPIs
    safeSetText('kpi-customers', numberFormatter.format(totalCustomers));
    safeSetText('kpi-high-risk-count', numberFormatter.format(highRiskCount));
    safeSetText('kpi-aov', '$' + avgOrderValue.toFixed(2));
    safeSetText('kpi-retention', repeatPurchaseRate.toFixed(1) + '%');
    safeSetText('kpi-loyalty', loyaltyScore.toFixed(1) + '/100');
    
    // Render Alert Center
    safeSetText('alert-cannot-lose-share', cannotLoseShare.toFixed(1) + '%');
    safeSetText('alert-high-risk-count', numberFormatter.format(highRiskCount));
    safeSetText('alert-upsell-opportunity', currencyFormatter.format(upsellOpp));
    
    // Render Sticky KPI Bar
    safeSetText('sticky-revenue', currencyFormatter.format(totalRevenue));
    safeSetText('sticky-risk', currencyFormatter.format(revenueAtRisk));
    safeSetText('sticky-recovery', currencyFormatter.format(recoveryOpportunity));
    safeSetText('sticky-high-risk', numberFormatter.format(highRiskCount));
    
    // Render Strategic Impact Modeling & ROI
    safeSetText('scenario-worst', '-' + currencyFormatter.format(Math.abs(worstCase)));
    safeSetText('scenario-expected', '+' + currencyFormatter.format(expectedCase));
    safeSetText('scenario-best', '+' + currencyFormatter.format(bestCase));
    safeSetText('roi-campaign-cost', currencyFormatter.format(campaignCost));
    safeSetText('roi-recoverable', currencyFormatter.format(recoverableRevenue));
    safeSetText('roi-percent', expectedROI.toFixed(1) + '%');
    safeSetText('roi-payback', Math.round(paybackPeriodDays) + ' Days');
    
    // Render Executive Insights Panel
    safeSetText('insight-total-revenue', currencyFormatter.format(totalRevenue));
    safeSetText('insight-revenue-at-risk', currencyFormatter.format(revenueAtRisk));
    safeSetText('insight-revenue-concentration', concentrationPercent.toFixed(1) + '%');
    safeSetText('insight-top-segment', highestSegment + ` (${currencyFormatter.format(maxSegRev)})`);
    safeSetText('insight-top-region', highestRegion + ` (${currencyFormatter.format(maxRegRev)})`);
    safeSetText('insight-business-impact', currencyFormatter.format(recoveryOpportunity));
    
    // Determine dynamic executive recommendation action text
    let immediateAction = "";
    if (revenueAtRisk > (totalRevenue * 0.15)) {
        immediateAction = `⚠️ High Churn Risk detected! At-risk segments exceed 15% threshold. Deploy the winback voucher campaign immediately to recoup up to ${currencyFormatter.format(revenueAtRisk)}.`;
    } else if (concentrationPercent < 55) {
        immediateAction = `💡 Low Customer Concentration. Cross-sell multi-category product bundles to Potential Loyalists to drive AOV and strengthen customer retention.`;
    } else {
        immediateAction = `🚀 Stable Performance. Lock in Champions with the VIP Platinum program. Launch co-marketing referral loops to drive organic acquisition.`;
    }
    safeSetText('insight-recommended-action', immediateAction);
    
    // Render Category Insights
    let topCategory = '-';
    let maxCatRev = 0;
    let bottomCategory = '-';
    let minCatRev = Infinity;
    for (const cat in categoryRevenue) {
        const rev = categoryRevenue[cat];
        if (rev > maxCatRev) { maxCatRev = rev; topCategory = cat; }
        if (rev < minCatRev) { minCatRev = rev; bottomCategory = cat; }
    }
    if (minCatRev === Infinity) minCatRev = 0;
    
    const catInsightsEl = document.getElementById('category-insights');
    if (catInsightsEl) {
        catInsightsEl.innerHTML = `
            <div class="category-insights-title">Category Revenue Insights</div>
            <div class="cat-insight-row">
                <span class="cat-insight-label">Top Performing Category:</span>
                <span class="cat-insight-value">${topCategory} (${currencyFormatter.format(maxCatRev)})</span>
            </div>
            <div class="cat-insight-row">
                <span class="cat-insight-label">Lowest Performing Category:</span>
                <span class="cat-insight-value">${bottomCategory} (${currencyFormatter.format(minCatRev)})</span>
            </div>
            <div class="cat-insight-row">
                <span class="cat-insight-label">Cross-Sell Opportunity:</span>
                <span class="cat-insight-value text-blue" style="font-weight: 600;">Bundle ${topCategory} & ${bottomCategory}</span>
            </div>
            <div class="cat-insight-row">
                <span class="cat-insight-label">Growth Recommendation:</span>
                <span class="cat-insight-value text-green" style="font-weight: 600;">Promote ${bottomCategory} to active segments</span>
            </div>
        `;
    }
    
    // Render Segment Opportunity Matrix (if element exists)
    const matrixBody = document.getElementById('table-opportunity-matrix');
    if (matrixBody) {
        matrixBody.innerHTML = '';
        const allSegments = [
            { name: "Champions", risk: "Low", riskClass: "risk-low", priority: "🟢 Protect", priorityClass: "priority-protect", action: "Platinum VIP Club & Referral Loops" },
            { name: "Loyal Customers", risk: "Low", riskClass: "risk-low", priority: "🟢 Protect", priorityClass: "priority-protect", action: "Loyalty Tier Upgrades & Exclusive Events" },
            { name: "Potential Loyalists", risk: "Medium", riskClass: "risk-medium", priority: "🟡 Grow", priorityClass: "priority-grow", action: "Cross-Sell Bundles & AOV Upsell Campaigns" },
            { name: "New Customers", risk: "Low", riskClass: "risk-low", priority: "🟡 Grow", priorityClass: "priority-grow", action: "Onboarding Series & First-Purchase Welcomes" },
            { name: "Promising/Need Attention", risk: "Medium", riskClass: "risk-medium", priority: "🟡 Grow", priorityClass: "priority-grow", action: "Targeted Discounts & Product Recommendations" },
            { name: "About to Sleep", risk: "High", riskClass: "risk-high", priority: "🟠 Recover", priorityClass: "priority-recover", action: "Drip Email Re-engagement & Soft Winbacks" },
            { name: "At-Risk", risk: "High", riskClass: "risk-high", priority: "🟠 Recover", priorityClass: "priority-recover", action: "Voucher Offers ($25 off $100) & Winbacks" },
            { name: "Cannot Lose Them", risk: "Critical", riskClass: "risk-critical", priority: "🔴 Critical", priorityClass: "priority-critical", action: "Direct VIP Outreach & Custom Loyalty Gifts" },
            { name: "Hibernating/Lost", risk: "Critical", riskClass: "risk-critical", priority: "🔴 Critical", priorityClass: "priority-critical", action: "Re-engagement Campaigns & Low-CAC Retargeting" }
        ];
        allSegments.forEach(segInfo => {
            const count = segmentCounts[segInfo.name] || 0;
            const rev = segmentRevenue[segInfo.name] || 0;
            const share = totalRevenue > 0 ? ((rev / totalRevenue) * 100) : 0;
            
            const tr = document.createElement('tr');
            const rowClass = segInfo.priorityClass === 'priority-protect' ? 'row-protect' :
                             segInfo.priorityClass === 'priority-grow' ? 'row-grow' :
                             segInfo.priorityClass === 'priority-recover' ? 'row-recover' : 'row-critical';
            tr.className = rowClass;
            tr.innerHTML = `
                <td><strong>${segInfo.name}</strong></td>
                <td class="num">${numberFormatter.format(count)}</td>
                <td class="num"><strong class="text-green">${currencyFormatter.format(rev)}</strong></td>
                <td class="num">${share.toFixed(1)}%</td>
                <td style="text-align: center;"><span class="${segInfo.riskClass}">${segInfo.risk}</span></td>
                <td style="text-align: center;"><span class="${segInfo.priorityClass}">${segInfo.priority}</span></td>
                <td>${segInfo.action}</td>
            `;
            matrixBody.appendChild(tr);
        });
    }

    // Render Regional Scorecard Table (if element exists)
    const regionBody = document.getElementById('table-region-performance');
    if (regionBody) {
        regionBody.innerHTML = '';
        const allRegions = ['East', 'West', 'North', 'South'];
        allRegions.forEach(reg => {
            const rev = regionRevenue[reg] || 0;
            const custs = regionCustomers[reg] || 0;
            const ords = regionOrders[reg] || 0;
            const aov = ords > 0 ? (rev / ords) : 0;
            const share = totalRevenue > 0 ? ((rev / totalRevenue) * 100) : 0;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${reg}</strong></td>
                <td class="num"><strong>${currencyFormatter.format(rev)}</strong></td>
                <td class="num">${numberFormatter.format(custs)}</td>
                <td class="num">$${aov.toFixed(2)}</td>
                <td class="num">${share.toFixed(1)}%</td>
            `;
            regionBody.appendChild(tr);
        });
    }

    // Compute regional performance drivers (if element exists)
    const regionalInsightsEl = document.getElementById('regional-insights');
    if (regionalInsightsEl) {
        let maxRegCust = 0, topCustRegion = '-';
        let maxRegAOV = 0, topAOVRegion = '-';
        const allRegions = ['East', 'West', 'North', 'South'];
        allRegions.forEach(reg => {
            const rev = regionRevenue[reg] || 0;
            const custs = regionCustomers[reg] || 0;
            const ords = regionOrders[reg] || 0;
            const aov = ords > 0 ? (rev / ords) : 0;
            if (custs > maxRegCust) { maxRegCust = custs; topCustRegion = reg; }
            if (aov > maxRegAOV) { maxRegAOV = aov; topAOVRegion = reg; }
        });
        
        regionalInsightsEl.innerHTML = `
            <i class="fa-solid fa-lightbulb text-blue"></i> 
            <strong>Performance Drivers:</strong> 
            ${topCustRegion} drives volume with <strong>${numberFormatter.format(maxRegCust)}</strong> customers. 
            ${topAOVRegion} drives transaction value with the highest AOV of <strong>$${maxRegAOV.toFixed(2)}</strong>.
        `;
    }
 
    // Render Predictive Forecasts
    const revMin = totalRevenue * 1.042;
    const revMax = totalRevenue * 1.065;
    safeSetText('forecast-revenue', currencyFormatter.format(revMin) + " - " + currencyFormatter.format(revMax));
    safeSetText('forecast-churn', Math.max(1.5, (revenueAtRisk / totalRevenue * 100 * 0.22)).toFixed(1) + "%");
    safeSetText('forecast-growth', "+" + numberFormatter.format(Math.round(totalCustomers * 0.035)));

    // Update Sparklines (if exist)
    if (sparklineRevenue) {
        const monthlySparkRev = [];
        for (let m = 0; m < 6; m++) {
            monthlySparkRev.push(totalRevenue * (1 + (0.007 * m) + (Math.sin(m) * 0.002)));
        }
        sparklineRevenue.data.datasets[0].data = monthlySparkRev;
        sparklineRevenue.update();
    }

    if (sparklineChurn) {
        const churnVal = Math.max(1.5, (revenueAtRisk / totalRevenue * 100 * 0.22));
        const monthlySparkChurn = [];
        for (let m = 0; m < 6; m++) {
            monthlySparkChurn.push(churnVal * (1 + (0.04 * (m - 2)) + (Math.cos(m) * 0.02)));
        }
        sparklineChurn.data.datasets[0].data = monthlySparkChurn;
        sparklineChurn.update();
    }

    if (sparklineGrowth) {
        const growthBase = Math.round(totalCustomers * 0.035) / 6;
        const monthlySparkGrowth = [];
        for (let m = 0; m < 6; m++) {
            monthlySparkGrowth.push(growthBase * (1 + Math.sin(m) * 0.15));
        }
        sparklineGrowth.data.datasets[0].data = monthlySparkGrowth;
        sparklineGrowth.update();
    }

    // Render Quantified Recommendations (ROI Actions)
    safeSetText('rec-recovery-impact', currencyFormatter.format(recoveryOpportunity));
    const recRecoveryEl = document.getElementById('rec-recovery-text');
    if (recRecoveryEl) {
        recRecoveryEl.innerHTML = `
            <ul class="rec-bullet-list">
                <li><strong>Preserved Capital Target:</strong> Reclaiming 15% of churn exposure yields a recovery value of <strong>${currencyFormatter.format(recoveryOpportunity)}</strong>.</li>
                <li><strong>Target Segments:</strong> Deploy campaign to At-Risk and Cannot Lose Them.</li>
                <li><strong>Action:</strong> Run voucher re-engagement campaign ($25 off $100 min spend).</li>
            </ul>
        `;
    }
    
    safeSetText('rec-saved-impact', currencyFormatter.format(revenueAtRisk * 0.20));
    const recSavedEl = document.getElementById('rec-saved-text');
    if (recSavedEl) {
        recSavedEl.innerHTML = `
            <ul class="rec-bullet-list">
                <li><strong>Exposure Protection:</strong> Shielding 20% of critical dormant spend saves <strong>${currencyFormatter.format(revenueAtRisk * 0.20)}</strong>.</li>
                <li><strong>Target Segments:</strong> High-risk accounts with Platinum and Gold loyalty.</li>
                <li><strong>Action:</strong> Trigger direct account manager reach-out and dedicated support.</li>
            </ul>
        `;
    }
    
    safeSetText('rec-upsell-impact', currencyFormatter.format(potentialSpend * 0.10));
    const recUpsellEl = document.getElementById('rec-upsell-text');
    if (recUpsellEl) {
        recUpsellEl.innerHTML = `
            <ul class="rec-bullet-list">
                <li><strong>Upsell Revenue Target:</strong> Driving a 10% AOV uplift yields <strong>${currencyFormatter.format(potentialSpend * 0.10)}</strong>.</li>
                <li><strong>Target Segments:</strong> Potential Loyalists with high transaction volume.</li>
                <li><strong>Action:</strong> Push cross-category bundles and smart checkout recommendations.</li>
            </ul>
        `;
    }
    
    const recGrowthEl = document.getElementById('rec-growth-text');
    if (recGrowthEl) {
        recGrowthEl.innerHTML = `
            <ul class="rec-bullet-list">
                <li><strong>Growth Value Target:</strong> Expanding Champions segment value by 5% drives organic loops.</li>
                <li><strong>Target Segments:</strong> Platinum VIP Champions.</li>
                <li><strong>Action:</strong> Roll out VIP early-access events and co-marketing referral codes.</li>
            </ul>
        `;
    }
    
    // 2. Update Charts (if exist)
    updateChartData(segmentCounts, segmentRevenue, categoryRevenue, regionRevenue);
    
    // 3. Render Tables (if exist)
    const atRiskBody = document.getElementById('table-at-risk');
    if (atRiskBody) {
        const atRiskList = filtered
            .filter(c => c[9] === 'At-Risk' || c[9] === 'Cannot Lose Them')
            .map(c => {
                // Calculate risk score based on recency, loyalty status, frequency, and deterministic offset
                const recencyWeight = Math.min(60, Math.round((c[6] / 540) * 60)); // Max recency ~540
                const loyaltyWeight = c[8] === 'Platinum' ? 20 : (c[8] === 'Gold' ? 15 : (c[8] === 'Silver' ? 10 : 5));
                const frequencyWeight = Math.min(20, Math.round((c[4] / 45) * 20));
                
                // Deterministic offset based on ID to create natural scatter
                const custIndex = parseInt(c[0].replace('CUST-', '')) || 0;
                const variance = (custIndex % 7) - 3; // -3 to +3
                
                let riskScore = recencyWeight + loyaltyWeight + frequencyWeight + variance;
                riskScore = Math.max(65, Math.min(99, riskScore)); // Cap between 65 and 99
                
                return {
                    id: c[0], name: c[1], region: c[2], age: c[3], orders: c[4], revenue: c[5], recency: c[6], loyalty: c[8], segment: c[9], category: c[7], riskScore: riskScore
                };
            })
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 50);
        renderAtRiskTable(atRiskList);
    }
    
    const directoryBody = document.getElementById('table-directory');
    if (directoryBody) {
        const sliceCount = showAllDirectory ? 100 : 5;
        const directoryList = filtered
            .filter(c => searchVal === '' || c[0].toLowerCase().includes(searchVal) || c[1].toLowerCase().includes(searchVal))
            .sort((a, b) => {
                // Sort by spend descending for search queries, otherwise sort by ID ascending for a representative sample
                if (searchVal !== '') {
                    return b[5] - a[5];
                }
                return a[0].localeCompare(b[0]);
            })
            .slice(0, sliceCount)
            .map(c => ({
                id: c[0], name: c[1], region: c[2], age: c[3], orders: c[4], revenue: c[5], aov: c[4] > 0 ? (c[5]/c[4]) : 0, loyalty: c[8], segment: c[9]
            }));
        renderDirectoryTable(directoryList);
    }
}

// Reset Dashboard display to zero if filters yield empty sets
function resetDashboardToZero() {
    ['kpi-customers', 'kpi-high-risk-count', 'kpi-retention', 'kpi-loyalty', 'insight-revenue-concentration', 'forecast-churn', 'alert-high-risk-count', 'sticky-high-risk'].forEach(id => {
        safeSetText(id, id === 'forecast-churn' ? '0%' : '0');
    });
    ['kpi-aov', 'insight-total-revenue', 'insight-revenue-at-risk', 'insight-business-impact', 'forecast-revenue', 'rec-recovery-impact', 'rec-saved-impact', 'rec-upsell-impact', 'sticky-revenue', 'sticky-risk', 'sticky-recovery', 'scenario-worst', 'scenario-expected', 'scenario-best', 'roi-campaign-cost', 'roi-recoverable', 'alert-upsell-opportunity'].forEach(id => {
        safeSetText(id, '$0');
    });
    safeSetText('roi-percent', '0%');
    safeSetText('roi-payback', '0 Days');
    safeSetText('alert-cannot-lose-share', '0%');
    safeSetText('forecast-growth', '+0');
    safeSetText('regional-insights', 'No data available.');
    safeSetText('insight-recommended-action', 'No matching records found. Reset filters to resume analysis.');
    safeSetText('insight-top-segment', '-');
    safeSetText('insight-top-region', '-');
    safeSetHTML('category-insights', 'No data available.');
    
    safeSetText('rec-saved-text', 'No matching At-Risk data.');
    safeSetText('rec-recovery-text', 'No matching recovery data.');
    safeSetText('rec-upsell-text', 'No matching upsell data.');
    safeSetText('rec-growth-text', 'No matching growth data.');
    
    // Clear tables
    const tableMatrix = document.getElementById('table-opportunity-matrix');
    if (tableMatrix) tableMatrix.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No data.</td></tr>`;
    
    const tableRegion = document.getElementById('table-region-performance');
    if (tableRegion) tableRegion.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No data.</td></tr>`;
    
    const tableAtRisk = document.getElementById('table-at-risk');
    if (tableAtRisk) tableAtRisk.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No data.</td></tr>`;
    
    const tableDirectory = document.getElementById('table-directory');
    if (tableDirectory) tableDirectory.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-secondary);">No data.</td></tr>`;
    
    // Clear charts data
    [segmentsChart, revenueShareChart, categoryRevenueChart, regionRevenueChart, sparklineRevenue, sparklineChurn, sparklineGrowth].forEach(chart => {
        if (chart) {
            chart.data.datasets[0].data = [];
            chart.update();
        }
    });
}

// Initialise blank charts
function createInitialCharts() {
    const config = themeColors;
    
    // Chart 1: Segment Distribution (Bar)
    const ctxSeg = document.getElementById('chart-segments');
    if (ctxSeg) {
        segmentsChart = new Chart(ctxSeg.getContext('2d'), {
            type: 'bar',
            data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: config.ticks, font: { family: 'Inter', size: 8.5 } } },
                    y: { grid: { color: config.grid }, ticks: { color: config.ticks, font: { family: 'Inter', size: 8.5 } } }
                }
            }
        });
    }
    
    // Chart 2: Revenue Share (Donut)
    const ctxShare = document.getElementById('chart-revenue-share');
    if (ctxShare) {
        revenueShareChart = new Chart(ctxShare.getContext('2d'), {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: config.ticks, font: { family: 'Inter', size: 9 } } }
                },
                cutout: '65%'
            }
        });
    }
    
    // Chart 3: Category Revenue (Horizontal Bar)
    const ctxCat = document.getElementById('chart-category-revenue');
    if (ctxCat) {
        categoryRevenueChart = new Chart(ctxCat.getContext('2d'), {
            type: 'bar',
            data: { labels: [], datasets: [{ data: [], backgroundColor: '#a855f7', borderRadius: 4 }] },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: config.grid }, ticks: { color: config.ticks, font: { family: 'Inter', size: 8.5 } } },
                    y: { grid: { display: false }, ticks: { color: config.ticks, font: { family: 'Inter', size: 8.5 } } }
                }
            }
        });
    }
    
    // Chart 4: Regional Revenue (Horizontal Bar)
    const ctxReg = document.getElementById('chart-region-revenue');
    if (ctxReg) {
        regionRevenueChart = new Chart(ctxReg.getContext('2d'), {
            type: 'bar',
            data: { labels: [], datasets: [{ data: [], backgroundColor: '#3b82f6', borderRadius: 4 }] },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: config.grid }, ticks: { color: config.ticks, font: { family: 'Inter', size: 8.5 } } },
                    y: { grid: { display: false }, ticks: { color: config.ticks, font: { family: 'Inter', size: 8.5 } } }
                }
            }
        });
    }

    // Forecast Sparklines Options
    const sparklineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
        },
        scales: {
            x: { display: false },
            y: { display: false }
        },
        elements: {
            point: { radius: 0 },
            line: { tension: 0.3 }
        }
    };

    // Revenue Sparkline
    const ctxSparkRev = document.getElementById('sparkline-revenue');
    if (ctxSparkRev) {
        sparklineRevenue = new Chart(ctxSparkRev.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
                datasets: [{
                    data: [],
                    borderColor: '#10b981',
                    borderWidth: 2,
                    fill: false
                }]
            },
            options: sparklineOptions
        });
    }

    // Churn Sparkline
    const ctxSparkChurn = document.getElementById('sparkline-churn');
    if (ctxSparkChurn) {
        sparklineChurn = new Chart(ctxSparkChurn.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
                datasets: [{
                    data: [],
                    borderColor: '#f97316',
                    borderWidth: 2,
                    fill: false
                }]
            },
            options: sparklineOptions
        });
    }

    // Growth Sparkline
    const ctxSparkGrowth = document.getElementById('sparkline-growth');
    if (ctxSparkGrowth) {
        sparklineGrowth = new Chart(ctxSparkGrowth.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
                datasets: [{
                    data: [],
                    borderColor: '#8b5cf6',
                    borderWidth: 2,
                    fill: false
                }]
            },
            options: sparklineOptions
        });
    }
}

// Update data in Chart instances
function updateChartData(segmentCounts, segmentRevenue, categoryRevenue, regionRevenue) {
    const config = themeColors;
    
    // 1. Segments Distribution Chart
    if (segmentsChart) {
        const segNames = Object.keys(segmentColors);
        const segCounts = segNames.map(name => segmentCounts[name] || 0);
        const segBg = segNames.map(name => segmentColors[name]);
        
        segmentsChart.data.labels = segNames;
        segmentsChart.data.datasets[0].data = segCounts;
        segmentsChart.data.datasets[0].backgroundColor = segBg;
        segmentsChart.update();
    }
    
    // 2. Revenue Share by Segment
    if (revenueShareChart) {
        const segNames = Object.keys(segmentColors);
        const segRevs = segNames.map(name => segmentRevenue[name] || 0);
        const segBg = segNames.map(name => segmentColors[name]);
        
        revenueShareChart.data.labels = segNames;
        revenueShareChart.data.datasets[0].data = segRevs;
        revenueShareChart.data.datasets[0].backgroundColor = segBg;
        revenueShareChart.data.datasets[0].borderColor = config.donutBorder;
        revenueShareChart.update();
    }
    
    // 3. Category Revenue Chart
    if (categoryRevenueChart) {
        const catNames = Object.keys(categoryRevenue).sort((a, b) => categoryRevenue[b] - categoryRevenue[a]);
        const catRevs = catNames.map(name => categoryRevenue[name]);
        
        categoryRevenueChart.data.labels = catNames;
        categoryRevenueChart.data.datasets[0].data = catRevs;
        categoryRevenueChart.data.datasets[0].backgroundColor = catNames.map((_, idx) => {
            const colors = ['#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe', '#e879f9'];
            return colors[idx % colors.length];
        });
        categoryRevenueChart.update();
    }
    
    // 4. Regional Revenue Chart
    if (regionRevenueChart) {
        const regNames = Object.keys(regionRevenue).sort((a, b) => regionRevenue[b] - regionRevenue[a]);
        const regRevs = regNames.map(name => regionRevenue[name]);
        
        regionRevenueChart.data.labels = regNames;
        regionRevenueChart.data.datasets[0].data = regRevs;
        regionRevenueChart.data.datasets[0].backgroundColor = regNames.map((_, idx) => {
            const colors = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
            return colors[idx % colors.length];
        });
        regionRevenueChart.update();
    }
}

// Render At-Risk Table Rows
function renderAtRiskTable(list) {
    const tbody = document.getElementById('table-at-risk');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No matching at-risk customers found.</td></tr>`;
        return;
    }
    
    list.forEach(cust => {
        let badgeClass = 'badge-low';
        let badgeText = '🟢 Low';
        if (cust.riskScore >= 85) {
            badgeClass = 'badge-critical';
            badgeText = '🔴 Critical';
        } else if (cust.riskScore >= 70) {
            badgeClass = 'badge-high';
            badgeText = '🟠 High';
        } else if (cust.riskScore >= 40) {
            badgeClass = 'badge-medium';
            badgeText = '🟡 Medium';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${cust.id}</strong></td>
            <td>${cust.name}</td>
            <td class="num"><strong class="text-green">${currencyFormatter.format(cust.revenue)}</strong></td>
            <td>${cust.recency} days</td>
            <td><span class="loyalty-tag loy-${cust.loyalty.toLowerCase()}">${cust.loyalty}</span></td>
            <td><span class="risk-badge ${badgeClass}">${badgeText} | ${cust.riskScore}/100</span></td>
            <td>
                <button class="btn-action" onclick="engageCustomer('${cust.id}', '${cust.name}')">
                    <i class="fa-solid fa-paper-plane"></i> Engage
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Render Directory Table Rows
function renderDirectoryTable(list) {
    const tbody = document.getElementById('table-directory');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-secondary);">No matching directory records found.</td></tr>`;
        return;
    }
    
    list.forEach(cust => {
        const tr = document.createElement('tr');
        const segClass = segmentClassMap[cust.segment] || 'seg-lost';
        tr.innerHTML = `
            <td><strong>${cust.id}</strong></td>
            <td>${cust.name}</td>
            <td>${cust.region}</td>
            <td>${cust.age}</td>
            <td class="num">${cust.orders}</td>
            <td class="num"><strong class="text-green">${currencyFormatter.format(cust.revenue)}</strong></td>
            <td class="num">$${cust.aov.toFixed(2)}</td>
            <td><span class="loyalty-tag loy-${cust.loyalty.toLowerCase()}">${cust.loyalty}</span></td>
            <td><span class="segment-tag ${segClass}">${cust.segment}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Setup Event Listeners on Dropdowns
function setupFilterListeners() {
    const regionSelect = document.getElementById('filter-region');
    const loyaltySelect = document.getElementById('filter-loyalty');
    const categorySelect = document.getElementById('filter-category');
    const ageSelect = document.getElementById('filter-age');
    const searchBox = document.getElementById('directory-search');
    const resetBtn = document.getElementById('btn-reset-filters');
    const toggleDirBtn = document.getElementById('btn-toggle-directory');
    
    const onChange = () => recalculateAndRender();
    
    if (regionSelect) regionSelect.addEventListener('change', onChange);
    if (loyaltySelect) loyaltySelect.addEventListener('change', onChange);
    if (categorySelect) categorySelect.addEventListener('change', onChange);
    if (ageSelect) ageSelect.addEventListener('change', onChange);
    
    let searchTimeout = null;
    if (searchBox) {
        searchBox.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                recalculateAndRender();
            }, 250);
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (regionSelect) regionSelect.value = 'all';
            if (loyaltySelect) loyaltySelect.value = 'all';
            if (categorySelect) categorySelect.value = 'all';
            if (ageSelect) ageSelect.value = 'all';
            if (searchBox) searchBox.value = '';
            recalculateAndRender();
        });
    }
    
    if (toggleDirBtn) {
        toggleDirBtn.addEventListener('click', () => {
            showAllDirectory = !showAllDirectory;
            toggleDirBtn.innerHTML = showAllDirectory ? 
                `<i class="fa-solid fa-compress"></i> Show Top 5 Customers` : 
                `<i class="fa-solid fa-list-ul"></i> View Full Customer Directory`;
            recalculateAndRender();
        });
    }

    // Smooth scrolling & active highlights for sidebar shortcuts
    document.querySelectorAll('.sidebar-menu a.menu-item').forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth' });
                    document.querySelectorAll('.sidebar-menu a.menu-item').forEach(l => l.classList.remove('active'));
                    this.classList.add('active');
                }
            }
        });
    });

    // Window Scroll Spy & Sticky KPI Bar Visibility with requestAnimationFrame
    let scrollTicking = false;
    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            window.requestAnimationFrame(() => {
                const scrollPos = window.scrollY;
                
                // 1. Toggle Sticky KPI Bar
                const stickyBar = document.getElementById('sticky-kpi-bar');
                if (stickyBar) {
                    if (scrollPos > 400) {
                        stickyBar.classList.add('visible');
                    } else {
                        stickyBar.classList.remove('visible');
                    }
                }
                
                // 2. Active Sidebar Anchor Spy
                const sections = [
                    'executive-insights',
                    'strategic-impact',
                    'segments-section',
                    'risk-analysis-section',
                    'regional-analysis-section',
                    'forecasting-section',
                    'board-recommendations'
                ];
                
                let activeSectionId = null;
                for (const sectionId of sections) {
                    const el = document.getElementById(sectionId);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        if (rect.top <= 180 && rect.bottom >= 100) {
                            activeSectionId = sectionId;
                        }
                    }
                }
                
                if (activeSectionId) {
                    document.querySelectorAll('.sidebar-menu a.menu-item').forEach(link => {
                        const href = link.getAttribute('href');
                        if (href && href.endsWith('#' + activeSectionId)) {
                            link.classList.add('active');
                        } else {
                            link.classList.remove('active');
                        }
                    });
                }
                scrollTicking = false;
            });
            scrollTicking = true;
        }
    });
}

// Engage Alert Action
function engageCustomer(id, name) {
    alert(`CRM Alert: Re-activation workflow triggered for ${name} (${id})! High-value voucher sent.`);
}
