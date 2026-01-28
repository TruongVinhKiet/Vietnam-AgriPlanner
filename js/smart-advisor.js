// =====================================================
// AgriPlanner - Smart Advisor (AI-Powered Recommendations)
// Analyzes farm data and provides smart shopping suggestions
// Priority: Gemini API → OpenRouter Gemma 3 27B → Rule-based
// =====================================================

// Database Animal Definitions - synced with animal_definitions table
const DB_ANIMALS = {
    LAND: ['Trâu', 'Bò thịt', 'Bò sữa', 'Lợn (Heo)', 'Dê', 'Cừu', 'Gà', 'Chim cút'],
    FRESHWATER: ['Cá rô phi', 'Cá trắm cỏ', 'Cá chép', 'Cá mè', 'Cá trê', 'Cá lóc', 'Cá tra', 'Cá basa', 'Lươn', 'Ếch', 'Ốc bươu đen'],
    BRACKISH: ['Tôm sú', 'Tôm thẻ chân trắng', 'Cua biển', 'Cá kèo', 'Cá đối'],
    SALTWATER: ['Cá mú', 'Cá chim biển', 'Cá hồng', 'Tôm hùm', 'Hàu', 'Nghêu', 'Sò'],
    SPECIAL: ['Vịt', 'Ngan', 'Ngỗng', 'Ong', 'Tằm']
};

// Get all animals as flat list for AI reference
const ALL_DB_ANIMALS = Object.values(DB_ANIMALS).flat();

class SmartAdvisor {
    constructor() {
        this.isOpen = false;
        this.isLoading = false;
        this.farmData = null;
        this.recommendations = [];
        this.useAI = true; // Try AI first, fallback to rule-based
        this.refreshInterval = null;
        this.container = null;
        this.panel = null;
        this.dataLoaded = false; // Track if data has been loaded
        this.lastLoadTime = null; // Track when data was last loaded
        this.currentAISource = 'none'; // Track which AI source is being used

        // Gemini API config (primary) - Using 1.5-flash for more requests
        this.geminiApiKey = CONFIG?.GEMINI_API_KEY || '';
        this.geminiApiUrl = CONFIG?.SMART_ADVISOR?.GEMINI_API_URL || 
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
        
        // OpenRouter API config (backup with Gemma 3 27B free)
        this.openrouterApiKey = CONFIG?.OPENROUTER_BACKUP_API_KEY || CONFIG?.OPENROUTER_API_KEY || '';
        this.openrouterModel = CONFIG?.SMART_ADVISOR?.BACKUP_MODEL || 'google/gemma-3-27b-it:free';
        this.openrouterApiUrl = CONFIG?.SMART_ADVISOR?.OPENROUTER_API_URL || 
            'https://openrouter.ai/api/v1/chat/completions';

        this.init();
    }

    init() {
        this.createAdvisorUI();
        this.bindEvents();
    }

