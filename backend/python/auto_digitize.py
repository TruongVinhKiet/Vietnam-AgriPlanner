# -*- coding: utf-8 -*-
"""
Auto Digitization Tool - Chuyển ảnh bản đồ thành KMZ tự động
Sử dụng Computer Vision để phân tích màu sắc và tạo polygon

Yêu cầu:
- Python 3.8+
- Laptop thường (KHÔNG CẦN GPU)
- RAM: 4GB+ là đủ

Modes:
- analyze: Chỉ phân tích và trả về JSON (cho AI Analysis)
- full: Phân tích + tạo KMZ/GeoJSON
"""

import cv2
import numpy as np
import os
import sys
from pathlib import Path
import json
import argparse

# Cài đặt: pip install opencv-python numpy simplekml
try:
    import simplekml
except ImportError:
    simplekml = None
    # Chỉ warning nếu cần export KMZ
    pass

class MapDigitizer:
    """Tự động digitize bản đồ thổ nhưỡng"""
    
    # Bảng màu chuẩn cho đất thổ nhưỡng Cà Mau (theo chú dẫn bản đồ gốc)
    # Format: RGB color -> {"name": tên loại đất, "code": mã}
    SOIL_COLOR_MAP = {
        # === ĐẤT CÁT GIỒNG - Vàng tươi ===
        (255, 255, 0): {"name": "Đất cát giồng", "code": "CG"},
        (255, 255, 50): {"name": "Đất cát giồng", "code": "CG"},
        (255, 255, 100): {"name": "Đất cát giồng", "code": "CG"},
        
        # === ĐẤT MẶN - Hồng nhạt/Cam nhạt ===
        (255, 200, 180): {"name": "Đất mặn nhiều", "code": "M1"},
        (255, 210, 190): {"name": "Đất mặn trung bình", "code": "M2"},
        (255, 220, 200): {"name": "Đất mặn ít", "code": "M3"},
        (255, 180, 160): {"name": "Đất mặn nhiều", "code": "M1"},
        
        # === ĐẤT PHÈN TIỀM TÀNG NÔNG (dưới rừng ngập mặn) - Tím nhạt ===
        (230, 200, 255): {"name": "Đất phèn tiềm tàng nông dưới rừng ngập mặn", "code": "PHTN-RNM"},
        (220, 190, 250): {"name": "Đất phèn tiềm tàng nông dưới rừng ngập mặn", "code": "PHTN-RNM"},
        
        # === ĐẤT PHÈN TIỀM TÀNG NÔNG - Tím/Hồng tím ===
        (200, 150, 200): {"name": "Đất phèn tiềm tàng nông, mặn nhiều", "code": "PHTN-M1"},
        (210, 160, 210): {"name": "Đất phèn tiềm tàng nông, mặn trung bình", "code": "PHTN-M2"},
        (220, 180, 220): {"name": "Đất phèn tiềm tàng nông, mặn ít", "code": "PHTN-M3"},
        (180, 130, 180): {"name": "Đất phèn tiềm tàng nông, mặn nhiều", "code": "PHTN-M1"},
        
        # === ĐẤT PHÈN TIỀM TÀNG SÂU (dưới rừng ngập mặn) - Xanh nhạt ===
        (200, 220, 255): {"name": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn", "code": "PHTS-RNM"},
        (180, 200, 240): {"name": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn", "code": "PHTS-RNM"},
        
        # === ĐẤT PHÈN TIỀM TÀNG SÂU - Hồng/Tím ===
        (240, 180, 220): {"name": "Đất phèn tiềm tàng sâu, mặn nhiều", "code": "PHTS-M1"},
        (230, 190, 230): {"name": "Đất phèn tiềm tàng sâu, mặn trung bình", "code": "PHTS-M2"},
        (220, 200, 235): {"name": "Đất phèn tiềm tàng sâu, mặn ít", "code": "PHTS-M3"},
        
        # === ĐẤT PHÈN HOẠT ĐỘNG NÔNG - Hồng đậm/Magenta ===
        (255, 100, 150): {"name": "Đất phèn hoạt động nông, mặn nhiều", "code": "PHHN-M1"},
        (255, 120, 170): {"name": "Đất phèn hoạt động nông, mặn trung bình", "code": "PHHN-M2"},
        (255, 150, 190): {"name": "Đất phèn hoạt động nông, mặn ít", "code": "PHHN-M3"},
        (230, 80, 130): {"name": "Đất phèn hoạt động nông, mặn nhiều", "code": "PHHN-M1"},
        
        # === ĐẤT PHÈN HOẠT ĐỘNG SÂU - Đỏ tím/Hồng đậm ===
        (220, 80, 120): {"name": "Đất phèn hoạt động sâu, mặn nhiều", "code": "PHHS-M1"},
        (200, 100, 150): {"name": "Đất phèn hoạt động sâu, mặn trung bình", "code": "PHHS-M2"},
        (180, 120, 170): {"name": "Đất phèn hoạt động sâu, mặn ít", "code": "PHHS-M3"},
        
        # === ĐẤT THAN BÙN PHÈN MẶN - Tím đậm ===
        (100, 50, 130): {"name": "Đất than bùn phèn mặn", "code": "TB"},
        (80, 40, 110): {"name": "Đất than bùn phèn mặn", "code": "TB"},
        (75, 0, 130): {"name": "Đất than bùn phèn mặn", "code": "TB"},
        
        # === ĐẤT VÀNG ĐỎ TRÊN ĐÁ MACMA AXIT - Cam/Đỏ cam ===
        (255, 160, 130): {"name": "Đất vàng đỏ trên đá Macma axit", "code": "VD"},
        (255, 140, 110): {"name": "Đất vàng đỏ trên đá Macma axit", "code": "VD"},
        (255, 127, 80): {"name": "Đất vàng đỏ trên đá Macma axit", "code": "VD"},
        
        # === SÔNG SUỐI, AO HỒ - Xanh cyan ===
        (0, 200, 200): {"name": "Sông, suối, ao hồ", "code": "SH"},
        (0, 180, 180): {"name": "Sông, suối, ao hồ", "code": "SH"},
        (100, 200, 220): {"name": "Sông, suối, ao hồ", "code": "SH"},
        (135, 206, 235): {"name": "Sông, suối, ao hồ", "code": "SH"},
        (173, 216, 230): {"name": "Sông, suối, ao hồ", "code": "SH"},
        
        # === BÃI BỒI VEN SÔNG, VEN BIỂN - Xanh ngọc nhạt ===
        (180, 230, 230): {"name": "Bãi bồi ven sông, ven biển", "code": "BB"},
        (200, 240, 240): {"name": "Bãi bồi ven sông, ven biển", "code": "BB"},
        (64, 224, 208): {"name": "Bãi bồi ven sông, ven biển", "code": "BB"},
        
        # === ĐẤT PHÙ SA - Xanh lá nhạt ===
        (144, 238, 144): {"name": "Đất phù sa ngọt", "code": "PSN"},
        (152, 251, 152): {"name": "Đất phù sa", "code": "PS"},
        (180, 255, 180): {"name": "Đất phù sa", "code": "PS"},
        
        # === ĐẤT XÁM - Xám ===
        (169, 169, 169): {"name": "Đất xám", "code": "X"},
        (192, 192, 192): {"name": "Đất xám", "code": "X"},
        (150, 150, 150): {"name": "Đất xám", "code": "X"},
    }
    
    # Bảng màu cho bản đồ QUY HOẠCH sử dụng đất
    PLANNING_COLOR_MAP = {
        # === ĐẤT NÔNG NGHIỆP ===
        # Đất trồng lúa - Vàng nhạt
        (255, 255, 200): {"name": "Đất trồng lúa khác", "code": "LUK"},
        (255, 255, 180): {"name": "Đất chuyên trồng lúa nước", "code": "LUC"},
        
        # Đất trồng cây - Cam/Vàng cam
        (255, 200, 150): {"name": "Đất trồng cây hàng năm khác", "code": "HNK"},
        (255, 220, 180): {"name": "Đất trồng cây lâu năm", "code": "CLN"},
        
        # Đất nuôi trồng thủy sản - Xanh cyan
        (0, 200, 255): {"name": "Đất nuôi trồng thủy sản", "code": "NTS"},
        (100, 220, 255): {"name": "Đất nuôi trồng thủy sản", "code": "NTS"},
        
        # Đất nông nghiệp khác - Vàng
        (255, 220, 100): {"name": "Đất nông nghiệp khác", "code": "NKH"},
        
        # === ĐẤT PHI NÔNG NGHIỆP ===
        # Đất ở - Hồng
        (255, 180, 180): {"name": "Đất ở nông thôn", "code": "ONT"},
        (255, 150, 150): {"name": "Đất ở đô thị", "code": "ODT"},
        (255, 100, 100): {"name": "Đất ở đô thị", "code": "ODT"},
        
        # Đất công nghiệp - Tím/Xanh tím
        (180, 100, 200): {"name": "Đất khu công nghiệp", "code": "SKK"},
        (150, 80, 180): {"name": "Đất cụm công nghiệp", "code": "SKN"},
        
        # Đất giao thông - Đỏ/Cam đậm
        (255, 100, 50): {"name": "Đất giao thông", "code": "DGT"},
        (200, 80, 40): {"name": "Đất giao thông", "code": "DGT"},
        
        # Đất thủy lợi - Xanh dương
        (100, 150, 255): {"name": "Đất thủy lợi", "code": "DTL"},
        (80, 130, 230): {"name": "Đất thủy lợi", "code": "DTL"},
        
        # Đất quốc phòng/an ninh - Xanh đậm
        (0, 100, 0): {"name": "Đất quốc phòng", "code": "CQP"},
        (0, 80, 0): {"name": "Đất an ninh", "code": "CAN"},
        
        # Sông, kênh, suối - Xanh dương nhạt
        (150, 200, 255): {"name": "Sông, kênh rạch, suối", "code": "SON"},
        (180, 220, 255): {"name": "Sông, kênh rạch, suối", "code": "SON"},
    }
    
    def __init__(self, image_path, output_dir="output"):
        """
        Args:
            image_path: Đường dẫn ảnh bản đồ
            output_dir: Thư mục lưu kết quả
        """
        self.image_path = image_path
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        # Đọc ảnh
        print(f"📖 Đọc ảnh: {image_path}", file=sys.stderr)
        self.img_original = cv2.imread(image_path)
        if self.img_original is None:
            raise ValueError(f"❌ Không đọc được ảnh: {image_path}")
        
        # Xử lý ảnh: loại bỏ nền trắng và phần thừa
        self.img = self._preprocess_image(self.img_original)
        
        self.height, self.width = self.img.shape[:2]
        print(f"   Kích thước sau xử lý: {self.width}x{self.height} pixels", file=sys.stderr)
        
        # Bounding box GPS (cần cung cấp từ bản đồ gốc)
        # Mặc định: Cà Mau
        self.north = 9.9
        self.south = 8.5
        self.east = 105.8
        self.west = 104.5
        
        # Store original image URL for display
        self.original_image_path = image_path
        
    def _preprocess_image(self, img):
        """
        Tiền xử lý ảnh: loại bỏ nền trắng, đường viền, chú thích
        Chỉ giữ lại phần bản đồ chính
        """
        print("🔧 Tiền xử lý ảnh...", file=sys.stderr)
        
        # Chuyển sang grayscale để tìm vùng bản đồ
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Tìm vùng không phải màu trắng (bản đồ)
        # Ngưỡng 240 để loại bỏ nền trắng
        _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
        
        # Morphology để làm sạch
        kernel = np.ones((5, 5), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        
        # Tìm contour lớn nhất (vùng bản đồ chính)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            print("   Không tìm thấy vùng bản đồ, giữ nguyên ảnh", file=sys.stderr)
            return img
        
        # Tìm contour lớn nhất
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        total_area = img.shape[0] * img.shape[1]
        
        print(f"   Vùng bản đồ chiếm {(area/total_area)*100:.1f}% ảnh", file=sys.stderr)
        
        # Chỉ crop nếu vùng bản đồ nhỏ hơn 95% ảnh (có nhiều phần thừa)
        if area < total_area * 0.95:
            # Lấy bounding rect
            x, y, w, h = cv2.boundingRect(largest_contour)
            
            # Thêm padding
            padding = 10
            x = max(0, x - padding)
            y = max(0, y - padding)
            w = min(img.shape[1] - x, w + 2 * padding)
            h = min(img.shape[0] - y, h + 2 * padding)
            
            # Crop ảnh
            cropped = img[y:y+h, x:x+w]
            print(f"   Đã cắt từ ({x},{y}) kích thước {w}x{h}", file=sys.stderr)
            
            # Tạo mask và loại bỏ nền trắng
            mask = np.zeros((h, w), dtype=np.uint8)
            shifted_contour = largest_contour - [x, y]
            cv2.drawContours(mask, [shifted_contour], -1, 255, -1)
            
            # Áp dụng mask - giữ vùng bản đồ, đổi vùng ngoài thành trắng
            result = cropped.copy()
            result[mask == 0] = [255, 255, 255]
            
            return result
        
        return img
        
    def set_bounds(self, north, south, east, west):
        """Thiết lập bounding box GPS của ảnh"""
        self.north = north
        self.south = south
        self.east = east
        self.west = west
        print(f"📍 Bounding box: N={north}, S={south}, E={east}, W={west}", file=sys.stderr)
    
    def pixel_to_gps(self, x, y):
        """Chuyển tọa độ pixel sang GPS (lon, lat)"""
        lon = self.west + (self.east - self.west) * (x / self.width)
        lat = self.north - (self.north - self.south) * (y / self.height)
        return (lon, lat)
    
    def _find_closest_soil_type(self, bgr_color, tolerance=50):
        """
        Tìm loại đất phù hợp nhất với màu cho trước
        
        Args:
            bgr_color: Tuple (B, G, R)
            tolerance: Khoảng cách màu tối đa
            
        Returns:
            Dict với name, code hoặc None
        """
        min_distance = float('inf')
        best_match = None
        
        # Chuyển BGR sang RGB để so sánh
        rgb_color = (bgr_color[2], bgr_color[1], bgr_color[0])
        
        for ref_rgb, soil_info in self.SOIL_COLOR_MAP.items():
            # Tính khoảng cách Euclidean
            distance = np.sqrt(sum((a - b) ** 2 for a, b in zip(rgb_color, ref_rgb)))
            
            if distance < min_distance:
                min_distance = distance
                best_match = soil_info
        
        if min_distance <= tolerance:
            return best_match
        return None
    
    def detect_colors(self, num_colors=12):
        """
        Phát hiện các màu chủ đạo trong bản đồ
        
        Args:
            num_colors: Số màu cần phát hiện
            
        Returns:
            List[(B, G, R), count, soil_info] - Màu, số pixel, thông tin đất
        """
        print(f"\n🎨 Phát hiện {num_colors} màu chủ đạo...", file=sys.stderr)
        
        # Reshape ảnh thành list pixels
        pixels = self.img.reshape((-1, 3))
        pixels = np.float32(pixels)
        
        # K-means clustering để tìm màu chủ đạo
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(pixels, num_colors, None, criteria, 10, 
                                        cv2.KMEANS_PP_CENTERS)
        
        # Đếm số pixel mỗi màu
        centers = np.uint8(centers)
        unique_labels, counts = np.unique(labels, return_counts=True)
        
        # Sắp xếp theo số lượng giảm dần
        color_data = []
        for center, count in zip(centers, counts):
            # Bỏ màu trắng/đen (background)
            brightness = sum(center) / 3
            if brightness > 245 or brightness < 10:
                continue
            
            # Tìm loại đất tương ứng
            soil_info = self._find_closest_soil_type(tuple(center))
            
            color_data.append({
                'bgr': tuple(center),
                'count': int(count),
                'soil_info': soil_info
            })
        
        color_data.sort(key=lambda x: x['count'], reverse=True)
        
        # Hiển thị
        for i, data in enumerate(color_data):
            color = data['bgr']
            count = data['count']
            percent = (count / len(pixels)) * 100
            soil = data['soil_info']
            soil_name = soil['name'] if soil else "Chưa xác định"
            print(f"   {i+1}. RGB({color[2]},{color[1]},{color[0]}) - {percent:.1f}% - {soil_name}", file=sys.stderr)
        
        return color_data
    
    def create_color_mask(self, target_color, tolerance=30):
        """
        Tạo mask cho một màu cụ thể
        
        Args:
            target_color: (B, G, R)
            tolerance: Sai số cho phép
            
        Returns:
            Binary mask
        """
        lower = np.array([max(0, c - tolerance) for c in target_color])
        upper = np.array([min(255, c + tolerance) for c in target_color])
        
        mask = cv2.inRange(self.img, lower, upper)
        
        # Noise removal
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        
        return mask
    
    def extract_polygons(self, mask, min_area=100, max_area=None):
        """
        Trích xuất polygons từ mask
        
        Args:
            mask: Binary mask
            min_area: Diện tích tối thiểu (pixels)
            max_area: Diện tích tối đa (None = không giới hạn)
            
        Returns:
            List of contours
        """
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, 
                                       cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter theo diện tích
        valid_contours = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area:
                continue
            if max_area and area > max_area:
                continue
            
            # Simplify polygon (giảm số điểm)
            epsilon = 0.005 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            valid_contours.append(approx)
        
        return valid_contours
    
    def contour_to_gps_coords(self, contour):
        """Chuyển contour sang GPS coordinates"""
        coords = []
        for point in contour:
            x, y = point[0]
            lon, lat = self.pixel_to_gps(x, y)
            coords.append((lon, lat))
        
        # Đóng polygon
        if coords and coords[0] != coords[-1]:
            coords.append(coords[0])
        
        return coords
    
    def auto_digitize(self, soil_colors=None, min_area=500, output_mode='full'):
        """
        Tự động digitize toàn bộ bản đồ
        
        Args:
            soil_colors: Dict {tên_đất: (B, G, R)} hoặc None để tự động
            min_area: Diện tích tối thiểu (pixels)
            output_mode: 'full' - trả về zones với coords, 'analyze' - chỉ trả về thống kê màu
            
        Returns:
            Dict with zones, colorMapping, etc.
        """
        zones = []
        color_mapping = {}
        
        # Tự động phát hiện màu
        print("\n🤖 Chế độ tự động - phát hiện màu...", file=sys.stderr)
        detected_colors = self.detect_colors(num_colors=15)
        
        # Tạo color mapping cho frontend
        for data in detected_colors:
            bgr = data['bgr']
            soil_info = data['soil_info']
            hex_color = f"#{bgr[2]:02x}{bgr[1]:02x}{bgr[0]:02x}"
            
            if soil_info:
                color_mapping[hex_color] = {
                    'name': soil_info['name'],
                    'code': soil_info['code'],
                    'count': 0  # Sẽ update sau
                }
            else:
                color_mapping[hex_color] = {
                    'name': 'Chưa xác định',
                    'code': 'N/A',
                    'count': 0
                }
        
        print(f"\n🔍 Digitize {len(detected_colors)} loại màu...", file=sys.stderr)
        
        zone_idx = 0
        for data in detected_colors:
            bgr = data['bgr']
            soil_info = data['soil_info']
            hex_color = f"#{bgr[2]:02x}{bgr[1]:02x}{bgr[0]:02x}"
            
            soil_name = soil_info['name'] if soil_info else f"Vùng {zone_idx+1}"
            zone_code = soil_info['code'] if soil_info else 'N/A'
            
            print(f"\n   {soil_name}: RGB({bgr[2]},{bgr[1]},{bgr[0]})", file=sys.stderr)
            
            # Tạo mask
            mask = self.create_color_mask(bgr, tolerance=35)
            
            # Trích xuất polygons
            contours = self.extract_polygons(mask, min_area=min_area)
            print(f"   → Tìm thấy {len(contours)} vùng", file=sys.stderr)
            
            # Update count trong color_mapping
            if hex_color in color_mapping:
                color_mapping[hex_color]['count'] = len(contours)
            
            # Chuyển sang GPS và tạo zone objects
            for idx, contour in enumerate(contours):
                area_px = cv2.contourArea(contour)
                coords = self.contour_to_gps_coords(contour)
                
                if len(coords) < 4:  # Polygon cần ít nhất 3 điểm + 1 điểm đóng
                    continue
                
                # Tính tâm
                M = cv2.moments(contour)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    center_lon, center_lat = self.pixel_to_gps(cx, cy)
                else:
                    center_lon = sum(c[0] for c in coords) / len(coords)
                    center_lat = sum(c[1] for c in coords) / len(coords)
                
                # Tính diện tích m2 (ước tính)
                lat_deg_to_m = 111000  # 1 độ lat ≈ 111km
                lng_deg_to_m = 111000 * np.cos(np.radians(center_lat))
                
                # Sử dụng Shoelace formula cho polygon
                area_sqm = 0
                for i in range(len(coords) - 1):
                    lon1, lat1 = coords[i]
                    lon2, lat2 = coords[i + 1]
                    area_sqm += (lon1 * lng_deg_to_m) * (lat2 * lat_deg_to_m)
                    area_sqm -= (lon2 * lng_deg_to_m) * (lat1 * lat_deg_to_m)
                area_sqm = abs(area_sqm) / 2
                
                zones.append({
                    'name': f"{soil_name} #{idx+1}",
                    'soilType': soil_name,
                    'zoneCode': zone_code,
                    'fillColor': hex_color,
                    'color': hex_color,  # For backward compatibility
                    'coordinates': [[lat, lon] for lon, lat in coords],
                    'coords': coords,  # For backward compatibility
                    'centerLat': center_lat,
                    'centerLng': center_lon,
                    'areaSqm': area_sqm,
                    'area_px': area_px
                })
                zone_idx += 1
        
        print(f"\n✅ Tổng cộng: {len(zones)} vùng", file=sys.stderr)
        
        return {
            'zones': zones,
            'colorMapping': color_mapping,
            'totalZones': len(zones),
            'imagePath': self.original_image_path,
            'bounds': {
                'north': self.north,
                'south': self.south,
                'east': self.east,
                'west': self.west
            },
            'source': 'auto_digitize'
        }
    
    def export_kmz(self, zones, output_name="output.kmz"):
        """Export zones ra file KMZ"""
        output_path = os.path.join(self.output_dir, output_name)
        print(f"\n💾 Export KMZ: {output_path}")
        
        kml = simplekml.Kml()
        
        for zone in zones:
            # Tạo polygon
            pol = kml.newpolygon(name=zone['name'])
            pol.outerboundaryis = zone['coords']
            
            # Style
            pol.style.linestyle.color = simplekml.Color.black
            pol.style.linestyle.width = 1
            
            # Chuyển #RRGGBB sang AABBGGRR (KML format)
            color_hex = zone['color'][1:]  # Bỏ #
            r = color_hex[0:2]
            g = color_hex[2:4]
            b = color_hex[4:6]
            kml_color = f"88{b}{g}{r}"  # 88 = alpha (55% opacity)
            
            pol.style.polystyle.color = kml_color
            pol.style.polystyle.fill = 1
            pol.style.polystyle.outline = 1
            
            # Description
            pol.description = f"Diện tích: ~{zone['area_px']} pixels"
        
        # Save
        kml.savekmz(output_path)
        print(f"✅ Đã lưu {len(zones)} vùng vào {output_path}")
        
        return output_path
    
    def export_geojson(self, zones, output_name="output.geojson"):
        """Export zones ra file GeoJSON"""
        output_path = os.path.join(self.output_dir, output_name)
        print(f"\n💾 Export GeoJSON: {output_path}")
        
        features = []
        for zone in zones:
            # Đổi (lon, lat) thành [lon, lat]
            coords_array = [[list(c) for c in zone['coords']]]
            
            feature = {
                "type": "Feature",
                "properties": {
                    "name": zone['name'],
                    "color": zone['color'],
                    "area_px": zone['area_px']
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": coords_array
                }
            }
            features.append(feature)
        
        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Đã lưu {len(zones)} vùng vào {output_path}")
        return output_path
    
    def visualize(self, zones, output_name="preview.jpg"):
        """Vẽ preview các vùng đã digitize"""
        output_path = os.path.join(self.output_dir, output_name)
        
        preview = self.img.copy()
        
        for zone in zones:
            # Chuyển GPS coords về pixel coords
            pixel_coords = []
            for lon, lat in zone['coords']:
                x = int((lon - self.west) / (self.east - self.west) * self.width)
                y = int((self.north - lat) / (self.north - self.south) * self.height)
                pixel_coords.append([x, y])
            
            pts = np.array(pixel_coords, np.int32)
            pts = pts.reshape((-1, 1, 2))
            
            # Vẽ polygon
            color_hex = zone['color'][1:]
            b = int(color_hex[4:6], 16)
            g = int(color_hex[2:4], 16)
            r = int(color_hex[0:2], 16)
            
            cv2.polylines(preview, [pts], True, (0, 0, 255), 2)
            cv2.fillPoly(preview, [pts], (b, g, r), cv2.LINE_AA)
        
        # Blend
        output_img = cv2.addWeighted(self.img, 0.5, preview, 0.5, 0)
        
        cv2.imwrite(output_path, output_img)
        print(f"💾 Preview lưu tại: {output_path}")
        
        return output_path


def main():
    """
    Main function với argument parsing
    Hỗ trợ 2 modes:
    - CLI: python auto_digitize.py <image>
    - API: python auto_digitize.py --image <path> --output json --province <province>
    """
    parser = argparse.ArgumentParser(description='Auto Digitization Tool')
    parser.add_argument('image', nargs='?', help='Đường dẫn ảnh bản đồ')
    parser.add_argument('--image', dest='image_path', help='Đường dẫn ảnh (alternative)')
    parser.add_argument('--output', choices=['json', 'full'], default='full',
                       help='Output mode: json (cho API) hoặc full (tạo files)')
    parser.add_argument('--province', default='Cà Mau', help='Tỉnh/Thành phố')
    parser.add_argument('--district', default='', help='Quận/Huyện')
    parser.add_argument('--north', type=float, help='GPS North bound')
    parser.add_argument('--south', type=float, help='GPS South bound')
    parser.add_argument('--east', type=float, help='GPS East bound')
    parser.add_argument('--west', type=float, help='GPS West bound')
    parser.add_argument('--min-area', type=int, default=500, help='Diện tích tối thiểu (pixels)')
    
    args = parser.parse_args()
    
    # Xác định image path
    image_path = args.image or args.image_path
    if not image_path:
        print("❌ Thiếu đường dẫn ảnh!", file=sys.stderr)
        parser.print_help()
        sys.exit(1)
    
    # JSON mode - chỉ output JSON
    if args.output == 'json':
        try:
            digitizer = MapDigitizer(image_path)
            
            # Set bounds nếu có
            if args.north and args.south and args.east and args.west:
                digitizer.set_bounds(args.north, args.south, args.east, args.west)
            
            # Chạy phân tích
            result = digitizer.auto_digitize(min_area=args.min_area)
            
            # Thêm metadata
            result['province'] = args.province
            result['district'] = args.district
            
            # Output JSON to stdout
            print(json.dumps(result, ensure_ascii=False))
            
        except Exception as e:
            # Output error as JSON
            error_result = {
                'success': False,
                'error': str(e),
                'zones': [],
                'colorMapping': {},
                'totalZones': 0
            }
            print(json.dumps(error_result, ensure_ascii=False))
            sys.exit(1)
        
        return
    
    # Full mode - CLI với output files
    print("="*70, file=sys.stderr)
    print("🗺️  AUTO DIGITIZATION TOOL - Chuyển ảnh bản đồ thành KMZ", file=sys.stderr)
    print("="*70, file=sys.stderr)
    
    try:
        digitizer = MapDigitizer(image_path)
        
        # Set bounds nếu có
        if args.north and args.south and args.east and args.west:
            digitizer.set_bounds(args.north, args.south, args.east, args.west)
        else:
            print("\n⚠️  Sử dụng bounds mặc định (Cà Mau)", file=sys.stderr)
        
        # Chạy phân tích
        result = digitizer.auto_digitize(min_area=args.min_area)
        zones = result['zones']
        
        if not zones:
            print("\n❌ Không tìm thấy vùng nào!", file=sys.stderr)
            sys.exit(1)
        
        # Export
        if simplekml:
            base_name = Path(image_path).stem
            digitizer.export_kmz(zones, f"{base_name}_digitized.kmz")
            digitizer.export_geojson(zones, f"{base_name}_digitized.geojson")
            digitizer.visualize(zones, f"{base_name}_preview.jpg")
            
            print("\n" + "="*70, file=sys.stderr)
            print("✅ HOÀN THÀNH!", file=sys.stderr)
            print("="*70, file=sys.stderr)
            print(f"\n📁 Kết quả lưu trong thư mục: {digitizer.output_dir}/", file=sys.stderr)
        else:
            print("\n⚠️  simplekml không được cài đặt, không thể export KMZ", file=sys.stderr)
            
    except Exception as e:
        print(f"\n❌ Lỗi: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
