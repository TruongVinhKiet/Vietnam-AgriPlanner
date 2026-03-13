/**
 * AgriPlanner — Data Export Panel
 * Shared module for Cultivation & Livestock pages
 * Renders a slide-in overlay with summary cards, charts, data table, and CSV export
 */

/* ==================== HELPERS ==================== */

function _depFormatCurrency(val) {
    if (!val && val !== 0) return '--';
    return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + ' ₫';
}

function _depFormatArea(sqm) {
    if (!sqm) return '--';
    const n = Number(sqm);
    return n < 10000 ? `${n.toFixed(0)} m²` : `${(n / 10000).toFixed(2)} ha`;
}

function _depFormatDate(d) {
    if (!d) return '--';
    try {
        const date = new Date(d);
        if (isNaN(date)) return d;
        return date.toLocaleDateString('vi-VN');
    } catch { return d; }
}

function _depGetPageType() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('livestock')) return 'livestock';
    if (path.includes('cultivation')) return 'cultivation';
    return 'unknown';
}

/* ==================== OPEN / CLOSE ==================== */

function openDataExportPanel() {
    // Prevent duplicates
    if (document.getElementById('dep-backdrop')) return;

    const pageType = _depGetPageType();

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'data-export-backdrop';
    backdrop.id = 'dep-backdrop';
    backdrop.addEventListener('click', closeDataExportPanel);

    // Create panel
    const panel = document.createElement('div');
    panel.className = 'data-export-panel';
    panel.id = 'dep-panel';
    panel.addEventListener('click', e => e.stopPropagation());

    // Build inner content depending on page type
    if (pageType === 'livestock') {
        panel.innerHTML = _buildLivestockPanel();
    } else {
        panel.innerHTML = _buildCultivationPanel();
    }

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    // Trigger animation on next frame
    requestAnimationFrame(() => {
        backdrop.classList.add('active');
        panel.classList.add('active');
    });

    // Render charts after DOM is ready
    setTimeout(() => {
        if (pageType === 'livestock') {
            _renderLivestockCharts();
        } else {
            _renderCultivationCharts();
        }
    }, 500);
}

function closeDataExportPanel() {
    const backdrop = document.getElementById('dep-backdrop');
    const panel = document.getElementById('dep-panel');
    if (backdrop) {
        backdrop.classList.remove('active');
    }
    if (panel) {
        panel.classList.remove('active');
    }
    setTimeout(() => {
        backdrop?.remove();
        panel?.remove();
    }, 400);
}

/* ==================== LIVESTOCK PANEL ==================== */

