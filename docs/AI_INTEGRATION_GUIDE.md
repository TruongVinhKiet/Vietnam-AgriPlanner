# 🤖 Hướng Dẫn Tích Hợp AI - AgriPlanner

## Tổng Quan

AgriPlanner hỗ trợ 3 nhà cung cấp AI để tư vấn nông nghiệp:

| Provider | Model | Ưu điểm | API Miễn phí |
|----------|-------|---------|--------------|
| **GitHub Models** | GPT-4o-mini | Nhanh, chất lượng cao | ✅ 150 req/phút |
| **Groq Cloud** | Llama 3.1 70B | Cực nhanh, miễn phí | ✅ Không giới hạn |
| **Cohere** | Command R+ | Tiếng Việt tốt | ✅ 1000 req/tháng |

---

## 📋 Bước 1: Lấy API Keys

### 1.1 GitHub Models (Khuyên dùng)

1. Truy cập: https://github.com/marketplace/models
2. Chọn model **GPT-4o-mini**
3. Click **"Get free API key"**
4. Tạo Personal Access Token với scope `models:read`
5. Copy token (bắt đầu bằng `ghp_...`)

### 1.2 Groq Cloud

1. Truy cập: https://console.groq.com
2. Đăng ký tài khoản (miễn phí)
3. Vào **API Keys** → **Create API Key**
4. Copy API key (bắt đầu bằng `gsk_...`)

### 1.3 Cohere

1. Truy cập: https://dashboard.cohere.com
2. Đăng ký tài khoản (miễn phí)
3. Vào **API Keys** → **Create Key**
4. Copy API key

---

## 📋 Bước 2: Cấu Hình Backend

### 2.1 Cập nhật file `.env`

Mở file `backend/.env` và điền các API keys:

```env
# AI ADVISOR CONFIGURATION
# ========================

# GitHub Models - https://github.com/marketplace/models
AI_GITHUB_TOKEN=ghp_your_github_token_here
AI_GITHUB_MODEL=gpt-4o-mini

# Groq Cloud - https://console.groq.com
AI_GROQ_API_KEY=gsk_your_groq_api_key_here
AI_GROQ_MODEL=llama-3.1-70b-versatile

# Cohere - https://dashboard.cohere.com
AI_COHERE_API_KEY=your_cohere_api_key_here
AI_COHERE_MODEL=command-r-plus
```

### 2.2 Kiểm tra `application.properties`

File `backend/src/main/resources/application.properties` đã được cấu hình sẵn:

```properties
# AI Advisor Configuration
ai.github.token=${AI_GITHUB_TOKEN:}
ai.github.model=${AI_GITHUB_MODEL:gpt-4o-mini}

ai.groq.api-key=${AI_GROQ_API_KEY:}
ai.groq.model=${AI_GROQ_MODEL:llama-3.1-70b-versatile}

ai.cohere.api-key=${AI_COHERE_API_KEY:}
ai.cohere.model=${AI_COHERE_MODEL:command-r-plus}
```

---

## 📋 Bước 3: Khởi Động và Test

### 3.1 Build và chạy Backend

```bash
cd backend
mvn spring-boot:run
```

### 3.2 Test API với curl

```bash
# Test kết nối
curl http://localhost:8080/api/ai-advisor/providers

# Test GitHub Models
curl http://localhost:8080/api/ai-advisor/test?provider=github

# Test Groq
curl http://localhost:8080/api/ai-advisor/test?provider=groq

# Test Cohere
curl http://localhost:8080/api/ai-advisor/test?provider=cohere
```

### 3.3 Test tư vấn

```bash
curl -X POST http://localhost:8080/api/ai-advisor/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Tư vấn cây trồng phù hợp với đất phù sa, diện tích 2 hecta, vùng ĐBSCL",
    "provider": "github"
  }'
```

---

## 📋 Bước 4: Sử Dụng Giao Diện

1. Truy cập: http://localhost:3000/pages/ai-advisor.html
2. Điền thông tin:
   - Vị trí
   - Loại đất
   - Diện tích
   - Nguồn nước
   - Mùa vụ
   - Ngân sách
3. Chọn nhà cung cấp AI
4. Click **"Nhận Tư Vấn AI"**

---

## 🔧 Troubleshooting

### Lỗi: "AI service unavailable"

**Nguyên nhân**: API key chưa được cấu hình hoặc không hợp lệ

**Giải pháp**:
1. Kiểm tra file `.env` có đúng API key không
2. Restart backend sau khi thay đổi `.env`
3. Kiểm tra API key còn hiệu lực

### Lỗi: "Rate limit exceeded"

**Nguyên nhân**: Đã vượt quá số lượng request cho phép

**Giải pháp**:
- GitHub Models: Đợi 1 phút
- Groq: Hiếm khi xảy ra
- Cohere: Đợi reset hàng tháng hoặc nâng cấp

### Lỗi: "Connection refused"

**Nguyên nhân**: Backend chưa chạy

**Giải pháp**:
```bash
cd backend
mvn spring-boot:run
```

---

## 📊 So Sánh Các Provider

### Tốc độ phản hồi
```
Groq     ████████████████████ 0.5s  (Nhanh nhất)
GitHub   ████████████████     1.5s
Cohere   ████████████         2.5s
```

### Chất lượng tiếng Việt
```
Cohere   ████████████████████ Tốt nhất
GitHub   █████████████████    Rất tốt
Groq     ██████████████       Tốt
```

### Độ chi tiết
```
GitHub   ████████████████████ Chi tiết nhất
Cohere   ████████████████     Rất chi tiết
Groq     ██████████████       Chi tiết
```

---

## 🔐 Bảo Mật

⚠️ **QUAN TRỌNG**:

1. **KHÔNG** commit file `.env` lên Git
2. **KHÔNG** để API keys trong code
3. Thêm `.env` vào `.gitignore`:
   ```
   # Environment files
   .env
   *.env
   backend/.env
   ```

4. Sử dụng biến môi trường trong production:
   ```bash
   export AI_GITHUB_TOKEN=ghp_xxx
   export AI_GROQ_API_KEY=gsk_xxx
   export AI_COHERE_API_KEY=xxx
   ```

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra logs backend: `backend/logs/`
2. Mở issue trên GitHub repository
3. Liên hệ team phát triển

---

*Cập nhật lần cuối: 2024*
