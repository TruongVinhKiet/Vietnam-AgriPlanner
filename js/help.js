/**
 * Help Page - Admin Chat
 * Handles chat with admin/support team
 */

var API_BASE_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL :
                   (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8080/api');

let currentUser = null;
let adminChatRoomId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    await initAdminChat();
});

async function loadCurrentUser() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            currentUser = await response.json();
        }
    } catch (error) {
        console.error('Error loading user:', error);
    }
}

async function initAdminChat() {
    if (!currentUser) return;

    try {
        // Get or create admin chat room for this user
        const response = await fetch(`${API_BASE_URL}/chat/admin?userId=${currentUser.id}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            const room = await response.json();
            adminChatRoomId = room.id;
            loadAdminMessages();
        }
    } catch (error) {
        console.error('Error initializing admin chat:', error);
    }
}

async function loadAdminMessages() {
    if (!adminChatRoomId) return;

    const container = document.getElementById('admin-chat-messages');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/chat/rooms/${adminChatRoomId}/messages?page=0&size=50`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
        });

        if (response.ok) {
            const data = await response.json();
            const messages = (data.content || []).reverse();

            if (messages.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; color: #9ca3af; padding: 60px 20px;">
                        <span class="material-symbols-outlined" style="font-size: 48px; margin-bottom: 8px;">chat</span>
                        <p>Chưa có tin nhắn nào</p>
                        <p style="font-size: 12px;">Gửi tin nhắn để bắt đầu cuộc trò chuyện</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = messages.map(msg => {
                const isFromUser = msg.sender?.id === currentUser.id;
                const isSystem = msg.messageType === 'SYSTEM';

                if (isSystem) {
                    return `
                        <div style="text-align: center; margin: 12px 0;">
                            <div style="display: inline-block; background: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 8px; font-size: 13px;">
                                ${escapeHtml(msg.content)}
                            </div>
                        </div>
                    `;
                }

                return `
                    <div style="display: flex; justify-content: ${isFromUser ? 'flex-end' : 'flex-start'}; margin-bottom: 12px;">
                        ${!isFromUser ? `
                            <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #4CAF50, #45a049); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 8px; color: white; font-size: 14px;">
                                <span class="material-symbols-outlined" style="font-size: 18px;">support_agent</span>
                            </div>
                        ` : ''}
                        <div style="max-width: 70%; padding: 10px 14px; border-radius: 16px; background: ${isFromUser ? 'var(--color-primary)' : 'white'}; color: ${isFromUser ? 'white' : '#1f2937'}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            ${escapeHtml(msg.content)}
                            <div style="font-size: 10px; opacity: 0.7; margin-top: 4px; text-align: right;">
                                ${formatTime(msg.createdAt)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            container.scrollTop = container.scrollHeight;
        }
    } catch (error) {
        console.error('Error loading admin messages:', error);
    }
}

async function sendAdminMessage() {
    const input = document.getElementById('admin-chat-input');
    const content = input?.value?.trim();
    if (!content || !currentUser) return;

    // If no room yet, create one first
    if (!adminChatRoomId) {
        await initAdminChat();
        if (!adminChatRoomId) {
            alert('Không thể kết nối với hỗ trợ. Vui lòng thử lại.');
            return;
        }
    }

    try {
        const response = await fetch(`${API_BASE_URL}/chat/rooms/${adminChatRoomId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                senderId: currentUser.id,
                content: content
            })
        });

        if (response.ok) {
            input.value = '';
            loadAdminMessages();
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Refresh messages every 10 seconds
setInterval(() => {
    if (adminChatRoomId) {
        loadAdminMessages();
    }
}, 10000);
