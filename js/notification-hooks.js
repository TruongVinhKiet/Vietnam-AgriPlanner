/*
 * AgriPlanner - Notification Hooks (Universal)
 * Automatically listens to agriAlert and showToast calls to trigger Global Notifications
 * This guarantees 100% correlation with real user actions and UI alerts.
 * Maps each page's data-page attribute to the correct notification category.
 */

(function () {
    const page = document.body.getAttribute('data-page') || 'system';

    // Map page names to notification categories (must match NOTIF_CATEGORIES in global-notifications.js)
    const PAGE_TO_CATEGORY = {
        'cultivation': 'cultivation',
        'livestock': 'livestock',
        'labor': 'labor',
        'inventory': 'inventory',
        'inventory-detail': 'inventory',
        'shop': 'shop',
        'cooperative': 'cooperative',
        'community': 'community',
        'analytics': 'finance',
        'finance': 'finance',
        'settings': 'system',
        'worker-detail': 'labor',
        'help': 'system',
        'system': 'system'
    };

    // Map success messages to more specific notification types
    const MSG_TO_TYPE = [
        // Cultivation
        { match: /thêm.*ruộng|lưu.*ruộng|mảnh ruộng/i, type: 'FIELD_ADDED' },
        { match: /xóa.*ruộng/i, type: 'FIELD_DELETED' },
        { match: /bón phân/i, type: 'GENERAL' },
        { match: /gieo hạt/i, type: 'GENERAL' },
        { match: /tưới nước/i, type: 'GENERAL' },
        { match: /phun thuốc/i, type: 'GENERAL' },
        { match: /thu hoạch/i, type: 'GENERAL' },
        { match: /xuất.*báo cáo|export/i, type: 'REPORT_EXPORTED' },
        // Livestock
        { match: /thêm.*chuồng|tạo.*chuồng/i, type: 'PEN_ADDED' },
        { match: /xóa.*chuồng/i, type: 'PEN_DELETED' },
        { match: /cập nhật.*tình trạng.*chuồng/i, type: 'GENERAL' },
        { match: /điện nước|lưu.*cài đặt.*điện/i, type: 'UTILITY_UPDATED' },
        { match: /giao việc|phân công/i, type: 'TASK_ASSIGNED' },
        { match: /tiêm phòng|vaccine/i, type: 'GENERAL' },
        { match: /vệ sinh/i, type: 'GENERAL' },
        { match: /cho ăn/i, type: 'GENERAL' },
        { match: /cân nặng/i, type: 'GENERAL' },
        { match: /bán.*sản phẩm/i, type: 'GENERAL' },
        // Labor
        { match: /lương|trả lương/i, type: 'SALARY_UPDATED' },
        { match: /duyệt.*hồ sơ|ứng tuyển/i, type: 'CV_RECEIVED' },
        { match: /từ chối.*hồ sơ/i, type: 'CV_RECEIVED' },
        { match: /tạo.*công việc|xóa.*công việc/i, type: 'TASK_CREATED' },
        { match: /cập nhật.*trạng thái|hoàn thành.*công việc/i, type: 'TASK_STATUS_CHANGED' },
        { match: /hạn mức.*tuyển dụng/i, type: 'GENERAL' },
        { match: /phản hồi/i, type: 'GENERAL' },
        // Inventory
        { match: /lưu kho|nhập kho|thêm.*kho/i, type: 'INVENTORY_IN' },
        { match: /bán.*thành công|xuất kho/i, type: 'INVENTORY_OUT' },
        // Shop
        { match: /mua.*thành công|đã mua/i, type: 'ORDER_PLACED' },
        { match: /đặt hàng/i, type: 'ORDER_PLACED' },
        { match: /đã đến|giao.*tới/i, type: 'ORDER_DELIVERED' },
        { match: /nhận hàng|xác nhận.*nhận/i, type: 'ORDER_RECEIVED' },
        { match: /điểm.*tích lũy|thưởng/i, type: 'LOYALTY_EARNED' },
        { match: /thanh toán.*thành công/i, type: 'ORDER_PLACED' },
        { match: /đánh giá/i, type: 'GENERAL' },
        // Cooperative
        { match: /tạo.*phiên|phiên.*mua|phiên.*bán/i, type: 'COOP_SESSION' },
        { match: /thành viên.*tham gia|gia nhập/i, type: 'COOP_MEMBER' },
        { match: /chuyển.*tiền/i, type: 'BALANCE_CHANGE' },
        // Community
        { match: /đăng bài|bài viết/i, type: 'POST_CREATED' },
        { match: /tin nhắn|nhắn tin/i, type: 'MESSAGE_RECEIVED' },
        { match: /reaction|thả tim|cảm xúc/i, type: 'REACTION_RECEIVED' },
        { match: /kết bạn|lời mời/i, type: 'GENERAL' },
        // Finance/Analytics
        { match: /biến động.*số dư|nạp tiền|rút tiền/i, type: 'BALANCE_CHANGE' },
    ];

    function detectNotifType(message) {
        if (!message) return 'GENERAL';
        for (const rule of MSG_TO_TYPE) {
            if (rule.match.test(message)) return rule.type;
        }
        return 'GENERAL';
    }

    function triggerGlobal(title, message, categoryStr) {
        let cat = PAGE_TO_CATEGORY[categoryStr] || PAGE_TO_CATEGORY[page] || 'system';
        let notifType = detectNotifType(message || title);

        if (typeof sendGlobalNotification === 'function') {
            sendGlobalNotification({
                title: title || 'Thành công',
                message: message,
                type: notifType,
                category: cat
            });
        }
    }

    // Hook agriAlert
    if (typeof window.agriAlert === 'function') {
        const origAgriAlert = window.agriAlert;
        window.agriAlert = function (message, type, title) {
            origAgriAlert.apply(this, arguments);
            if (type === 'success') {
                triggerGlobal(title, message, page);
            }
        };
    }

    // Hook showToast (used in shop, cooperative, community, labor, etc.)
    if (typeof window.showToast === 'function') {
        const origShowToast = window.showToast;
        window.showToast = function (title, message, type) {
            origShowToast.apply(this, arguments);
            if (type === 'success') {
                triggerGlobal(title, message, page);
            }
        };
    }

    // Hook showNotification (used in livestock.js, cultivation.js)
    if (typeof window.showNotification === 'function') {
        const origShowNotification = window.showNotification;
        window.showNotification = function (message, type) {
            origShowNotification.apply(this, arguments);
            if (type === 'success') {
                triggerGlobal('Thành công', message, page);
            }
        };
    }

})();
