
/**
 * Shared AI Analysis Logic for AgriPlanner
 * Handles image upload simulation, analysis based on filename, and task creation.
 */

const AI_ANALYSIS_ENHANCED = true;

// API_BASE_URL is already defined in config.js

const AI_CONFIG = {
    cultivation: {
        modalId: 'pest-analysis-modal',
        apiEndpoint: '/fields/{id}/analyze', // Mock
        taskType: 'PEST_CONTROL',
        defaultTaskName: 'Phun thuốc trừ sâu',
        defaultTaskDesc: 'Hệ thống AI phát hiện sâu bệnh: ',
    },
    livestock: {
        // Livestock uses a separate modal for pen/animal analysis
        modalId: 'livestock-analysis-modal',
        taskType: 'CLEAN', // or VACCINE
        defaultTaskName: 'Vệ sinh chuồng trại',
        defaultTaskDesc: 'Hệ thống AI phát hiện chuồng bẩn: ',
    }
};

let currentAnalysisContext = {
    type: null, // 'CULTIVATION' or 'LIVESTOCK'
    id: null,   // Field ID or Pen ID
    targetName: '',
    analysisResult: null
};

// ==================== UI FUNCTIONS ====================

function openAnalysisModalGeneric(type, id, name) {
    currentAnalysisContext = { type, id, targetName: name, analysisResult: null };

    // Create or Open Modal
    // I will use a shared HTML structure injected dynamically if not present, 
    // or assume specific IDs exist. 
    // Cultivation has #pest-analysis-modal. 
    // I will try to use a unified modal ID 'ai-analysis-modal' if possible, 
    // but to fit existing cultivation, I might need to adapt.

    // Let's create a generic modal in DOM if it doesn't exist
    let modal = document.getElementById('ai-analysis-modal');
    if (!modal) {
        createGenericAnalysisModal();
        modal = document.getElementById('ai-analysis-modal');
    }

    // Reset State
    document.getElementById('ai-upload-area').style.display = 'flex';
    document.getElementById('ai-preview-area').style.display = 'none';
    document.getElementById('ai-result-area').style.display = 'none';
    document.getElementById('ai-file-input').value = '';

    // Update Title
    const title = type === 'CULTIVATION' ? `Phân tích Sâu bệnh - ${name}` : `Phân tích Chuồng trại - ${name}`;
    document.getElementById('ai-modal-title').textContent = title;

    modal.classList.add('open', 'active'); // Support both styles
    modal.style.display = 'flex';
}

