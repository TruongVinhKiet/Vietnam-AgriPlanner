// =================================================
// AgriPlanner - AI Chatbot Module
// Agriculture-focused chatbot using Gemini via OpenRouter
// =================================================

class AgriChatbot {
    constructor() {
        this.isOpen = false;
        this.isLoading = false;
        this.messages = [];
        this.container = null;
        this.panel = null;
        this.messagesContainer = null;

        // System prompt - Only agriculture topics
        this.systemPrompt = `Bạn là AgriBot, trợ lý AI chuyên về nông nghiệp của AgriPlanner. 

QUAN TRỌNG - QUY TẮC BẮT BUỘC:
1. Chỉ trả lời các câu hỏi liên quan đến nông nghiệp, trồng trọt, chăn nuôi, thời tiết nông nghiệp, kỹ thuật canh tác, phân bón, thuốc bảo vệ thực vật, quản lý trang trại.
2. Nếu câu hỏi KHÔNG liên quan đến nông nghiệp, từ chối lịch sự: "Xin lỗi, tôi chỉ có thể hỗ trợ các câu hỏi liên quan đến nông nghiệp. Bạn có câu hỏi gì về trồng trọt, chăn nuôi hay quản lý nông trại không?"
3. Trả lời ngắn gọn, súc tích (tối đa 3-4 câu).
4. Sử dụng tiếng Việt.
5. Đưa ra lời khuyên thực tế, có thể áp dụng ngay.

Ví dụ câu hỏi hợp lệ: cách trồng lúa, thời vụ gieo ngô, bệnh trên heo, phân bón cho rau, dự báo thời tiết.
Ví dụ câu hỏi KHÔNG hợp lệ: lập trình, nấu ăn, phim ảnh, chính trị.`;

        this.init();
    }

    init() {
        this.createChatbotUI();
        this.bindEvents();
    }

