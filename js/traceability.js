/**
 * Traceability Consumer View Logic
 * Fetches public timeline data and renders it
 */

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8080/api';

    // Get Field ID from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const fieldId = urlParams.get('fieldId');

    if (fieldId) {
        fetchTimelineData(fieldId);
        document.getElementById('scan-time').innerText = new Date().toLocaleString('vi-VN');
    } else {
        showError('Không tìm thấy mã truy xuất (Field ID missing)');
    }
});

async function fetchTimelineData(fieldId) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/traceability/${fieldId}`);
        if (!response.ok) throw new Error('Không thể tải dữ liệu');

        const data = await response.json();
        renderStory(data);
    } catch (error) {
        console.error(error);
        showError('Lỗi cập nhật dữ liệu: ' + error.message);
    }
}

function renderStory(data) {
    // 1. Render Header
    if (data.product) {
        document.getElementById('product-name').innerText = data.product.name;
        if (data.product.image) {
            document.getElementById('product-image').src = data.product.image;
        }
    }

    if (data.farm) {
        document.getElementById('farm-name').innerText = data.farm.fieldName; // Using Field Name as Farm for now
        document.getElementById('field-area').innerText = data.farm.area + ' m²';
    }

    // 2. Render Timeline
    const timelineContainer = document.getElementById('timeline-container');
    timelineContainer.innerHTML = ''; // Clear loader

    if (!data.timeline || data.timeline.length === 0) {
        timelineContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#94a3b8;">Chưa có hoạt động nào được ghi nhận.</div>';
        return;
    }

    data.timeline.forEach((item, index) => {
        const dateObj = new Date(item.date);
        const dateStr = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

        // CSS Icon Class based on type (simple mapping)
        let typeClass = 'type-DEFAULT';
        if (item.type) {
            if (item.type.includes('HARVEST')) typeClass = 'type-HARVEST';
            else if (item.type.includes('WATERING')) typeClass = 'type-WATERING';
            else if (item.type.includes('PESTICIDE')) typeClass = 'type-PESTICIDE';
        }

        const el = document.createElement('div');
        el.className = `timeline-item ${typeClass}`;
        el.style.animationDelay = `${index * 0.1}s`;

        el.innerHTML = `
            <div class="timeline-dot">
                <span class="material-symbols-outlined">${item.icon || 'circle'}</span>
            </div>
            <div class="timeline-content">
                <span class="timeline-date">${dateStr}</span>
                <h4 class="timeline-title">${item.type || 'Hoạt động'}</h4>
                <p class="timeline-desc">${item.description || ''}</p>
            </div>
        `;

        timelineContainer.appendChild(el);
    });
}

function showError(msg) {
    document.getElementById('timeline-container').innerHTML = `
        <div class="error-state" style="text-align:center; padding:40px; color:#ef4444;">
            <span class="material-symbols-outlined" style="font-size:48px; margin-bottom:16px;">error</span>
            <p>${msg}</p>
        </div>
    `;
}
