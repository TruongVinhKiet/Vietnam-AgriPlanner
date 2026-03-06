/* =====================================================
   AgriPlanner - Chart Utilities
   Simple chart rendering without external libraries
   ===================================================== */

/**
 * Create a simple bar chart
 * @param {Element} container - Container element
 * @param {Object} options - Chart configuration
 */
function createBarChart(container, options = {}) {
    const defaults = {
        data: [],
        labels: [],
        colors: ['var(--color-primary)', '#f97316'],
        height: 300,
        animated: true
    };

    const config = { ...defaults, ...options };

    // Find max value for scaling
    const maxValue = Math.max(...config.data.flat());

    // Create chart HTML
    const chartHTML = `
        <div class="bar-chart" style="height: ${config.height}px">
            <div class="bar-chart__grid">
                ${Array(5).fill(0).map(() => '<div class="bar-chart__grid-line"></div>').join('')}
            </div>
            <div class="bar-chart__bars">
                ${config.labels.map((label, i) => `
                    <div class="bar-chart__group">
                        <div class="bar-chart__bar-wrapper">
                            ${Array.isArray(config.data[0])
            ? config.data.map((series, j) => `
                                    <div class="bar-chart__bar" 
                                         style="height: ${(series[i] / maxValue) * 100}%; background-color: ${config.colors[j]}"
                                         data-value="${series[i]}">
                                    </div>
                                  `).join('')
            : `<div class="bar-chart__bar" 
                                        style="height: ${(config.data[i] / maxValue) * 100}%; background-color: ${config.colors[0]}"
                                        data-value="${config.data[i]}">
                                   </div>`
        }
                        </div>
                        <span class="bar-chart__label">${label}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.innerHTML = chartHTML;

    // Animate bars if GSAP is available
    if (config.animated && window.Animations?.isGsapLoaded()) {
        const bars = container.querySelectorAll('.bar-chart__bar');
        window.Animations.animateBars(bars);
    }
}

/**
 * Create a pie chart using CSS conic-gradient
 * @param {Element} container - Container element
 * @param {Object} options - Chart configuration
 */
function createPieChart(container, options = {}) {
    const defaults = {
        data: [],
        labels: [],
        colors: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
        size: 192,
        total: null,
        centerLabel: 'Total'
    };

    const config = { ...defaults, ...options };

    // Calculate total if not provided
    const total = config.total || config.data.reduce((a, b) => a + b, 0);

    // Build conic gradient
    let currentAngle = 0;
    const gradientStops = config.data.map((value, i) => {
        const startAngle = currentAngle;
        const percentage = (value / total) * 100;
        currentAngle += percentage;
        return `${config.colors[i]} ${startAngle}% ${currentAngle}%`;
    }).join(', ');

    const pieHTML = `
        <div class="pie-chart-container">
            <div class="pie-chart" style="
                width: ${config.size}px; 
                height: ${config.size}px;
                background: conic-gradient(${gradientStops});
            ">
                <div class="pie-chart__center">
                    <span class="pie-chart__label">${config.centerLabel}</span>
                    <span class="pie-chart__value">$${(total / 1000).toFixed(1)}k</span>
                </div>
            </div>
            <div class="pie-legend">
                ${config.labels.map((label, i) => {
        const percentage = Math.round((config.data[i] / total) * 100);
        return `
                        <div class="pie-legend__item">
                            <span class="pie-legend__dot" style="background-color: ${config.colors[i]}"></span>
                            <span class="pie-legend__text">${label}</span>
                            <span class="pie-legend__value">${percentage}%</span>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;

    container.innerHTML = pieHTML;
}

/**
 * Create a simple line chart using SVG
 * @param {Element} container - Container element
 * @param {Object} options - Chart configuration
 */
