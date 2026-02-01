/**
 * AI Advisor JavaScript - AgriPlanner
 * Xử lý logic tương tác với AI để tư vấn nông nghiệp
 */

// API Configuration - Uses CONFIG from config.js
const AI_ADVISOR_API = `${CONFIG.API_BASE_URL.replace('/api', '')}/api/ai-advisor`;

// DOM Elements
const advisorForm = document.getElementById('advisorForm');
const resultsSection = document.getElementById('resultsSection');
const loadingOverlay = document.getElementById('loadingOverlay');
const aiResponse = document.getElementById('aiResponse');
const providerBadge = document.getElementById('providerBadge');
const responseTime = document.getElementById('responseTime');

// Provider icons
const providerIcons = {
    github: '<i class="fab fa-github"></i> GitHub Models',
    groq: '<i class="fas fa-bolt"></i> Groq Cloud',
    cohere: '<i class="fas fa-comments"></i> Cohere'
};

// Form submission handler
advisorForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Collect form data
    const formData = {
        location: document.getElementById('location').value,
        soilType: document.getElementById('soilType').value,
        area: parseFloat(document.getElementById('area').value),
        waterSource: document.getElementById('waterSource').value,
        season: document.getElementById('season').value,
        currentCrops: document.getElementById('currentCrops').value,
        budget: parseFloat(document.getElementById('budget').value) || 0,
        experience: document.getElementById('experience').value,
        notes: document.getElementById('notes').value
    };

    // Get selected AI provider
    const selectedProvider = document.querySelector('input[name="aiProvider"]:checked').value;

    // Build the prompt
    const prompt = buildAgriculturePrompt(formData);

    // Show loading
    showLoading();
    const startTime = Date.now();

    try {
        const response = await fetch(`${AI_ADVISOR_API}/recommend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
            },
            body: JSON.stringify({
                prompt: prompt,
                provider: selectedProvider,
                context: formData
            })
        });

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Lỗi khi gọi API');
        }

        const data = await response.json();
        
        // Display results
        displayResults(data, selectedProvider, duration);
        
    } catch (error) {
        console.error('AI Advisor Error:', error);
        showError(error.message);
    } finally {
        hideLoading();
    }
});

/**
 * Build agriculture-specific prompt
 */
function buildAgriculturePrompt(data) {
    const soilTypeMap = {
        'dat_phu_sa': 'Đất phù sa',
        'dat_xam': 'Đất xám',
        'dat_do_vang': 'Đất đỏ vàng',
        'dat_phèn': 'Đất phèn',
        'dat_mặn': 'Đất mặn',
        'dat_cat': 'Đất cát',
        'dat_bazan': 'Đất bazan',
        'dat_mun': 'Đất mùn'
    };

    const waterSourceMap = {
        'song_suoi': 'Sông, suối',
        'ao_ho': 'Ao, hồ',
        'gieng_khoan': 'Giếng khoan',
        'nuoc_mua': 'Nước mưa',
        'kenh_muong': 'Kênh mương thủy lợi'
    };

    const seasonMap = {
        'dong_xuan': 'Đông Xuân (tháng 11 đến tháng 3)',
        'he_thu': 'Hè Thu (tháng 4 đến tháng 8)',
        'thu_dong': 'Thu Đông (tháng 9 đến tháng 12)',
        'quanh_nam': 'Quanh năm'
    };

    const experienceMap = {
        'beginner': 'Mới bắt đầu',
        'intermediate': 'Có kinh nghiệm',
        'expert': 'Chuyên gia'
    };

    return `Bạn là chuyên gia nông nghiệp Việt Nam. Hãy tư vấn chi tiết về cây trồng phù hợp dựa trên thông tin sau:

📍 Vị trí: ${data.location}
🏔️ Loại đất: ${soilTypeMap[data.soilType] || data.soilType}
📐 Diện tích: ${data.area} hecta
💧 Nguồn nước: ${waterSourceMap[data.waterSource] || data.waterSource}
📅 Mùa vụ dự kiến: ${seasonMap[data.season] || data.season}
🌱 Cây trồng hiện tại: ${data.currentCrops || 'Chưa có'}
💰 Ngân sách: ${data.budget > 0 ? data.budget + ' triệu VNĐ' : 'Không giới hạn'}
👨‍🌾 Kinh nghiệm: ${experienceMap[data.experience] || data.experience}
${data.notes ? '📝 Ghi chú: ' + data.notes : ''}

Yêu cầu trả lời bằng tiếng Việt, bao gồm:
1. **Đề xuất cây trồng phù hợp nhất** (3-5 loại, sắp xếp theo độ ưu tiên)
2. **Lý do đề xuất** cho từng loại cây
3. **Kỹ thuật canh tác cơ bản** 
4. **Ước tính chi phí và lợi nhuận**
5. **Rủi ro tiềm ẩn và cách phòng tránh**
6. **Lịch trình canh tác gợi ý**`;
}

/**
 * Display AI response
 */
function displayResults(data, provider, duration) {
    resultsSection.style.display = 'block';
    
    // Update provider badge
    providerBadge.innerHTML = providerIcons[provider] || provider;
    
    // Update response time
    responseTime.textContent = `Thời gian: ${duration}s`;
    
    // Format and display response
    const formattedResponse = formatAIResponse(data.response || data.content || data);
    aiResponse.innerHTML = formattedResponse;
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Format AI response with proper styling
 */
function formatAIResponse(response) {
    if (typeof response !== 'string') {
        response = JSON.stringify(response, null, 2);
    }

    // Convert markdown-like formatting to HTML
    let formatted = response
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Lists
        .replace(/^\d+\.\s+(.+)$/gm, '<li class="numbered">$1</li>')
        .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
    
    // Wrap consecutive li elements in ul
    formatted = formatted.replace(/(<li[^>]*>.*?<\/li>)+/g, '<ul>$&</ul>');
    
    return `<div class="ai-response-text"><p>${formatted}</p></div>`;
}

/**
 * Show loading overlay
 */
function showLoading() {
    loadingOverlay.style.display = 'flex';
    resultsSection.style.display = 'none';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    loadingOverlay.style.display = 'none';
}

/**
 * Show error message
 */
function showError(message) {
    resultsSection.style.display = 'block';
    aiResponse.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Có lỗi xảy ra</h3>
            <p>${message}</p>
            <p>Vui lòng kiểm tra:</p>
            <ul>
                <li>Cấu hình API key trong file .env</li>
                <li>Kết nối internet</li>
                <li>Dịch vụ AI đang hoạt động</li>
            </ul>
        </div>
    `;
}

/**
 * Copy response to clipboard
 */
function copyResponse() {
    const text = aiResponse.innerText;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Đã sao chép vào clipboard!');
    }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Không thể sao chép', 'error');
    });
}