    createAdvisorUI() {
        this.container = document.createElement('div');
        this.container.className = 'smart-advisor-container';
        this.container.innerHTML = `
            <!-- Floating Button -->
            <button class="smart-advisor-toggle" id="advisor-toggle" title="Đề xuất thông minh">
                <span class="material-symbols-outlined">auto_awesome</span>
                <span class="smart-advisor-badge" id="advisor-badge" style="display: none;">0</span>
            </button>
            
            <!-- Advisor Panel -->
            <div class="smart-advisor-panel" id="advisor-panel">
                <div class="advisor-header">
                    <div class="advisor-header__icon">
                        <span class="material-symbols-outlined">psychology</span>
                    </div>
                    <div class="advisor-header__info">
                        <div class="advisor-header__title">Cố vấn Thông minh</div>
                        <div class="advisor-header__status" id="advisor-status">Sẵn sàng phân tích</div>
                    </div>
                    <button class="advisor-header__close" id="advisor-close">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <!-- Farm Stats Summary -->
                <div class="advisor-stats" id="advisor-stats">
                    <div class="advisor-stat">
                        <div class="advisor-stat__value" id="stat-balance">--</div>
                        <div class="advisor-stat__label">Số dư</div>
                    </div>
                    <div class="advisor-stat">
                        <div class="advisor-stat__value" id="stat-fields">--</div>
                        <div class="advisor-stat__label">Ruộng</div>
                    </div>
                    <div class="advisor-stat">
                        <div class="advisor-stat__value" id="stat-livestock">--</div>
                        <div class="advisor-stat__label">Chuồng</div>
                    </div>
                </div>
                
                <!-- Recommendations -->
                <div class="advisor-recommendations" id="advisor-recommendations">
                    <div class="advisor-empty">
                        <span class="material-symbols-outlined">touch_app</span>
                        <div class="advisor-empty__title">Nhấn "Làm mới" để bắt đầu</div>
                        <p>Phân tích dữ liệu và đưa ra đề xuất thông minh</p>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="advisor-footer">
                    <div class="advisor-ai-status">
                        <span class="advisor-ai-status__dot" id="ai-status-dot"></span>
                        <span id="ai-status-text">AI Gemini</span>
                    </div>
                    <button class="advisor-refresh" id="advisor-refresh" title="Làm mới đề xuất">
                        <span class="material-symbols-outlined">refresh</span>
                        Làm mới
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);
        this.panel = document.getElementById('advisor-panel');
    }

    bindEvents() {
        document.getElementById('advisor-toggle').addEventListener('click', () => this.toggle());
        document.getElementById('advisor-close').addEventListener('click', () => this.close());
        document.getElementById('advisor-refresh').addEventListener('click', () => this.refresh(true));
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.isOpen = true;
        this.panel.classList.add('open');
        document.getElementById('advisor-toggle').classList.add('active');
        
        // Load data only if not loaded yet OR data is stale (> 5 minutes)
        if (!this.dataLoaded || this.isDataStale()) {
            this.loadRecommendations();
        }
    }

    close() {
        this.isOpen = false;
        this.panel.classList.remove('open');
        document.getElementById('advisor-toggle').classList.remove('active');
    }

    isDataStale() {
        if (!this.lastLoadTime) return true;
        const fiveMinutes = 5 * 60 * 1000;
        return (Date.now() - this.lastLoadTime) > fiveMinutes;
    }

    async refresh(forceRefresh = false) {
        const refreshBtn = document.getElementById('advisor-refresh');
        refreshBtn.classList.add('loading');
        refreshBtn.disabled = true;
        
        // Force reload data
        this.dataLoaded = false;
        await this.loadRecommendations();
        
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
    }

    // ==================== DATA FETCHING ====================

    async loadRecommendations() {
        this.showLoading();
        
        try {
            // 1. Fetch all farm data from real APIs
            await this.fetchFarmData();
            
            // 2. Update stats display
            this.updateStatsDisplay();
            
            // 3. Try AI analysis first (Gemini → OpenRouter → Rule-based)
            if (this.useAI && (this.geminiApiKey || this.openrouterApiKey)) {
                try {
                    this.recommendations = await this.getAIRecommendations();
                    // AI status is set inside getAIRecommendations based on which API succeeded
                } catch (aiError) {
                    console.warn('All AI APIs failed, using rule-based:', aiError);
                    this.recommendations = this.getRuleBasedRecommendations();
                    this.setAIStatus('rule-based');
                }
            } else {
                this.recommendations = this.getRuleBasedRecommendations();
                this.setAIStatus('rule-based');
            }
            
            // 4. Render recommendations
            this.renderRecommendations();
            this.updateBadge();
            
            // Mark data as loaded
            this.dataLoaded = true;
            this.lastLoadTime = Date.now();
            
        } catch (error) {
            console.error('Error loading recommendations:', error);
            this.showError('Không thể tải dữ liệu. Vui lòng thử lại.');
        }
    }

    async fetchFarmData() {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const userEmail = localStorage.getItem('userEmail');
        
        if (!userEmail && !token) {
            throw new Error('User not logged in');
        }

        const API_BASE = CONFIG?.API_BASE_URL || 'http://localhost:8080/api';
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        // First, get user's farm to get farmId
        let farmId = null;
        let farmData = null;
        try {
            const farmRes = await fetch(`${API_BASE}/farms/my-farms`, { headers });
            if (farmRes.ok) {
                const farms = await farmRes.json();
                if (farms.length > 0) {
                    farmData = farms[0];
                    farmId = farms[0].id;
                }
            }
        } catch (e) {
            console.warn('Could not fetch farms:', e);
        }

        // Fetch data from multiple endpoints in parallel
        const [balanceRes, fieldsRes, pensRes, inventoryRes] = await Promise.all([
            fetch(`${API_BASE}/assets/balance?email=${encodeURIComponent(userEmail)}`, { headers }).catch(() => null),
            farmId ? fetch(`${API_BASE}/fields?farmId=${farmId}`, { headers }).catch(() => null) : Promise.resolve(null),
            fetch(`${API_BASE}/livestock/pens`, { headers }).catch(() => null),
            fetch(`${API_BASE}/shop/inventory?userEmail=${encodeURIComponent(userEmail)}`, { headers }).catch(() => null)
        ]);

        // Parse responses
        const balanceData = balanceRes?.ok ? await balanceRes.json() : { balance: 0 };
        const fields = fieldsRes?.ok ? await fieldsRes.json() : [];
        const pens = pensRes?.ok ? await pensRes.json() : [];
        const inventory = inventoryRes?.ok ? await inventoryRes.json() : { items: [] };

        // Count planted fields (fields with currentCropId) and empty fields
        const plantedFields = fields.filter(f => f.currentCropId || f.status === 'ACTIVE').length;
        const emptyFields = fields.filter(f => !f.currentCropId && f.status !== 'ACTIVE');
        
        // Calculate total area
        const totalArea = fields.reduce((sum, f) => sum + (f.areaSqm || 0), 0) / 10000; // Convert to hectares

        // Compile farm data from REAL API responses
        this.farmData = {
            // Financial data
            balance: balanceData.balance || 0,
            totalIncome: balanceData.totalIncome || 0,
            totalExpense: balanceData.totalExpense || 0,
            profit: (balanceData.totalIncome || 0) - (balanceData.totalExpense || 0),
            
            // Cultivation data - COUNT FROM REAL FIELDS API
            totalFields: fields.length,
            plantedFields: plantedFields,
            emptyFieldsCount: emptyFields.length,
            emptyFields: emptyFields.map(f => ({
                id: f.id,
                name: f.name,
                areaSqm: f.areaSqm,
                areaHa: (f.areaSqm / 10000).toFixed(2)
            })),
            totalAreaHectares: totalArea.toFixed(2),
            activeFields: fields.filter(f => f.currentCropId).map(f => ({
                id: f.id,
                name: f.name,
                cropName: f.currentCrop?.name || 'N/A',
                areaSqm: f.areaSqm,
                expectedRevenue: f.expectedRevenue || 0
            })),
            allFields: fields,
            
            // Livestock data
            pens: pens || [],
            totalPens: pens.length || 0,
            totalAnimals: pens.reduce((sum, pen) => sum + (pen.animalCount || 0), 0),
            
            // Inventory data
            inventory: inventory.items || [],
            inventoryValue: inventory.totalValue || 0
        };

        document.getElementById('advisor-status').textContent = 'Đã cập nhật ' + new Date().toLocaleTimeString('vi-VN');
    }

    updateStatsDisplay() {
        if (!this.farmData) return;

        document.getElementById('stat-balance').textContent = this.formatCompactCurrency(this.farmData.balance);
        // Show planted/total format
        document.getElementById('stat-fields').textContent = `${this.farmData.plantedFields}/${this.farmData.totalFields}`;
        document.getElementById('stat-livestock').textContent = this.farmData.totalPens.toString();
    }

    setAIStatus(source) {
        const dot = document.getElementById('ai-status-dot');
        const text = document.getElementById('ai-status-text');
        
        switch (source) {
            case 'gemini':
                dot.classList.remove('fallback', 'backup');
                dot.classList.add('primary');
                text.textContent = '🔵 AI Gemini';
                break;
            case 'openrouter':
                dot.classList.remove('fallback', 'primary');
                dot.classList.add('backup');
                text.textContent = '🟢 AI Gemma 3';
                break;
            case 'rule-based':
            default:
                dot.classList.remove('primary', 'backup');
                dot.classList.add('fallback');
                text.textContent = '🟡 Rule-based';
        }
        this.currentAISource = source;
    }

    // ==================== AI RECOMMENDATIONS ====================

    async getAIRecommendations() {
        const prompt = this.buildAIPrompt();
        const systemPrompt = this.buildSystemPrompt();
        
        // Try Gemini API first (primary)
        try {
            console.log('🔵 Trying Gemini API...');
            const result = await this.callGeminiAPI(prompt, systemPrompt);
            this.setAIStatus('gemini');
            return result;
        } catch (geminiError) {
            console.warn('Gemini API failed:', geminiError.message);
        }
        
        // Fallback to OpenRouter with Gemma 3 27B (backup)
        try {
            console.log('🟢 Trying OpenRouter Gemma 3 27B...');
            const result = await this.callOpenRouterAPI(prompt, systemPrompt);
            this.setAIStatus('openrouter');
            return result;
        } catch (openrouterError) {
            console.warn('OpenRouter API failed:', openrouterError.message);
        }
        
        // Both APIs failed, throw to trigger rule-based fallback
        throw new Error('All AI APIs failed');
    }
    
    // Call Google Gemini API directly
    async callGeminiAPI(prompt, systemPrompt) {
        const url = `${this.geminiApiUrl}?key=${this.geminiApiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemPrompt}\n\n${prompt}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1000
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        return this.parseAIResponse(content);
    }
    
