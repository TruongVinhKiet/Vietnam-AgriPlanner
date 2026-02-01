# Cải tiến Phân tích AI - Hỗ trợ Upload Ảnh Riêng

## Vấn đề

AI không nhận dạng chính xác loại đất từ file KMZ vì:
- File KMZ chứa nhiều ảnh chồng lớp (overlay) phức tạp
- Chất lượng ảnh trong KMZ có thể không tốt
- AI phải xử lý nhiều ảnh cùng lúc, dẫn đến kết quả không chính xác

**Kết quả**: AI phát hiện được vùng nhưng trả về `Loại: N/A`

## Giải pháp

Cho phép người dùng **upload ảnh riêng** (JPG/PNG/PDF) để phân tích, KMZ chỉ dùng để lấy tọa độ.

### Lợi ích:
1. **Ảnh rõ ràng hơn**: User có thể chọn ảnh chất lượng cao từ bản đồ gốc
2. **Chính xác hơn**: AI phân tích ảnh sạch, không bị nhiễu từ overlay
3. **Linh hoạt**: Có thể upload nhiều ảnh (tối đa 5) từ nhiều nguồn khác nhau
4. **Tương thích ngược**: Vẫn giữ cách cũ (phân tích từ KMZ) nếu không upload ảnh riêng

---

## Cách sử dụng

### 1. Trên trang Admin (admin-advanced.html)

1. Chọn tab **"Quản lý KMZ"**
2. Upload file KMZ như bình thường
3. **Bật checkbox** "Phân tích chuyên sâu bằng AI" ✅
4. **Bật checkbox mới**: "Upload ảnh riêng để phân tích (khuyến nghị)" ✅
5. Click vào khung "**Click để chọn ảnh bản đồ**"
6. Chọn 1-5 ảnh JPG/PNG/PDF (tối đa 10MB/ảnh)
7. Xem trước ảnh đã chọn
8. Click "**Tải lên và Xử lý**"

### 2. Quy trình phân tích

**Với ảnh riêng** (khuyến nghị):
```
User chọn KMZ + 3 ảnh JPG
    ↓
Backend:
  - KMZ → Extract tọa độ (coordinates)
  - 3 ảnh JPG → AI phân tích màu sắc
    ↓
AI Vision phân tích từng ảnh:
  - Ảnh 1: Phát hiện 15 vùng đất mặn
  - Ảnh 2: Phát hiện 20 vùng đất phèn
  - Ảnh 3: Phát hiện 10 vùng đất cát
    ↓
Merge kết quả: 45 vùng với tọa độ từ KMZ
```

**Không có ảnh riêng** (cách cũ):
```
User chỉ chọn KMZ
    ↓
Backend:
  - Extract ảnh từ KMZ (lấy ảnh đầu tiên)
  - AI phân tích ảnh đó
    ↓
Kết quả có thể không chính xác nếu ảnh trong KMZ kém chất lượng
```

---

## Thay đổi kỹ thuật

### Frontend (admin-advanced.html + admin-advanced.js)

**Thêm UI mới:**
- Checkbox "Upload ảnh riêng để phân tích"
- Input file multiple: `<input type="file" multiple accept=".jpg,.jpeg,.png,.pdf">`
- Preview ảnh đã chọn với nút xóa
- Validation: tối đa 5 ảnh, mỗi ảnh ≤ 10MB

**JavaScript:**
```javascript
let selectedAdditionalImages = []; // Danh sách ảnh bổ sung

function handleAdditionalImagesSelect(e) {
    // Validate + lưu ảnh
}

function updateImagePreview() {
    // Hiển thị preview ảnh
}

async function submitUploadWithAI() {
    const formData = new FormData();
    formData.append('file', selectedFile); // KMZ
    
    // Thêm ảnh riêng nếu có
    if (useSeparateImages && selectedAdditionalImages.length > 0) {
        formData.append('useSeparateImages', 'true');
        selectedAdditionalImages.forEach(img => {
            formData.append('additionalImages', img);
        });
    }
}
```

### Backend

#### KmzUploadController.java