function _buildLivestockPanel() {
    const pens = (typeof allPens !== 'undefined') ? allPens : [];
    const totalPens = pens.length;
    const activePens = pens.filter(p => p.animalDefinition && p.animalCount > 0).length;
    const totalAnimals = pens.reduce((s, p) => s + (p.animalCount || 0), 0);
    const totalInvestment = pens.reduce((s, p) => s + (Number(p.totalInvestment) || 0), 0);

    // Status distribution
    const statusDist = {};
    pens.forEach(p => {
        const st = (p.status || 'EMPTY').toUpperCase();
        statusDist[st] = (statusDist[st] || 0) + 1;
    });

    // Animal type distribution
    const animalDist = {};
    pens.forEach(p => {
        if (p.animalDefinition) {
            const name = p.animalDefinition.name || 'Khác';
            animalDist[name] = (animalDist[name] || 0) + (p.animalCount || 0);
        }
    });

    // Build table rows
    let tableRows = '';
    pens.forEach(pen => {
        const animalName = pen.animalDefinition?.name || '--';
        const count = pen.animalCount || 0;
        const capacity = pen.capacity || '--';
        const status = (pen.status || 'EMPTY').toUpperCase();
        const statusLabel = { CLEAN: 'Sạch', DIRTY: 'Cần dọn', SICK: 'Ốm', EMPTY: 'Trống' }[status] || status;
        const statusClass = status.toLowerCase();
        const startDate = _depFormatDate(pen.startDate);
        const harvestDate = _depFormatDate(pen.expectedHarvestDate);
        const investment = _depFormatCurrency(pen.totalInvestment);
        const area = pen.areaSqm ? `${Number(pen.areaSqm).toFixed(0)} m²` : '--';
        const farmingType = pen.farmingType || '--';

        tableRows += `<tr>
            <td style="font-weight:600">${pen.code}</td>
            <td>${animalName}</td>
            <td style="text-align:center">${count}</td>
            <td style="text-align:center">${capacity}</td>
            <td>${area}</td>
            <td><span class="dep-badge dep-badge--${statusClass}">${statusLabel}</span></td>
            <td>${startDate}</td>
            <td>${harvestDate}</td>
            <td style="text-align:right; font-weight:600; color:#16a34a">${investment}</td>
        </tr>`;
    });

    if (pens.length === 0) {
        tableRows = `<tr><td colspan="9" style="text-align:center;padding:40px;color:#94a3b8;">Chưa có dữ liệu chuồng trại</td></tr>`;
    }

    return `
        <div class="dep-header">
            <div class="dep-header__left">
                <div class="dep-header__icon-wrap">
                    <span class="material-symbols-outlined">summarize</span>
                </div>
                <div>
                    <h2 class="dep-header__title">Báo cáo Chăn nuôi</h2>
                    <p class="dep-header__subtitle">Tổng quan trang trại • ${_depFormatDate(new Date())}</p>
                </div>
            </div>
            <button class="dep-header__close" onclick="closeDataExportPanel()" title="Đóng">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>

        <div class="dep-body">
            <!-- Summary Cards -->
            <div class="dep-summary-grid">
                <div class="dep-summary-card dep-summary-card--green">
                    <span class="material-symbols-outlined dep-summary-card__bg-icon">fence</span>
                    <div class="dep-summary-card__label">Tổng chuồng</div>
                    <div class="dep-summary-card__value dep-summary-card__value--green">${totalPens}</div>
                </div>
                <div class="dep-summary-card dep-summary-card--blue">
                    <span class="material-symbols-outlined dep-summary-card__bg-icon">pets</span>
                    <div class="dep-summary-card__label">Tổng vật nuôi</div>
                    <div class="dep-summary-card__value dep-summary-card__value--blue">${totalAnimals.toLocaleString('vi-VN')}</div>
                </div>
                <div class="dep-summary-card dep-summary-card--amber">
                    <span class="material-symbols-outlined dep-summary-card__bg-icon">check_circle</span>
                    <div class="dep-summary-card__label">Chuồng hoạt động</div>
                    <div class="dep-summary-card__value dep-summary-card__value--amber">${activePens}</div>
                </div>
                <div class="dep-summary-card dep-summary-card--purple">
                    <span class="material-symbols-outlined dep-summary-card__bg-icon">payments</span>
                    <div class="dep-summary-card__label">Tổng vốn đầu tư</div>
                    <div class="dep-summary-card__value dep-summary-card__value--purple" style="font-size:18px">${_depFormatCurrency(totalInvestment)}</div>
                </div>
            </div>

            <!-- Charts -->
            <div class="dep-charts-row">
                <div class="dep-chart-card">
                    <div class="dep-chart-card__title">
                        <span class="material-symbols-outlined">donut_large</span>
                        Phân bố trạng thái chuồng
                    </div>
                    <div class="dep-chart-wrap" id="dep-chart-status"></div>
                </div>
                <div class="dep-chart-card">
                    <div class="dep-chart-card__title">
                        <span class="material-symbols-outlined">bar_chart</span>
                        Số lượng vật nuôi theo loại
                    </div>
                    <div class="dep-chart-wrap" id="dep-chart-animals"></div>
                </div>
            </div>

            <!-- Data Table -->
            <div class="dep-section">
                <div class="dep-section__header">
                    <div class="dep-section__icon dep-section__icon--green">
                        <span class="material-symbols-outlined">table_chart</span>
                    </div>
                    <div class="dep-section__title">Chi tiết chuồng trại (${totalPens})</div>
                </div>
                <div class="dep-table-wrapper">
                    <table class="dep-table" id="dep-data-table">
                        <thead>
                            <tr>
                                <th>Mã chuồng</th>
                                <th>Vật nuôi</th>
                                <th style="text-align:center">Số lượng</th>
                                <th style="text-align:center">Sức chứa</th>
                                <th>Diện tích</th>
                                <th>Trạng thái</th>
                                <th>Ngày bắt đầu</th>
                                <th>Dự kiến thu hoạch</th>
                                <th style="text-align:right">Vốn đầu tư</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="dep-footer">
            <div class="dep-footer__info">
                <span class="material-symbols-outlined">info</span>
                Dữ liệu cập nhật lần cuối: ${new Date().toLocaleString('vi-VN')}
            </div>
            <div class="dep-footer__actions">
                <button class="dep-btn dep-btn--secondary" onclick="exportDataAsPDF('livestock')">
                    <span class="material-symbols-outlined">picture_as_pdf</span>
                    Xuất PDF
                </button>
                <button class="dep-btn dep-btn--primary" onclick="_depExportCSV('livestock')">
                    <span class="material-symbols-outlined">download</span>
                    Xuất CSV
                </button>
            </div>
        </div>
    `;
}

