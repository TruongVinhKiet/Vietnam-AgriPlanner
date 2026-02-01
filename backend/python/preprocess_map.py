#!/usr/bin/env python3
"""
Map Image Preprocessing Script
Loại bỏ nền trắng, logo, legend và giữ lại phần bản đồ chính.

Usage:
    python preprocess_map.py <input_image> <output_image>
"""

import cv2
import numpy as np
import sys
import os
from pathlib import Path

def log(message):
    """Print log message with timestamp"""
    print(f"[OpenCV] {message}")

def find_map_region(image):
    """
    Tìm vùng bản đồ chính bằng cách detect đường viền lớn nhất không phải trắng
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Threshold để tìm các vùng không phải trắng
    _, thresh = cv2.threshold(gray, 250, 255, cv2.THRESH_BINARY_INV)
    
    # Tìm contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        log("Không tìm thấy contours")
        return None
    
    # Tìm contour lớn nhất (thường là bản đồ)
    largest_contour = max(contours, key=cv2.contourArea)
    
    # Lấy bounding rectangle
    x, y, w, h = cv2.boundingRect(largest_contour)
    
    # Mở rộng một chút để không cắt mất viền
    padding = 10
    x = max(0, x - padding)
    y = max(0, y - padding)
    w = min(image.shape[1] - x, w + 2 * padding)
    h = min(image.shape[0] - y, h + 2 * padding)
    
    return (x, y, w, h)

def remove_white_background(image):
    """
    Chuyển nền trắng thành trong suốt (cho PNG) hoặc giữ nguyên
    """
    # Tạo mask cho các pixel gần trắng
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Định nghĩa ngưỡng cho màu trắng
    lower_white = np.array([0, 0, 240])
    upper_white = np.array([180, 30, 255])
    
    # Tạo mask
    white_mask = cv2.inRange(hsv, lower_white, upper_white)
    
    # Đảo ngược mask (giữ lại phần không trắng)
    mask = cv2.bitwise_not(white_mask)
    
    return mask

def detect_legend_region(image):
    """
    Phát hiện vùng chú thích (legend) thường ở góc
    Trả về mask để loại bỏ
    """
    h, w = image.shape[:2]
    
    # Legend thường ở các vị trí:
    # - Góc trái dưới
    # - Góc phải dưới  
    # - Góc trái trên
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Tìm vùng có nhiều text (variance cao)
    legend_regions = []
    
    # Kiểm tra góc trái dưới (25% x 40%)
    roi_lb = gray[int(h*0.6):h, 0:int(w*0.25)]
    if np.std(roi_lb) > 40:  # Có nhiều chi tiết = có thể là legend
        legend_regions.append(('left_bottom', int(h*0.6), h, 0, int(w*0.25)))
    
    # Kiểm tra góc phải trên (mini map thường ở đây)
    roi_rt = gray[0:int(h*0.25), int(w*0.75):w]
    if np.std(roi_rt) > 40:
        legend_regions.append(('right_top', 0, int(h*0.25), int(w*0.75), w))
    
    return legend_regions

def crop_map_smart(image_path, output_path):
    """
    Thông minh crop bản đồ:
    1. Detect vùng bản đồ chính
    2. Loại bỏ nền trắng xung quanh
    3. Loại bỏ legend/mini-map nếu cần
    """
    log(f"Đang xử lý: {image_path}")
    
    # Đọc ảnh
    image = cv2.imread(image_path)
    if image is None:
        log(f"Lỗi: Không thể đọc file {image_path}")
        return False
    
    original_h, original_w = image.shape[:2]
    log(f"Kích thước gốc: {original_w}x{original_h}")
    
    # Bước 1: Tìm vùng bản đồ chính
    map_region = find_map_region(image)
    
    if map_region:
        x, y, w, h = map_region
        log(f"Phát hiện vùng bản đồ: ({x}, {y}) - {w}x{h}")
        
        # Crop nếu vùng bản đồ nhỏ hơn đáng kể so với ảnh gốc
        if w < original_w * 0.95 or h < original_h * 0.95:
            image = image[y:y+h, x:x+w]
            log(f"Đã crop bản đồ: {w}x{h}")
    
    # Bước 2: Phát hiện và đánh dấu vùng legend
    legend_regions = detect_legend_region(image)
    
    for region in legend_regions:
        name, y1, y2, x1, x2 = region
        log(f"Phát hiện {name}: ({x1},{y1}) - ({x2},{y2})")
        # Không xóa legend vì có thể cần cho phân tích
        # Chỉ log để biết
    
    # Bước 3: Tăng cường màu sắc nhẹ để AI phân tích dễ hơn
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    enhanced = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
    
    # Bước 4: Resize nếu quá lớn (giữ tỷ lệ, max 2000px)
    max_dim = 2000
    h, w = enhanced.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)
        enhanced = cv2.resize(enhanced, (new_w, new_h), interpolation=cv2.INTER_AREA)
        log(f"Đã resize: {new_w}x{new_h}")
    
    # Lưu kết quả
    cv2.imwrite(output_path, enhanced)
    log(f"Đã lưu: {output_path}")
    
    return True

def extract_color_regions(image_path, output_dir):
    """
    Tách các vùng màu khác nhau thành các file riêng
    Hữu ích cho phân tích chi tiết
    """
    log(f"Đang tách màu từ: {image_path}")
    
    image = cv2.imread(image_path)
    if image is None:
        return []
    
    # Convert to HSV
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Định nghĩa các khoảng màu phổ biến trong bản đồ thổ nhưỡng
    color_ranges = {
        'yellow': ([20, 100, 100], [35, 255, 255]),      # Đất cát giồng
        'pink_light': ([150, 30, 150], [170, 100, 255]), # Đất mặn nhẹ
        'pink_dark': ([140, 80, 100], [160, 255, 255]),  # Đất mặn nhiều
        'purple_light': ([130, 30, 150], [150, 100, 255]), # Đất phèn tiềm tàng
        'purple_dark': ([130, 100, 50], [150, 255, 200]), # Đất phèn hoạt động
        'cyan': ([80, 100, 100], [100, 255, 255]),       # Sông suối
        'blue': ([100, 100, 100], [130, 255, 255]),      # Nước
    }
    
    extracted = []
    
    for color_name, (lower, upper) in color_ranges.items():
        lower = np.array(lower)
        upper = np.array(upper)
        
        # Tạo mask
        mask = cv2.inRange(hsv, lower, upper)
        
        # Đếm pixel
        pixel_count = cv2.countNonZero(mask)
        total_pixels = image.shape[0] * image.shape[1]
        percentage = (pixel_count / total_pixels) * 100
        
        if percentage > 0.5:  # Chỉ giữ các màu chiếm > 0.5%
            # Lưu mask
            output_path = os.path.join(output_dir, f"mask_{color_name}.png")
            cv2.imwrite(output_path, mask)
            
            extracted.append({
                'color': color_name,
                'percentage': round(percentage, 2),
                'pixel_count': pixel_count,
                'mask_path': output_path
            })
            
            log(f"  {color_name}: {percentage:.2f}%")
    
    return extracted

def main():
    if len(sys.argv) < 3:
        print("Usage: python preprocess_map.py <input_image> <output_image>")
        print("       python preprocess_map.py <input_image> <output_dir> --extract-colors")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(input_path):
        log(f"Lỗi: File không tồn tại: {input_path}")
        sys.exit(1)
    
    if len(sys.argv) > 3 and sys.argv[3] == '--extract-colors':
        # Mode: tách màu
        os.makedirs(output_path, exist_ok=True)
        result = extract_color_regions(input_path, output_path)
        if result:
            log(f"Đã tách {len(result)} vùng màu")
            for r in result:
                print(f"  - {r['color']}: {r['percentage']}%")
    else:
        # Mode: crop & enhance
        success = crop_map_smart(input_path, output_path)
        if success:
            log("Xử lý hoàn tất!")
            sys.exit(0)
        else:
            log("Xử lý thất bại!")
            sys.exit(1)

if __name__ == "__main__":
    main()