function createLineChart(container, options = {}) {
    const defaults = {
        data: [],
        labels: [],
        color: 'var(--color-primary)',
        height: 160,
        showDots: true,
        animated: true,
        fill: true
    };

    const config = { ...defaults, ...options };

    // Guard: need at least 1 data point
    if (!config.data || config.data.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;">Chưa có dữ liệu</p>';
        return;
    }

    // Guard: single data point — duplicate to make a line
    if (config.data.length === 1) {
        config.data = [config.data[0], config.data[0]];
        config.labels = [config.labels[0] || '', config.labels[0] || ''];
    }

    // Resolve CSS variable colors to hex for SVG compatibility
    const resolvedColor = resolveColor(config.color);

    const minValue = Math.min(...config.data);
    const maxValue = Math.max(...config.data);
    const range = maxValue - minValue || 1;

    const width = 100;
    const height = 50;
    const padding = 5;

    // Calculate points — guard against NaN
    const points = config.data.map((value, i) => {
        const len = config.data.length;
        const x = len > 1
            ? (i / (len - 1)) * (width - padding * 2) + padding
            : width / 2;
        const y = height - ((value - minValue) / range) * (height - padding * 2) - padding;
        return { x: isNaN(x) ? padding : x, y: isNaN(y) ? padding : y, value };
    });

    // Create path
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaD = pathD + ` L${width - padding},${height - padding} L${padding},${height - padding} Z`;

    // Generate unique gradient ID to avoid collisions
    const gradId = 'chartGrad_' + Math.random().toString(36).substr(2, 9);

    const svgHTML = `
        <div class="weight-chart" style="height: ${config.height}px">
            <div class="weight-chart__grid">
                ${Array(4).fill(0).map(() => '<div class="weight-chart__grid-line"></div>').join('')}
            </div>
            <svg class="weight-chart__svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                ${config.fill ? `
                    <defs>
                        <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color: ${resolvedColor}; stop-opacity: 0.2"/>
                            <stop offset="100%" style="stop-color: ${resolvedColor}; stop-opacity: 0"/>
                        </linearGradient>
                    </defs>
                    <path d="${areaD}" fill="url(#${gradId})"/>
                ` : ''}
                <path d="${pathD}" 
                      fill="none" 
                      stroke="${resolvedColor}" 
                      stroke-width="2" 
                      vector-effect="non-scaling-stroke"
                      class="line-chart__path"/>
                ${config.showDots ? points.map(p => `
                    <circle cx="${p.x}" cy="${p.y}" r="3" 
                            fill="white" 
                            stroke="${resolvedColor}" 
                            stroke-width="1.5" 
                            vector-effect="non-scaling-stroke"/>
                `).join('') : ''}
            </svg>
            <div class="weight-chart__labels">
                ${config.labels.map(label => `<span>${label}</span>`).join('')}
            </div>
        </div>
    `;

    container.innerHTML = svgHTML;

    // Animate line drawing if GSAP is available
    if (config.animated && window.Animations?.isGsapLoaded()) {
        const path = container.querySelector('.line-chart__path');
        if (path) {
            window.Animations.drawLine(path);
        }
    }
}

/**
 * Resolve CSS variable to actual color value
 */
function resolveColor(color) {
    if (!color || !color.startsWith('var(')) return color;
    const varName = color.replace(/var\((.*?)\)/, '$1').trim();
    const computed = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return computed || '#10b981';
}

/**
 * Create a professional ApexCharts area chart for livestock trends
 * Uses ApexCharts library (already loaded on livestock page)
 * @param {Element} container - Container element
 * @param {Object} options - Chart configuration
 */
function createApexAreaChart(container, options = {}) {
    const {
        data = [],
        labels = [],
        color = '#10b981',
        height = 180,
        title = '',
        yAxisLabel = '',
        unit = '',
        seriesName = 'Giá trị'
    } = options;

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;">Chưa có dữ liệu</p>';
        return null;
    }

    // Destroy previous chart if any
    if (container._apexChart) {
        try { container._apexChart.destroy(); } catch (e) { /* ignore */ }
    }
    container.innerHTML = '';

    const chartOptions = {
        series: [{
            name: seriesName,
            data: data
        }],
        chart: {
            type: 'area',
            height: height,
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false },
            zoom: { enabled: false },
            sparkline: { enabled: false },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800,
                animateGradually: { enabled: true, delay: 150 },
                dynamicAnimation: { enabled: true, speed: 350 }
            }
        },
        colors: [color],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [0, 100]
            }
        },
        stroke: {
            curve: 'smooth',
            width: 2.5
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: labels,
            labels: {
                style: { fontSize: '10px', colors: '#94a3b8' },
                rotate: -45,
                rotateAlways: labels.length > 5
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: { fontSize: '10px', colors: '#94a3b8' },
                formatter: (val) => val !== undefined && val !== null ? val.toFixed(1) + (unit ? ' ' + unit : '') : ''
            },
            title: yAxisLabel ? { text: yAxisLabel, style: { fontSize: '11px', color: '#94a3b8' } } : undefined
        },
        grid: {
            borderColor: '#f1f5f9',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { top: -10, right: 5, bottom: 0, left: 5 }
        },
        tooltip: {
            theme: 'light',
            x: { show: true },
            y: {
                formatter: (val) => val !== undefined && val !== null ? val.toFixed(2) + (unit ? ' ' + unit : '') : ''
            },
            marker: { show: true }
        },
        markers: {
            size: data.length <= 10 ? 4 : 2,
            colors: ['#fff'],
            strokeColors: [color],
            strokeWidth: 2,
            hover: { sizeOffset: 2 }
        }
    };

    const chart = new ApexCharts(container, chartOptions);
    chart.render();
    container._apexChart = chart;
    return chart;
}

/**
 * Create a progress bar
 * @param {Element} container - Container element
 * @param {number} value - Current value (0-100)
 * @param {Object} options - Configuration
 */
function createProgressBar(container, value, options = {}) {
    const defaults = {
        color: 'var(--color-primary)',
        height: 6,
        animated: true
    };

    const config = { ...defaults, ...options };

    container.innerHTML = `
        <div class="progress" style="height: ${config.height}px">
            <div class="progress__bar" 
                 style="width: ${config.animated ? 0 : value}%; background-color: ${config.color}">
            </div>
        </div>
    `;

    // Animate if requested
    if (config.animated && window.Animations?.isGsapLoaded()) {
        const bar = container.querySelector('.progress__bar');
        gsap.to(bar, {
            width: `${value}%`,
            duration: 1,
            ease: 'power2.out'
        });
    }
}

// Export chart utilities
window.Charts = {
    createBarChart,
    createPieChart,
    createLineChart,
    createProgressBar,
    createApexAreaChart
};
