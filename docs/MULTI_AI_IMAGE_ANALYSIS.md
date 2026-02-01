# Hệ thống Phân tích Ảnh Bản đồ Multi-AI

## Tổng quan

Hệ thống sử dụng nhiều AI engine để phân tích ảnh bản đồ thổ nhưỡng/quy hoạch, chia công việc để tối ưu hiệu quả và tránh quá tải một AI.

## Kiến trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                    Admin Upload Ảnh Bản đồ                       │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BƯỚC 1: GEMINI AI                            │
│  • Phân tích tọa độ 4 góc bản đồ                                 │
│  • Nhận diện tên địa phương, tỉnh/huyện                         │
│  • Trích xuất metadata từ ảnh                                    │
│  Logger: AI.Gemini                                               │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BƯỚC 2: OPENCV (Python)                       │
│  • Loại bỏ nền trắng xung quanh                                 │
│  • Phát hiện và loại bỏ logo, legend, compass                   │
│  • Crop phần bản đồ chính                                        │
│  • Tăng cường màu sắc                                            │
│  • Resize phù hợp cho AI Vision                                  │
│  Logger: AI.OpenCV                                               │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BƯỚC 3: GPT-4O VISION                         │
│  • Phân tích màu sắc từng vùng                                  │
│  • Chia ảnh thành các polygon                                   │
│  • Xác định loại đất/quy hoạch dựa vào màu                      │
│  • Tính toán tỷ lệ diện tích                                    │
│  Logger: AI.GPT4o                                                │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                BƯỚC 4: GROQ + COHERE (Cross-check)               │
│  • Groq (Llama): Xác minh kết quả GPT-4o                        │
│  • Cohere: Xác minh và bổ sung                                  │
│  • Voting system để chọn kết quả tốt nhất                       │
│  Logger: AI.Groq, AI.Cohere                                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     KẾT QUẢ TỔNG HỢP                            │
│  • Danh sách zones với tọa độ polygon                           │
│  • Loại đất/quy hoạch và màu sắc                                │
│  • Confidence score                                              │
│  • Preview trên bản đồ                                          │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN XÁC NHẬN                                │
│  • Chọn loại bản đồ (Thổ nhưỡng / Quy hoạch)                   │
│  • Xem trước kết quả trên bản đồ                                │
│  • Xác nhận lưu vào Database                                    │
│  • Hoặc hủy bỏ nếu kết quả không đúng                          │
└─────────────────────────────────────────────────────────────────┘
```

## Files quan trọng

### Backend

| File | Mô tả |
|------|-------|
| `MultiAIOrchestrator.java` | Service điều phối 4 AI |
| `MapImageAnalysisController.java` | REST API endpoint |
| `preprocess_map.py` | Python script xử lý ảnh OpenCV |

### Frontend

| File | Mô tả |
|------|-------|
| `admin-advanced.html` | Tab "Phân tích Ảnh AI" |
| `admin-advanced.js` | Các hàm xử lý UI và gọi API |

## API Endpoints

### POST `/api/admin/map-image/analyze`
Upload và bắt đầu phân tích ảnh

**Request:**
```
FormData:
- image: File (JPG/PNG, max 50MB)
- province: String (tên tỉnh)
- district: String (tên huyện, optional)
```

**Response:**
```json
{
  "success": true,
  "analysisId": "uuid-xxx",
  "message": "Đang phân tích..."
}
```

### GET `/api/admin/map-image/analyze/{id}/progress`
SSE endpoint để nhận realtime progress

**Events:**
- `connected`: Kết nối thành công
- `progress`: Cập nhật tiến độ từng bước
- `complete`: Hoàn thành, trả về kết quả

### GET `/api/admin/map-image/analyze/{id}/status`
Kiểm tra trạng thái (fallback nếu SSE không hoạt động)

### POST `/api/admin/map-image/analyze/{id}/confirm`
Xác nhận và lưu kết quả vào Database

**Request:**
```json
{
  "mapType": "soil" | "planning"
}
```

### DELETE `/api/admin/map-image/analyze/{id}`
Hủy bỏ kết quả phân tích

## Logging

Mỗi AI có logger riêng để dễ debug:

```java
// Trong application.properties
logging.level.AI.Gemini=DEBUG
logging.level.AI.OpenCV=DEBUG
logging.level.AI.GPT4o=DEBUG
logging.level.AI.Groq=DEBUG
logging.level.AI.Cohere=DEBUG
```

## Cấu hình API Keys

File `.env`:
```
# Gemini (Google AI)
GEMINI_API_KEY=AIza...

# GPT-4o (GitHub Models)
GITHUB_TOKEN=ghp_...

# Groq
GROQ_API_KEY=gsk_...

# Cohere
COHERE_API_KEY=...
```

## Cài đặt Python (cho OpenCV)

```bash
cd backend/python
pip install opencv-python numpy pillow
```

## Cách sử dụng

1. Vào **Admin > Quản lý KMZ > Phân tích Ảnh AI**
2. Upload ảnh bản đồ (JPG/PNG)
3. Chọn tỉnh/huyện
4. Click "Bắt đầu Phân tích Multi-AI"
5. Theo dõi tiến độ từng bước
6. Xem kết quả và chọn loại bản đồ
7. Click "Xác nhận và Lưu"

## Troubleshooting

### Gemini không phân tích được tọa độ
- Kiểm tra ảnh có hiển thị rõ tên địa phương không
- Thử với ảnh có resolution cao hơn

### OpenCV không hoạt động
- Kiểm tra Python đã cài đặt opencv-python
- Chạy `python preprocess_map.py test_image.jpg` để test

### GPT-4o không nhận diện màu
- Ảnh cần có màu sắc rõ ràng
- Kiểm tra preprocessed image từ OpenCV

### SSE không nhận được event
- Browser có thể block SSE
- Fallback sẽ tự động chuyển sang polling

## Màu sắc đất thường gặp (Cà Mau)

| Màu | Loại đất |
|-----|----------|
| Vàng nhạt | Đất phù sa |
| Cam/Nâu đỏ | Đất phèn hoạt động |
| Tím | Đất phèn tiềm tàng |
| Xanh lá | Đất phù sa gley |
| Xám | Đất bãi bồi |
| Xanh dương | Vùng ngập nước |