function _renderLivestockCharts() {
    const pens = (typeof allPens !== 'undefined') ? allPens : [];

    // Status distribution chart (Donut)
    const statusDist = {};
    pens.forEach(p => {
        const st = (p.status || 'EMPTY').toUpperCase();
        statusDist[st] = (statusDist[st] || 0) + 1;
    });

    const statusLabels = { CLEAN: 'Sạch', DIRTY: 'Cần dọn', SICK: 'Ốm', EMPTY: 'Trống' };
    const statusColors = { CLEAN: '#22c55e', DIRTY: '#a1887f', SICK: '#ef4444', EMPTY: '#94a3b8' };

    if (Object.keys(statusDist).length > 0 && document.getElementById('dep-chart-status')) {
        const labels = Object.keys(statusDist).map(k => statusLabels[k] || k);
        const series = Object.values(statusDist);
        const colors = Object.keys(statusDist).map(k => statusColors[k] || '#6b7280');

        new ApexCharts(document.getElementById('dep-chart-status'), {
            chart: { type: 'donut', height: 200, animations: { enabled: true, easing: 'easeinout', speed: 800, animateGradually: { enabled: true, delay: 150 } } },
            series: series,
            labels: labels,
            colors: colors,
            plotOptions: { pie: { donut: { size: '60%', labels: { show: true, total: { show: true, label: 'Tổng', fontSize: '14px', fontWeight: 700, color: '#374151' } } } } },
            dataLabels: { enabled: false },
            legend: { position: 'bottom', fontSize: '12px', fontFamily: 'Manrope, sans-serif', markers: { radius: 4 } },
            stroke: { width: 2, colors: ['#fff'] }
        }).render();
    }

    // Animal type bar chart
    const animalDist = {};
    pens.forEach(p => {
        if (p.animalDefinition) {
            const name = p.animalDefinition.name || 'Khác';
            animalDist[name] = (animalDist[name] || 0) + (p.animalCount || 0);
        }
    });

    if (Object.keys(animalDist).length > 0 && document.getElementById('dep-chart-animals')) {
        new ApexCharts(document.getElementById('dep-chart-animals'), {
            chart: { type: 'bar', height: 200, toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 1000, animateGradually: { enabled: true, delay: 200 } } },
            series: [{ name: 'Số lượng', data: Object.values(animalDist) }],
            xaxis: { categories: Object.keys(animalDist), labels: { style: { fontSize: '11px', fontFamily: 'Manrope' } } },
            yaxis: { labels: { style: { fontSize: '11px' } } },
            colors: ['#16a34a'],
            plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', distributed: true } },
            dataLabels: { enabled: true, style: { fontSize: '11px', fontWeight: 700 } },
            legend: { show: false },
            grid: { borderColor: '#f1f5f9' },
            tooltip: { style: { fontFamily: 'Manrope' } }
        }).render();
    }
}

/* ==================== CULTIVATION PANEL ==================== */

