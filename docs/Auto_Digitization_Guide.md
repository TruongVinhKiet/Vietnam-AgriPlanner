# Hướng dẫn Auto Digitization - Chuyển ảnh bản đồ thành KMZ tự động

## 🎯 Tổng quan

**Phương pháp này SỬ DỤNG:**
- ✅ Computer Vision đơn giản (OpenCV)
- ✅ Color Segmentation (phân tích màu sắc)
- ✅ Contour Detection (tìm đường viền)
- ✅ **KHÔNG CẦN GPU**
- ✅ **KHÔNG CẦN Training ML Model**

**Cấu hình tối thiểu:**
- CPU: Intel i3 hoặc tương đương
- RAM: 4GB
- Python 3.8+
- Laptop thường là đủ

---

## 📦 Cài đặt

### Bước 1: Cài Python packages

```powershell
# Mở PowerShell/CMD
cd e:\Agriplanner\scripts

# Cài đặt thư viện cần thiết
pip install opencv-python numpy simplekml
```

**Giải thích các thư viện:**
- `opencv-python` (~50MB): Xử lý ảnh, phát hiện màu sắc, tìm contours
- `numpy` (~20MB): Tính toán số học
- `simplekml` (~1MB): Tạo file KML/KMZ

**Tổng dung lượng:** ~70MB
**Thời gian cài:** 1-2 phút

---

## 🚀 Sử dụng

### Cách 1: Tự động phát hiện màu (Khuyến nghị)

```powershell
# Chạy với ảnh bản đồ
python auto_digitize.py "đường_dẫn_ảnh_bản_đồ.jpg"

# Ví dụ cụ thể
python auto_digitize.py "E:\New Volume (E)\Agriplanner\map\Bản đồ thổ nhưỡng\Ca Mau\ca_mau_soil.jpg"
```

**Script sẽ tự động:**
1. Phát hiện 8 màu chủ đạo trong ảnh
2. Tạo polygon cho mỗi vùng màu
3. Export ra file KMZ

### Cách 2: Với GPS bounds chính xác

```powershell
python auto_digitize.py <ảnh> <north> <south> <east> <west>

# Ví dụ: Cà Mau
python auto_digitize.py ca_mau_soil.jpg 9.9 8.5 105.8 104.5
```

**Cách lấy GPS bounds:**
1. Mở Google Maps
2. Zoom vào khu vực bản đồ
3. Click chuột phải góc trên bên trái → "What's here?" → Lấy Lat (North)
4. Click góc dưới bên phải → Lấy Lat (South)
5. Tương tự với Lng (East, West)

---

## 📊 Kết quả

Sau khi chạy, sẽ có 3 file trong thư mục `output/`:

```
output/
├── ca_mau_soil_digitized.kmz      ← Upload vào AgriPlanner
├── ca_mau_soil_digitized.geojson  ← Dự phòng
└── ca_mau_soil_preview.jpg        ← Xem trước kết quả
```

### 1. File KMZ (Chính)
- Có polygon vectors với GPS coordinates
- Màu sắc giữ nguyên như ảnh gốc
- Upload trực tiếp vào AgriPlanner

### 2. File GeoJSON (Dự phòng)
- Format JSON để debug
- Import vào QGIS/Mapbox nếu cần

### 3. Preview JPG
- Ảnh overlay để kiểm tra trước khi upload
- Polygon màu đỏ viền

---

## ⚙️ Tùy chỉnh nâng cao

### Điều chỉnh độ nhạy màu

Mở file `auto_digitize.py`, tìm dòng:

```python
# Dòng ~200
mask = self.create_color_mask(color_bgr, tolerance=40)
```

**Thay đổi `tolerance`:**
- `tolerance=20`: Khắt khe hơn, chỉ lấy màu rất giống
- `tolerance=40`: Mặc định, cân bằng
- `tolerance=60`: Lỏng lẻo, lấy nhiều màu gần giống

