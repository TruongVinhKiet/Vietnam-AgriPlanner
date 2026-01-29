document.addEventListener('DOMContentLoaded', async () => {
    const page = document && document.body && document.body.dataset ? document.body.dataset.page : null;
    if (page !== 'worker-detail') return;

    const contentEl = document.getElementById('worker-detail-content');

    let wid = null;
    try {
        const url = new URL(window.location.href);
        const widRaw = url.searchParams.get('workerId');
        wid = widRaw != null ? Number(widRaw) : null;
    } catch (e) {
        wid = null;
    }

    if (!wid || !Number.isFinite(wid)) {
        if (contentEl) {
            contentEl.innerHTML = '<div style="text-align: center; padding: 3rem; color: #ef4444;">Thiếu workerId. Vui lòng quay lại danh sách và chọn nhân công.</div>';
        }
        return;
    }

    if (typeof ensureFarmId === 'function') {
        await ensureFarmId();
    }
    if (typeof ensureApprovedWorkersForAssignment === 'function') {
        await ensureApprovedWorkersForAssignment();
    }

    const titleEl = document.getElementById('worker-detail-title');
    if (titleEl && typeof findApprovedWorkerById === 'function') {
        const worker = findApprovedWorkerById(wid);
        titleEl.textContent = worker && (worker.fullName || worker.email)
            ? `Chi tiết nhân công: ${worker.fullName || worker.email}`
            : `Chi tiết nhân công #${wid}`;
    }

    if (typeof loadWorkerDetailContent === 'function') {
        workerDetailWorkerId = wid;
        await loadWorkerDetailContent(wid);
    } else if (contentEl) {
        contentEl.innerHTML = '<div style="text-align: center; padding: 3rem; color: #ef4444;">Không thể tải chi tiết nhân công</div>';
    }
});

function refreshWorkerDetailPage() {
    if (!workerDetailWorkerId) return;
    if (typeof loadWorkerDetailContent !== 'function') return;
    loadWorkerDetailContent(workerDetailWorkerId);
}

function goBackToLabor() {
    window.location.href = 'labor.html';
}

window.refreshWorkerDetailPage = refreshWorkerDetailPage;
window.goBackToLabor = goBackToLabor;