    createChatbotUI() {
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'chatbot-container';
        this.container.innerHTML = `
            <!-- Floating Button -->
            <button class="chatbot-toggle" id="chatbot-toggle" title="Hỏi AgriBot">
                <span class="material-symbols-outlined">smart_toy</span>
            </button>
            
            <!-- Chat Panel -->
            <div class="chatbot-panel" id="chatbot-panel">
                <div class="chatbot-header">
                    <div class="chatbot-header__avatar">
                        <span class="material-symbols-outlined">smart_toy</span>
                    </div>
                    <div class="chatbot-header__info">
                        <div class="chatbot-header__name">AgriBot</div>
                        <div class="chatbot-header__status">Trợ lý nông nghiệp AI</div>
                    </div>
                    <button class="chatbot-header__close" id="chatbot-close">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div class="chatbot-messages" id="chatbot-messages">
                    <div class="chatbot-welcome">
                        <div class="chatbot-welcome__icon">
                            <span class="material-symbols-outlined">agriculture</span>
                        </div>
                        <h3 class="chatbot-welcome__title">Xin chào! 👋</h3>
                        <p class="chatbot-welcome__text">Tôi là AgriBot, trợ lý AI chuyên về nông nghiệp. Hãy hỏi tôi về trồng trọt, chăn nuôi, hay quản lý nông trại!</p>
                        <div class="chatbot-welcome__suggestions">
                            <button class="chatbot-suggestion" data-question="Cách trồng lúa hiệu quả?">🌾 Trồng lúa</button>
                            <button class="chatbot-suggestion" data-question="Phòng bệnh cho heo như thế nào?">🐷 Chăn nuôi heo</button>
                            <button class="chatbot-suggestion" data-question="Thời vụ trồng ngô ở miền Nam?">🌽 Thời vụ ngô</button>
                        </div>
                    </div>
                </div>
                
                <div class="chatbot-input">
                    <form class="chatbot-input__form" id="chatbot-form">
                        <input type="text" class="chatbot-input__field" id="chatbot-input" placeholder="Nhập câu hỏi về nông nghiệp..." autocomplete="off">
                        <button type="submit" class="chatbot-input__submit" id="chatbot-submit">
                            <span class="material-symbols-outlined">send</span>
                        </button>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        // Get references
        this.panel = document.getElementById('chatbot-panel');
        this.messagesContainer = document.getElementById('chatbot-messages');
    }

    bindEvents() {
        // Toggle button
        document.getElementById('chatbot-toggle').addEventListener('click', () => this.toggle());

        // Close button
        document.getElementById('chatbot-close').addEventListener('click', () => this.close());

        // Form submit
        document.getElementById('chatbot-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Suggestion buttons
        this.container.querySelectorAll('.chatbot-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.dataset.question;
                document.getElementById('chatbot-input').value = question;
                this.handleSubmit();
            });
        });

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        this.panel.classList.add('open');
        document.getElementById('chatbot-toggle').classList.add('active');
        document.getElementById('chatbot-input').focus();

        // GSAP animation if available
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(this.panel,
                { opacity: 0, y: 20, scale: 0.95 },
                { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(1.5)' }
            );
        }
    }

    close() {
        this.isOpen = false;
        this.panel.classList.remove('open');
        document.getElementById('chatbot-toggle').classList.remove('active');
    }

    async handleSubmit() {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();

        if (!message || this.isLoading) return;

        // Clear welcome screen on first message
        const welcome = this.messagesContainer.querySelector('.chatbot-welcome');
        if (welcome) {
            welcome.remove();
        }

        // Add user message
        this.addMessage(message, 'user');
        input.value = '';

        // Add to history
        this.messages.push({ role: 'user', content: message });

        // Show typing indicator
        this.showTyping();

        try {
            const response = await this.callAPI(message);
            this.hideTyping();
            this.addMessage(response, 'bot');
            this.messages.push({ role: 'assistant', content: response });

            // Limit history to save tokens
            if (this.messages.length > CONFIG.CHATBOT.MAX_HISTORY_MESSAGES * 2) {
                this.messages = this.messages.slice(-CONFIG.CHATBOT.MAX_HISTORY_MESSAGES * 2);
            }
        } catch (error) {
            this.hideTyping();
            this.addMessage('Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.', 'bot');
            console.error('Chatbot error:', error);
        }
    }

    addMessage(text, type) {
        const messageEl = document.createElement('div');
        messageEl.className = `chatbot-message chatbot-message--${type}`;
        messageEl.innerHTML = `
            <div class="chatbot-message__avatar">
                <span class="material-symbols-outlined">${type === 'bot' ? 'smart_toy' : 'person'}</span>
            </div>
            <div class="chatbot-message__content">${this.formatMessage(text)}</div>
        `;

        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    formatMessage(text) {
        // Convert markdown-like formatting
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    showTyping() {
        this.isLoading = true;
        const typingEl = document.createElement('div');
        typingEl.className = 'chatbot-message chatbot-message--bot';
        typingEl.id = 'chatbot-typing';
        typingEl.innerHTML = `
            <div class="chatbot-message__avatar">
                <span class="material-symbols-outlined">smart_toy</span>
            </div>
            <div class="chatbot-typing">
                <span class="chatbot-typing__dot"></span>
                <span class="chatbot-typing__dot"></span>
                <span class="chatbot-typing__dot"></span>
            </div>
        `;
        this.messagesContainer.appendChild(typingEl);
        this.scrollToBottom();
        document.getElementById('chatbot-submit').disabled = true;
    }

    hideTyping() {
        this.isLoading = false;
        const typingEl = document.getElementById('chatbot-typing');
        if (typingEl) typingEl.remove();
        document.getElementById('chatbot-submit').disabled = false;
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async callAPI(userMessage) {
        // Build messages array with limited history
        const apiMessages = [
            { role: 'system', content: this.systemPrompt },
            ...this.messages.slice(-(typeof CONFIG !== 'undefined' && CONFIG.CHATBOT ? CONFIG.CHATBOT.MAX_HISTORY_MESSAGES : 10) * 2),
            { role: 'user', content: userMessage }
        ];

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(typeof CONFIG !== 'undefined') ? CONFIG.OPENROUTER_API_KEY : ''}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'AgriPlanner Chatbot'
            },
            body: JSON.stringify({
                model: (typeof CONFIG !== 'undefined' && CONFIG.CHATBOT) ? CONFIG.CHATBOT.MODEL : 'google/gemini-2.0-flash-exp:free',
                messages: apiMessages,
                max_tokens: (typeof CONFIG !== 'undefined' && CONFIG.CHATBOT) ? CONFIG.CHATBOT.MAX_TOKENS_PER_RESPONSE : 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', function () {
    // Only initialize if chatbot feature is enabled
    if (typeof CONFIG !== 'undefined' && CONFIG.FEATURES && CONFIG.FEATURES.USE_CHATBOT) {
        window.agriChatbot = new AgriChatbot();
    }
});