### Điều chỉnh diện tích tối thiểu

```python
# Dòng ~350
zones = digitizer.auto_digitize(soil_colors=None, min_area=1000)
```

**Thay đổi `min_area`:**
- `min_area=100`: Lấy cả vùng rất nhỏ (nhiễu)
- `min_area=1000`: Mặc định, bỏ vùng quá nhỏ
- `min_area=5000`: Chỉ lấy vùng lớn

### Định nghĩa màu thủ công

Nếu biết chính xác màu từng loại đất:

```python
# Thêm vào main() function
soil_colors = {
    "Đất phù sa": (139, 69, 19),      # BGR: nâu
    "Đất phèn": (71, 99, 255),        # BGR: đỏ cam
    "Đất mặn": (235, 206, 135),       # BGR: xanh nhạt
    "Đất cát": (179, 222, 245),       # BGR: vàng cát
}

# Thay dòng
zones = digitizer.auto_digitize(soil_colors=soil_colors, min_area=1000)
```

**Cách lấy màu BGR:**
1. Mở ảnh trong Paint/Photoshop
2. Dùng Color Picker
3. Lấy RGB (R, G, B)
4. Đảo ngược thành BGR: (B, G, R)

---

## 🔧 Xử lý lỗi thường gặp

### Lỗi 1: Import error

```
ImportError: No module named 'cv2'
```

**Giải pháp:**
```powershell
pip install opencv-python
```

### Lỗi 2: Không tìm thấy vùng nào

```
❌ Không tìm thấy vùng nào!
```

**Nguyên nhân:**
- Màu sắc trong ảnh quá nhiễu
- `min_area` quá cao
- `tolerance` quá thấp

**Giải pháp:**
1. Giảm `min_area` xuống 100-500
2. Tăng `tolerance` lên 50-60
3. Kiểm tra ảnh có rõ nét không

### Lỗi 3: Polygon méo/không chính xác

**Nguyên nhân:**
- GPS bounds sai
- Ảnh bị méo/perspective

**Giải pháp:**
1. Kiểm tra lại GPS bounds (north/south/east/west)
2. Dùng ảnh đã được georeferenced
3. Nếu ảnh méo, cần rectify trước (dùng QGIS)

### Lỗi 4: RAM không đủ với ảnh lớn

**Giải pháp:**
```python
# Resize ảnh trước khi xử lý (thêm vào __init__)
max_dimension = 3000
if self.width > max_dimension or self.height > max_dimension:
    scale = max_dimension / max(self.width, self.height)
    new_width = int(self.width * scale)
    new_height = int(self.height * scale)
    self.img = cv2.resize(self.img, (new_width, new_height))
    self.width, self.height = new_width, new_height
```

---

## 📈 So sánh với các phương pháp khác

| Phương pháp | Thời gian | Độ chính xác | Cấu hình máy | Skill cần |
|-------------|-----------|--------------|--------------|-----------|
| **Auto Digitize (Script này)** | ⚡ 1-5 phút | ⭐⭐⭐ 70-85% | 💻 Thường | Python cơ bản |
| QGIS Digitize thủ công | 🐌 2-8 giờ | ⭐⭐⭐⭐⭐ 95%+ | 💻 Thường | GIS trung cấp |
| Google Earth Pro | 🐌 1-4 giờ | ⭐⭐⭐⭐ 90% | 💻 Thường | Đơn giản |
| Deep Learning (Mask R-CNN) | ⚡ 5-10 phút | ⭐⭐⭐⭐⭐ 90-95% | 🖥️ GPU mạnh | ML/AI cao cấp |

**Kết luận:**
- Script này tốt cho **bản đồ đơn giản, màu sắc rõ ràng**
- Nếu cần **độ chính xác cao → dùng QGIS**
- Nếu cần **xử lý hàng loạt → Deep Learning**

---

## 💡 Tips & Tricks

### 1. Chuẩn bị ảnh tốt nhất