function _buildCultivationPanel() {
    let fields = [];
    if (typeof fieldsData !== 'undefined' && fieldsData.length > 0) {
        fields = fieldsData;
    } else if (typeof allFieldsData !== 'undefined') {
        fields = allFieldsData;
    }
    const totalFields = fields.length;
    const activeFields = fields.filter(f => (f.status || '').toUpperCase() === 'ACTIVE').length;
    const totalArea = fields.reduce((s, f) => s + (Number(f.areaSqm) || 0), 0);
    const estimatedRevenue = fields.reduce((s, f) => {
        if (f.currentCrop && f.currentCrop.estimatedRevenue) return s + Number(f.currentCrop.estimatedRevenue);
        return s;
    }, 0);

    // Crop distribution
    const cropDist = {};
    fields.forEach(f => {
        const name = f.currentCrop?.name || 'Chưa trồng';
        cropDist[name] = (cropDist[name] || 0) + 1;
    });

    // Stage distribution
    const stageDist = {};
    fields.forEach(f => {
        const stage = f.workflowStage || 'EMPTY';
        stageDist[stage] = (stageDist[stage] || 0) + 1;
    });

    // Build table rows
    let tableRows = '';
    fields.forEach(field => {
        const cropName = field.currentCrop?.name || '--';
        const stage = field.workflowStage || 'EMPTY';
        const stageLabels = {
            EMPTY: 'Trống', CROP_SELECTED: 'Đã chọn giống', FERTILIZED: 'Đã bón phân',
            SEEDED: 'Đã gieo hạt', GROWING: 'Đang phát triển', READY_HARVEST: 'Sẵn sàng thu hoạch', HARVESTED: 'Đã thu hoạch'
        };
        const stageLabel = stageLabels[stage] || stage;
        const status = (field.status || 'EMPTY').toUpperCase();
        const statusLabel = { ACTIVE: 'Hoạt động', FALLOW: 'Nghỉ', EMPTY: 'Trống' }[status] || status;
        const statusClass = status.toLowerCase();
        const area = _depFormatArea(field.areaSqm);
        const plantDate = _depFormatDate(field.plantedDate);
        const harvestDate = _depFormatDate(field.expectedHarvestDate);
        const revenue = field.currentCrop?.estimatedRevenue ? _depFormatCurrency(field.currentCrop.estimatedRevenue) : '--';

        tableRows += `<tr>
            <td style="font-weight:600">${field.name}</td>
            <td>${area}</td>
            <td>${cropName}</td>
            <td>${stageLabel}</td>
            <td><span class="dep-badge dep-badge--${statusClass}">${statusLabel}</span></td>
            <td>${plantDate}</td>
            <td>${harvestDate}</td>
            <td style="text-align:right; font-weight:600; color:#16a34a">${revenue}</td>
        </tr>`;
    });

    if (fields.length === 0) {
        tableRows = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8;">Chưa có dữ liệu ruộng</td></tr>`;
    }

    return `
        <div class="dep-header">
            <div class="dep-header__left">
                <div class="dep-header__icon-wrap">
                    <span class="material-symbols-outlined">summarize</span>
                </div>
                <div>
                    <h2 class="dep-header__title">Báo cáo Trồng trọt</h2>
                    <p class="dep-header__subtitle">Tổng quan trang trại • ${_depFormatDate(new Date())}</p>
                </div>
            </div>
            <button class="dep-header__close" onclick="closeDataExportPanel()" title="Đóng">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>

        <div class="dep-body">
            <!-- Summary Cards -->
            <div class="dep-summary-grid">
                <div class="dep-summary-card dep-summary-card--green">
                    <span class="material-symbols-outlined dep-summary-card__bg-icon">grass</span>
                    <div class="dep-summary-card__label">Tổng ruộng</div>
                    <div class="dep-summary-card__value dep-summary-card__value--green">${totalFields}</div>
                </div>
                <div class="dep-summary-card dep-summary-card--blue">
                    <span class="material-symbols-outlined dep-summary-card__bg-icon">straighten</span>
                    <div class="dep-summary-card__label">Tổng diện tích</div>
                    <div class="dep-summary-card__value dep-summary-card__value--blue" style="font-size:18px">${_depFormatArea(totalArea)}</div>
                </div>
                <div class="dep-summary-card dep-summary-card--amber">
                    <span class="material-symbols-outlined dep-summary-card__bg-icon">potted_plant</span>
                    <div class="dep-summary-card__label">Ruộng hoạt động</div>
                    <div class="dep-summary-card__value dep-summary-card__value--amber">${activeFields}</div>
                </div>
                <div class="dep-summary-card dep-summary-card--purple">
                    <span class="material-symbols-outlined dep-summary-card__bg-icon">trending_up</span>
                    <div class="dep-summary-card__label">Dự kiến doanh thu</div>
                    <div class="dep-summary-card__value dep-summary-card__value--purple" style="font-size:18px">${estimatedRevenue > 0 ? _depFormatCurrency(estimatedRevenue) : '--'}</div>
                </div>
            </div>

            <!-- Charts -->
            <div class="dep-charts-row">
                <div class="dep-chart-card">
                    <div class="dep-chart-card__title">
                        <span class="material-symbols-outlined">donut_large</span>
                        Phân bố cây trồng
                    </div>
                    <div class="dep-chart-wrap" id="dep-chart-crops"></div>
                </div>
                <div class="dep-chart-card">
                    <div class="dep-chart-card__title">
                        <span class="material-symbols-outlined">bar_chart</span>
                        Giai đoạn canh tác
                    </div>
                    <div class="dep-chart-wrap" id="dep-chart-stages"></div>
                </div>
            </div>

            <!-- Data Table -->
            <div class="dep-section">
                <div class="dep-section__header">
                    <div class="dep-section__icon dep-section__icon--green">
                        <span class="material-symbols-outlined">table_chart</span>
                    </div>
                    <div class="dep-section__title">Chi tiết ruộng (${totalFields})</div>
                </div>
                <div class="dep-table-wrapper">
                    <table class="dep-table" id="dep-data-table">
                        <thead>
                            <tr>
                                <th>Tên ruộng</th>
                                <th>Diện tích</th>
                                <th>Cây trồng</th>
                                <th>Giai đoạn</th>
                                <th>Trạng thái</th>
                                <th>Ngày trồng</th>
                                <th>Dự kiến thu hoạch</th>
                                <th style="text-align:right">Doanh thu dự kiến</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="dep-footer">
            <div class="dep-footer__info">
                <span class="material-symbols-outlined">info</span>
                Dữ liệu cập nhật lần cuối: ${new Date().toLocaleString('vi-VN')}
            </div>
            <div class="dep-footer__actions">
                <button class="dep-btn dep-btn--secondary" onclick="exportDataAsPDF('cultivation')">
                    <span class="material-symbols-outlined">picture_as_pdf</span>
                    Xuất PDF
                </button>
                <button class="dep-btn dep-btn--primary" onclick="_depExportCSV('cultivation')">
                    <span class="material-symbols-outlined">download</span>
                    Xuất CSV
                </button>
            </div>
        </div>
    `;
}

