#!/usr/bin/env python3
"""
Script để phân tích màu từ hình ảnh chú thích (legend) của bản đồ thổ nhưỡng.
Trích xuất các màu theo thứ tự từ trên xuống để mapping với tên loại đất.
"""

import cv2
import numpy as np
import sys
from collections import Counter

def rgb_to_hex(r, g, b):
    """Convert RGB to hex string"""
    return "#{:02x}{:02x}{:02x}".format(int(r), int(g), int(b))

def analyze_legend_colors(image_path):
    """
    Phân tích màu từ ảnh chú thích theo thứ tự từ trên xuống.
    Giả sử legend có dạng: [màu] [tên loại đất] theo hàng
    """
    print(f"\n=== PHÂN TÍCH MÀU CHÚ THÍCH ===")
    print(f"File: {image_path}")
    
    # Đọc ảnh
    image = cv2.imread(image_path)
    if image is None:
        print(f"ERROR: Không thể đọc file: {image_path}")
        return
    
    # Convert BGR to RGB
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    h, w = image.shape[:2]
    print(f"Kích thước ảnh: {w}x{h}")
    
    # Soil type names in order (from the legend image)
    soil_types = [
        "Đất cát giồng",
        "Đất mặn nhiều", 
        "Đất mặn trung bình",
        "Đất mặn ít",
        "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
        "Đất phèn tiềm tàng nông, mặn nhiều",
        "Đất phèn tiềm tàng nông, mặn trung bình",
        "Đất phèn tiềm tàng nông, mặn ít",
        "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",
        "Đất phèn tiềm tàng sâu, mặn nhiều",
        "Đất phèn tiềm tàng sâu, mặn trung bình",
        "Đất phèn tiềm tàng sâu, mặn ít",
        "Đất phèn hoạt động nông, mặn nhiều",
        "Đất phèn hoạt động nông, mặn trung bình",
        "Đất phèn hoạt động nông, mặn ít",
        "Đất phèn hoạt động sâu, mặn nhiều",
        "Đất phèn hoạt động sâu, mặn trung bình",
        "Đất phèn hoạt động sâu, mặn ít",
        "Đất than bùn phèn mặn",
        "Đất vàng đỏ trên đá Macma axit",
        "Sông, suối, ao hồ",
        "Bãi bồi ven sông, ven biển"
    ]
    
    # Method 1: Scan left edge in horizontal strips
    print("\n--- PHƯƠNG PHÁP 1: Quét dải ngang bên trái ---")
    
    # Assuming color squares are on the left side
    color_strip_width = int(w * 0.1)  # First 10% of width
    strip_height = h // len(soil_types)
    
    extracted_colors = []
    
    for i, soil_type in enumerate(soil_types):
        # Calculate y position for this row
        y_start = int(i * strip_height + strip_height * 0.2)
        y_end = int(i * strip_height + strip_height * 0.8)
        
        if y_end > h:
            y_end = h
        if y_start >= y_end:
            continue
            
        # Extract color from left strip
        strip = image_rgb[y_start:y_end, 5:color_strip_width]
        
        if strip.size == 0:
            continue
            
        # Get dominant color in this strip
        pixels = strip.reshape(-1, 3)
        
        # Filter out white/near-white and black pixels
        valid_pixels = []
        for p in pixels:
            r, g, b = int(p[0]), int(p[1]), int(p[2])
            # Skip white-ish
            if r > 245 and g > 245 and b > 245:
                continue
            # Skip black-ish  
            if r < 15 and g < 15 and b < 15:
                continue
            # Skip gray
            if abs(r-g) < 10 and abs(g-b) < 10 and abs(r-b) < 10 and r < 200:
                continue
            valid_pixels.append((r, g, b))
        
        if valid_pixels:
            # Get most common color
            color_counts = Counter(valid_pixels)
            dominant_color = color_counts.most_common(1)[0][0]
            r, g, b = dominant_color
            hex_color = rgb_to_hex(r, g, b)
            
            extracted_colors.append({
                'index': i,
                'soil_type': soil_type,
                'rgb': (r, g, b),
                'hex': hex_color
            })
            print(f"  [{i+1:2d}] {hex_color} RGB({r:3d},{g:3d},{b:3d}) - {soil_type}")
    
    # Method 2: K-means clustering on left portion
    print("\n--- PHƯƠNG PHÁP 2: K-means trên phần trái ảnh ---")
    
    left_portion = image_rgb[:, :int(w*0.15)]
    pixels = left_portion.reshape(-1, 3).astype(np.float32)
    
    # Filter pixels
    mask = np.ones(len(pixels), dtype=bool)
    # Remove white
    mask &= ~((pixels[:, 0] > 240) & (pixels[:, 1] > 240) & (pixels[:, 2] > 240))
    # Remove black
    mask &= ~((pixels[:, 0] < 20) & (pixels[:, 1] < 20) & (pixels[:, 2] < 20))
    
    filtered_pixels = pixels[mask]
    
    if len(filtered_pixels) > 100:
        # K-means with more clusters than soil types
        n_colors = min(30, len(soil_types) + 10)
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
        _, labels, centers = cv2.kmeans(filtered_pixels, n_colors, None, criteria, 5, cv2.KMEANS_RANDOM_CENTERS)
        
        # Count pixels per cluster
        label_counts = Counter(labels.flatten())
        
        print(f"  Tìm thấy {n_colors} cụm màu chính:")
        sorted_colors = []
        for idx, count in label_counts.most_common():
            center = centers[idx]
            r, g, b = int(center[0]), int(center[1]), int(center[2])
            hex_color = rgb_to_hex(r, g, b)
            percentage = (count / len(filtered_pixels)) * 100
            if percentage > 0.5:  # Only show colors > 0.5%
                sorted_colors.append((hex_color, r, g, b, percentage))
                print(f"    {hex_color} RGB({r:3d},{g:3d},{b:3d}) - {percentage:.1f}%")
    
    # Output Java code for mock data
    print("\n\n=== JAVA MOCK DATA CODE ===")
    print("// Copy this to MultiAIOrchestrator.java KNOWN_COLOR_MAPPINGS")
    print("Map<String, String> caMauSoilColors = new LinkedHashMap<>();")
    
    for item in extracted_colors:
        hex_c = item['hex']
        soil = item['soil_type']
        print(f'caMauSoilColors.put("{hex_c}", "{soil}");')
    
    return extracted_colors

def analyze_from_clipboard_or_file():
    """Try to analyze from provided image path"""
    if len(sys.argv) < 2:
        print("Usage: python analyze_legend_colors.py <image_path>")
        print("Example: python analyze_legend_colors.py legend.jpg")
        return
    
    image_path = sys.argv[1]
    analyze_legend_colors(image_path)

if __name__ == "__main__":
    analyze_from_clipboard_or_file()
