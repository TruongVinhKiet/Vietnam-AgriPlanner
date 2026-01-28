/**
 * Pest Analysis Feature Logic
 * Handles image upload, scanning animation, and result display (Single Page)
 */

var selectedPestFile = null;
var analysisTimer = null;
var detectedPestResult = null;

// Global variable to track current field for analysis
// Note: This variable is shared with cultivation.js, use var to prevent redeclaration error
if (typeof currentFieldId === 'undefined') {
    var currentFieldId = null;
}

// Open the analysis modal
function openPestAnalysisModal(fieldId = null) {
    if (fieldId) currentFieldId = fieldId;

    const modal = document.getElementById('pest-analysis-modal');
    if (!modal) return;

    // Reset state
    resetPestAnalysis();

    modal.style.display = 'block';
    setTimeout(() => modal.classList.add('show'), 10);
}

// Reset modal to initial state
function resetPestAnalysis() {
    // Restore modal size
    const modalContent = document.querySelector('#pest-analysis-modal .modal-content');
    modalContent.classList.remove('expanded');

    // Show scanner parts
    document.getElementById('scan-container').style.display = 'flex';
    document.getElementById('scan-placeholder').style.display = 'flex';
    document.getElementById('scan-preview').style.display = 'none';
    document.getElementById('scan-preview').src = '';

    document.getElementById('scan-overlay').classList.remove('active');
    document.getElementById('analyzing-status').classList.remove('active');
    document.getElementById('analyzing-status').style.display = 'none'; // Ensure it's hidden by default

    // Hide result parts
    document.getElementById('pest-result-view').style.display = 'none';
    document.getElementById('pest-result-view').style.opacity = '0';

    // Reset buttons
    const footerAction = document.getElementById('modal-footer-action');
    if (footerAction) footerAction.style.display = 'flex';

    document.getElementById('start-scan-btn').disabled = true;
    document.getElementById('start-scan-btn').style.display = 'inline-block';
    document.getElementById('reset-scan-btn').style.display = 'none';

    document.getElementById('pest-file-input').value = '';

    // Hide error
    const errorEl = document.getElementById('analysis-error');
    if (errorEl) errorEl.style.display = 'none';

    if (analysisTimer) clearTimeout(analysisTimer);
    selectedPestFile = null;
    detectedPestResult = null;
}

// Handle file selection
function handlePestImageUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        selectedPestFile = file;

        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('scan-preview');
            preview.src = e.target.result;
            preview.style.display = 'block';
            document.getElementById('scan-placeholder').style.display = 'none';
            document.getElementById('start-scan-btn').disabled = false;
        };
        reader.readAsDataURL(file);
    }
}

// Start analysis process
function startPestAnalysis() {
    if (!selectedPestFile) return;

    // UI Updates
    document.getElementById('start-scan-btn').style.display = 'none';
    document.getElementById('scan-overlay').classList.add('active');
    document.getElementById('analyzing-status').style.display = 'block'; // Show it now
    setTimeout(() => {
        document.getElementById('analyzing-status').classList.add('active');
    }, 10);

    // Hide previous errors
    const errorEl = document.getElementById('analysis-error');
    if (errorEl) errorEl.style.display = 'none';

    // Random duration between 5-10 seconds
    const duration = Math.floor(Math.random() * 5000) + 5000;

    analysisTimer = setTimeout(() => {
        finishPestAnalysis();
    }, duration);
}

