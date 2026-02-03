# AI Image Analysis - Cải tiến v2.0

## Tóm tắt thay đổi

### 1. Cải thiện chất lượng Polygon (Polygon Mode)

**Vấn đề trước:**
- Polygons bị simplify quá mức (max 10 điểm) → hình dạng dị dạng
- Morphology quá mạnh (kernel 15x15) → mất chi tiết
- min_area 0.5% → bỏ mất vùng nhỏ

**Sau khi cải tiến:**
- `max_points = 50` (tăng từ 10) → giữ nhiều chi tiết hơn
- Morphology nhẹ hơn (kernel 3x3, 5x5) → bảo toàn hình dạng gốc
- `min_area = 0.1%` → giữ cả vùng nhỏ
- **Không dùng convex hull** - giữ hình dạng thực của contour

**Kết quả:**
- Trước: ~244 zones, max 10 điểm/polygon → dị dạng
- Sau: ~117 zones, 22-50 điểm/polygon → khớp hình dạng thực hơn

### 2. Thêm Image Overlay Mode (Mới!)

**Chức năng:** Tạo ảnh overlay để hiển thị trên bản đồ, giống như KMZ GroundOverlay

**Cách dùng:**
```bash
python map_polygon_extractor.py input.jpg output.json --with-legend --image-overlay --geo-bounds-file geo_bounds.json
```

**Output:**
- File PNG với alpha channel (nền trong suốt)
- `imageUrl` để frontend dùng `L.imageOverlay()`
- `boundaryCoordinates` cho 4 góc SW, SE, NE, NW

**Ưu điểm:**
- Giữ nguyên 100% hình ảnh gốc
- Không bị simplify hay méo mó
- Hiển thị chính xác như bản đồ gốc

### 3. Files đã sửa đổi

1. **map_polygon_extractor.py** (E:\Agriplanner\backend\python)
   - Thêm `--image-overlay` flag
   - Tạo `create_image_overlay()` function
   - Giảm morphology từ kernel 15x15 → 3x3, 5x5
   - Tăng `max_points` từ 10 → 50
   - Giảm `min_area_percent` từ 0.5% → 0.1%
   - Bỏ convex hull trong `simplify_contour()`

2. **MapImageAnalysisController.java**
   - Thêm xử lý `imageUrl` trong `convertToZone()`
   - Thêm xử lý `fillOpacity` từ Python

3. **geo_bounds.json** (mới)
   - File mẫu tọa độ địa lý cho Cà Mau

## Hướng dẫn test

### Test Polygon Mode (cải tiến):
```bash
cd E:\Agriplanner\backend\python
python map_polygon_extractor.py "image\Cà Mau_Thổ Nhưỡng.jpeg" output_test.json --with-legend --geo-bounds-file geo_bounds.json --max-dimension 3000
```

### Test Image Overlay Mode:
```bash
cd E:\Agriplanner\backend\python
python map_polygon_extractor.py "image\Cà Mau_Thổ Nhưỡng.jpeg" output_overlay.json --with-legend --image-overlay --geo-bounds-file geo_bounds.json
```

## So sánh 2 modes

| Đặc điểm | Polygon Mode | Image Overlay Mode |
|----------|--------------|-------------------|
| Độ chính xác hình dạng | ~90% (22-50 điểm) | 100% (ảnh gốc) |
| Kích thước dữ liệu | Nhỏ (JSON coordinates) | Lớn (PNG file) |
| Khả năng tương tác | Click vào từng vùng | Click vào toàn bộ overlay |
| Tốc độ render | Nhanh | Trung bình |
| Phù hợp cho | Phân tích chi tiết từng vùng | Xem tổng quan bản đồ |

## Lưu ý

1. **Image Overlay Mode** yêu cầu backend serve file PNG overlay
2. Frontend cần cập nhật để xử lý zone có `isOverlay: true`
3. Geo bounds phải chính xác để overlay đúng vị trí

## Files output

- `output.json` - Kết quả phân tích
- `output_legend.jpg` - Ảnh legend đã crop
- `output_overlay.png` - Ảnh overlay (chỉ có trong Image Overlay Mode)
