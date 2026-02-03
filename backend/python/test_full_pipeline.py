#!/usr/bin/env python3
"""
TEST TOÀN DIỆN QUY TRÌNH PHÂN TÍCH BẢN ĐỒ THỔ NHƯỠNG
====================================================

3 BƯỚC KIỂM TRA:
1. Xác định tọa độ từ mockdata (không cần Gemini/GitHub)
2. Trích xuất polygon - loại bỏ đường lưới cyan và sọc đen
3. Phân loại đất từ màu sắc

Test với: Cà Mau_Thổ Nhưỡng.jpeg
"""

import os
import sys
import json
import cv2
import numpy as np
from collections import Counter
from pathlib import Path

# ===========================
# MOCK DATA - CÀ MAU THỔ NHƯỠNG
# ===========================

MOCK_COORDINATES = {
    "ca_mau_tho_nhuong": {
        # Tọa độ chính xác 4 điểm:
        # P1: x=105, y=9.25 | P2: x=105.25, y=9.25
        # P3: x=105, y=9    | P4: x=105.25, y=9
        "sw": {"lat": 9.0, "lng": 105.0},     # P3 - Southwest corner
        "ne": {"lat": 9.25, "lng": 105.25},   # P2 - Northeast corner
        "center": {"lat": 9.125, "lng": 105.125},
        "scale": "1:100000",
        "province": "Cà Mau"
    }
}