function _renderCultivationCharts() {
    let fields = [];
    if (typeof fieldsData !== 'undefined' && fieldsData.length > 0) {
        fields = fieldsData;
    } else if (typeof allFieldsData !== 'undefined') {
        fields = allFieldsData;
    }

    // Crop distribution donut
    const cropDist = {};
    fields.forEach(f => {
        const name = f.currentCrop?.name || 'Chưa trồng';
        cropDist[name] = (cropDist[name] || 0) + 1;
    });

    const cropColors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

    if (Object.keys(cropDist).length > 0 && document.getElementById('dep-chart-crops')) {
        new ApexCharts(document.getElementById('dep-chart-crops'), {
            chart: { type: 'donut', height: 200, animations: { enabled: true, easing: 'easeinout', speed: 800, animateGradually: { enabled: true, delay: 150 } } },
            series: Object.values(cropDist),
            labels: Object.keys(cropDist),
            colors: cropColors.slice(0, Object.keys(cropDist).length),
            plotOptions: { pie: { donut: { size: '60%', labels: { show: true, total: { show: true, label: 'Tổng ruộng', fontSize: '13px', fontWeight: 700, color: '#374151' } } } } },
            dataLabels: { enabled: false },
            legend: { position: 'bottom', fontSize: '12px', fontFamily: 'Manrope, sans-serif', markers: { radius: 4 } },
            stroke: { width: 2, colors: ['#fff'] }
        }).render();
    }

    // Stage distribution bar chart
    const stageDist = {};
    const stageLabels = {
        EMPTY: 'Trống', CROP_SELECTED: 'Chọn giống', FERTILIZED: 'Bón phân',
        SEEDED: 'Gieo hạt', GROWING: 'Phát triển', READY_HARVEST: 'Thu hoạch', HARVESTED: 'Đã thu'
    };
    fields.forEach(f => {
        const stage = f.workflowStage || 'EMPTY';
        const label = stageLabels[stage] || stage;
        stageDist[label] = (stageDist[label] || 0) + 1;
    });

    const stageColors = ['#94a3b8', '#8b5cf6', '#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#10b981'];

    if (Object.keys(stageDist).length > 0 && document.getElementById('dep-chart-stages')) {
        new ApexCharts(document.getElementById('dep-chart-stages'), {
            chart: { type: 'bar', height: 200, toolbar: { show: false }, animations: { enabled: true, easing: 'easeinout', speed: 1000, animateGradually: { enabled: true, delay: 200 } } },
            series: [{ name: 'Ruộng', data: Object.values(stageDist) }],
            xaxis: { categories: Object.keys(stageDist), labels: { style: { fontSize: '10px', fontFamily: 'Manrope' }, rotate: -30 } },
            yaxis: { labels: { style: { fontSize: '11px' } } },
            colors: stageColors,
            plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', distributed: true } },
            dataLabels: { enabled: true, style: { fontSize: '11px', fontWeight: 700 } },
            legend: { show: false },
            grid: { borderColor: '#f1f5f9' }
        }).render();
    }
}