    // Call OpenRouter API with Gemma 3 27B
    async callOpenRouterAPI(prompt, systemPrompt) {
        const response = await fetch(this.openrouterApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.openrouterApiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'AgriPlanner Smart Advisor'
            },
            body: JSON.stringify({
                model: this.openrouterModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error('OpenRouter API error: ' + response.status);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        
        return this.parseAIResponse(content);
    }
    
    // Parse AI response to extract recommendations
    parseAIResponse(content) {
        try {
            // Remove markdown code blocks if present
            const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            return parsed.recommendations || [];
        } catch (parseError) {
            console.error('Failed to parse AI response:', content);
            throw new Error('Invalid AI response format');
        }
    }
    
    buildSystemPrompt() {
        return `Bạn là cố vấn nông nghiệp AI của AgriPlanner. Phân tích dữ liệu trang trại và đưa ra đề xuất mua sắm thông minh.
                        
QUAN TRỌNG - Trả về JSON với format CHÍNH XÁC sau (không markdown, không giải thích):
{
  "recommendations": [
    {
      "type": "expand|livestock|finance|buy|warning",
      "title": "Tiêu đề ngắn gọn",
      "description": "Mô tả chi tiết 1-2 câu",
      "details": {
        "cost": số tiền (number),
        "revenue": doanh thu dự kiến (number),
        "duration": "thời gian (string)",
        "roi": "tỷ lệ lợi nhuận (string)"
      },
      "action": {
        "type": "buy_shop|navigate_cultivation|navigate_livestock|info",
        "category": "HAT_GIONG|CON_GIONG|PHAN_BON|THUC_AN|THUOC_TRU_SAU|MAY_MOC",
        "productKeyword": "từ khóa sản phẩm để tìm",
        "animalType": "loại vật nuôi phù hợp nếu là gợi ý chăn nuôi"
      }
    }
  ]
}

Loại đề xuất:
- expand: Mở rộng trồng trọt
- livestock: Mở rộng chăn nuôi (GỢI Ý LOẠI VẬT NUÔI PHÙ HỢP với môi trường chuồng: LAND=heo/gà/bò, WATER=cá/tôm/cua)
- finance: Dự đoán tài chính
- buy: Đề xuất mua hàng cụ thể
- warning: Cảnh báo thiếu hụt

Chỉ trả về 3-5 đề xuất quan trọng nhất, ưu tiên theo ROI và tính khả thi với số dư hiện tại.`;
    }

    buildAIPrompt() {
        const data = this.farmData;
        
        // Build pen details with environment info
        const penDetails = data.pens.slice(0, 5).map(p => ({
            name: p.name,
            animal: p.animalDefinition?.name || 'Chưa có',
            count: p.animalCount || 0,
            status: p.feedingStatus || 'N/A',
            environment: p.farmingType || p.environmentType || 'LAND', // LAND, WATER, etc.
            waterType: p.waterType || null // FRESH, SALT, BRACKISH for aquatic
        }));
        
        // Count empty pens by environment type
        const emptyPens = data.pens.filter(p => !p.animalCount || p.animalCount === 0);
        const emptyPensByEnv = emptyPens.reduce((acc, p) => {
            const env = p.farmingType || p.environmentType || 'LAND';
            acc[env] = acc[env] || [];
            acc[env].push({ name: p.name, waterType: p.waterType });
            return acc;
        }, {});
        
        return `Phân tích dữ liệu trang trại của tôi và đề xuất mua sắm:

=== TÀI CHÍNH ===
- Số dư hiện tại: ${this.formatCurrency(data.balance)}
- Tổng thu nhập: ${this.formatCurrency(data.totalIncome)}
- Tổng chi tiêu: ${this.formatCurrency(data.totalExpense)}
- Lợi nhuận: ${this.formatCurrency(data.profit)}

=== TRỒNG TRỌT ===
- Tổng số ruộng: ${data.totalFields}
- Đang canh tác: ${data.plantedFields}
- Ruộng trống: ${data.emptyFieldsCount}
- Tổng diện tích: ${data.totalAreaHectares} ha
- Ruộng trống chi tiết: ${JSON.stringify(data.emptyFields.slice(0, 3).map(f => f.name))}
- Dự báo thu hoạch: ${JSON.stringify(data.harvestForecast.slice(0, 3))}

=== CHĂN NUÔI ===
- Tổng số chuồng: ${data.totalPens}
- Tổng số vật nuôi: ${data.totalAnimals}
- Chi tiết chuồng: ${JSON.stringify(penDetails)}
- Chuồng trống theo môi trường: ${JSON.stringify(emptyPensByEnv)}

=== ĐỘNG VẬT CÓ SẴN TRONG HỆ THỐNG ===
- LAND (trên cạn): ${DB_ANIMALS.LAND.join(', ')}
- FRESHWATER (nước ngọt): ${DB_ANIMALS.FRESHWATER.join(', ')}
- BRACKISH (nước lợ): ${DB_ANIMALS.BRACKISH.join(', ')}
- SALTWATER (nước mặn): ${DB_ANIMALS.SALTWATER.join(', ')}
- SPECIAL (đặc biệt): ${DB_ANIMALS.SPECIAL.join(', ')}

=== KHO HÀNG ===
- Giá trị kho: ${this.formatCurrency(data.inventoryValue)}
- Số mặt hàng: ${data.inventory.length}

Hãy đưa ra đề xuất phù hợp với ngân sách và tình trạng trang trại.
QUAN TRỌNG: Khi gợi ý động vật, CHỈ sử dụng tên động vật trong danh sách trên (có sẵn trong CSDL).
Với chuồng trống, gợi ý loại vật nuôi phù hợp với môi trường chuồng.`;
    }

    // ==================== RULE-BASED RECOMMENDATIONS ====================

    getRuleBasedRecommendations() {
        const recommendations = [];
        const data = this.farmData;
        
        if (!data) return recommendations;

        // 1. Check empty fields that need crops
        if (data.emptyFieldsCount > 0 && data.balance > 500000) {
            const emptyFieldNames = data.emptyFields.slice(0, 3).map(f => f.name).join(', ');
            const totalEmptyArea = data.emptyFields.reduce((sum, f) => sum + parseFloat(f.areaHa), 0).toFixed(2);
            recommendations.push({
                type: 'expand',
                title: `${data.emptyFieldsCount} ruộng trống cần trồng cây`,
                description: `Ruộng: ${emptyFieldNames}${data.emptyFieldsCount > 3 ? '...' : ''} (${totalEmptyArea} ha) đang bỏ trống. Nên trồng lúa hoặc rau màu để tăng thu nhập.`,
                details: {
                    cost: 500000 * data.emptyFieldsCount,
                    revenue: 2500000 * data.emptyFieldsCount,
                    duration: '3-4 tháng',
                    roi: '+400%'
                },
                action: {
                    type: 'navigate_cultivation',
                    fieldId: data.emptyFields[0]?.id,
                    fieldName: data.emptyFields[0]?.name
                }
            });
        }

        // 2. Check livestock expansion - with environment-based animal suggestions from DATABASE
        // Animals from DB: 
        // LAND: Trâu, Bò thịt, Bò sữa, Lợn (Heo), Dê, Cừu, Gà, Chim cút, Vịt, Ngan, Ngỗng
        // FRESHWATER: Cá rô phi, Cá trắm cỏ, Cá chép, Cá mè, Cá trê, Cá lóc, Cá tra, Cá basa, Lươn, Ếch, Ốc bươu đen
        // BRACKISH: Tôm sú, Tôm thẻ chân trắng, Cua biển, Cá kèo, Cá đối
        // SALTWATER: Cá mú, Cá chim biển, Cá hồng, Tôm hùm, Hàu, Nghêu, Sò
        
        const emptyPens = data.pens.filter(p => !p.animalCount || p.animalCount === 0);
        if (emptyPens.length > 0 && data.balance > 1000000) {
            // Group empty pens by environment - check category field from DB
            const landPens = emptyPens.filter(p => {
                const cat = (p.category || p.farmingType || p.environmentType || 'LAND').toUpperCase();
                return cat === 'LAND' || cat === 'SPECIAL';
            });
            const freshwaterPens = emptyPens.filter(p => {
                const cat = (p.category || '').toUpperCase();
                const water = (p.waterType || '').toUpperCase();
                return cat === 'FRESHWATER' || water === 'FRESHWATER';
            });
            const brackishPens = emptyPens.filter(p => {
                const cat = (p.category || '').toUpperCase();
                const water = (p.waterType || '').toUpperCase();
                return cat === 'BRACKISH' || water === 'BRACKISH';
            });
            const saltwaterPens = emptyPens.filter(p => {
                const cat = (p.category || '').toUpperCase();
                const water = (p.waterType || '').toUpperCase();
                return cat === 'SALTWATER' || water === 'SALTWATER';
            });
            
            // LAND animals from DB
            if (landPens.length > 0) {
                const penName = landPens[0].name;
                recommendations.push({
                    type: 'livestock',
                    title: `Thả giống chuồng ${penName}`,
                    description: `Chuồng ${penName} (trên cạn) đang trống. Phù hợp nuôi: Lợn, Gà, Bò thịt, Dê, Vịt, Ngan. Chi phí từ 30K-20M/con.`,
                    details: {
                        cost: 1500000,
                        revenue: 5000000,
                        duration: '3-6 tháng',
                        roi: '+233%'
                    },
                    action: {
                        type: 'buy_shop',
                        category: 'CON_GIONG',
                        productKeyword: 'lợn gà bò dê vịt',
                        animalSuggestions: ['Lợn (Heo)', 'Gà', 'Bò thịt', 'Dê', 'Vịt', 'Ngan', 'Cừu']
                    }
                });
            }
            
            // FRESHWATER animals from DB
            if (freshwaterPens.length > 0) {
                const pen = freshwaterPens[0];
                recommendations.push({
                    type: 'livestock',
                    title: `Thả giống ao ${pen.name}`,
                    description: `Ao ${pen.name} (nước ngọt) đang trống. Phù hợp: Cá rô phi, Cá tra, Cá lóc, Cá trê, Lươn, Ếch.`,
                    details: {
                        cost: 500000,
                        revenue: 3000000,
                        duration: '3-6 tháng',
                        roi: '+500%'
                    },
                    action: {
                        type: 'buy_shop',
                        category: 'CON_GIONG',
                        productKeyword: 'cá rô phi tra lóc trê',
                        animalSuggestions: ['Cá rô phi', 'Cá tra', 'Cá lóc', 'Cá trê', 'Cá chép', 'Lươn', 'Ếch']
                    }
                });
            }
            
            // BRACKISH animals from DB
            if (brackishPens.length > 0) {
                const pen = brackishPens[0];
                recommendations.push({
                    type: 'livestock',
                    title: `Thả giống ao ${pen.name}`,
                    description: `Ao ${pen.name} (nước lợ) đang trống. Phù hợp: Tôm sú, Tôm thẻ chân trắng, Cua biển, Cá kèo, Cá đối.`,
                    details: {
                        cost: 2000000,
                        revenue: 10000000,
                        duration: '3-4 tháng',
                        roi: '+400%'
                    },
                    action: {
                        type: 'buy_shop',
                        category: 'CON_GIONG',
                        productKeyword: 'tôm sú thẻ cua',
                        animalSuggestions: ['Tôm sú', 'Tôm thẻ chân trắng', 'Cua biển', 'Cá kèo', 'Cá đối']
                    }
                });
            }
            
            // SALTWATER animals from DB
            if (saltwaterPens.length > 0) {
                const pen = saltwaterPens[0];
                recommendations.push({
                    type: 'livestock',
                    title: `Thả giống ao ${pen.name}`,
                    description: `Ao ${pen.name} (nước mặn) đang trống. Phù hợp: Cá mú, Cá chim biển, Cá hồng, Tôm hùm, Hàu, Nghêu.`,
                    details: {
                        cost: 5000000,
                        revenue: 20000000,
                        duration: '6-12 tháng',
                        roi: '+300%'
                    },
                    action: {
                        type: 'buy_shop',
                        category: 'CON_GIONG',
                        productKeyword: 'cá mú chim hồng tôm hùm',
                        animalSuggestions: ['Cá mú', 'Cá chim biển', 'Cá hồng', 'Tôm hùm', 'Hàu', 'Nghêu', 'Sò']
                    }
                });
            }
        } else if (data.balance > 5000000 && data.totalPens < 5) {
            // Suggest creating new pen if no empty pens
            recommendations.push({
                type: 'livestock',
                title: 'Tạo chuồng nuôi mới',
                description: `Với số vốn ${this.formatCompactCurrency(data.balance)}, bạn có thể tạo thêm chuồng/ao để mở rộng chăn nuôi.`,
                details: {
                    cost: 3000000,
                    revenue: 8000000,
                    duration: '4-6 tháng',
                    roi: '+166%'
                },
                action: {
                    type: 'navigate_livestock'
                }
            });
        }

        // 3. Financial forecast
        if (data.activeFields.length > 0) {
            const totalExpectedRevenue = data.activeFields.reduce((sum, f) => sum + (f.expectedRevenue || 0), 0);
            if (totalExpectedRevenue > 0) {
                recommendations.push({
                    type: 'finance',
                    title: 'Dự báo thu hoạch sắp tới',
                    description: `Dự kiến thu về ${this.formatCompactCurrency(totalExpectedRevenue)} từ ${data.activeFields.length} ruộng đang canh tác.`,
                    details: {
                        cost: 0,
                        revenue: totalExpectedRevenue,
                        duration: 'Trong vòng 3 tháng',
                        roi: 'Dự báo'
                    },
                    action: {
                        type: 'info'
                    }
                });
            }
        }

        // 4. Check for feed needs
        const pensNeedingFeed = data.pens.filter(p => p.feedingStatus !== 'FED' && p.animalCount > 0);
        if (pensNeedingFeed.length > 0) {
            const penNames = pensNeedingFeed.slice(0, 2).map(p => p.name).join(', ');
            recommendations.push({
                type: 'warning',
                title: `${pensNeedingFeed.length} chuồng cần cho ăn`,
                description: `Chuồng ${penNames} cần được cho ăn. Hãy kiểm tra kho hoặc mua thức ăn chăn nuôi!`,
                details: {
                    cost: 200000 * pensNeedingFeed.length,
                    revenue: 0,
                    duration: 'Ngay lập tức',
                    roi: 'Bảo vệ vốn'
                },
                action: {
                    type: 'buy_shop',
                    category: 'THUC_AN',
                    productKeyword: 'thức ăn',
                    quantity: pensNeedingFeed.length * 10
                }
            });
        }

        // 5. Suggest fertilizer if growing crops
        if (data.plantedFields > 0) {
            recommendations.push({
                type: 'buy',
                title: 'Bổ sung phân bón',
                description: `Phân bón giúp tăng năng suất 20-30%. Đang có ${data.plantedFields} ruộng cần chăm sóc.`,
                details: {
                    cost: 150000 * data.plantedFields,
                    revenue: data.plantedFields * 500000,
                    duration: 'Tăng năng suất',
                    roi: '+233%'
                },
                action: {
                    type: 'buy_shop',
                    category: 'PHAN_BON',
                    productKeyword: 'phân bón',
                    quantity: data.plantedFields * 5
                }
            });
        }

        return recommendations.slice(0, 5); // Return max 5 recommendations
    }

    // ==================== RENDERING ====================

    renderRecommendations() {
        const container = document.getElementById('advisor-recommendations');
        
        if (this.recommendations.length === 0) {
            container.innerHTML = `
                <div class="advisor-empty">
                    <span class="material-symbols-outlined">check_circle</span>
                    <div class="advisor-empty__title">Trang trại hoạt động tốt!</div>
                    <p>Không có đề xuất mới. Tiếp tục theo dõi.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.recommendations.map((rec, index) => this.createRecommendationCard(rec, index)).join('');
        
        // Bind action buttons
        container.querySelectorAll('.recommendation-btn--primary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.handleRecommendationAction(this.recommendations[index]);
            });
        });
    }

    createRecommendationCard(rec, index) {
        const iconMap = {
            'expand': 'agriculture',
            'livestock': 'pets',
            'finance': 'payments',
            'buy': 'shopping_cart',
            'warning': 'warning'
        };

        const typeLabels = {
            'expand': 'Mở rộng',
            'livestock': 'Chăn nuôi',
            'finance': 'Tài chính',
            'buy': 'Đề xuất mua',
            'warning': 'Cảnh báo'
        };

        const details = rec.details || {};
        const hasAction = rec.action && rec.action.type !== 'info';

        return `
            <div class="recommendation-card recommendation-card--${rec.type}">
                <div class="recommendation-card__header">
                    <div class="recommendation-card__icon ${rec.type}">
                        <span class="material-symbols-outlined">${iconMap[rec.type] || 'lightbulb'}</span>
                    </div>
                    <div class="recommendation-card__content">
                        <div class="recommendation-card__type">${typeLabels[rec.type] || 'Đề xuất'}</div>
                        <div class="recommendation-card__title">${rec.title}</div>
                    </div>
                </div>
                <div class="recommendation-card__desc">${rec.description}</div>
                
                ${details.cost !== undefined || details.revenue !== undefined ? `
                <div class="recommendation-details">
                    ${details.cost > 0 ? `<span class="rec-detail negative">Chi phí: -${this.formatCompactCurrency(details.cost)}</span>` : ''}
                    ${details.revenue > 0 ? `<span class="rec-detail positive">Doanh thu: +${this.formatCompactCurrency(details.revenue)}</span>` : ''}
                    ${details.duration ? `<span class="rec-detail">Thời gian: ${details.duration}</span>` : ''}
                    ${details.roi ? `<span class="rec-detail roi">ROI: ${details.roi}</span>` : ''}
                </div>` : ''}
                
                ${hasAction ? `
                <div class="recommendation-actions">
                    <button class="recommendation-btn recommendation-btn--primary" data-index="${index}">
                        <span class="material-symbols-outlined icon-sm">add_shopping_cart</span>
                        Mua ngay
                    </button>
                    <button class="recommendation-btn recommendation-btn--secondary" onclick="smartAdvisor.dismissRecommendation(${index})">
                        <span class="material-symbols-outlined icon-sm">close</span>
                    </button>
                </div>` : ''}
            </div>
        `;
    }

    // ==================== ACTIONS ====================

    handleRecommendationAction(rec) {
        if (!rec.action) return;

        switch (rec.action.type) {
            case 'buy':
            case 'buy_shop':
                // Save purchase intent to localStorage for shop page
                const purchaseIntent = {
                    category: rec.action.category || '',
                    keyword: rec.action.productKeyword || '',
                    quantity: rec.action.quantity || 1,
                    fromAdvisor: true,
                    timestamp: Date.now()
                };
                localStorage.setItem('agriplanner_purchase_intent', JSON.stringify(purchaseIntent));
                
                // Check if already on shop page
                if (window.location.pathname.includes('shop.html')) {
                    // Filter products directly
                    this.filterShopProducts(rec.action.category, rec.action.productKeyword);
                    this.close();
                    this.showToast('Đã lọc sản phẩm', `Đang hiển thị ${rec.action.productKeyword || rec.action.category}`, 'info');
                } else {
                    // Navigate to shop page
                    window.location.href = `shop.html?category=${rec.action.category || ''}&search=${encodeURIComponent(rec.action.productKeyword || '')}`;
                }
                break;
                
            case 'navigate_cultivation':
                // Navigate to cultivation page
                if (window.location.pathname.includes('cultivation.html')) {
                    // Already on cultivation page, just close and highlight field if available
                    this.close();
                    if (rec.action.fieldId && typeof highlightField === 'function') {
                        highlightField(rec.action.fieldId);
                    }
                    this.showToast('Canh tác', `Hãy chọn ruộng "${rec.action.fieldName || ''}" để bắt đầu trồng cây!`, 'info');
                } else {
                    const fieldParam = rec.action.fieldId ? `?field=${rec.action.fieldId}` : '';
                    window.location.href = `cultivation.html${fieldParam}`;
                }
                break;
                
            case 'navigate_livestock':
                // Navigate to livestock page
                if (window.location.pathname.includes('livestock.html')) {
                    this.close();
                    this.showToast('Chăn nuôi', 'Hãy tạo chuồng mới để mở rộng chăn nuôi!', 'info');
                } else {
                    window.location.href = 'livestock.html?action=new_pen';
                }
                break;
                
            case 'navigate':
                // Navigate to another page
                if (rec.action.url) {
                    window.location.href = rec.action.url;
                }
                break;
                
            case 'info':
                // Just informational, show details
                this.showToast('Thông tin', rec.description || 'Đây là thông tin tham khảo.', 'info');
                break;
                
            default:
                console.log('Unknown action type:', rec.action.type);
        }
    }
    
    filterShopProducts(category, keyword) {
        // Filter products by category
        if (category) {
            const tab = document.querySelector(`.category-tab[data-category="${category}"]`);
            if (tab) tab.click();
        }
        
        // Search for product
        if (keyword) {
            setTimeout(() => {
                const searchInput = document.getElementById('shop-search');
                if (searchInput) {
                    searchInput.value = keyword;
                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, 100);
        }
    }

    dismissRecommendation(index) {
        this.recommendations.splice(index, 1);
        this.renderRecommendations();
        this.updateBadge();
    }

    // ==================== UI HELPERS ====================

    showLoading() {
        this.isLoading = true;
        document.getElementById('advisor-recommendations').innerHTML = `
            <div class="advisor-loading">
                <div class="advisor-loading__spinner"></div>
                <div class="advisor-loading__text">Đang phân tích dữ liệu trang trại...</div>
            </div>
        `;
    }

    showError(message) {
        document.getElementById('advisor-recommendations').innerHTML = `
            <div class="advisor-empty">
                <span class="material-symbols-outlined">error</span>
                <div class="advisor-empty__title">Có lỗi xảy ra</div>
                <p>${message}</p>
            </div>
        `;
    }

    updateBadge() {
        const badge = document.getElementById('advisor-badge');
        const toggle = document.getElementById('advisor-toggle');
        const count = this.recommendations.length;
        
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
            toggle.classList.add('has-recommendations');
        } else {
            badge.style.display = 'none';
            toggle.classList.remove('has-recommendations');
        }
    }

    showToast(title, message, type = 'info') {
        // Use existing showToast from shop.js if available
        if (typeof showToast === 'function') {
            showToast(title, message, type);
        }
    }

    // ==================== UTILITIES ====================

    formatCurrency(amount) {
        if (amount === null || amount === undefined) return '0 VNĐ';
        return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
    }

    formatCompactCurrency(amount) {
        if (amount === null || amount === undefined) return '0';
        if (amount >= 1000000000) {
            return (amount / 1000000000).toFixed(1) + 'B';
        }
        if (amount >= 1000000) {
            return (amount / 1000000).toFixed(1) + 'M';
        }
        if (amount >= 1000) {
            return (amount / 1000).toFixed(0) + 'K';
        }
        return amount.toString();
    }

    // Cleanup
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        if (this.container) {
            this.container.remove();
        }
    }
}

// Initialize Smart Advisor when DOM is ready
let smartAdvisor;
document.addEventListener('DOMContentLoaded', () => {
    smartAdvisor = new SmartAdvisor();
});

// Make globally accessible
window.smartAdvisor = smartAdvisor;