# Color mappings from test_mock_colors.py
MOCK_COLOR_MAPPINGS = {
    # ĐẤT THAN BÙN PHÈN MẶN - Dark purple/blue
    "#28004c": "Đất than bùn phèn mặn",
    "#280050": "Đất than bùn phèn mặn",
    "#2c0050": "Đất than bùn phèn mặn",
    "#2c004c": "Đất than bùn phèn mặn",
    "#24004c": "Đất than bùn phèn mặn",
    "#240048": "Đất than bùn phèn mặn",
    "#300060": "Đất than bùn phèn mặn",
    
    # ĐẤT MẶN ÍT - Very light pink/white
    "#ffffff": "Đất mặn ít",
    "#fffcfc": "Đất mặn ít",
    "#fcfcfc": "Đất mặn ít",
    "#f8f8f8": "Đất mặn ít",
    "#f8fcfc": "Đất mặn ít",
    "#fcf8fc": "Đất mặn ít",
    "#f8f8fc": "Đất mặn ít",
    "#f4f4f4": "Đất mặn ít",
    "#f4fcfc": "Đất mặn ít",
    "#fcfcf8": "Đất mặn ít",
    "#f4f4f8": "Đất mặn ít",
    "#f8f4f8": "Đất mặn ít",
    "#f4f8f8": "Đất mặn ít",
    "#f4f8fc": "Đất mặn ít",
    "#fcf8f8": "Đất mặn ít",
    
    # ĐẤT PHÈN TIỀM TÀNG NÔNG dưới rừng ngập mặn - Light purple (D8B0FC range)
    "#d8b0fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#dcb0fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d8acfc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d4b0fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#cca0fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#cca0f8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d0a0fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#cc9cf8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#c890fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#c490fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d4acfc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#dcb4fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    
    # ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN NHIỀU - Light blue purple (C0D0FC)
    "#c0d4fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#bcd0fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#bcd4fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#c0d0fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#b8d0fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#c4d0fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#b8d4fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#c4d4fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#c0d8fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#c0ccfc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#b4ccfc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#b8ccfc": "Đất phèn tiềm tàng nông, mặn nhiều",
    
    # ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN TRUNG BÌNH - Bright pink (FC80FC)
    "#fc84f8": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#fc84fc": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#fc80f8": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#fc80fc": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#fc7cf8": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#fc7cfc": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#fc88f8": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#fc88fc": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#fc80f4": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#fc84f4": "Đất phèn tiềm tàng nông, mặn trung bình",
    
    # ĐẤT PHÈN TIỀM TÀNG SÂU, MẶN TRUNG BÌNH - Bright magenta (FC74F8)
    "#fc74f8": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#fc74fc": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#fc78f8": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#fc78fc": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#fc70f4": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#fc70f8": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#f874f8": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#f878f8": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#f870f4": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#f874fc": "Đất phèn tiềm tàng sâu, mặn trung bình",
    
    # ĐẤT PHÈN TIỀM TÀNG SÂU, MẶN ÍT - Light magenta (FCA0FC)
    "#fca0fc": "Đất phèn tiềm tàng sâu, mặn ít",
    "#fca4fc": "Đất phèn tiềm tàng sâu, mặn ít",
    "#fca0f8": "Đất phèn tiềm tàng sâu, mặn ít",
    "#fc9cf8": "Đất phèn tiềm tàng sâu, mặn ít",
    "#fcacfc": "Đất phèn tiềm tàng sâu, mặn ít",
    "#fca8fc": "Đất phèn tiềm tàng sâu, mặn ít",
    "#fca4f8": "Đất phèn tiềm tàng sâu, mặn ít",
    "#fca8f8": "Đất phèn tiềm tàng sâu, mặn ít",
    "#f8a0fc": "Đất phèn tiềm tàng sâu, mặn ít",
    "#f8a4fc": "Đất phèn tiềm tàng sâu, mặn ít",
    "#fc9cfc": "Đất phèn tiềm tàng sâu, mặn ít",
    "#f8acfc": "Đất phèn tiềm tàng sâu, mặn ít",
    
    # ĐẤT PHÈN TIỀM TÀNG SÂU dưới rừng ngập mặn - Very light pink (FCCCFC)
    "#fcccfc": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",
    "#fcc8fc": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",
    "#fcd0fc": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",
    "#fcc4fc": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",
    
    # ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN NHIỀU - Medium pink (FCB0FC)
    "#fcb0fc": "Đất phèn hoạt động nông, mặn nhiều",
    "#fcb4fc": "Đất phèn hoạt động nông, mặn nhiều",
    "#fcb0f8": "Đất phèn hoạt động nông, mặn nhiều",
    "#fcacf8": "Đất phèn hoạt động nông, mặn nhiều",
    "#f8b0fc": "Đất phèn hoạt động nông, mặn nhiều",
    "#f8b4fc": "Đất phèn hoạt động nông, mặn nhiều",
    "#f8acf8": "Đất phèn hoạt động nông, mặn nhiều",
    "#f4b0fc": "Đất phèn hoạt động nông, mặn nhiều",
    "#f0a8fc": "Đất phèn hoạt động nông, mặn nhiều",
    "#eca8fc": "Đất phèn hoạt động nông, mặn nhiều",
    
    # ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN TRUNG BÌNH - Hot pink (FC64B0)
    "#fc64b0": "Đất phèn hoạt động nông, mặn trung bình",
    "#fc64ac": "Đất phèn hoạt động nông, mặn trung bình",
    "#fc60a8": "Đất phèn hoạt động nông, mặn trung bình",
    "#fc68b0": "Đất phèn hoạt động nông, mặn trung bình",
    
    # ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN ÍT - Light violet (C0C0FC)
    "#c0c0fc": "Đất phèn hoạt động nông, mặn ít",
    "#bcbcfc": "Đất phèn hoạt động nông, mặn ít",
    "#bcc0fc": "Đất phèn hoạt động nông, mặn ít",
    "#c4c4fc": "Đất phèn hoạt động nông, mặn ít",
    "#bcbcf8": "Đất phèn hoạt động nông, mặn ít",
    "#c4ccfc": "Đất phèn hoạt động nông, mặn ít",
    
    # ĐẤT PHÈN HOẠT ĐỘNG SÂU, MẶN ÍT - Blue violet (9090FC)
    "#9090fc": "Đất phèn hoạt động sâu, mặn ít",
    "#9094fc": "Đất phèn hoạt động sâu, mặn ít",
    "#9088fc": "Đất phèn hoạt động sâu, mặn ít",
    "#8c8cfc": "Đất phèn hoạt động sâu, mặn ít",
    
    # ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN ÍT - Light pink (FCB0D8)
    "#fcb0d8": "Đất phèn tiềm tàng nông, mặn ít",
    "#fcacd8": "Đất phèn tiềm tàng nông, mặn ít",
    "#fcacdc": "Đất phèn tiềm tàng nông, mặn ít",
    "#fcb0d4": "Đất phèn tiềm tàng nông, mặn ít",
    
    # SÔNG, SUỐI, AO HỒ - Light blue (lavender)
    "#a0c0fc": "Sông, suối, ao hồ",
    "#a4c0fc": "Sông, suối, ao hồ",
    "#9cc0fc": "Sông, suối, ao hồ",
    "#a0bcfc": "Sông, suối, ao hồ",
    "#a4c4fc": "Sông, suối, ao hồ",
    "#a4bcfc": "Sông, suối, ao hồ",
    "#a8c4fc": "Sông, suối, ao hồ",
    "#9cbcfc": "Sông, suối, ao hồ",
    "#a0c0f8": "Sông, suối, ao hồ",
    
    # BÃI BỒI VEN SÔNG, VEN BIỂN - Very light cyan/white
    "#f0fcfc": "Bãi bồi ven sông, ven biển",
    "#ecfcfc": "Bãi bồi ven sông, ven biển",
    "#e8fcfc": "Bãi bồi ven sông, ven biển",
    
    # KÝ HIỆU ĐẶC BIỆT - Màu xanh lá (ký hiệu rừng/cây xanh trên bản đồ)
    "#04f400": "Ký hiệu rừng/cây xanh",
    "#04f000": "Ký hiệu rừng/cây xanh",
    "#00ff00": "Ký hiệu rừng/cây xanh",
    "#00f400": "Ký hiệu rừng/cây xanh",
    "#08f000": "Ký hiệu rừng/cây xanh",
    "#00f000": "Ký hiệu rừng/cây xanh",
}

