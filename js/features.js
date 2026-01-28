/**
 * AgriPlanner Features Module - Các tính năng nâng cao
 * Các panel và modal cho: Thông báo, Lịch sử thu hoạch, Tưới tiêu, 
 * Thị trường, Phân tích chi phí, Phát hiện sâu bệnh
 */

var API_BASE = typeof API_BASE !== 'undefined' ? API_BASE :
    (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8080/api');

// Get current field ID helper
function getSelectedFieldId() {
    return typeof selectedField !== 'undefined' && selectedField ? selectedField.id : null;
}

// ==================== NOTIFICATIONS ====================
let notificationCount = 0;

async function fetchNotifications(userId = 1) {
    try {
        const response = await fetch(`${API_BASE}/notifications/user/${userId}/unread`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('authToken')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch notifications');
        const notifications = await response.json();
        notificationCount = notifications.length;
        updateNotificationBadge();
        return notifications;
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
}

function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    if (badge) {
        badge.textContent = notificationCount > 0 ? notificationCount : '';
        badge.style.display = notificationCount > 0 ? 'flex' : 'none';
    }
}

function toggleNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    if (panel) {
        closeOtherPanels('notification-panel');
        panel.classList.toggle('open');
        updateFeatureOverlay();
        if (panel.classList.contains('open')) {
            renderNotifications();
        }
    }
}

// Helper functions for panel management
function closeOtherPanels(exceptPanelId) {
    const panels = ['notification-panel', 'irrigation-panel', 'marketplace-panel', 'pest-panel'];
    panels.forEach(id => {
        if (id !== exceptPanelId) {
            const panel = document.getElementById(id);
            if (panel) panel.classList.remove('open');
        }
    });
}

function updateFeatureOverlay() {
    const overlay = document.getElementById('feature-overlay');
    const anyOpen = document.querySelectorAll('.feature-panel.open').length > 0;
    if (overlay) {
        overlay.classList.toggle('open', anyOpen);
    }
}

function closeAllFeaturePanels() {
    const panels = document.querySelectorAll('.feature-panel');
    panels.forEach(p => p.classList.remove('open'));
    updateFeatureOverlay();
}

async function renderNotifications() {
    const container = document.getElementById('notification-list');
    if (!container) return;

    const notifications = await fetchNotifications();
    if (notifications.length === 0) {
        container.innerHTML = '<div class="empty-state">Không có thông báo mới</div>';
        return;
    }

    container.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.isRead ? 'read' : 'unread'}" onclick="markNotificationRead(${n.id})">
            <div class="notification-icon ${getNotificationIconClass(n.type)}">
                <span class="material-symbols-outlined">${getNotificationIcon(n.type)}</span>
            </div>
            <div class="notification-content">
                <h4>${n.title}</h4>
                <p>${n.message || ''}</p>
                <span class="notification-time">${formatTime(n.createdAt)}</span>
            </div>
        </div>
    `).join('');
}

function getNotificationIcon(type) {
    const icons = {
        'WATER_REMINDER': 'water_drop',
        'FERTILIZE_REMINDER': 'eco',
        'HARVEST_READY': 'agriculture',
        'PEST_ALERT': 'bug_report',
        'WEATHER_WARNING': 'thunderstorm'
    };
    return icons[type] || 'notifications';
}

function getNotificationIconClass(type) {
    const classes = {
        'WATER_REMINDER': 'icon--blue',
        'FERTILIZE_REMINDER': 'icon--green',
        'HARVEST_READY': 'icon--amber',
        'PEST_ALERT': 'icon--red',
        'WEATHER_WARNING': 'icon--purple'
    };
    return classes[type] || '';
}

async function markNotificationRead(id) {
    try {
        await fetch(`${API_BASE}/notifications/${id}/read`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        renderNotifications();
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// ==================== HARVEST HISTORY ====================
async function openHarvestHistoryModal() {
    const modal = document.getElementById('harvest-history-modal');
    if (modal) {
        modal.classList.add('open');
        await renderHarvestHistory();
    }
}

function closeHarvestHistoryModal() {
    const modal = document.getElementById('harvest-history-modal');
    if (modal) {
        modal.classList.remove('open');
    }
}

async function renderHarvestHistory() {
    const container = document.getElementById('harvest-history-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/analytics/harvest-history`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        if (!response.ok) throw new Error('Failed to fetch harvest history');
        const records = await response.json();

        if (records.length === 0) {
            container.innerHTML = '<div class="empty-state">Chưa có dữ liệu thu hoạch</div>';
            return;
        }

        container.innerHTML = records.map(r => `
            <div class="harvest-record">
                <div class="harvest-record__header">
                    <span class="harvest-record__crop">${r.cropName || 'N/A'}</span>
                    <span class="harvest-record__date">${formatDate(r.harvestDate)}</span>
                </div>
                <div class="harvest-record__stats">
                    <div class="stat">
                        <span class="label">Sản lượng</span>
                        <span class="value">${formatNumber(r.yieldKg)} kg</span>
                    </div>
                    <div class="stat">
                        <span class="label">Doanh thu</span>
                        <span class="value revenue">${formatCurrency(r.revenue)}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Chi phí</span>
                        <span class="value cost">${formatCurrency(r.totalCost)}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Lợi nhuận</span>
                        <span class="value ${r.profit >= 0 ? 'profit' : 'loss'}">${formatCurrency(r.profit)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error fetching harvest history:', error);
        container.innerHTML = '<div class="error-state">Lỗi tải dữ liệu</div>';
    }
}

// ==================== IRRIGATION SCHEDULE ====================
function toggleIrrigationPanel() {
    const panel = document.getElementById('irrigation-panel');
    if (panel) {
        closeOtherPanels('irrigation-panel');
        panel.classList.toggle('open');
        updateFeatureOverlay();
        if (panel.classList.contains('open')) {
            const fieldId = getSelectedFieldId();
            if (fieldId) renderIrrigationSchedule(fieldId);
            else document.getElementById('irrigation-list').innerHTML = '<div class="empty-state">Chọn một ruộng để xem lịch tưới</div>';
        }
    }
}

async function renderIrrigationSchedule(fieldId) {
    const container = document.getElementById('irrigation-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/irrigation/field/${fieldId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        if (!response.ok) throw new Error('Failed');
        const schedules = await response.json();

        if (schedules.length === 0) {
            container.innerHTML = `<div class="empty-state">Chưa có lịch tưới</div>
                <button class="btn btn--primary btn--sm" onclick="openCreateIrrigationModal()">
                    <span class="material-symbols-outlined">add</span> Tạo lịch tưới
                </button>`;
            return;
        }

        container.innerHTML = schedules.map(s => `
            <div class="irrigation-item ${s.isActive ? 'active' : 'inactive'}">
                <div class="irrigation-info">
                    <span class="schedule-type">${formatScheduleType(s.scheduleType)}</span>
                    <span class="schedule-time">${s.timeOfDay || '06:00'} - ${s.durationMinutes || 30} phút</span>
                </div>
                <button class="toggle-btn ${s.isActive ? 'on' : 'off'}" onclick="toggleIrrigationSchedule(${s.id})">
                    <span class="material-symbols-outlined">${s.isActive ? 'toggle_on' : 'toggle_off'}</span>
                </button>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="error-state">Lỗi tải dữ liệu</div>';
    }
}