// Finish analysis and show result or error
async function finishPestAnalysis() {
    // Current field ID logic (if applicable)
    // For now we assume the field from context or passed via openPestAnalysisModal but 
    // since openPestAnalysisModal is global, let's fix that signature in next step or use currentFieldId global from cultivation.js

    // Using global currentFieldId if available, else null
    const fieldId = (typeof currentFieldId !== 'undefined') ? currentFieldId : null;

    // Analyze file name (Client side hint, but logic is moved to backend basically)
    const imageName = selectedPestFile ? selectedPestFile.name : "";

    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        const API_BASE = typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8080/api';
        const response = await fetch(`${API_BASE}/pests/detect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                fieldId: fieldId,
                imageName: imageName,
                notes: "Uploaded via Web App"
            })
        });

        const result = await response.json();

        document.getElementById('scan-overlay').classList.remove('active');
        document.getElementById('analyzing-status').classList.remove('active');

        if (result.detected && result.pests && result.pests.length > 0) {
            // Show the first detected pest (highest confidence)
            detectedPestResult = result.pests[0];
            showPestResultInModal(detectedPestResult);
        } else {
            const errorEl = document.getElementById('analysis-error');
            if (errorEl) {
                errorEl.style.display = 'block';
                errorEl.innerHTML = '<span class="material-symbols-outlined" style="vertical-align: middle;">check_circle</span> Cây khỏe mạnh! Không phát hiện sâu bệnh.';
                errorEl.style.color = '#10b981';
            }
        }

    } catch (error) {
        console.error("Analysis Error:", error);
        const errorEl = document.getElementById('analysis-error');
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = "Lỗi kết nối máy chủ.";
        }
    }
}

// Display result data
function showPestResultInModal(pest) {
    // Populate Data
    document.getElementById('modal-pest-name').textContent = pest.pestName;
    document.getElementById('modal-pest-scientific').textContent = pest.scientificName || '';
    // Use placeholder if no image URL from backend (User uploaded image is pestImg, but here we want reference image?)
    // Actually we should show the uploaded image as result or the reference image.
    // Let's float the uploaded image to verify.
    // For specific pest, we might want their stock image.
    // If backend doesn't provide image, use uploaded one for now or placeholder.
    document.getElementById('modal-pest-img').src = document.getElementById('scan-preview').src;

    document.getElementById('modal-pest-description').textContent = pest.description;

    const treatmentText = pest.treatment || "Chưa có dữ liệu thuốc trị";
    document.getElementById('modal-pest-treatment').textContent = treatmentText;
    document.getElementById('modal-pest-prevention').textContent = pest.prevention;

    const severityEl = document.getElementById('modal-pest-severity');
    // Map severity string to class
    const sev = pest.severity ? pest.severity.toLowerCase() : 'low';
    severityEl.className = `pest-severity-badge severity-${sev}`;
    document.getElementById('modal-severity-text').textContent = pest.severity || 'UNKNOWN';

    // Transition UI
    document.getElementById('scan-container').style.display = 'none';
    document.getElementById('analyzing-status').classList.remove('active');
    document.getElementById('analyzing-status').style.display = 'none';

    const modalContent = document.querySelector('#pest-analysis-modal .modal-content');
    modalContent.classList.add('expanded');

    const resultView = document.getElementById('pest-result-view');

    // Inject Buttons based on context
    const actionContainer = document.querySelector('#modal-footer-action');
    if (actionContainer) {
        actionContainer.innerHTML = `
            <button class="btn btn--secondary" onclick="closeModalById('pest-analysis-modal')">Đóng</button>
            <button class="btn btn--danger" onclick="closeModalById('pest-analysis-modal')" style="margin-left:auto; margin-right:8px;">Hủy bỏ</button>
            <button class="btn btn--primary" onclick="savePestResult()">
                <span class="material-symbols-outlined">save</span> Lưu kết quả
            </button>
        `;
    }

    resultView.style.display = 'block';

    document.getElementById('reset-scan-btn').style.display = 'none';

    setTimeout(() => {
        resultView.style.opacity = '1';
    }, 50);
}

async function savePestResult() {
    if (!detectedPestResult) return;

    // Attempt to get fieldId from global scope or context
    const fieldId = (typeof currentFieldId !== 'undefined') ? currentFieldId : null;

    // If no fieldId, we might still want to allow saving if the backend supports it, 
    // but the requirement says "lưu vào csdl về tình trang của mảnh ruộng đó".
    if (!fieldId) {
        alert("Lỗi: Không xác định được ruộng để lưu kết quả!");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${CONFIG.API_BASE_URL}/pests/detections`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                fieldId: fieldId,
                pestName: detectedPestResult.pestName,
                severity: detectedPestResult.severity,
                notes: "Phát hiện qua ảnh (AI Analysis) - Đã xác nhận"
            })
        });

        if (response.ok) {
            showToast('Phân tích sâu bệnh', 'Đã lưu kết quả vào hồ sơ ruộng!', 'success');

            // Switch buttons to Treatment
            const actionContainer = document.querySelector('#modal-footer-action');
            if (actionContainer) {
                actionContainer.innerHTML = `
                    <button class="btn btn--secondary" onclick="closeModalById('pest-analysis-modal')">Đóng</button>
                    <button class="btn btn--primary" onclick="applyTreatment()">
                        <span class="material-symbols-outlined">healing</span> Tạo lịch phun thuốc
                    </button>
                `;
            }
        } else {
            const err = await response.text();
            showToast('Lỗi', "Lỗi khi lưu: " + err, 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Lỗi', "Lỗi kết nối máy chủ!", 'error');
    }
}

// Quick action to apply treatment
async function applyTreatment() {
    if (!detectedPestResult || !detectedPestResult.treatment) return;

    // Pre-fill "Phun thuoc" activity
    const treatmentName = detectedPestResult.treatment.split(',')[0].trim(); // Take first suggestion

    if (confirm(`Bạn có muốn tạo lịch hoạt động "Phun thuốc" với: ${treatmentName}?`)) {
        // We can open the Pesticide Modal and prefill it, or call API directly.
        // Let's try to open Pesticide Modal if available and prefill.
        // Assuming openPesticideModal exists in cultivation.js

        closeModalById('pest-analysis-modal');

        // Check if function exists globally
        if (typeof openPesticideModal === 'function') {
            // We need a way to prefill. Let's set values to DOM elements directly then open.
            try {
                const nameInput = document.getElementById('pesticide-name');
                if (nameInput) nameInput.value = treatmentName;

                // Open modal
                openPesticideModal();
                showToast('Đề xuất thuốc', `Đã đề xuất thuốc: ${treatmentName}`, 'info');
            } catch (e) {
                console.error(e);
            }
        }
    }
}

// Legacy function (unused but kept for reference if needed)
function navigateToPestResult() {
    // Deprecated for single page
}
