/**
 * Agri-Weather Logs Logic
 * Handles weather history display and spray condition advice
 */

const WEATHER_API_URL = `${CONFIG.API_BASE_URL}/weather`;

// Current farm ID - loaded dynamically
let weatherFarmId = null;

// Current weather data (typically from external API or widget)
let currentWeatherData = {
    windSpeed: 8,
    rainProbability: 20,
    temperature: 32,
    humidity: 75,
    condition: 'CLOUDY'
};

/**
 * Load current user's farm for weather operations
 */
async function loadWeatherFarm() {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const response = await fetch(`${CONFIG.API_BASE_URL}/farms/my-farms`, { headers });
        if (response.ok) {
            const farms = await response.json();
            if (farms.length > 0) {
                weatherFarmId = farms[0].id;
            }
        }
    } catch (error) {
        console.error('Error loading farm for weather:', error);
    }
}

async function openWeatherModal() {
    const modal = document.getElementById('weather-modal');
    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('show'), 10);

    // Load farm if not already loaded
    if (!weatherFarmId) {
        await loadWeatherFarm();
    }

    fetchSprayAdvice();
    fetchWeatherHistory();
}

function closeWeatherModal() {
    const modal = document.getElementById('weather-modal');
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}

// Fetch spray advice based on current conditions
async function fetchSprayAdvice() {
    const adviceContainer = document.getElementById('spray-advice-container');
    adviceContainer.innerHTML = '<div class="loading">Đang phân tích...</div>';

    try {
        const url = `${WEATHER_API_URL}/spray-advice?windSpeed=${currentWeatherData.windSpeed}&rainProbability=${currentWeatherData.rainProbability}&temperature=${currentWeatherData.temperature}`;
        const response = await fetch(url);
        const data = await response.json();

        renderSprayAdvice(data);
    } catch (error) {
        console.error('Error fetching spray advice:', error);
        adviceContainer.innerHTML = '<div class="error">Không thể tải dữ liệu</div>';
    }
}

function renderSprayAdvice(data) {
    const container = document.getElementById('spray-advice-container');

    const statusClass = data.canSpray ? 'status-ok' : 'status-danger';
    const statusIcon = data.canSpray ? 'check_circle' : 'warning';
    const statusText = data.canSpray ? 'Có thể phun thuốc' : 'Không nên phun thuốc';

    let warningsHtml = '';
    if (data.warnings && data.warnings.length > 0) {
        warningsHtml = data.warnings.map(w => `
            <div class="advice-warning ${w.severity === 'HIGH' ? 'warning-high' : 'warning-medium'}">
                <span class="material-symbols-outlined">${getWarningIcon(w.type)}</span>
                <span>${w.message}</span>
            </div>
        `).join('');
    }

    container.innerHTML = `
        <div class="spray-status ${statusClass}">
            <span class="material-symbols-outlined">${statusIcon}</span>
            <span>${statusText}</span>
        </div>
        
        <div class="current-conditions">
            <div class="condition-item">
                <span class="material-symbols-outlined">air</span>
                <span>${currentWeatherData.windSpeed} km/h</span>
            </div>
            <div class="condition-item">
                <span class="material-symbols-outlined">water_drop</span>
                <span>${currentWeatherData.rainProbability}% mưa</span>
            </div>
            <div class="condition-item">
                <span class="material-symbols-outlined">thermostat</span>
                <span>${currentWeatherData.temperature}°C</span>
            </div>
        </div>
        
        ${warningsHtml}
        
        <div class="advice-recommendation">
            <span class="material-symbols-outlined">tips_and_updates</span>
            <span>${data.recommendation || ''}</span>
        </div>
    `;
}

function getWarningIcon(type) {
    switch (type) {
        case 'WIND': return 'air';
        case 'RAIN': return 'rainy';
        case 'HEAT': return 'local_fire_department';
        default: return 'info';
    }
}

// Fetch weather history
async function fetchWeatherHistory() {
    const historyContainer = document.getElementById('weather-history-container');
    historyContainer.innerHTML = '<div class="loading">Đang tải lịch sử...</div>';

    if (!weatherFarmId) {
        historyContainer.innerHTML = '<div class="empty-state"><p>Chưa có nông trại được chọn.</p></div>';
        return;
    }

    try {
        const response = await fetch(`${WEATHER_API_URL}/history/${weatherFarmId}?days=14`);
        const logs = await response.json();

        renderWeatherHistory(logs);
    } catch (error) {
        console.error('Error fetching weather history:', error);
        historyContainer.innerHTML = '<div class="error">Không thể tải lịch sử thời tiết</div>';
    }
}

function renderWeatherHistory(logs) {
    const container = document.getElementById('weather-history-container');

    if (!logs || logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="material-symbols-outlined">cloud_off</span>
                <p>Chưa có dữ liệu thời tiết.</p>
                <button class="btn btn--primary" onclick="logTodayWeather()">
                    <span class="material-symbols-outlined">add</span> Ghi thời tiết hôm nay
                </button>
            </div>
        `;
        return;
    }

    const tableRows = logs.map(log => {
        const dateStr = new Date(log.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
        const conditionIcon = getConditionIcon(log.condition);

        return `
            <tr>
                <td>${dateStr}</td>
                <td><span class="material-symbols-outlined">${conditionIcon}</span></td>
                <td>${log.tempMin || '-'}° - ${log.tempMax || '-'}°</td>
                <td>${log.humidity || '-'}%</td>
                <td>${log.windSpeed || '-'} km/h</td>
                <td>${log.rainfall || 0} mm</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="history-header">
            <h4>Lịch sử thời tiết (14 ngày qua)</h4>
            <button class="btn btn--small" onclick="logTodayWeather()">
                <span class="material-symbols-outlined">add</span> Ghi hôm nay
            </button>
        </div>
        <table class="weather-history-table">
            <thead>
                <tr>
                    <th>Ngày</th>
                    <th>Thời tiết</th>
                    <th>Nhiệt độ</th>
                    <th>Độ ẩm</th>
                    <th>Gió</th>
                    <th>Mưa</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
    `;
}

function getConditionIcon(condition) {
    switch (condition?.toUpperCase()) {
        case 'SUNNY': return 'sunny';
        case 'CLOUDY': return 'cloud';
        case 'RAINY': return 'rainy';
        case 'STORMY': return 'thunderstorm';
        default: return 'partly_cloudy_day';
    }
}

// Log today's weather
async function logTodayWeather() {
    if (!weatherFarmId) {
        alert('Chưa có nông trại được chọn!');
        return;
    }

    // Use current widget data or prompt user
    const payload = {
        farmId: weatherFarmId,
        tempMin: currentWeatherData.temperature - 5,
        tempMax: currentWeatherData.temperature + 3,
        humidity: currentWeatherData.humidity,
        windSpeed: currentWeatherData.windSpeed,
        rainfall: currentWeatherData.rainProbability > 50 ? 5 : 0,
        condition: currentWeatherData.condition
    };

    try {
        const response = await fetch(`${WEATHER_API_URL}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert('Đã lưu thời tiết hôm nay!');
            fetchWeatherHistory();
        } else {
            alert('Lỗi khi lưu thời tiết.');
        }
    } catch (error) {
        console.error('Error logging weather:', error);
    }
}

// Update current weather from external source (e.g., widget)
function updateCurrentWeather(data) {
    currentWeatherData = { ...currentWeatherData, ...data };
}