function formatScheduleType(type) {
    const types = {
        'DAILY': 'Hàng ngày',
        'EVERY_OTHER_DAY': 'Cách ngày',
        'WEEKLY': 'Hàng tuần',
        'CUSTOM': 'Tùy chỉnh'
    };
    return types[type] || type;
}

async function toggleIrrigationSchedule(id) {
    try {
        await fetch(`${API_BASE}/irrigation/${id}/toggle`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        const fieldId = getSelectedFieldId();
        if (fieldId) renderIrrigationSchedule(fieldId);
    } catch (error) {
        console.error('Error toggling irrigation:', error);
    }
}

// ==================== MARKETPLACE & TRADING ====================
let marketPollingInterval;
let activeMarketCropId = null; // Track selected crop for chart
let marketChart = null; // ApexChart instance

function toggleMarketplacePanel() {
    const panel = document.getElementById('marketplace-panel');
    if (panel) {
        const isOpening = !panel.classList.contains('open');
        closeOtherPanels('marketplace-panel');

        panel.classList.toggle('open');
        updateFeatureOverlay();

        if (isOpening) {
            renderMarketplaceList();
            startMarketplacePolling();
        } else {
            stopMarketplacePolling();
        }
    }
}

function startMarketplacePolling() {
    stopMarketplacePolling();
    marketPollingInterval = setInterval(() => {
        renderMarketplaceList(false); // Update list values only
        if (activeMarketCropId) updateMarketChart(activeMarketCropId); // Real-time chart update
    }, 5000); // 5s fast polling for "Trading" feel
    console.log('Market trading feed started');
}

function stopMarketplacePolling() {
    if (marketPollingInterval) {
        clearInterval(marketPollingInterval);
        marketPollingInterval = null;
        console.log('Market trading feed stopped');
    }
}

// Ensure polling stops when closing other panels
const originalCloseOtherPanels = closeOtherPanels;
closeOtherPanels = function (exceptPanelId) {
    if (exceptPanelId !== 'marketplace-panel') {
        stopMarketplacePolling();
    }
    originalCloseOtherPanels(exceptPanelId);
};

// Render the list of tickers (Left Sidebar)
async function renderMarketplaceList(isFullRender = true) {
    const container = document.getElementById('market-ticker-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/marketplace/overview`);
        if (!response.ok) throw new Error('Failed');
        const items = await response.json();

        // On first load, select the first item
        if (!activeMarketCropId && items.length > 0) {
            selectMarketItem(items[0]);
        }

        container.innerHTML = items.map(item => {
            const isUp = item.trend === 'up';
            const changeColor = isUp ? 'text-green' : (item.trend === 'down' ? 'text-red' : '');
            const isActive = activeMarketCropId === item.cropId ? 'active' : '';

            return `
            <div class="ticker-item ${isActive}" onclick='selectMarketItem(${JSON.stringify(item)})'>
                <div class="ticker-info">
                    <h4>${item.cropName}</h4>
                    <span>${item.category || 'COMMODITY'}</span>
                </div>
                <div class="ticker-price">
                    <span class="current">${formatCurrency(item.currentPrice)}</span>
                    <span class="change ${changeColor}">
                        ${isUp ? '▲' : '▼'} ${Math.abs(item.priceChange || 0).toFixed(2)}%
                    </span>
                </div>
            </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Ticker error:', error);
    }
}

function selectMarketItem(item) {
    if (typeof item === 'string') item = JSON.parse(item); // safety catch
    activeMarketCropId = item.cropId;

    // Update List Active State
    document.querySelectorAll('.ticker-item').forEach(el => el.classList.remove('active'));
    // (Re-rendering list would be cleaner but heavyweight, simplistic active state toggle for now in render loop)

    // Update Details Header
    document.getElementById('detail-icon').textContent = getCropIcon(item.cropName);
    document.getElementById('detail-name').textContent = item.cropName;
    document.getElementById('detail-category').textContent = item.category || 'COMMODITY';
    document.getElementById('detail-price').textContent = formatCurrency(item.currentPrice);

    const changeEl = document.getElementById('detail-change');
    const isUp = item.trend === 'up';
    changeEl.textContent = `${isUp ? '+' : '-'}${Math.abs(item.priceChange).toFixed(2)}%`;
    changeEl.className = `stat-value ${isUp ? 'text-green' : 'text-red'}`;

    // Hide empty state, show content
    document.getElementById('market-empty-state').style.display = 'none';
    document.getElementById('market-detail-container').style.display = 'flex';

    // Init Chart
    initMarketChart(item.cropId, item.cropName, item.currentPrice);
    updateMarketStats(item.currentPrice);
}

function getCropIcon(name) {
    const n = name.toLowerCase();
    if (n.includes('lúa') || n.includes('gạo')) return '🌾';
    if (n.includes('ngô') || n.includes('bắp')) return '🌽';
    if (n.includes('khoai')) return '🥔';
    if (n.includes('cà phê')) return '☕';
    if (n.includes('xoài')) return '🥭';
    if (n.includes('thanh long')) return '🐉';
    if (n.includes('mía')) return '🎋';
    if (n.includes('cam') || n.includes('quýt')) return '🍊';
    if (n.includes('táo')) return '🍎';
    if (n.includes('dưa')) return '🍉';
    if (n.includes('nho')) return '🍇';
    if (n.includes('tiêu') || n.includes('ớt')) return '🌶️';
    if (n.includes('điều')) return '🥜';
    if (n.includes('cao su')) return '🌳';
    return '🌱';
}

function updateMarketStats(currentPrice) {
    // Generate mock high/low based on volatility for display
    const high = currentPrice * (1 + Math.random() * 0.05);
    const low = currentPrice * (1 - Math.random() * 0.05);
    document.getElementById('detail-high').textContent = formatCurrency(high);
    document.getElementById('detail-low').textContent = formatCurrency(low);
}

// Initialize ApexChart
async function initMarketChart(cropId, cropName, currentPrice) {
    const chartDiv = document.querySelector("#price-chart");
    if (!chartDiv) return;

    // Fetch History - with better error handling
    try {
        let history = [];
        try {
            const response = await fetch(`${API_BASE}/marketplace/prices/crop/${cropId}`);
            if (response.ok) {
                history = await response.json();
            } else {
                // Server returned error (500, 404, etc.) - use mock data
                console.warn(`Market price API returned ${response.status}, using mock data`);
                history = [];
            }
        } catch (err) {
            console.warn("Could not fetch price history, using mock data:", err.message);
            history = [];
        }

        // If no history from backend (or error), generate mock history for the demo
        if (!history || history.length < 2) {
            history = generateMockHistory(currentPrice);
        }

        // Format for ApexCharts
        const dataSeries = history.map(h => ({
            x: new Date(h.priceDate || h.date).getTime(),
            y: h.price || h.value
        }));

        const options = {
            series: [{
                name: 'Giá (VNĐ)',
                data: dataSeries
            }],
            chart: {
                type: 'area',
                height: 400,
                background: 'transparent',
                animations: {
                    enabled: true,
                    easing: 'linear',
                    dynamicAnimation: {
                        speed: 1000
                    }
                },
                toolbar: { show: false }
            },
            theme: { mode: 'dark' }, // Force dark theme for chart
            stroke: {
                curve: 'smooth',
                width: 2
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.3,
                }
            },
            colors: ['#10b981'], // Green theme
            dataLabels: { enabled: false },
            grid: {
                borderColor: '#334155',
                strokeDashArray: 4,
            },
            xaxis: {
                type: 'datetime',
                tooltip: { enabled: false },
                axisBorder: { show: false },
                axisTicks: { show: false },
                labels: {
                    datetimeUTC: false,
                    format: 'HH:mm'
                }
            },
            yaxis: {
                labels: {
                    formatter: (value) => {
                        return new Intl.NumberFormat('vi-VN', { notation: "compact" }).format(value);
                    },
                    style: { colors: '#94a3b8' }
                }
            },
            tooltip: {
                theme: 'dark',
                x: {
                    format: 'dd MMM HH:mm:ss',
                    formatter: (val) => {
                        // Force Vietnam Timezone display
                        return new Date(val).toLocaleString('vi-VN', {
                            timeZone: 'Asia/Ho_Chi_Minh',
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                            day: '2-digit', month: '2-digit'
                        });
                    }
                }
            }
        };

        if (marketChart) {
            marketChart.destroy();
        }

        marketChart = new ApexCharts(chartDiv, options);
        marketChart.render();

    } catch (e) {
        console.error("Chart init error", e);
        chartDiv.innerHTML = `<div style="text-align:center; padding:20px;">Lỗi hiển thị biểu đồ: ${e.message}</div>`;
    }
}

// Generate mock history for demo purposes if backend data is missing
function generateMockHistory(currentPrice) {
    const data = [];
    let price = currentPrice;
    const now = new Date();

    // Generate 20 points back in time (every 10 seconds)
    for (let i = 20; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 10000);
        // Random walk
        const change = (Math.random() - 0.5) * (price * 0.02);
        price += change;

        data.push({
            priceDate: date.toISOString(),
            price: Math.max(0, price)
        });
    }
    return data;
}

// Update Chart Real-time
async function updateMarketChart(cropId) {
    if (!marketChart) return;

    // Fetch latest point only or re-fetch (simpler to re-fetch for sync)
    try {
        let history = [];
        try {
            const response = await fetch(`${API_BASE}/marketplace/prices/crop/${cropId}`);
            if (response.ok) {
                history = await response.json();
            }
        } catch (fetchErr) {
            // Network error - silently use mock update
            history = [];
        }

        if (history && history.length > 0) {
            const dataSeries = history.map(h => ({
                x: new Date(h.priceDate).getTime(),
                y: h.price
            }));

            marketChart.updateSeries([{
                data: dataSeries
            }]);
        } else {
            // Mock update if no backend data
            const lastData = marketChart.w?.config?.series?.[0]?.data;
            if (lastData && lastData.length > 0) {
                const lastPrice = lastData[lastData.length - 1].y;
                const newPrice = lastPrice * (1 + (Math.random() - 0.5) * 0.01);

                marketChart.appendData([{
                    data: [{
                        x: new Date().getTime(),
                        y: newPrice
                    }]
                }]);
            }
        }

        // Flash effect on price
        const priceEl = document.getElementById('detail-price');
        priceEl.style.color = '#fff';
        setTimeout(() => priceEl.style.color = '#10b981', 100);

    } catch (e) { console.error("Update chart error", e); }
}

// ==================== ANALYTICS ====================
async function openAnalyticsModal() {
    const modal = document.getElementById('analytics-modal');
    if (modal) {
        modal.classList.add('open');
        await renderAnalyticsSummary();
    }
}

function closeAnalyticsModal() {
    const modal = document.getElementById('analytics-modal');
    if (modal) {
        modal.classList.remove('open');
    }
}

async function renderAnalyticsSummary() {
    const container = document.getElementById('analytics-content');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/analytics/summary`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();

        container.innerHTML = `
            <div class="analytics-grid">
                <div class="analytics-card">
                    <span class="material-symbols-outlined icon--green">agriculture</span>
                    <div class="analytics-card__value">${data.harvestCount || 0}</div>
                    <div class="analytics-card__label">Lần thu hoạch</div>
                </div>
                <div class="analytics-card">
                    <span class="material-symbols-outlined icon--blue">scale</span>
                    <div class="analytics-card__value">${formatNumber(data.totalYieldKg || 0)} kg</div>
                    <div class="analytics-card__label">Tổng sản lượng</div>
                </div>
                <div class="analytics-card">
                    <span class="material-symbols-outlined icon--amber">payments</span>
                    <div class="analytics-card__value">${formatCurrency(data.totalRevenue || 0)}</div>
                    <div class="analytics-card__label">Tổng doanh thu</div>
                </div>
                <div class="analytics-card">
                    <span class="material-symbols-outlined icon--red">receipt_long</span>
                    <div class="analytics-card__value">${formatCurrency(data.totalCost || 0)}</div>
                    <div class="analytics-card__label">Tổng chi phí</div>
                </div>
                <div class="analytics-card analytics-card--large ${(data.totalProfit || 0) >= 0 ? 'profit' : 'loss'}">
                    <span class="material-symbols-outlined">${(data.totalProfit || 0) >= 0 ? 'trending_up' : 'trending_down'}</span>
                    <div class="analytics-card__value">${formatCurrency(data.totalProfit || 0)}</div>
                    <div class="analytics-card__label">Tổng lợi nhuận</div>
                </div>
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="error-state">Lỗi tải dữ liệu phân tích</div>';
    }
}

// ==================== PEST DETECTION ====================
function togglePestPanel() {
    const panel = document.getElementById('pest-panel');
    if (panel) {
        closeOtherPanels('pest-panel');
        panel.classList.toggle('open');
        updateFeatureOverlay();
        if (panel.classList.contains('open')) {
            renderPestDefinitions();
        }
    }
}

async function renderPestDefinitions() {
    const container = document.getElementById('pest-list');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE}/pests/definitions`);
        if (!response.ok) throw new Error('Failed');
        const pests = await response.json();

        container.innerHTML = pests.map(p => `
            <div class="pest-item severity--${(p.severity || 'LOW').toLowerCase()}">
                <div class="pest-header">
                    <span class="pest-name">${p.name}</span>
                    <span class="severity-badge">${p.severity}</span>
                </div>
                <p class="pest-description">${p.description || ''}</p>
                <div class="pest-treatment">
                    <strong>Điều trị:</strong> ${p.treatment || 'N/A'}
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="error-state">Lỗi tải dữ liệu sâu bệnh</div>';
    }
}

async function detectPests() {
    const container = document.getElementById('pest-detection-result');
    if (!container) return;

    container.innerHTML = '<div class="loading">Đang phân tích...</div>';

    try {
        const response = await fetch(`${API_BASE}/pests/detect`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fieldId: getSelectedFieldId() })
        });
        if (!response.ok) throw new Error('Failed');
        const result = await response.json();

        if (result.count === 0) {
            container.innerHTML = `
                <div class="detection-success">
                    <span class="material-symbols-outlined">check_circle</span>
                    <p>Không phát hiện sâu bệnh!</p>
                </div>`;
        } else {
            container.innerHTML = `
                <div class="detection-warning">
                    <span class="material-symbols-outlined">warning</span>
                    <p>Phát hiện ${result.count} loại sâu bệnh</p>
                </div>
                ${result.pests.map(p => `
                    <div class="detected-pest">
                        <span class="pest-name">${p.pestName}</span>
                        <span class="confidence">${Math.round(p.confidence)}%</span>
                        <p><strong>Xử lý:</strong> ${p.treatment}</p>
                    </div>
                `).join('')}
            `;
        }
    } catch (error) {
        container.innerHTML = '<div class="error-state">Lỗi phát hiện sâu bệnh</div>';
    }
}

// ==================== UTILITIES ====================
function formatCurrency(value) {
    if (value == null) return '0 VNĐ';
    return new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ';
}

function formatNumber(value) {
    if (value == null) return '0';
    return new Intl.NumberFormat('vi-VN').format(value);
}

function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    return date.toLocaleDateString('vi-VN');
}

// ==================== INIT ====================
function initFeatures() {
    // Fetch initial notifications
    fetchNotifications();

    // Refresh notifications every 5 minutes
    setInterval(fetchNotifications, 300000);

    console.log('AgriPlanner Features initialized');
}

// Auto-init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeatures);
} else {
    initFeatures();
}
