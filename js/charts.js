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

    const minValue = Math.min(...config.data);
    const maxValue = Math.max(...config.data);
    const range = maxValue - minValue || 1;

    const width = 100;
    const height = 50;
    const padding = 5;

    // Calculate points
    const points = config.data.map((value, i) => {
        const x = (i / (config.data.length - 1)) * (width - padding * 2) + padding;
        const y = height - ((value - minValue) / range) * (height - padding * 2) - padding;
        return { x, y, value };
    });

    // Create path
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaD = pathD + ` L${width - padding},${height - padding} L${padding},${height - padding} Z`;

    const svgHTML = `
        <div class="weight-chart" style="height: ${config.height}px">
            <div class="weight-chart__grid">
                ${Array(4).fill(0).map(() => '<div class="weight-chart__grid-line"></div>').join('')}
            </div>
            <svg class="weight-chart__svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                ${config.fill ? `
                    <defs>
                        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" style="stop-color: ${config.color}; stop-opacity: 0.2"/>
                            <stop offset="100%" style="stop-color: ${config.color}; stop-opacity: 0"/>
                        </linearGradient>
                    </defs>
                    <path d="${areaD}" fill="url(#chartGradient)"/>
                ` : ''}
                <path d="${pathD}" 
                      fill="none" 
                      stroke="${config.color}" 
                      stroke-width="2" 
                      vector-effect="non-scaling-stroke"
                      class="line-chart__path"/>
                ${config.showDots ? points.map(p => `
                    <circle cx="${p.x}" cy="${p.y}" r="3" 
                            fill="white" 
                            stroke="${config.color}" 
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
    createProgressBar
};