# 22 loại đất theo chú thích
SOIL_TYPES_IN_LEGEND = [
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
    "Bãi bồi ven sông, ven biển",
    "Ký hiệu rừng/cây xanh",
]

# ===========================
# HELPER FUNCTIONS  
# ===========================

def rgb_to_hex(r, g, b):
    return "#{:02x}{:02x}{:02x}".format(int(r), int(g), int(b))

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def match_color_to_mock(hex_color, threshold=45):
    """Match a color to mock data using Euclidean distance"""
    if hex_color.lower() in MOCK_COLOR_MAPPINGS:
        return MOCK_COLOR_MAPPINGS[hex_color.lower()], 0
    
    r1, g1, b1 = hex_to_rgb(hex_color)
    best_match = None
    min_dist = float('inf')
    
    for mock_hex, soil_type in MOCK_COLOR_MAPPINGS.items():
        r2, g2, b2 = hex_to_rgb(mock_hex)
        dist = np.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2)
        if dist < min_dist:
            min_dist = dist
            best_match = soil_type
    
    if min_dist <= threshold:
        return best_match, min_dist
    return None, min_dist

def get_mock_coordinates(filename):
    """Get mock coordinates from filename"""
    filename_lower = filename.lower().replace(' ', '_').replace('-', '_')
    
    # Check various patterns
    patterns = [
        "ca_mau", "cà_mau", "camau",
        "tho_nhuong", "thổ_nhưỡng", "soil"
    ]
    
    if any(p in filename_lower for p in ["ca_mau", "cà_mau", "camau"]):
        return MOCK_COORDINATES["ca_mau_tho_nhuong"]
    
    return None

def print_header(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)

def print_step(step_num, text):
    print(f"\n{'─' * 70}")
    print(f"  BƯỚC {step_num}: {text}")
    print(f"{'─' * 70}")

# ===========================
# BƯỚC 1: XÁC ĐỊNH TỌA ĐỘ
# ===========================