/**
 * Save response to localStorage/server
 */
function saveResponse() {
    const savedAdvice = JSON.parse(localStorage.getItem('savedAdvice') || '[]');
    savedAdvice.push({
        id: Date.now(),
        date: new Date().toISOString(),
        content: aiResponse.innerText,
        provider: providerBadge.innerText
    });
    localStorage.setItem('savedAdvice', JSON.stringify(savedAdvice));
    showToast('Đã lưu tư vấn!');
}

/**
 * Print response
 */
function printResponse() {
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Tư Vấn Nông Nghiệp - AgriPlanner</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; }
                h1 { color: #2e7d32; }
                .header { border-bottom: 2px solid #2e7d32; padding-bottom: 10px; margin-bottom: 20px; }
                .content { line-height: 1.6; }
                ul { padding-left: 20px; }
                li { margin-bottom: 8px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🌱 AgriPlanner - Tư Vấn AI</h1>
                <p>Ngày: ${new Date().toLocaleDateString('vi-VN')}</p>
            </div>
            <div class="content">
                ${aiResponse.innerHTML}
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Test AI connection
 */
async function testAIConnection() {
    const providers = ['github', 'groq', 'cohere'];
    
    for (const provider of providers) {
        try {
            const response = await fetch(`${AI_ADVISOR_API}/test?provider=${provider}`);
            const data = await response.json();
            console.log(`${provider}:`, data.status ? '✅ Connected' : '❌ Failed');
        } catch (error) {
            console.log(`${provider}: ❌ Error -`, error.message);
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('AI Advisor loaded');
    
    // Check for API availability
    fetch(`${AI_ADVISOR_API}/providers`)
        .then(res => res.json())
        .then(data => {
            console.log('Available AI providers:', data);
        })
        .catch(err => {
            console.warn('Could not fetch AI providers:', err);
        });
});
