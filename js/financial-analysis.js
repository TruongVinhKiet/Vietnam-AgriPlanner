/**
 * Financial Forecasting & Analysis Logic
 * Handles data fetching, cost calculation, and Chart.js rendering
 */

var financialChart = null;
var currentFinancialData = null;
// Use existing API_BASE from config.js/features.js, or define if not available
var FINANCIAL_API_BASE = typeof API_BASE !== 'undefined' ? API_BASE : 
                         (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8080/api');

// Open the financial analysis modal
async function openFinancialAnalysisModels() {
    const modal = document.getElementById('financial-analysis-modal');
    if (!modal) return;

    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('show'), 10);

    // Initialize fields dropdown
    await loadFinancialFields();
}

// Close the modal
function closeFinancialModal() {
    const modal = document.getElementById('financial-analysis-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

// Load fields into dropdown
async function loadFinancialFields() {
    try {
        // Get user's farms dynamically
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const farmsResponse = await fetch(`${FINANCIAL_API_BASE}/farms/my-farms`, { headers });
        if (!farmsResponse.ok) {
            console.warn('Could not fetch user farms');
            return;
        }

        const farms = await farmsResponse.json();
        if (farms.length === 0) {
            const select = document.getElementById('financial-field-select');
            select.innerHTML = '<option value="">-- Chưa có nông trại --</option>';
            return;
        }

        const farmId = farms[0].id;
        const response = await fetch(`${FINANCIAL_API_BASE}/fields?farmId=${farmId}`, { headers });
        if (!response.ok) throw new Error('Failed to fetch fields');

        const fields = await response.json();
        const select = document.getElementById('financial-field-select');
        select.innerHTML = '<option value="">-- Chọn thửa ruộng --</option>';

        fields.forEach(field => {
            select.innerHTML += `<option value="${field.id}">${field.name} (${field.status})</option>`;
        });

        // Auto-select first active field if available
        const activeField = fields.find(f => f.status === 'ACTIVE' || f.currentCropId);
        if (activeField) {
            select.value = activeField.id;
            analyzeFieldFinancials(activeField.id);
        }

    } catch (error) {
        console.error('Error loading fields:', error);
    }
}

// Analyze financials for a specific field
async function analyzeFieldFinancials(fieldId) {
    if (!fieldId) return;

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        // 1. Fetch Field Details (Area, Current Crop)
        const fieldRes = await fetch(`${FINANCIAL_API_BASE}/fields/${fieldId}`, { headers });
        const field = await fieldRes.json();

        // 2. Fetch Activities (Costs)
        const activitiesRes = await fetch(`${FINANCIAL_API_BASE}/fields/${fieldId}/activities`, { headers });
        const activities = await activitiesRes.json();

        // 3. Fetch Crop Definition (Market Price, Yield)
        let crop = null;
        if (field.currentCropId) {
            const cropRes = await fetch(`${FINANCIAL_API_BASE}/crops/${field.currentCropId}`, { headers }); // Assuming endpoint exists or fetch all
            // Fallback if specific endpoint missing, use get all
            if (!cropRes.ok) {
                const allCropsRes = await fetch(`${FINANCIAL_API_BASE}/crops`, { headers }); // Adjust endpoint as needed
                const allCrops = await allCropsRes.json();
                crop = allCrops.find(c => c.id === field.currentCropId);
            } else {
                crop = await cropRes.json();
            }
        }

        // Calculate Metrics
        calculateAndRender(field, activities, crop);

    } catch (error) {
        console.error('Error analyzing financials:', error);
        // Show error state in modal
    }
}

function calculateAndRender(field, activities, crop) {
    // A. Calculate Actual Costs
    let totalCost = 0;
    const costHistory = []; // { date, cumulativeCost }

    // Sort activities by date
    activities.sort((a, b) => new Date(a.performedAt) - new Date(b.performedAt));

    activities.forEach(act => {
        if (act.cost) {
            totalCost += parseFloat(act.cost);
            costHistory.push({
                x: act.performedAt, // Date string
                y: totalCost
            });
        }
    });

    // B. Calculate Projected Revenue
    // Default values if data missing
    const area = field.areaSqm || 1000;
    const expectedYield = crop ? (crop.expectedYieldPerSqm || 0.5) : 0.5; // kg/sqm
    const marketPrice = crop ? (crop.marketPricePerKg || 7000) : 7000; // VND/kg

    const projectedOutput = area * expectedYield; // kg
    const projectedRevenue = projectedOutput * marketPrice;

    // Store for sliders
    currentFinancialData = {
        totalCost,
        projectedOutput,
        basePrice: marketPrice,
        baseRevenue: projectedRevenue,
        plantingDate: field.plantingDate || new Date().toISOString()
    };

    // Update UI KPI Cards
    updateKPIs(totalCost, projectedRevenue);

    // Render Chart
    renderFinancialChart(costHistory, projectedRevenue, currentFinancialData.plantingDate);

    // Update Profit Projection text
    updateProfitProjection(projectedRevenue, totalCost);

    // Reset Sliders
    document.getElementById('price-slider').value = marketPrice;
    document.getElementById('price-value-display').textContent = formatCurrency(marketPrice) + '/kg';

    // If no cost data
    if (totalCost === 0) {
        // Mock some data/alert for demo
        console.warn('No cost data found. Charts will start at 0.');
    }
}

function updateKPIs(cost, revenue) {
    document.getElementById('kpi-cost').textContent = formatCurrency(cost);
    document.getElementById('kpi-revenue').textContent = formatCurrency(revenue);

    const profit = revenue - cost;
    const profitEl = document.getElementById('kpi-profit');
    profitEl.textContent = formatCurrency(profit);
    profitEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';
}

function updateProfitProjection(revenue, cost) {
    const profit = revenue - cost;
    const el = document.getElementById('projected-profit-display');
    el.textContent = formatCurrency(profit);
    el.className = profit >= 0 ? 'profit-value-highlight text-green-600' : 'profit-value-highlight text-red-600';
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Chart.js Rendering
function renderFinancialChart(costData, revenueLimit, startDate) {
    const ctx = document.getElementById('financialRoiChart');
    if (!ctx) return;

    if (financialChart) {
        financialChart.destroy();
    }

    // Generate Revenue Line (Flat line or projected slope)
    // For simplicity: Start 0 at planting date, reach max revenue at 'today' + 30 days (harvest)
    // If we have actual harvest date, use that.

    // Mock harvest date: 90 days after planting or today + 30
    const start = new Date(startDate).getTime();
    const end = start + (90 * 24 * 60 * 60 * 1000);

    const revenueDataset = [
        { x: new Date(startDate).toISOString(), y: 0 },
        { x: new Date(end).toISOString(), y: revenueLimit }
    ];

    financialChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Chi phí tích lũy',
                    data: costData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Doanh thu dự kiến',
                    data: revenueDataset,
                    borderColor: '#10b981',
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        displayFormats: {
                            month: 'MM/yyyy'
                        }
                    },
                    title: { display: true, text: 'Thời gian' }
                },
                y: {
                    title: { display: true, text: 'VND' },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
}

// Handle Slider Change (What-if scenario)
function onPriceSliderChange(e) {
    if (!currentFinancialData) return;

    const newPrice = parseFloat(e.target.value);
    document.getElementById('price-value-display').textContent = formatCurrency(newPrice) + '/kg';

    const newRevenue = currentFinancialData.projectedOutput * newPrice;

    // Update KPI (only Revenue and Profit)
    document.getElementById('kpi-revenue').textContent = formatCurrency(newRevenue);
    const cost = currentFinancialData.totalCost;
    const profit = newRevenue - cost;

    const profitEl = document.getElementById('kpi-profit');
    profitEl.textContent = formatCurrency(profit);
    profitEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';

    updateProfitProjection(newRevenue, cost);

    // Update Chart Revenue Line
    if (financialChart) {
        // Last point of revenue dataset (index 1)
        const revenueMeta = financialChart.data.datasets[1];
        if (revenueMeta.data.length >= 2) {
            revenueMeta.data[1].y = newRevenue;
            financialChart.update();
        }
    }
}
