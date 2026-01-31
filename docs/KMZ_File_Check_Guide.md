# Hướng dẫn kiểm tra file KMZ

## Vấn đề hiện tại
Hệ thống có thể xử lý 2 loại KMZ:
- ✅ **Vector KMZ** - Có polygon coordinates (lưu vào database như vùng thật)
- ❌ **Raster KMZ** - Chỉ là hình ảnh overlay (lưu như ảnh, không có geometry)

## Cách kiểm tra file KMZ của bạn

### Bước 1: Giải nén file KMZ
```bash
# KMZ là file ZIP, đổi tên thành .zip rồi giải nén
ren camau_soil.kmz camau_soil.zip
unzip camau_soil.zip
```

### Bước 2: Mở file doc.kml hoặc *.kml bên trong
Tìm xem có các thẻ XML nào:

#### ✅ VECTOR KMZ (TỐT - có polygon thật)
```xml
<Placemark>
  <name>Đất phù sa</name>
  <Polygon>
    <outerBoundaryIs>
      <LinearRing>
        <coordinates>
          105.123,9.456,0
          105.234,9.567,0
          105.345,9.678,0
          105.123,9.456,0
        </coordinates>
      </LinearRing>
    </outerBoundaryIs>
  </Polygon>
  <Style>
    <PolyStyle>
      <color>ff0000ff</color>
    </PolyStyle>
  </Style>
</Placemark>
```

#### ❌ RASTER KMZ (XẤU - chỉ là ảnh)
```xml
<GroundOverlay>
  <name>Bản đồ thổ nhưỡng</name>
  <Icon>
    <href>kml_overlay_0.png</href>
  </Icon>
  <LatLonBox>
    <north>10.5</north>
    <south>9.5</south>
    <east>106.0</east>
    <west>105.0</west>
  </LatLonBox>
</GroundOverlay>
```

## Cách tạo Vector KMZ từ ảnh bản đồ

### Phương pháp 1: Dùng QGIS (Miễn phí, mạnh)

1. **Cài đặt QGIS**: https://qgis.org/download/

2. **Georeferencing ảnh**:
   ```
   Raster → Georeferencer
   - Mở ảnh bản đồ (.jpg/.png)
   - Add Point: Click vào góc ảnh → nhập tọa độ GPS thật (lat/lon)
   - Cần tối thiểu 4 điểm góc
   - Transformation: Polynomial 1
   - Target SRS: EPSG:4326 (WGS84)
   - Run → Lưu file GeoTIFF
   ```

3. **Digitize thủ công**:
   ```
   Layer → Create Layer → New Shapefile Layer
   - Geometry: Polygon
   - CRS: EPSG:4326
   
   Toggle Editing → Add Polygon Feature
   - Vẽ theo từng vùng màu
   - Nhập thuộc tính (tên đất, loại đất)
   
   Save Edits
   ```

4. **Export KMZ**:
   ```
   Right-click layer → Export → Save Features As
   - Format: KML/KMZ
   - CRS: EPSG:4326
   - Altitude Mode: clampToGround
   ✅ Export style: Yes
   ```

### Phương pháp 2: Google Earth Pro (Đơn giản hơn)

1. **Cài Google Earth Pro** (miễn phí)

2. **Thêm ảnh overlay**:
   ```
   Add → Image Overlay
   - Browse → chọn ảnh bản đồ
   - Kéo góc để căn chỉnh tọa độ
   - OK
   ```

3. **Vẽ polygon**:
   ```
   Add → Polygon
   - Vẽ theo từng vùng màu
   - Properties:
     * Name: "Đất phù sa"
     * Description: Thông tin chi tiết
     * Style/Color: Chọn màu
   - OK
   ```

4. **Lưu KMZ**:
   ```
   Right-click folder → Save Place As
   - Save as type: KMZ
   ```

### Phương pháp 3: Dùng Python Script (Tự động hóa)

