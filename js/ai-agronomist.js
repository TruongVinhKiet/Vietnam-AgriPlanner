/**
 * AI Agronomist - Intelligent Assistant Logic
 * Fetches insights based on current weather & crop status
 */

var AI_CONFIG = {
    POLL_INTERVAL: 60000 * 5, // Poll every 5 minutes
    MOCK_MODE: false // Set true if backend not ready
};

document.addEventListener('DOMContentLoaded', () => {
    initAiAgronomist();
});

function initAiAgronomist() {
    // Create UI if not exists
    if (!document.querySelector('.ai-fab-container')) {
        injectAiUi();
    }

    // Bind Events
    const fab = document.getElementById('ai-fab');
    const closeBtn = document.getElementById('ai-panel-close');

    if (fab) fab.addEventListener('click', toggleAiPanel);
    if (closeBtn) closeBtn.addEventListener('click', toggleAiPanel);

    // Initial fetch after a short delay to let weather load
    setTimeout(fetchAiInsights, 3000);
}

function injectAiUi() {
    const container = document.createElement('div');
    container.className = 'ai-ui-root';
    container.innerHTML = `
        <!-- Floating Action Button -->
        <div class="ai-fab-container">
            <button class="ai-fab" id="ai-fab">
                <span class="material-symbols-outlined ai-fab__icon">eco</span>
                <span class="ai-badge" id="ai-notification-badge">!</span>
            </button>
        </div>

        <!-- Insights Panel -->
        <div class="ai-panel" id="ai-panel">
            <div class="ai-panel__header">
                <h4 class="ai-panel__title">
                    <span class="material-symbols-outlined" style="color: #10b981;">psychology</span>
                    Trợ lý Nông học
                </h4>
                <button class="ai-panel__close" id="ai-panel-close">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="ai-panel__content" id="ai-content">
                <!-- Content injected here -->
                <div class="ai-typing">
                    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(container);
}

function toggleAiPanel() {
    const panel = document.getElementById('ai-panel');
    const badge = document.getElementById('ai-notification-badge');

    panel.classList.toggle('active');

    // Hide badge when opened
    if (panel.classList.contains('active')) {
        badge.style.display = 'none';

        // Re-fetch if content is empty or stale
        const content = document.getElementById('ai-content');
        if (!content.children.length || content.querySelector('.ai-card') === null) {
            fetchAiInsights();
        }
    }
}

async function fetchAiInsights() {
    const contentDiv = document.getElementById('ai-content');
    contentDiv.innerHTML = `
        <div class="ai-typing">
            <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        </div>
    `;

    try {
        // 1. Get Environment Data (Mocking extraction from DOM or using defaults)
        // Ideally these should come from the Weather Widget state
        const tempText = document.querySelector('.weather-card__temp')?.innerText || '30°C';
        const humidityText = document.querySelector('.weather-card__secondary span:first-child')?.innerText || '70%'; // Simplistic selector

        const temp = parseFloat(tempText.replace('°C', '')) || 32.5; // Default to hot for demo trigger
        const humidity = parseFloat(humidityText.replace('%', '')) || 85;

        // 2. Prepare Payload
        // We need a field ID. For demo, pick first available or 1
        const fieldId = 1;

        const payload = {
            fieldId: fieldId,
            currentTemp: temp,
            currentHumidity: humidity
        };

        // 3. Call Backend
        const response = await fetch(`${CONFIG.API_BASE_URL}/ai/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('AI Service Unavailable');

        const data = await response.json();

        // 4. Render Results
        renderInsights(data.insights);

    } catch (error) {
        console.error('AI Error:', error);
        contentDiv.innerHTML = `
            <div class="ai-card danger">
                <div class="ai-card__title">
                    <span class="material-symbols-outlined">error</span>
                    Lỗi kết nối
                </div>
                <div class="ai-card__msg">Không thể kết nối với Chuyên gia AI. Vui lòng thử lại sau.</div>
            </div>
        `;
    }
}

function renderInsights(insights) {
    const contentDiv = document.getElementById('ai-content');
    const badge = document.getElementById('ai-notification-badge');
    contentDiv.innerHTML = '';

    if (!insights || insights.length === 0) {
        contentDiv.innerHTML = `
            <div class="ai-card success">
                <div class="ai-card__title">
                    <span class="material-symbols-outlined">check_circle</span>
                    Mọi thứ ổn định
                </div>
                <div class="ai-card__msg">Điều kiện thời tiết đang rất tốt cho cây trồng.</div>
            </div>
        `;
        return;
    }

    let hasAlert = false;

    insights.forEach(insight => {
        const card = document.createElement('div');
        let typeClass = 'info';
        let icon = 'info';

        if (insight.type === 'WARNING') { typeClass = 'warning'; icon = 'warning'; hasAlert = true; }
        if (insight.type === 'DANGER') { typeClass = 'danger'; icon = 'report'; hasAlert = true; }
        if (insight.type === 'SUCCESS') { typeClass = 'success'; icon = 'check_circle'; }

        card.className = `ai-card ${typeClass}`;
        card.innerHTML = `
            <div class="ai-card__title">
                <span class="material-symbols-outlined">${icon}</span>
                ${insight.title}
            </div>
            <div class="ai-card__msg">${insight.message}</div>
        `;
        contentDiv.appendChild(card);
    });

    // Show badge if there are alerts and panel is closed
    const panel = document.getElementById('ai-panel');
    if (hasAlert && !panel.classList.contains('active')) {
        badge.style.display = 'block';
        badge.innerText = insights.length; // Count
    }
}