def step1_identify_coordinates(filename):
    """Bước 1: Xác định tọa độ từ mockdata (không cần AI)"""
    print_step(1, "XÁC ĐỊNH TỌA ĐỘ TỪ MOCKDATA")
    
    coords = get_mock_coordinates(filename)
    
    if coords:
        print(f"   ✅ ĐÃ TÌM THẤY MOCKDATA CHO: {filename}")
        print(f"   📍 Tỉnh: {coords['province']}")
        print(f"   📍 SW Corner: ({coords['sw']['lat']}, {coords['sw']['lng']})")
        print(f"   📍 NE Corner: ({coords['ne']['lat']}, {coords['ne']['lng']})")
        print(f"   📍 Center: ({coords['center']['lat']}, {coords['center']['lng']})")
        print(f"   📐 Scale: {coords['scale']}")
        return coords
    else:
        print(f"   ❌ KHÔNG TÌM THẤY MOCKDATA CHO: {filename}")
        print(f"   ⚠️  Cần AI (Gemini/GPT-4o) để trích xuất tọa độ")
        return None

# ===========================
# BƯỚC 2: TRÍCH XUẤT POLYGON
# ===========================

def step2_extract_polygons(image_path, geo_bounds=None, verbose=True):
    """
    Bước 2: Trích xuất polygon - loại bỏ đường lưới cyan và sọc đen
    """
    print_step(2, "TRÍCH XUẤT POLYGON (Loại bỏ đường lưới & sọc đen)")
    
    # Read image
    with open(image_path, 'rb') as f:
        file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    
    if image is None:
        print(f"   ❌ Không đọc được ảnh: {image_path}")
        return None
    
    h, w = image.shape[:2]
    print(f"   📐 Kích thước ảnh: {w} x {h} = {w*h:,} pixels")
    
    # Convert to RGB
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    pixels = image_rgb.reshape(-1, 3)
    
    # VECTORIZED FILTERING
    r = pixels[:, 0].astype(np.int32)
    g = pixels[:, 1].astype(np.int32)
    b = pixels[:, 2].astype(np.int32)
    
    # ═══════════════════════════════════════════════════════════════
    # LOẠI BỎ CÁC YẾU TỐ KHÔNG PHẢI ĐẤT
    # ═══════════════════════════════════════════════════════════════
    
    # 1. Loại bỏ màu trắng thuần (background)
    not_pure_white = ~((r > 252) & (g > 252) & (b > 252))
    
    # 2. Loại bỏ màu đen (đường sọc ranh giới, text)
    not_black = ~((r < 35) & (g < 35) & (b < 35))
    
    # 3. Loại bỏ màu xám đậm (đường kẻ, text)
    diff_rg = np.abs(r - g)
    diff_gb = np.abs(g - b)
    diff_rb = np.abs(r - b)
    is_dark_gray = (diff_rg < 15) & (diff_gb < 15) & (diff_rb < 15) & (r > 30) & (r < 180)
    not_dark_gray = ~is_dark_gray
    
    # 4. Loại bỏ màu ĐỎ (đường giao thông)
    is_red_line = (r > 180) & (g < 100) & (b < 100)
    not_red_line = ~is_red_line
    
    # ★★★ 5. LOẠI BỎ ĐƯỜNG LƯỚI TỌA ĐỘ CYAN/XANH DA TRỜI ★★★
    # Đường cyan có đặc điểm: R thấp, G & B cao
    is_cyan_line = (r < 120) & (g > 180) & (b > 220) & (b > r + 80)
    # Mở rộng: xanh dương nhạt (light blue grid lines)
    is_light_blue_line = (r < 150) & (g > 200) & (b > 240) & (np.abs(g - b) < 40)
    not_cyan_grid = ~(is_cyan_line | is_light_blue_line)
    
    # 6. Loại bỏ border đen có blue thấp
    is_dark_border = (r < 45) & (g < 45) & (b < 70) & ~((r < 50) & (g < 20) & (b > 45))
    not_dark_border = ~is_dark_border
    
    # Kết hợp tất cả filters
    valid_mask = (not_pure_white & not_black & not_dark_gray & 
                  not_red_line & not_cyan_grid & not_dark_border)
    
    valid_pixels = pixels[valid_mask]
    
    # Count filtered
    total = len(pixels)
    filtered_count = total - len(valid_pixels)
    cyan_filtered = np.sum(is_cyan_line | is_light_blue_line)
    black_filtered = np.sum(~not_black | ~not_dark_border)
    red_filtered = np.sum(is_red_line)
    
    print(f"\n   🔍 LỌC PIXEL:")
    print(f"      - Tổng pixels: {total:,}")
    print(f"      - Pixels hợp lệ: {len(valid_pixels):,} ({len(valid_pixels)*100/total:.1f}%)")
    print(f"      - Đã loại bỏ: {filtered_count:,}")
    print(f"        • Đường đen/ranh giới: {black_filtered:,}")
    print(f"        • Đường đỏ giao thông: {red_filtered:,}")
    print(f"        • Đường lưới cyan: {cyan_filtered:,}")
    
    # Quantize colors
    HISTOGRAM_BINS = 64
    step = 256 // HISTOGRAM_BINS
    quantized = (valid_pixels // step) * step
    
    # Count unique colors
    keys = (quantized[:, 0].astype(np.int32) * 65536 + 
            quantized[:, 1].astype(np.int32) * 256 + 
            quantized[:, 2].astype(np.int32))
    unique_keys, counts = np.unique(keys, return_counts=True)
    
    print(f"\n   🎨 PHÂN TÍCH MÀU:")
    print(f"      - Số màu unique: {len(unique_keys)}")
    
    # Extract significant colors
    MIN_PERCENTAGE = 0.1
    valid_count = len(valid_pixels)
    
    colors = []
    sorted_indices = np.argsort(-counts)
    
    for idx in sorted_indices:
        key = unique_keys[idx]
        count = counts[idx]
        pct = (count / valid_count) * 100
        
        if pct < MIN_PERCENTAGE:
            continue
        
        cr = (key // 65536) & 0xFF
        cg = (key // 256) & 0xFF
        cb = key & 0xFF
        hex_c = rgb_to_hex(cr, cg, cb)
        soil_type, distance = match_color_to_mock(hex_c)
        
        colors.append({
            'hex': hex_c,
            'rgb': [cr, cg, cb],
            'percentage': round(pct, 2),
            'count': int(count),
            'soil_type': soil_type,
            'match_distance': round(distance, 1)
        })
    
    print(f"      - Màu đủ diện tích (>{MIN_PERCENTAGE}%): {len(colors)}")
    
    # Calculate polygons (simplified - just count)
    print(f"\n   📊 TOP 10 MÀU CHÍNH:")
    for i, c in enumerate(colors[:10]):
        status = "✅" if c['soil_type'] else "❓"
        soil = c['soil_type'] or "Không xác định"
        print(f"      {i+1}. {c['hex']} {c['percentage']:5.1f}% {status} {soil[:40]}")
    
    return {
        'image_size': {'width': w, 'height': h},
        'total_pixels': total,
        'valid_pixels': len(valid_pixels),
        'filtered_pixels': {
            'total': filtered_count,
            'black_border': int(black_filtered),
            'red_road': int(red_filtered),
            'cyan_grid': int(cyan_filtered)
        },
        'colors': colors,
        'geo_bounds': geo_bounds
    }

# ===========================
# BƯỚC 3: PHÂN LOẠI ĐẤT
# ===========================

def step3_classify_soil(polygon_data):
    """Bước 3: Phân loại đất từ màu sắc"""
    print_step(3, "PHÂN LOẠI ĐẤT")
    
    colors = polygon_data.get('colors', [])
    
    # Count soil types
    soil_stats = {}
    matched = 0
    unmatched = 0
    
    for c in colors:
        soil_type = c.get('soil_type')
        if soil_type:
            matched += 1
            if soil_type not in soil_stats:
                soil_stats[soil_type] = {'count': 0, 'percentage': 0}
            soil_stats[soil_type]['count'] += 1
            soil_stats[soil_type]['percentage'] += c['percentage']
        else:
            unmatched += 1
    
    # Sort by percentage
    sorted_stats = sorted(soil_stats.items(), key=lambda x: -x[1]['percentage'])
    
    print(f"\n   📊 THỐNG KÊ LOẠI ĐẤT:")
    print(f"      - Màu đã match: {matched}")
    print(f"      - Màu chưa match: {unmatched}")
    print(f"      - Số loại đất phát hiện: {len(soil_stats)}")
    
    print(f"\n   🗺️  PHÂN BỐ LOẠI ĐẤT:")
    for soil_type, stats in sorted_stats:
        pct = stats['percentage']
        bar = "█" * int(pct / 2)
        print(f"      {pct:5.1f}% {bar} {soil_type}")
    
    # Check against legend
    found_types = set(soil_stats.keys())
    legend_types = set(SOIL_TYPES_IN_LEGEND)
    
    present = found_types & legend_types
    missing = legend_types - found_types
    
    print(f"\n   ✅ KIỂM TRA ĐỦ LOẠI ĐẤT:")
    print(f"      - Tìm thấy: {len(present)}/22 loại")
    if missing:
        print(f"      - Thiếu ({len(missing)} loại):")
        for m in sorted(missing):
            print(f"        • {m}")
    
    return {
        'soil_types': dict(sorted_stats),
        'matched_colors': matched,
        'unmatched_colors': unmatched,
        'types_found': len(soil_stats),
        'types_in_legend': 22,
        'missing_types': list(missing)
    }

# ===========================
# MAIN TEST
# ===========================

def main():
    print_header("TEST TOÀN DIỆN QUY TRÌNH PHÂN TÍCH BẢN ĐỒ THỔ NHƯỠNG")
    
    # Test image
    script_dir = Path(__file__).parent
    test_images = [
        script_dir / "image" / "upscalemedia-transformed (1).jpeg",
        script_dir / "image" / "Cà Mau_Thổ Nhưỡng.jpeg",
    ]
    
    image_path = None
    for img in test_images:
        if img.exists():
            image_path = img
            break
    
    if not image_path:
        print("❌ Không tìm thấy ảnh test!")
        print("   Đường dẫn tìm kiếm:")
        for img in test_images:
            print(f"   - {img}")
        return
    
    print(f"\n📁 File test: {image_path.name}")
    print(f"📂 Đường dẫn: {image_path}")
    
    import time
    start = time.time()
    
    # BƯỚC 1: Xác định tọa độ
    geo_bounds = step1_identify_coordinates(image_path.name)
    
    # BƯỚC 2: Trích xuất polygon
    polygon_data = step2_extract_polygons(str(image_path), geo_bounds)
    
    # BƯỚC 3: Phân loại đất
    if polygon_data:
        classification = step3_classify_soil(polygon_data)
    
    elapsed = time.time() - start
    
    print_header(f"HOÀN THÀNH - Thời gian: {elapsed:.2f} giây")
    
    # Summary
    if geo_bounds and polygon_data:
        print(f"""
   📋 TÓM TẮT:
   ────────────────────────────────────
   ✅ Bước 1: Tọa độ từ MockData - OK
      Tỉnh: {geo_bounds['province']}
      Bounds: SW({geo_bounds['sw']['lat']}, {geo_bounds['sw']['lng']}) 
              NE({geo_bounds['ne']['lat']}, {geo_bounds['ne']['lng']})
   
   ✅ Bước 2: Trích xuất vùng màu - OK
      Pixels hợp lệ: {polygon_data['valid_pixels']:,} / {polygon_data['total_pixels']:,}
      Đường cyan đã lọc: {polygon_data['filtered_pixels']['cyan_grid']:,}
      Đường đen đã lọc: {polygon_data['filtered_pixels']['black_border']:,}
      Số màu: {len(polygon_data['colors'])}
   
   ✅ Bước 3: Phân loại đất - OK
      Loại đất phát hiện: {classification['types_found']}/22
      Màu đã match: {classification['matched_colors']}
      Màu chưa match: {classification['unmatched_colors']}
   ────────────────────────────────────
        """)

if __name__ == "__main__":
    main()