**Ảnh lý tưởng:**
- ✅ Độ phân giải cao (2000x2000+)
- ✅ Màu sắc rõ ràng, tương phản cao
- ✅ Không có watermark/logo che khuất
- ✅ Đã được georeferenced (có GPS info)

**Xử lý ảnh trước:**
```python
# Tăng contrast
import cv2
img = cv2.imread('map.jpg')
lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
l, a, b = cv2.split(lab)
clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
l = clahe.apply(l)
enhanced = cv2.merge([l, a, b])
enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
cv2.imwrite('map_enhanced.jpg', enhanced)
```

### 2. Kiểm tra kết quả

Trước khi upload vào AgriPlanner:
1. Mở file `*_preview.jpg` kiểm tra polygon có đúng không
2. Mở file KMZ trong Google Earth Pro xem GPS có chính xác không
3. Nếu sai → điều chỉnh bounds hoặc tolerance

### 3. Batch processing nhiều ảnh

```python
# batch_digitize.py
import os
from auto_digitize import MapDigitizer

image_dir = "E:/maps/soil_maps/"
bounds = (9.9, 8.5, 105.8, 104.5)  # north, south, east, west

for filename in os.listdir(image_dir):
    if filename.endswith('.jpg') or filename.endswith('.png'):
        print(f"\n{'='*50}\nProcessing: {filename}\n{'='*50}")
        
        img_path = os.path.join(image_dir, filename)
        digitizer = MapDigitizer(img_path)
        digitizer.set_bounds(*bounds)
        
        zones = digitizer.auto_digitize(min_area=1000)
        
        base_name = os.path.splitext(filename)[0]
        digitizer.export_kmz(zones, f"{base_name}.kmz")
```

---

## 📚 Tài liệu tham khảo

### Computer Vision Concepts

1. **Color Segmentation:**
   - K-means clustering để nhóm màu tương tự
   - HSV color space để phân tích màu sắc tốt hơn RGB

2. **Contour Detection:**
   - `cv2.findContours()` tìm đường viền
   - `cv2.approxPolyDP()` đơn giản hóa polygon

3. **Morphological Operations:**
   - `MORPH_CLOSE`: Lấp lỗ nhỏ
   - `MORPH_OPEN`: Loại bỏ nhiễu

### OpenCV Documentation

- Tutorials: https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html
- Contours: https://docs.opencv.org/4.x/d4/d73/tutorial_py_contours_begin.html

---

## ❓ FAQ

**Q: Có cần cài CUDA/GPU không?**
A: KHÔNG. Script này chỉ dùng CPU.

**Q: Mất bao lâu để xử lý 1 ảnh?**
A: 1-5 phút tùy kích thước ảnh và số màu.

**Q: Độ chính xác bao nhiêu %?**
A: 70-85% với ảnh rõ nét, màu sắc phân biệt. Cần kiểm tra và chỉnh sửa thủ công sau.

**Q: File KMZ có tương thích với AgriPlanner không?**
A: CÓ. Đây là Vector KMZ với polygon thật, không phải GroundOverlay.

**Q: Có thể chạy trên macOS/Linux không?**
A: CÓ. Script cross-platform.

---

## 🎓 Học thêm

Nếu muốn tìm hiểu sâu hơn về Computer Vision:

1. **OpenCV Python Tutorial** (Miễn phí)
   - https://www.learnopencv.com/

2. **Digital Image Processing** (Coursera)
   - Giảng bởi Duke University

3. **Remote Sensing & GIS** (YouTube)
   - Sentinel Hub tutorials

---

**Lưu ý cuối:** Script này là công cụ hỗ trợ, không thay thế hoàn toàn việc digitize thủ công. Sau khi auto digitize, nên:
1. Kiểm tra kết quả trong Google Earth
2. Chỉnh sửa/bổ sung thủ công nếu cần
3. Verify GPS coordinates
4. Upload vào AgriPlanner