/* ==================== CSV EXPORT ==================== */

function _depExportCSV(pageType) {
    let csvContent = '';
    let filename = '';

    if (pageType === 'livestock') {
        const pens = (typeof allPens !== 'undefined') ? allPens : [];
        const statusLabels = { CLEAN: 'Sạch', DIRTY: 'Cần dọn', SICK: 'Ốm', EMPTY: 'Trống' };

        csvContent = '\uFEFF'; // BOM for Excel UTF-8
        csvContent += 'Mã chuồng,Vật nuôi,Số lượng,Sức chứa,Diện tích (m²),Trạng thái,Ngày bắt đầu,Dự kiến thu hoạch,Vốn đầu tư (VND)\n';

        pens.forEach(pen => {
            const row = [
                pen.code || '',
                pen.animalDefinition?.name || '',
                pen.animalCount || 0,
                pen.capacity || '',
                pen.areaSqm || '',
                statusLabels[(pen.status || 'EMPTY').toUpperCase()] || pen.status || '',
                _depFormatDate(pen.startDate),
                _depFormatDate(pen.expectedHarvestDate),
                Math.round(Number(pen.totalInvestment) || 0)
            ];
            csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
        });

        filename = `BaoCao_ChanNuoi_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`;
    } else {
        let fields = [];
        if (typeof fieldsData !== 'undefined' && fieldsData.length > 0) {
            fields = fieldsData;
        } else if (typeof allFieldsData !== 'undefined') {
            fields = allFieldsData;
        }
        const stageLabels = {
            EMPTY: 'Trống', CROP_SELECTED: 'Đã chọn giống', FERTILIZED: 'Đã bón phân',
            SEEDED: 'Đã gieo hạt', GROWING: 'Đang phát triển', READY_HARVEST: 'Sẵn sàng thu hoạch', HARVESTED: 'Đã thu hoạch'
        };

        csvContent = '\uFEFF';
        csvContent += 'Tên ruộng,Diện tích (m²),Cây trồng,Giai đoạn,Trạng thái,Ngày trồng,Dự kiến thu hoạch,Doanh thu dự kiến (VND)\n';

        fields.forEach(field => {
            const row = [
                field.name || '',
                Number(field.areaSqm) || 0,
                field.currentCrop?.name || '',
                stageLabels[field.workflowStage] || field.workflowStage || '',
                field.status || '',
                _depFormatDate(field.plantedDate),
                _depFormatDate(field.expectedHarvestDate),
                Math.round(Number(field.currentCrop?.estimatedRevenue) || 0)
            ];
            csvContent += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
        });

        filename = `BaoCao_TrongTrot_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.csv`;
    }

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    // Show notification if available
    if (typeof showNotification === 'function') {
        showNotification(`Đã tải xuống ${filename}`, 'success');
    }
}

/* ==================== KEYBOARD SHORTCUT ==================== */
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('dep-panel')) {
        closeDataExportPanel();
    }
});

/* ==================== PDF EXPORT ==================== */