function createGenericAnalysisModal() {
    const html = `
    <div id="ai-analysis-modal" class="modal" style="z-index: 10005; display: none;">
        <div class="modal__content" style="max-width: 800px; width: 90%;">
            <div class="modal__header">
                <h3 class="modal__title" id="ai-modal-title">AI Analysis</h3>
                <button class="modal__close" onclick="closeAiModal()"><span class="material-symbols-outlined">close</span></button>
            </div>
            <div class="modal__body" style="padding: 20px;">
                <!-- Upload Area -->
                <div id="ai-upload-area" style="border: 2px dashed #cbd5e1; border-radius: 12px; height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" 
                     onclick="document.getElementById('ai-file-input').click()"
                     ondragover="event.preventDefault(); this.style.borderColor='#10b981'; this.style.background='#f0fdf4';"
                     ondragleave="event.preventDefault(); this.style.borderColor='#cbd5e1'; this.style.background='transparent';"
                     ondrop="handleDrop(event)">
                    <span class="material-symbols-outlined" style="font-size: 64px; color: #94a3b8; margin-bottom: 16px;">add_a_photo</span>
                    <p style="color: #64748b; font-weight: 500;">Click để chọn ảnh hoặc kéo thả vào đây</p>
                    <p style="color: #94a3b8; font-size: 13px;">Hỗ trợ: JPG, PNG (Max 5MB)</p>
                    <input type="file" id="ai-file-input" accept="image/*" style="display: none;" onchange="handleFileSelect(event)">
                </div>

                <!-- Preview Area -->
                <div id="ai-preview-area" style="display: none; flex-direction: column; gap: 20px;">
                    <div style="display: flex; gap: 20px; align-items: flex-start;">
                        <img id="ai-preview-img" src="" style="width: 50%; border-radius: 8px; border: 1px solid #e2e8f0; max-height: 400px; object-fit: contain;">
                        <div style="flex: 1;">
                            <h4 style="margin-top: 0;">Ảnh đã chọn</h4>
                            <p id="ai-file-name" style="color: #64748b; font-size: 13px; margin-bottom: 20px;"></p>
                            <button class="btn btn--primary" id="btn-start-analyze" onclick="startAnalysis()" style="width: 100%;">
                                <span class="material-symbols-outlined">auto_awesome</span> Bắt đầu phân tích
                            </button>
                            <button class="btn btn--secondary" onclick="resetAiUpload()" style="width: 100%; margin-top: 10px;">
                                Chọn ảnh khác
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Result Area -->
                <div id="ai-result-area" style="display: none; flex-direction: column; gap: 20px;">
                    <div style="display: flex; gap: 20px;">
                        <div style="width: 40%;">
                             <img id="ai-result-img" src="" style="width: 100%; border-radius: 8px; border: 1px solid #e2e8f0;">
                        </div>
                        <div style="flex: 1;">
                            <div id="ai-loading" style="display: none; text-align: center; padding: 40px;">
                                <div class="loading-spinner" style="margin: 0 auto;"></div>
                                <p style="margin-top: 16px; color: #64748b;">Hệ thống AI đang phân tích...</p>
                            </div>
                            
                            <div id="ai-success-content" style="display: none;">
                                <div id="ai-result-header" style="padding: 12px; border-radius: 8px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
                                    <span class="material-symbols-outlined" style="font-size: 32px;">check_circle</span>
                                    <div>
                                        <h3 id="ai-disease-name" style="margin: 0; font-size: 18px;">Tên bệnh / Vấn đề</h3>
                                        <span id="ai-confidence" style="font-size: 12px; opacity: 0.8;">Độ tin cậy: 98%</span>
                                    </div>
                                </div>

                                <div class="detail-section">
                                    <label>Mô tả triệu chứng / Tình trạng:</label>
                                    <p id="ai-description" style="background:#f8fafc; padding:10px; border-radius:6px; margin-top: 4px;">...</p>
                                </div>

                                <div class="detail-section" style="margin-top: 16px;">
                                    <label>Đề xuất xử lý:</label>
                                    <p id="ai-solution" style="background:#ecfdf5; color:#065f46; padding:10px; border-radius:6px; margin-top: 4px;">...</p>
                                </div>

                                <button id="btn-add-task" class="btn btn--primary" style="width: 100%; margin-top: 24px;" onclick="addAiTask()">
                                    <span class="material-symbols-outlined">assignment_add</span>
                                    Thêm vào công việc hôm nay
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

function closeAiModal() {
    const modal = document.getElementById('ai-analysis-modal');
    if (modal) {
        modal.classList.remove('open', 'active');
        modal.style.display = 'none';
    }
}

// ============ FILE HANDLING ============

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) processFile(file);
}

function handleDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) processFile(file);
}

function processFile(file) {
    // Show Preview
    document.getElementById('ai-upload-area').style.display = 'none';
    document.getElementById('ai-preview-area').style.display = 'flex';

    const reader = new FileReader();
    reader.onload = function (e) {
        document.getElementById('ai-preview-img').src = e.target.result;
        document.getElementById('ai-result-img').src = e.target.result;
    };
    reader.readAsDataURL(file);

    document.getElementById('ai-file-name').textContent = file.name;
    document.getElementById('ai-file-name').dataset.rawName = file.name; // Store for logic
}

function resetAiUpload() {
    document.getElementById('ai-upload-area').style.display = 'flex';
    document.getElementById('ai-preview-area').style.display = 'none';
    document.getElementById('ai-result-area').style.display = 'none';
    document.getElementById('ai-file-input').value = '';
}

// ============ ANALYSIS LOGIC ============

function startAnalysis() {
    document.getElementById('ai-preview-area').style.display = 'none';
    document.getElementById('ai-result-area').style.display = 'flex';
    document.getElementById('ai-loading').style.display = 'block';
    document.getElementById('ai-success-content').style.display = 'none';

    const filename = document.getElementById('ai-file-name').dataset.rawName || '';

    // Simulate AI Delay
    setTimeout(() => {
        document.getElementById('ai-loading').style.display = 'none';
        document.getElementById('ai-success-content').style.display = 'block';
        analyzeFilename(filename);
    }, 1500);
}

function analyzeFilename(filename) {
    const name = filename.toLowerCase();

    // Result Object
    let result = {
        name: 'Không xác định',
        description: 'Hệ thống không phát hiện vấn đề rõ ràng.',
        solution: 'Tiếp tục theo dõi.',
        isIssue: false,
        taskName: '',
        type: 'OTHER'
    };

    // --- VALIDATION: Prevent Cross-Domain Analysis ---
    if (currentAnalysisContext.type === 'LIVESTOCK') {
        // Reject Cultivation images (Expanded Registry)
        const cultivationKeywords = ['cay_', 'sau', 'pest', 'benh', 'ray', 'bo_tri', 'dao_on', 'nhen', 'rep', 'kham', 'virus', 'oc_'];
        if (cultivationKeywords.some(kw => name.includes(kw))) {
            result = {
                name: '⛔ Ảnh không hợp lệ',
                description: 'Hệ thống phát hiện ảnh cây trồng/sâu bệnh nhưng bạn đang phân tích chuồng trại.',
                solution: 'Vui lòng tải lên ảnh chuồng trại hoặc vật nuôi.',
                isIssue: false,
                taskName: '',
                type: 'OTHER'
            };
            styleResultHeader(true, true);
            document.getElementById('ai-result-header').style.backgroundColor = '#fef2f2';
            document.getElementById('ai-result-header').style.color = '#b91c1c';
            document.getElementById('ai-result-header').querySelector('span').textContent = 'error';

            currentAnalysisContext.analysisResult = result;
            renderResult(result);
            return;
        }
    } else if (currentAnalysisContext.type === 'CULTIVATION') {
        // Reject Livestock images
        if (name.includes('chuong_')) {
            result = {
                name: '⛔ Ảnh không hợp lệ',
                description: 'Hệ thống phát hiện ảnh chuồng trại nhưng bạn đang phân tích cây trồng.',
                solution: 'Vui lòng tải lên ảnh cây trồng hoặc sâu bệnh.',
                isIssue: false,
                taskName: '',
                type: 'OTHER'
            };
            styleResultHeader(true);
            document.getElementById('ai-result-header').querySelector('span').textContent = 'error';

            currentAnalysisContext.analysisResult = result;
            renderResult(result);
            return;
        }
    }
    // ------------------------------------------------

    // LOGIC for LIVESTOCK
    if (currentAnalysisContext.type === 'LIVESTOCK') {
        if (name.includes('chuong_do')) {
            result = {
                name: '⚠️ Chuồng bẩn / Ô nhiễm',
                description: 'Phát hiện chất thải chưa được xử lý, nguy cơ gây bệnh tiêu hóa cho vật nuôi.',
                solution: 'Cần vệ sinh chuồng ngay lập tức. Sử dụng vòi xịt áp lực cao và chế phẩm sinh học.',
                isIssue: true,
                taskName: 'Vệ sinh chuồng ' + currentAnalysisContext.targetName,
                type: 'CLEAN'
            };
            styleResultHeader(true);
        } else if (name.includes('chuong_sach')) {
            result = {
                name: '✅ Chuồng sạch sẽ',
                description: 'Môi trường đạt chuẩn. Vật nuôi khỏe mạnh.',
                solution: 'Duy trì lịch vệ sinh định kỳ.',
                isIssue: false,
                taskName: '',
                type: 'OTHER'
            };
            styleResultHeader(false);
            // Update Status to CLEAN
            updateObjectStatus('LIVESTOCK', currentAnalysisContext.id, 'CLEAN');
        } else {
            // Random or default logic if neither
            result = {
                name: 'Phân tích tổng quát',
                description: 'Chỉ số môi trường ở mức trung bình.',
                solution: 'Tiếp tục theo dõi.',
                isIssue: false
            };
            styleResultHeader(false, true); // Neutral
        }
    }
    // LOGIC for CULTIVATION (EXTENDED DICTIONARY)
    else {
        if (name.includes('cay_khoe')) {
            result = {
                name: '✅ Cây trồng khỏe mạnh',
                description: 'Cây trồng phát triển tốt, màu sắc lá xanh tự nhiên, không có dấu hiệu sâu bệnh.',
                solution: 'Tiếp tục chăm sóc và bón phân theo đúng quy trình kỹ thuật.',
                isIssue: false,
                taskName: '',
                type: 'OTHER'
            };
            styleResultHeader(false);
            updateObjectStatus('CULTIVATION', currentAnalysisContext.id, 'GOOD');
        }
        // 1. Rầy nâu
        else if (name.includes('ray_nau')) {
            result = {
                name: '🦟 Rầy nâu (Brown Plant Hopper)',
                description: 'Mật độ rầy cao, chích hút nhựa ở gốc lúa gây "cháy rầy".',
                solution: 'Phun thuốc đặc trị rầy (như Actara, Chess, Bassa). Hạ mực nước ruộng nếu có thể.',
                isIssue: true,
                taskName: 'Phun thuốc Rầy (' + currentAnalysisContext.targetName + ')',
                type: 'PEST_CONTROL'
            };
            styleResultHeader(true);
        }
        // 2. Sâu đục thân
        else if (name.includes('sau_duc_than')) {
            result = {
                name: '🐛 Sâu đục thân (Stem Borer)',
                description: 'Ấu trùng đục vào thân làm héo ngọn (giai đoạn đẻ nhánh) hoặc bông bạc (giai đoạn trổ).',
                solution: 'Phun thuốc lưu dẫn (Virtako, Prevathon). Cắt bỏ cọng héo.',
                isIssue: true,
                taskName: 'Phun sâu đục thân (' + currentAnalysisContext.targetName + ')',
                type: 'PEST_CONTROL'
            };
            styleResultHeader(true);
        }
        // 3. Bọ trĩ
        else if (name.includes('bo_tri')) {
            result = {
                name: '🪰 Bọ trĩ (Bù lạch)',
                description: 'Lá non bị xoăn, biến dạng, xuất hiện các vệt trắng nhỏ.',
                solution: 'Bón đủ nước. Phun thuốc Radiant, Confidor nếu mật độ cao.',
                isIssue: true,
                taskName: 'Phun bọ trĩ (' + currentAnalysisContext.targetName + ')',
                type: 'PEST_CONTROL'
            };
            styleResultHeader(true);
        }
        // 4. Bệnh đạo ôn
        else if (name.includes('dao_on') || name.includes('benh_dao_on')) {
            result = {
                name: '🍂 Bệnh đạo ôn (Blast Disease)',
                description: 'Vết bệnh hình thoi trên lá hoặc thối cổ bông.',
                solution: 'Ngưng bón đạm. Phun thuốc đặc trị đạo ôn (Beam, Filia, Fujiwan).',
                isIssue: true,
                taskName: 'Phun đạo ôn (' + currentAnalysisContext.targetName + ')',
                type: 'PEST_CONTROL'
            };
            styleResultHeader(true);
        }
        // 5. Nhện đỏ
        else if (name.includes('nhen_do')) {
            result = {
                name: '🕷️ Nhện đỏ (Red Mite)',
                description: 'Lá chuyển màu vàng loang lổ, mặt dưới lá có tơ nhỏ.',
                solution: 'Tưới phun mưa rửa trôi. Sử dụng thuốc đặc trị nhện (Ortus, Nissorun).',
                isIssue: true,
                taskName: 'Phun nhện đỏ (' + currentAnalysisContext.targetName + ')',
                type: 'PEST_CONTROL'
            };
            styleResultHeader(true);
        }
        // 6. Sâu cuốn lá
        else if (name.includes('sau_cuon_la')) {
            result = {
                name: '🐛 Sâu cuốn lá nhỏ',
                description: 'Sâu non nhả tơ cuốn lá lúa thành ống và ăn biểu bì bên trong.',
                solution: 'Phun thuốc khi sâu còn non (tuổi 1-2). Hạn chế phun sớm để bảo vệ thiên địch.',
                isIssue: true,
                taskName: 'Phun sâu cuốn lá (' + currentAnalysisContext.targetName + ')',
                type: 'PEST_CONTROL'
            };
            styleResultHeader(true);
        }
        // 7. Rệp xanh
        else if (name.includes('rep_xanh')) {
            result = {
                name: '🦟 Rệp xanh (Green Aphid)',
                description: 'Rệp bám hút nhựa ở mặt dưới lá và ngọn non, cây còi cọc.',
                solution: 'Phun thuốc trừ rệp. Bảo vệ bọ rùa và các loài thiên địch.',
                isIssue: true,
                taskName: 'Phun rệp (' + currentAnalysisContext.targetName + ')',
                type: 'PEST_CONTROL'
            };
            styleResultHeader(true);
        }
        // 8. Bệnh khảm lá (Virus)
        else if (name.includes('kham_la') || name.includes('virus')) {
            result = {
                name: '🦠 Bệnh khảm lá (Mosaic Virus)',
                description: 'Lá lốm đốm vàng xanh, cây phát triển kém, xoăn lá.',
                solution: 'Bệnh do virus không có thuốc đặc trị. Nhổ bỏ cây bệnh, diệt côn trùng môi giới (rệp, bọ phấn).',
                isIssue: true,
                taskName: 'Xử lý bệnh khảm (' + currentAnalysisContext.targetName + ')',
                type: 'PEST_CONTROL' // Or REMOVING
            };
            styleResultHeader(true);
        }
        // 9. Ốc bươu vàng
        else if (name.includes('oc_buou_vang') || name.includes('oc_')) {
            result = {
                name: '🐌 Ốc bươu vàng',
                description: 'Ốc cắn phá mạ non và lá lúa, gây mất khoảng.',
                solution: 'Rải thuốc diệt ốc, bắt thủ công, hoặc thả vịt ăn ốc.',
                isIssue: true,
                taskName: 'Diệt ốc (' + currentAnalysisContext.targetName + ')',
                type: 'PEST_CONTROL'
            };
            styleResultHeader(true);
        }
        // 10. Sâu khoang
        else if (name.includes('sau_khoang')) {
            result = {
                name: '🐛 Sâu khoang (Armyworm)',
                description: 'Sâu ăn tạp, cắn phá mạnh lá và thân cây.',
                solution: 'Phun thuốc trừ sâu phổ rộng vào lúc chiều mát.',
                isIssue: true,
                taskName: 'Phun sâu khoang (' + currentAnalysisContext.targetName + ')',
                type: 'PEST_CONTROL'
            };
            styleResultHeader(true);
        }
        // Fallback for Generic Pests
        else if (name.includes('sau') || name.includes('pest') || name.includes('benh')) {
            result = {
                name: '⚠️ Dịch hại chưa xác định rõ',
                description: 'Hệ thống phát hiện dấu hiệu sâu bệnh bất thường.',
                solution: 'Kiểm tra thực tế đồng ruộng và gửi mẫu phân tích bổ sung.',
                isIssue: true,
                taskName: 'Kiểm tra sâu bệnh (' + currentAnalysisContext.targetName + ')',
                type: 'PEST_CONTROL'
            };
            styleResultHeader(true);
        }
        else {
            result = {
                name: '✅ Cây trồng khỏe mạnh',
                description: 'Không phát hiện sâu bệnh. Màu sắc lá tốt.',
                solution: 'Tiếp tục bón phân theo lịch.',
                isIssue: false,
                taskName: '',
                type: 'OTHER'
            };
            styleResultHeader(false);
        }
    }

    currentAnalysisContext.analysisResult = result;
    renderResult(result);
}

function renderResult(result) {
    // Render text
    document.getElementById('ai-disease-name').textContent = result.name;
    document.getElementById('ai-description').textContent = result.description;
    document.getElementById('ai-solution').textContent = result.solution;

    // Show/Hide Add Task Button
    const btnTask = document.getElementById('btn-add-task');
    if (result.isIssue) {
        btnTask.style.display = 'flex';
    } else {
        btnTask.style.display = 'none';
    }
}

async function updateObjectStatus(type, id, status) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        let url = '';
        if (type === 'CULTIVATION') {
            url = `${API_BASE_URL}/fields/${id}/condition`;
        } else {
            url = `${API_BASE_URL}/livestock/pens/${id}/status`; // Assuming this endpoint
        }

        // Fallback: If status specific endpoints don't exist, try generic PATCH
        // But for safe implementation, we'll try the specific status endpoint first
        // If it fails (404), we might silently fail or log.
        // Given we don't have backend code, we iterate on best guess.

        console.log(`Updating ${type} ${id} status to ${status}`);

        const payload = type === 'CULTIVATION'
            ? { condition: status }
            : { status: status };

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log('Status updated successfully');
            // Refresh UI if needed (Reload page or trigger reload function)
            // We can't easily access reload functions here without referencing global scope carefully.
            // If cultivation.js functions are global (window.loadFields), we can call them.
            if (type === 'CULTIVATION' && window.loadFields) {
                window.loadFields();
            } else if (type === 'LIVESTOCK' && window.loadPens) {
                window.loadPens();
            }
        } else {
            // Try PATCH /fields/{id} directly if status route fails?
            // console.warn('Status update failed, trying fallback...');
        }
    } catch (e) {
        console.error('Error updating status:', e);
    }
}

function styleResultHeader(isIssue, isNeutral = false) {
    const header = document.getElementById('ai-result-header');
    if (isIssue) {
        header.style.backgroundColor = '#fef2f2'; // Red bg
        header.style.color = '#b91c1c';
        header.querySelector('span').textContent = 'warning';
    } else if (isNeutral) {
        header.style.backgroundColor = '#f8fafc';
        header.style.color = '#334155';
        header.querySelector('span').textContent = 'info';
    } else {
        header.style.backgroundColor = '#ecfdf5'; // Green bg
        header.style.color = '#047857';
        header.querySelector('span').textContent = 'check_circle';
    }
}

// ============ ADD TASK LOGIC ============

async function addAiTask() {
    if (!currentAnalysisContext.analysisResult || !currentAnalysisContext.analysisResult.isIssue) return;

    const result = currentAnalysisContext.analysisResult;
    const btn = document.getElementById('btn-add-task');

    btn.disabled = true;
    btn.innerHTML = 'Đang thêm công việc...';

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const userEmail = localStorage.getItem('userEmail');

        // Use Fetch Profile to get ID if needed, or assume backend handles generic task creation
        // We'll construct a simplified payload. 
        // Need Owner ID. If global 'myFarmId' exists (from labor.js/cultivation.js context), utilize it.

        // Hack: Create task API endpoint usually requires ownerId. 
        // We'll try to get it from localStorage if stored, or fetch profile.
        // Assuming fetchAPI is available globally or we use standard fetch.

        // If we are in cultivation/livestock page, we might not have `getCurrentUserId` from labor.js.
        // We will do a quick profile fetch here to be safe.

        const profileRes = await fetch(`${API_BASE_URL}/user/profile?email=${encodeURIComponent(userEmail)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const profile = await profileRes.json();
        const ownerId = profile.id;

        // Find Farm ID (Assume first farm)
        const farmsRes = await fetch(`${API_BASE_URL}/farms/my-farms`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const farms = await farmsRes.json();
        const farmId = farms.length > 0 ? farms[0].id : 1;

        const payload = {
            farmId: farmId,
            ownerId: ownerId,
            name: result.taskName,
            description: result.description + " [AI Detected]",
            priority: 'HIGH',
            taskType: result.type,
            salary: 50000, // Default Salary
            quantityRequired: 1,
            // Related IDs
            fieldId: currentAnalysisContext.type === 'CULTIVATION' ? currentAnalysisContext.id : null,
            penId: currentAnalysisContext.type === 'LIVESTOCK' ? currentAnalysisContext.id : null,
            workerId: null // Pending assignment
        };

        const response = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            agriAlert("Đã thêm công việc vào danh sách hôm nay!", 'success');
            closeAiModal();
        } else {
            throw new Error("Failed to create task");
        }

    } catch (e) {
        console.error(e);
        agriAlert("Lỗi khi thêm công việc: " + e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined">assignment_add</span> Thêm vào công việc hôm nay';
    }
}

// Global Export
window.openAnalysisModalGeneric = openAnalysisModalGeneric;