```python
# Cần cài: pip install opencv-python shapely fiona
import cv2
import numpy as np
from shapely.geometry import Polygon
import fiona
from fiona.crs import from_epsg

# 1. Load ảnh
img = cv2.imread('camau_soil_map.jpg')

# 2. Phân loại theo màu (ví dụ: tìm vùng hồng = đất phù sa)
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
lower_pink = np.array([140, 50, 50])
upper_pink = np.array([170, 255, 255])
mask = cv2.inRange(hsv, lower_pink, upper_pink)

# 3. Tìm contours
contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# 4. Chuyển pixel coordinates → GPS coordinates
# Cần biết bounds thật: (north, south, east, west)
north, south = 10.5, 9.5  # Ví dụ
east, west = 106.0, 105.0

def pixel_to_gps(x, y, img_width, img_height):
    lon = west + (east - west) * (x / img_width)
    lat = north - (north - south) * (y / img_height)
    return (lon, lat)

# 5. Tạo shapefile
schema = {
    'geometry': 'Polygon',
    'properties': {'name': 'str', 'soil_type': 'str'}
}

with fiona.open('soil_zones.shp', 'w', 'ESRI Shapefile', schema, crs=from_epsg(4326)) as output:
    for cnt in contours:
        if cv2.contourArea(cnt) < 100:  # Bỏ vùng nhỏ
            continue
        
        # Chuyển contour sang GPS
        gps_coords = [pixel_to_gps(pt[0][0], pt[0][1], img.shape[1], img.shape[0]) 
                      for pt in cnt]
        
        poly = Polygon(gps_coords)
        output.write({
            'geometry': mapping(poly),
            'properties': {'name': 'Đất phù sa', 'soil_type': 'PS'}
        })

# 6. Convert shapefile → KMZ bằng QGIS/ogr2ogr
```

## Cách upload vào hệ thống AgriPlanner

### Sau khi có file KMZ vector:

1. **Đăng nhập admin**: http://localhost:8080/pages/admin.html
2. **Tab "Quy hoạch & Bản đồ"**
3. **Chọn loại bản đồ**:
   - ⚪ Quy hoạch (cho file quy hoạch sử dụng đất)
   - ⚪ Thổ nhưỡng (cho file bản đồ đất)
4. **Upload KMZ**: Chọn file → Upload
5. **Kiểm tra**:
   - Vào trang Canh tác (cultivation.html)
   - Bật nút "🌱 Lớp thổ nhưỡng" để xem

## Lưu ý quan trọng

### ✅ File KMZ TỐT phải có:
- Nhiều `<Placemark>` với `<Polygon>` hoặc `<MultiGeometry>`
- `<coordinates>` với định dạng: `lon,lat,alt lon,lat,alt ...`
- Style với màu sắc riêng cho mỗi loại đất

### ❌ File KMZ XẤU (không dùng được):
- Chỉ có `<GroundOverlay>` với ảnh PNG/JPG
- Không có `<coordinates>` thật
- Hệ thống chỉ lưu ảnh, không có geometry

## Kiểm tra nhanh trong code

### Test file KMZ:
```bash
# Upload qua API
curl -X POST http://localhost:8080/api/admin/kmz/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@camau_soil.kmz" \
  -F "province=Cà Mau" \
  -F "district=Thới Bình" \
  -F "mapType=soil"

# Xem log backend để check
# Nếu thấy "Found X placemarks" → TỐT
# Nếu thấy "trying GroundOverlay parsing" → XẤU (chỉ là ảnh)
```

## Tổng kết

| Loại file | Có polygon? | Lưu vào DB | Hiển thị | Click được? |
|-----------|-------------|------------|----------|-------------|
| Vector KMZ | ✅ Có | ✅ Geometry thật | ✅ Như layer | ✅ Có thông tin |
| Raster KMZ | ❌ Không | ❌ Chỉ ảnh | ⚠️ Như ảnh overlay | ❌ Không |

**Khuyến nghị**: Dùng QGIS để digitize ảnh → tạo Vector KMZ