async function exportDataAsPDF(type) {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        const h2cUrl = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        const jspdfUrl = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

        try {
            if (typeof showNotification === 'function') {
                showNotification('info', 'Đang tải tiện ích', 'Đang tải thư viện tạo PDF...');
            }
            await _loadScript(h2cUrl);
            await _loadScript(jspdfUrl);
        } catch (e) {
            console.error('Lỗi tải thư viện jsPDF/html2canvas', e);
            if (typeof showNotification === 'function') {
                showNotification('error', 'Lỗi', 'Không tải được thư viện PDF');
            }
            return;
        }
    }

    const { jsPDF } = window.jspdf;
    const panelNode = document.querySelector('.data-export-panel');
    if (!panelNode) return;

    if (typeof showNotification === 'function') {
        showNotification('info', 'Đang xử lý', 'Đang tạo tệp PDF, vui lòng đợi...');
    }

    try {
        const depBody = panelNode.querySelector('.dep-body');
        const actionsNode = panelNode.querySelector('.dep-footer__actions');
        const closeNode = panelNode.querySelector('.dep-header__close');

        let originalOverflow = 'auto';
        let originalHeight = 'auto';
        let originalTransform = 'none';

        if (depBody) {
            originalOverflow = depBody.style.overflowY;
            originalHeight = depBody.style.height;

            // Expand body fully 
            depBody.style.overflowY = 'visible';
            depBody.style.height = 'max-content';
        }

        // The absolute position transform logic
        originalTransform = panelNode.style.transform;
        panelNode.style.transform = 'none';

        if (actionsNode) actionsNode.style.display = 'none';
        if (closeNode) closeNode.style.display = 'none';

        const canvas = await html2canvas(panelNode, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowHeight: panelNode.scrollHeight,
            onclone: (doc) => {
                const clonedPanel = doc.querySelector('.data-export-panel');
                if (clonedPanel) {
                    clonedPanel.style.height = 'max-content';
                    clonedPanel.style.position = 'relative';
                    clonedPanel.style.boxShadow = 'none';
                    clonedPanel.style.background = '#ffffff';

                    // Essential for full-height table capture: disable flex layout
                    clonedPanel.style.display = 'block';

                    // Force the body frame to expand
                    const bodyPart = clonedPanel.querySelector('.dep-body');
                    if (bodyPart) {
                        bodyPart.style.overflow = 'visible';
                        bodyPart.style.height = 'max-content';
                        bodyPart.style.maxHeight = 'none';
                        bodyPart.style.paddingBottom = '20px'; // Overwrite large scroll padding
                    }

                    // Fix missing background gradients on summary cards by defining fallback colors
                    const cards = clonedPanel.querySelectorAll('.dep-summary-card');
                    cards.forEach(card => {
                        if (card.classList.contains('dep-summary-card--green')) card.style.background = '#f0fdf4';
                        if (card.classList.contains('dep-summary-card--blue')) card.style.background = '#eff6ff';
                        if (card.classList.contains('dep-summary-card--amber')) card.style.background = '#fffbeb';
                        if (card.classList.contains('dep-summary-card--purple')) card.style.background = '#faf5ff';
                        // Force opacity to 1 if it animated from 0
                        card.style.opacity = '1';
                        card.style.transform = 'none';
                        // Keep text colors explicit
                        card.style.color = '#000';
                    });

                    // Ensure sections and rows are fully visible (override animations if needed)
                    clonedPanel.querySelectorAll('.dep-section, .dep-table tbody tr, .dep-chart-card').forEach(el => {
                        el.style.opacity = '1';
                        el.style.transform = 'none';
                    });

                    const head = clonedPanel.querySelector('.dep-header');
                    if (head) {
                        head.style.background = '#f0fdf4';
                        head.style.color = '#000';
                    }

                    const tableHead = clonedPanel.querySelectorAll('.dep-table th');
                    tableHead.forEach(th => th.style.background = '#f0fdf4');

                    // Explicitly draw ApexCharts if they are invisible
                    // html2canvas sometimes struggles with SVGs inside foreignObjects or hidden overflow parents
                    clonedPanel.querySelectorAll('.apexcharts-svg').forEach(svg => {
                        svg.style.backgroundColor = 'white';
                    });
                }
            }
        });

        if (depBody) {
            depBody.style.overflowY = originalOverflow;
            depBody.style.height = originalHeight;
        }
        panelNode.style.transform = originalTransform;
        if (actionsNode) actionsNode.style.display = '';
        if (closeNode) closeNode.style.display = '';

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const dateStr = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
        const filename = type === 'cultivation' ? `BaoCao_TrongTrot_${dateStr}.pdf` : `BaoCao_ChanNuoi_${dateStr}.pdf`;
        pdf.save(filename);

        if (typeof showNotification === 'function') {
            showNotification('success', 'Thành công', 'Đã lưu tệp PDF báo cáo!');
        }
    } catch (err) {
        console.error('PDF Export Error:', err);
        if (typeof showNotification === 'function') {
            showNotification('error', 'Lỗi', 'Không thể tạo tệp PDF, vui lòng thử lại sau.');
        }
    }
}

function _loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