**Endpoint mới:**
```java
@PostMapping("/analyze")
public ResponseEntity<?> analyzeKmz(
    @RequestParam("file") MultipartFile file,                      // KMZ
    @RequestParam(value = "additionalImages", required = false) 
        List<MultipartFile> additionalImages,                      // Ảnh riêng
    @RequestParam(value = "useSeparateImages", defaultValue = "false") 
        boolean useSeparateImages,
    // ...other params
) {
    // Logic mới
    List<File> imagesToAnalyze = new ArrayList<>();
    
    if (useSeparateImages && additionalImages != null) {
        // Dùng ảnh riêng để phân tích
        for (MultipartFile img : additionalImages) {
            imagesToAnalyze.add(saveToTemp(img));
        }
    } else {
        // Cách cũ: extract từ KMZ
        List<Path> extractedImages = kmzParserService.extractImagesFromKmz(tempFile);
        imagesToAnalyze.add(extractedImages.get(0).toFile());
    }
    
    // Phân tích
    if (imagesToAnalyze.size() == 1) {
        aiResult = mapAnalysisAIService.analyzeMapImage(imagesToAnalyze.get(0), mapType);
    } else {
        aiResult = mapAnalysisAIService.analyzeMultipleImages(imagesToAnalyze, mapType);
    }
}
```

#### KmzParserService.java

**Method mới:**
```java
public Map<String, Object> extractCoordinatesFromKmz(Path kmzPath) {
    // Extract KML từ KMZ
    // Parse <coordinates> tags
    // Trả về danh sách polygons với coordinates
    return result;
}
```

#### MapAnalysisAIService.java

**Method mới:**
```java
public Map<String, Object> analyzeMultipleImages(List<File> imageFiles, String mapType) {
    List<Map<String, Object>> allZones = new ArrayList<>();
    
    // Phân tích từng ảnh
    for (File imageFile : imageFiles) {
        Map<String, Object> result = analyzeMapImage(imageFile, mapType);
        List<Map<String, Object>> zones = result.get("zones");
        
        // Tag source image
        for (Map<String, Object> zone : zones) {
            zone.put("sourceImage", imageFile.getName());
        }
        
        allZones.addAll(zones);
    }
    
    // Merge kết quả
    return mergedResult;
}
```

---

## Testing

### Test Case 1: Upload KMZ + 3 ảnh riêng

1. Upload file KMZ Cà Mau
2. Bật AI Analysis
3. Bật "Upload ảnh riêng"
4. Chọn 3 ảnh JPG từ bản đồ gốc
5. Submit

**Kết quả mong đợi:**
- Backend nhận 1 KMZ + 3 JPG
- AI phân tích 3 ảnh, merge kết quả
- Hiển thị "Đã phân tích 3 ảnh, tìm thấy X vùng"

### Test Case 2: Upload chỉ KMZ (backward compatible)

1. Upload file KMZ
2. Bật AI Analysis
3. KHÔNG bật "Upload ảnh riêng"
4. Submit

**Kết quả mong đợi:**
- Backend extract ảnh từ KMZ
- AI phân tích ảnh đầu tiên từ KMZ
- Kết quả tương tự như trước

### Test Case 3: Validation

1. Upload KMZ
2. Bật "Upload ảnh riêng"
3. Chọn 7 ảnh (vượt quá 5)

**Kết quả mong đợi:**
- Toast warning: "Tối đa 5 ảnh. Chỉ lấy 5 ảnh đầu tiên."
- Chỉ 5 ảnh đầu được thêm

---

## Lưu ý

### Token Optimization
- Mỗi ảnh gửi AI = 1 API call
- 5 ảnh = 5 calls → Chi phí cao hơn
- **Khuyến nghị**: Chọn 1-2 ảnh đại diện thay vì 5 ảnh

### Chất lượng ảnh
- **Tốt nhất**: PNG, JPG không nén (từ PDF gốc)
- **Khuyến nghị kích thước**: 1000-2000px (vừa đủ cho AI)
- **Tránh**: Ảnh quá nhỏ (<500px), ảnh bị nén nhiều

### Định dạng hỗ trợ
- ✅ JPG/JPEG (ảnh scan)
- ✅ PNG (screenshot, export từ GIS)
- ✅ PDF (AI sẽ convert page đầu tiên thành ảnh)

---

## Kết luận

Giải pháp này giải quyết vấn đề **AI không nhận dạng được loại đất** bằng cách:

1. ✅ Tách riêng việc lấy tọa độ (KMZ) và phân tích màu sắc (ảnh riêng)
2. ✅ Cho phép user upload ảnh chất lượng cao
3. ✅ Hỗ trợ phân tích nhiều ảnh cùng lúc
4. ✅ Tương thích ngược với workflow cũ

**Kết quả**: Thay vì "Loại: N/A", giờ sẽ nhận dạng chính xác loại đất như "Đất mặn nhiều", "Đất phèn tiềm tàng nông", v.v.
