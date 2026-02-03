#!/usr/bin/env python3
"""
Test script để kiểm tra mock data màu với bản đồ thổ nhưỡng Cà Mau.
🚀 TỐI ƯU HÓA: Histogram-based (1-2s) thay vì K-means (25 phút)

Các phương pháp hỗ trợ:
1. HISTOGRAM (mặc định) - Nhanh nhất, chính xác nhất cho bản đồ
2. SAMPLING + K-means - Backup khi cần clustering
3. RESIZE - Giảm độ phân giải
"""

import cv2
import numpy as np
from collections import Counter
import math
import time

# ========== CẤU HÌNH TỐI ƯU ==========
MAX_SAMPLES = 300_000      # Giới hạn pixel cho K-means (nếu dùng)
HISTOGRAM_BINS = 64        # Số mức lượng tử hóa màu (64-128)
MIN_PERCENTAGE = 0.05      # Bỏ qua vùng màu < 0.05% (giảm thêm để phát hiện)
COLOR_MATCH_THRESHOLD = 45 # Ngưỡng khoảng cách màu Euclidean (giảm để chính xác hơn)

# Danh sách 22 loại đất theo chú thích (phải match đủ)
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
]

# =============================================================================
# MOCK COLOR MAPPINGS - Cập nhật theo chú thích bản đồ thổ nhưỡng Cà Mau
# Mỗi loại đất có MÀU CHÍNH (primary) và các biến thể (variants) do JPEG compression
# =============================================================================
MOCK_COLOR_MAPPINGS = {
    # ═══════════════════════════════════════════════════════════════════════════
    # 1. ĐẤT CÁT GIỒNG - Màu VÀNG TƯƠI (Yellow) - Hàng 1 trong chú thích
    # ═══════════════════════════════════════════════════════════════════════════
    "#ffff00": "Đất cát giồng",  # Primary - pure yellow
    "#fcfc00": "Đất cát giồng",
    "#f8f800": "Đất cát giồng",
    "#fcfc04": "Đất cát giồng",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 2. ĐẤT MẶN NHIỀU - Màu VÀNG NHẠT/KEM (Pale yellow/cream) - Hàng 2
    # ═══════════════════════════════════════════════════════════════════════════
    "#ffffc0": "Đất mặn nhiều",  # Primary - pale yellow
    "#fcfcbc": "Đất mặn nhiều",
    "#ffffb8": "Đất mặn nhiều",
    "#fcfcc0": "Đất mặn nhiều",
    "#f8f8b4": "Đất mặn nhiều",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 3. ĐẤT MẶN TRUNG BÌNH - Màu VÀNG RẤT NHẠT (Very pale yellow) - Hàng 3
    # ═══════════════════════════════════════════════════════════════════════════
    "#ffffd8": "Đất mặn trung bình",  # Primary
    "#fcfcd4": "Đất mặn trung bình",
    "#ffffdc": "Đất mặn trung bình",
    "#f8f8d0": "Đất mặn trung bình",
    "#fcfce0": "Đất mặn trung bình",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 4. ĐẤT MẶN ÍT - Màu TRẮNG NGÀ (Ivory/off-white) - Hàng 4
    # ═══════════════════════════════════════════════════════════════════════════
    "#ffffec": "Đất mặn ít",  # Primary - near white with yellow tint
    "#fcfce8": "Đất mặn ít",
    "#fffff0": "Đất mặn ít",
    "#f8f8e4": "Đất mặn ít",
    "#fcfcf0": "Đất mặn ít",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 5. ĐẤT PHÈN TIỀM TÀNG NÔNG dưới rừng ngập mặn - TÍM RẤT NHẠT (Very light lavender)
    # ═══════════════════════════════════════════════════════════════════════════
    "#e8d8fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",  # Primary
    "#e4d4f8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#e0d0f4": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#dcd0fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d8ccf8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d8b0fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",  # Detected in map
    "#d4b0fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#dcb0fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d8acfc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#dcb4fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d4acfc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d4acf8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 6. ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN NHIỀU - TÍM XANH NHẠT (Light blue-lavender)
    # ═══════════════════════════════════════════════════════════════════════════
    "#c8d8fc": "Đất phèn tiềm tàng nông, mặn nhiều",  # Primary
    "#c4d4f8": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#c0d0fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#c0d4fc": "Đất phèn tiềm tàng nông, mặn nhiều",  # Detected
    "#bcd0fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    "#bcd4fc": "Đất phèn tiềm tàng nông, mặn nhiều",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 7. ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN TRUNG BÌNH - HỒNG TÍM (Pink-magenta)
    # ═══════════════════════════════════════════════════════════════════════════
    "#fc80fc": "Đất phèn tiềm tàng nông, mặn trung bình",  # Primary
    "#fc84fc": "Đất phèn tiềm tàng nông, mặn trung bình",  # Detected
    "#fc84f8": "Đất phèn tiềm tàng nông, mặn trung bình",  # Detected
    "#fc80f8": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#fc7cf8": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#fc80f4": "Đất phèn tiềm tàng nông, mặn trung bình",
    "#f87cf4": "Đất phèn tiềm tàng nông, mặn trung bình",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 8. ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN ÍT - HỒNG NHẠT (Light pink)
    # ═══════════════════════════════════════════════════════════════════════════
    "#fcb0dc": "Đất phèn tiềm tàng nông, mặn ít",  # Primary
    "#fcb4dc": "Đất phèn tiềm tàng nông, mặn ít",
    "#f8acd8": "Đất phèn tiềm tàng nông, mặn ít",
    "#fcb0d8": "Đất phèn tiềm tàng nông, mặn ít",
    "#f8b0d8": "Đất phèn tiềm tàng nông, mặn ít",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 9. ĐẤT PHÈN TIỀM TÀNG SÂU dưới rừng ngập mặn - XANH TÍM NHẠT (Pale blue-purple)
    # ═══════════════════════════════════════════════════════════════════════════
    "#c8c8fc": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",  # Primary
    "#c4c4f8": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",
    "#c8c8f8": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",
    "#ccccfc": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",
    "#fcccfc": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",  # Detected - very light pink
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 10. ĐẤT PHÈN TIỀM TÀNG SÂU, MẶN NHIỀU - HỒNG ĐẬM/MAGENTA (Deep pink)
    # ═══════════════════════════════════════════════════════════════════════════
    "#fc60b0": "Đất phèn tiềm tàng sâu, mặn nhiều",  # Primary
    "#fc5cac": "Đất phèn tiềm tàng sâu, mặn nhiều",
    "#f858a8": "Đất phèn tiềm tàng sâu, mặn nhiều",
    "#fc64b4": "Đất phèn tiềm tàng sâu, mặn nhiều",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 11. ĐẤT PHÈN TIỀM TÀNG SÂU, MẶN TRUNG BÌNH - HỒNG TÍM (Magenta-pink)
    # ═══════════════════════════════════════════════════════════════════════════
    "#fc74fc": "Đất phèn tiềm tàng sâu, mặn trung bình",  # Primary
    "#fc74f8": "Đất phèn tiềm tàng sâu, mặn trung bình",  # Detected
    "#fc78f8": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#fc70f4": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#f870f4": "Đất phèn tiềm tàng sâu, mặn trung bình",
    "#fc74f4": "Đất phèn tiềm tàng sâu, mặn trung bình",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 12. ĐẤT PHÈN TIỀM TÀNG SÂU, MẶN ÍT - HỒNG NHẠT (Pale pink)
    # ═══════════════════════════════════════════════════════════════════════════
    "#fca8fc": "Đất phèn tiềm tàng sâu, mặn ít",  # Primary
    "#fca4fc": "Đất phèn tiềm tàng sâu, mặn ít",  # Detected
    "#fca0fc": "Đất phèn tiềm tàng sâu, mặn ít",  # Detected
    "#fca4f8": "Đất phèn tiềm tàng sâu, mặn ít",
    "#fca0f8": "Đất phèn tiềm tàng sâu, mặn ít",
    "#fcacfc": "Đất phèn tiềm tàng sâu, mặn ít",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 13. ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN NHIỀU - HỒNG/MAGENTA (Pink-magenta)
    # ═══════════════════════════════════════════════════════════════════════════
    "#fcb0fc": "Đất phèn hoạt động nông, mặn nhiều",  # Primary
    "#fcb4fc": "Đất phèn hoạt động nông, mặn nhiều",  # Detected
    "#fcb0f8": "Đất phèn hoạt động nông, mặn nhiều",
    "#f8acf8": "Đất phèn hoạt động nông, mặn nhiều",
    "#fcacf8": "Đất phèn hoạt động nông, mặn nhiều",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 14. ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN TRUNG BÌNH - HỒNG ĐẬM (Deep pink)
    # ═══════════════════════════════════════════════════════════════════════════
    "#fc64b0": "Đất phèn hoạt động nông, mặn trung bình",  # Primary
    "#fc68b4": "Đất phèn hoạt động nông, mặn trung bình",
    "#f860ac": "Đất phèn hoạt động nông, mặn trung bình",
    "#fc60a8": "Đất phèn hoạt động nông, mặn trung bình",
    "#f85ca8": "Đất phèn hoạt động nông, mặn trung bình",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 15. ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN ÍT - TÍM XANH NHẠT (Pale violet-blue)
    # ═══════════════════════════════════════════════════════════════════════════
    "#c0c4fc": "Đất phèn hoạt động nông, mặn ít",  # Primary
    "#c4c8fc": "Đất phèn hoạt động nông, mặn ít",
    "#c0c0fc": "Đất phèn hoạt động nông, mặn ít",
    "#bcbcf8": "Đất phèn hoạt động nông, mặn ít",
    "#c0c0f8": "Đất phèn hoạt động nông, mặn ít",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 16. ĐẤT PHÈN HOẠT ĐỘNG SÂU, MẶN NHIỀU - HỒNG (Pink)
    # ═══════════════════════════════════════════════════════════════════════════
    "#fc9cdc": "Đất phèn hoạt động sâu, mặn nhiều",  # Primary
    "#fc98d8": "Đất phèn hoạt động sâu, mặn nhiều",
    "#f894d4": "Đất phèn hoạt động sâu, mặn nhiều",
    "#fca0e0": "Đất phèn hoạt động sâu, mặn nhiều",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 17. ĐẤT PHÈN HOẠT ĐỘNG SÂU, MẶN TRUNG BÌNH - HỒNG ĐẬM/ĐỎ HỒNG (Deep rose)
    # ═══════════════════════════════════════════════════════════════════════════
    "#fc54a8": "Đất phèn hoạt động sâu, mặn trung bình",  # Primary
    "#fc58ac": "Đất phèn hoạt động sâu, mặn trung bình",
    "#f850a4": "Đất phèn hoạt động sâu, mặn trung bình",
    "#fc50a4": "Đất phèn hoạt động sâu, mặn trung bình",
    "#f84ca0": "Đất phèn hoạt động sâu, mặn trung bình",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 18. ĐẤT PHÈN HOẠT ĐỘNG SÂU, MẶN ÍT - XANH TÍM (Blue-violet)
    # ═══════════════════════════════════════════════════════════════════════════
    "#9494f4": "Đất phèn hoạt động sâu, mặn ít",  # Primary
    "#9090f0": "Đất phèn hoạt động sâu, mặn ít",
    "#9898f8": "Đất phèn hoạt động sâu, mặn ít",
    "#8c8cec": "Đất phèn hoạt động sâu, mặn ít",
    "#9090ec": "Đất phèn hoạt động sâu, mặn ít",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 19. ĐẤT THAN BÙN PHÈN MẶN - TÍM ĐẬM/ĐEN TÍM (Dark purple/indigo)
    # ═══════════════════════════════════════════════════════════════════════════
    "#280050": "Đất than bùn phèn mặn",  # Primary - detected
    "#28004c": "Đất than bùn phèn mặn",  # Detected
    "#240048": "Đất than bùn phèn mặn",
    "#2c0054": "Đất than bùn phèn mặn",
    "#200044": "Đất than bùn phèn mặn",
    "#300058": "Đất than bùn phèn mặn",
    "#1c0040": "Đất than bùn phèn mặn",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 20. ĐẤT VÀNG ĐỎ trên đá Macma axit - CAM NHẠT/SALMON (Light salmon/peach)
    # ═══════════════════════════════════════════════════════════════════════════
    "#fcb8a0": "Đất vàng đỏ trên đá Macma axit",  # Primary
    "#f8b49c": "Đất vàng đỏ trên đá Macma axit",
    "#fcbca4": "Đất vàng đỏ trên đá Macma axit",
    "#f4b098": "Đất vàng đỏ trên đá Macma axit",
    "#fcb4a0": "Đất vàng đỏ trên đá Macma axit",
    "#f8b8a4": "Đất vàng đỏ trên đá Macma axit",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 21. SÔNG, SUỐI, AO HỒ - XANH DA TRỜI/CYAN (Blue-cyan) - Thực tế trong bản đồ
    # ═══════════════════════════════════════════════════════════════════════════
    "#50fcfc": "Sông, suối, ao hồ",  # Primary - cyan thuần
    "#4cf8f8": "Sông, suối, ao hồ",
    "#54fcfc": "Sông, suối, ao hồ",
    "#48f4f4": "Sông, suối, ao hồ",
    "#5cfcfc": "Sông, suối, ao hồ",
    "#00fcfc": "Sông, suối, ao hồ",
    "#04f8f8": "Sông, suối, ao hồ",
    "#14f8fc": "Sông, suối, ao hồ",  # Detected in map
    # Màu xanh da trời (thực tế trong bản đồ này)
    "#68c8fc": "Sông, suối, ao hồ",  # Primary detected
    "#6cc8fc": "Sông, suối, ao hồ",  # Detected
    "#6cccfc": "Sông, suối, ao hồ",  # Detected
    "#78c8fc": "Sông, suối, ao hồ",  # Detected
    "#74c8fc": "Sông, suối, ao hồ",
    "#70ccfc": "Sông, suối, ao hồ",
    "#64c4fc": "Sông, suối, ao hồ",
    "#60c0fc": "Sông, suối, ao hồ",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 22. BÃI BỒI VEN SÔNG, VEN BIỂN - XANH NHẠT/TRẮNG XANH (Pale cyan)
    # ═══════════════════════════════════════════════════════════════════════════
    "#d4fcfc": "Bãi bồi ven sông, ven biển",  # Primary
    "#d0f8f8": "Bãi bồi ven sông, ven biển",
    "#d8fcfc": "Bãi bồi ven sông, ven biển",
    "#ccf4f4": "Bãi bồi ven sông, ven biển",
    "#dcfcfc": "Bãi bồi ven sông, ven biển",
    "#e0fcfc": "Bãi bồi ven sông, ven biển",
    
    # ═══════════════════════════════════════════════════════════════════════════
    # THÊM: Các màu phát hiện trong bản đồ cần mapping lại cho đúng
    # ═══════════════════════════════════════════════════════════════════════════
    # Màu tím nhạt detected - thuộc nhóm đất mặn (theo vị trí trên bản đồ)
    "#cca0fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",  # Light purple - adj
    "#cca0f8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#cc9cf8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#cc9cfc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d0a0fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d0a0f8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d0a4fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#c8a0f8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#c89cf8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#c890f8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#c890fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#c894fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#c490fc": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    "#d09cf8": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
    
    # Màu xanh dương nhạt - có thể là sông suối hoặc đất phèn tiềm tàng sâu
    "#a0c0fc": "Sông, suối, ao hồ",  # Light blue - likely water
    "#a4c0fc": "Sông, suối, ao hồ",  # Light blue
    "#a8c4fc": "Sông, suối, ao hồ",
    "#9cbcfc": "Sông, suối, ao hồ",
    "#98b8fc": "Sông, suối, ao hồ",
}

def hex_to_rgb(hex_color):
    """Convert hex to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(r, g, b):
    """Convert RGB to hex string"""
    return "#{:02x}{:02x}{:02x}".format(int(r), int(g), int(b))

def euclidean_distance(c1, c2):
    """Calculate Euclidean distance between two RGB colors"""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))

def match_color_to_mock(hex_color, threshold=COLOR_MATCH_THRESHOLD):
    """
    Match a hex color to mock data using Euclidean distance.
    Returns (matched_soil_type, distance) or (None, min_distance)
    """
    rgb = hex_to_rgb(hex_color)
    
    # Direct match
    if hex_color.lower() in MOCK_COLOR_MAPPINGS:
        return MOCK_COLOR_MAPPINGS[hex_color.lower()], 0
    
    # Distance-based match
    min_distance = float('inf')
    best_match = None
    
    for mock_hex, soil_type in MOCK_COLOR_MAPPINGS.items():
        mock_rgb = hex_to_rgb(mock_hex)
        dist = euclidean_distance(rgb, mock_rgb)
        if dist < min_distance:
            min_distance = dist
            best_match = soil_type
    
    if min_distance <= threshold:
        return best_match, min_distance
    else:
        return None, min_distance


def is_valid_map_color(r, g, b):
    """Kiểm tra pixel có phải màu bản đồ hợp lệ không (bỏ trắng/đen/xám)"""
    # Skip white-ish (background)
    if r > 248 and g > 248 and b > 248:
        return False
    # Skip black (text/borders)
    if r < 20 and g < 20 and b < 20:
        return False
    # Skip near-gray (roads, text)
    if abs(r-g) < 15 and abs(g-b) < 15 and 50 < r < 200:
        return False
    return True


def quantize_color(r, g, b, bins=HISTOGRAM_BINS):
    """Lượng tử hóa màu về số mức nhất định"""
    step = 256 // bins
    return (r // step * step, g // step * step, b // step * step)


# ============================================================
# 🚀 PHƯƠNG PHÁP 1: HISTOGRAM (NHANH NHẤT - 1-2 GIÂY)
# ============================================================
def analyze_with_histogram(image_rgb, verbose=True):
    """
    Phân tích màu bằng histogram - NHANH NHẤT cho bản đồ.
    Thời gian: 1-2 giây cho ảnh 70M pixel
    🔥 TỐI ƯU: Dùng Numpy vectorized thay vì Python loop
    """
    if verbose:
        print("\n🚀 PHƯƠNG PHÁP: HISTOGRAM (tối ưu Numpy vectorized)")
    
    h, w = image_rgb.shape[:2]
    pixels = image_rgb.reshape(-1, 3)
    
    # 🔥 VECTORIZED FILTERING - Loại bỏ đường sọc đen, text, background
    r, g, b = pixels[:, 0].astype(np.int32), pixels[:, 1].astype(np.int32), pixels[:, 2].astype(np.int32)
    
    # === LOẠI BỎ BACKGROUND & NOISE ===
    # 1. Loại bỏ màu trắng thuần (background) - GIỮ LẠI màu trắng ngà (đất mặn ít)
    not_pure_white = ~((r > 252) & (g > 252) & (b > 252))
    
    # 2. Loại bỏ màu đen (đường sọc, text, borders) - QUAN TRỌNG
    not_black = ~((r < 35) & (g < 35) & (b < 35))
    
    # 3. Loại bỏ màu xám đậm (đường kẻ, text) - GIỮ LẠI xám nhạt
    diff_rg = np.abs(r - g)
    diff_gb = np.abs(g - b)
    diff_rb = np.abs(r - b)
    is_dark_gray = (diff_rg < 15) & (diff_gb < 15) & (diff_rb < 15) & (r > 30) & (r < 180)
    not_dark_gray = ~is_dark_gray
    
    # 4. Loại bỏ màu đỏ đường (đường đỏ trên bản đồ)
    is_red_line = (r > 180) & (g < 80) & (b < 80)
    not_red_line = ~is_red_line
    
    # 5. Loại bỏ border đen có blue thấp (khác với đất than bùn)
    is_dark_border = (r < 45) & (g < 45) & (b < 70) & ~((r < 50) & (g < 20) & (b > 45))
    not_dark_border = ~is_dark_border
    
    # Kết hợp tất cả filters
    valid_mask = not_pure_white & not_black & not_dark_gray & not_red_line & not_dark_border
    valid_pixels = pixels[valid_mask]
    
    if verbose:
        print(f"   Pixels hợp lệ: {len(valid_pixels):,} / {len(pixels):,}")
    
    # 🔥 VECTORIZED QUANTIZATION
    step = 256 // HISTOGRAM_BINS
    quantized = (valid_pixels // step) * step
    
    # Convert to tuple for hashing - sử dụng np.unique thay vì Counter
    # Tạo unique key bằng cách pack RGB vào 1 số
    keys = quantized[:, 0].astype(np.int32) * 65536 + \
           quantized[:, 1].astype(np.int32) * 256 + \
           quantized[:, 2].astype(np.int32)
    
    unique_keys, counts = np.unique(keys, return_counts=True)
    
    if verbose:
        print(f"   Số màu unique (sau quantize): {len(unique_keys)}")
    
    # Chuyển thành kết quả
    results = []
    valid_count = len(valid_pixels)
    
    # Sort by count descending
    sorted_indices = np.argsort(-counts)
    
    for idx in sorted_indices:
        key = unique_keys[idx]
        count = counts[idx]
        
        percentage = (count / valid_count) * 100
        if percentage < MIN_PERCENTAGE:
            continue
        
        # Unpack RGB from key
        r = (key // 65536) & 0xFF
        g = (key // 256) & 0xFF  
        b = key & 0xFF
        
        hex_color = rgb_to_hex(r, g, b)
        soil_type, distance = match_color_to_mock(hex_color)
        
        results.append({
            'hex': hex_color,
            'rgb': (r, g, b),
            'percentage': percentage,
            'soil_type': soil_type,
            'distance': distance
        })
    
    return results


# ============================================================
# 🔧 PHƯƠNG PHÁP 2: SAMPLING + K-MEANS (BACKUP)
# ============================================================
def analyze_with_kmeans_sampling(image_rgb, n_clusters=25, verbose=True):
    """
    K-means với sampling - giảm từ 25 phút xuống 3-8 giây.
    """
    if verbose:
        print("\n🔧 PHƯƠNG PHÁP: K-MEANS + SAMPLING")
    
    pixels = image_rgb.reshape(-1, 3)
    
    # Lọc pixel hợp lệ (vectorized cho nhanh)
    r, g, b = pixels[:, 0], pixels[:, 1], pixels[:, 2]
    
    # Masks
    not_white = ~((r > 248) & (g > 248) & (b > 248))
    not_black = ~((r < 20) & (g < 20) & (b < 20))
    not_gray = ~((np.abs(r.astype(int) - g.astype(int)) < 15) & 
                 (np.abs(g.astype(int) - b.astype(int)) < 15) & 
                 (r > 50) & (r < 200))
    
    valid_mask = not_white & not_black & not_gray
    valid_pixels = pixels[valid_mask].astype(np.float32)
    
    if verbose:
        print(f"   Pixels hợp lệ: {len(valid_pixels):,} / {len(pixels):,}")
    
    # 🔥 SAMPLING - Giảm 300-600 lần thời gian
    if len(valid_pixels) > MAX_SAMPLES:
        if verbose:
            print(f"   ⚡ Sampling: {len(valid_pixels):,} → {MAX_SAMPLES:,} pixels")
        idx = np.random.choice(len(valid_pixels), MAX_SAMPLES, replace=False)
        sample = valid_pixels[idx]
    else:
        sample = valid_pixels
    
    # K-means clustering
    if verbose:
        print(f"   🔄 Running K-means với {n_clusters} clusters...")
    
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
    _, labels, centers = cv2.kmeans(sample, n_clusters, None, criteria, 5, cv2.KMEANS_RANDOM_CENTERS)
    
    # Đếm và tạo kết quả
    label_counts = Counter(labels.flatten())
    results = []
    
    for idx, count in label_counts.most_common():
        center = centers[idx]
        r, g, b = int(center[0]), int(center[1]), int(center[2])
        hex_color = rgb_to_hex(r, g, b)
        percentage = (count / len(sample)) * 100
        
        if percentage < MIN_PERCENTAGE:
            continue
        
        soil_type, distance = match_color_to_mock(hex_color)
        results.append({
            'hex': hex_color,
            'rgb': (r, g, b),
            'percentage': percentage,
            'soil_type': soil_type,
            'distance': distance
        })
    
    return results


# ============================================================
# 📊 HÀM CHÍNH - HỖ TRỢ CẢ 2 PHƯƠNG PHÁP
# ============================================================
def extract_and_analyze_colors(image_path, method='histogram'):
    """
    Extract colors from map image and match with mock data.
    
    Args:
        image_path: Đường dẫn file ảnh
        method: 'histogram' (mặc định, nhanh nhất) hoặc 'kmeans' (backup)
    """
    print(f"\n{'='*70}")
    print(f"   PHÂN TÍCH MÀU BẢN ĐỒ THỔ NHƯỠNG CÀ MAU")
    print(f"{'='*70}")
    print(f"📁 File: {image_path}")
    print(f"⚙️  Method: {method.upper()}")
    
    start_time = time.time()
    
    # Đọc ảnh
    image = cv2.imread(image_path)
    if image is None:
        print(f"❌ ERROR: Cannot read file: {image_path}")
        return None
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    h, w = image_rgb.shape[:2]
    print(f"📐 Kích thước: {w:,} x {h:,} = {w*h:,} pixels")
    
    # Chọn phương pháp
    if method == 'histogram':
        results = analyze_with_histogram(image_rgb)
    elif method == 'kmeans':
        results = analyze_with_kmeans_sampling(image_rgb)
    else:
        print(f"❌ Unknown method: {method}")
        return None
    
    elapsed = time.time() - start_time
    print(f"\n⏱️  Thời gian xử lý: {elapsed:.2f} giây")
    
    # In kết quả
    print_results(results)
    
    return results


def print_results(results):
    """In kết quả phân tích"""
    if not results:
        print("❌ Không có kết quả")
        return
    
    print(f"\n{'─'*90}")
    print(f"{'HEX':<10} {'RGB':<18} {'%':>7}  {'Distance':>8}  Loại đất")
    print(f"{'─'*90}")
    
    matched_count = 0
    unmatched_colors = []
    
    for r in results:
        hex_c = r['hex']
        rgb_str = f"({r['rgb'][0]:3d},{r['rgb'][1]:3d},{r['rgb'][2]:3d})"
        pct = f"{r['percentage']:.1f}%"
        dist = f"{r['distance']:.1f}" if r['distance'] else "0"
        
        if r['soil_type']:
            matched_count += 1
            status = "✅"
            soil = r['soil_type']
        else:
            status = "❌"
            soil = "KHÔNG TÌM THẤY"
            unmatched_colors.append(r)
        
        print(f"{hex_c:<10} {rgb_str:<18} {pct:>7}  {dist:>8}  {status} {soil}")
    
    # Summary
    print(f"\n{'='*70}")
    print(f"   📊 TÓM TẮT KẾT QUẢ")
    print(f"{'='*70}")
    print(f"   Tổng vùng màu: {len(results)}")
    print(f"   ✅ Đã match:   {matched_count}")
    print(f"   ❌ Chưa match: {len(unmatched_colors)}")
    
    if unmatched_colors:
        print(f"\n   ⚠️  MÀU CHƯA MATCH (cần thêm vào mock data):")
        for u in unmatched_colors:
            print(f"      {u['hex']} RGB{u['rgb']} - {u['percentage']:.1f}% - distance: {u['distance']:.1f}")
    
    # Thống kê theo loại đất
    print(f"\n{'─'*70}")
    print(f"   🗺️  THỐNG KÊ THEO LOẠI ĐẤT")
    print(f"{'─'*70}")
    
    soil_stats = {}
    for r in results:
        if r['soil_type']:
            soil_stats[r['soil_type']] = soil_stats.get(r['soil_type'], 0) + r['percentage']
    
    sorted_stats = sorted(soil_stats.items(), key=lambda x: x[1], reverse=True)
    for soil, pct in sorted_stats:
        bar = "█" * int(pct / 2)  # Visual bar
        print(f"   {pct:5.1f}% {bar} {soil}")
    
    # === VALIDATION: Kiểm tra có đủ loại đất không ===
    print(f"\n{'─'*70}")
    print(f"   ✅ KIỂM TRA ĐỦ LOẠI ĐẤT (22 loại theo chú thích)")
    print(f"{'─'*70}")
    
    detected_types = set(soil_stats.keys())
    expected_types = set(SOIL_TYPES_IN_LEGEND)
    
    matched = detected_types & expected_types
    missing = expected_types - detected_types
    extra = detected_types - expected_types
    
    print(f"   📊 Phát hiện: {len(detected_types)} loại")
    print(f"   ✅ Khớp với chú thích: {len(matched)}/22")
    
    if missing:
        print(f"\n   ⚠️  THIẾU ({len(missing)} loại):")
        for m in sorted(missing):
            print(f"      - {m}")
    
    if extra:
        print(f"\n   ℹ️  THÊM (không có trong chú thích):")
        for e in sorted(extra):
            print(f"      - {e}")
    
    if len(matched) == 22:
        print(f"\n   🎉 HOÀN HẢO! Đã match đủ 22/22 loại đất!")

if __name__ == "__main__":
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='Phân tích màu bản đồ thổ nhưỡng')
    parser.add_argument('image', nargs='?', 
                        default=r"E:\Agriplanner\backend\python\image\upscalemedia-transformed (1).jpeg",
                        help='Đường dẫn file ảnh')
    parser.add_argument('--method', '-m', choices=['histogram', 'kmeans'], 
                        default='histogram',
                        help='Phương pháp: histogram (mặc định, nhanh) hoặc kmeans')
    parser.add_argument('--benchmark', '-b', action='store_true',
                        help='Chạy benchmark so sánh cả 2 phương pháp')
    
    args = parser.parse_args()
    
    if args.benchmark:
        print("\n" + "🏁"*35)
        print("   BENCHMARK: SO SÁNH 2 PHƯƠNG PHÁP")
        print("🏁"*35)
        
        # Test histogram
        print("\n" + "="*70)
        t1 = time.time()
        r1 = extract_and_analyze_colors(args.image, method='histogram')
        time_hist = time.time() - t1
        
        # Test kmeans
        print("\n" + "="*70)
        t2 = time.time()
        r2 = extract_and_analyze_colors(args.image, method='kmeans')
        time_kmeans = time.time() - t2
        
        # So sánh
        print("\n" + "🏆"*35)
        print("   KẾT QUẢ BENCHMARK")
        print("🏆"*35)
        print(f"\n   📊 Histogram:  {time_hist:.2f} giây")
        print(f"   🔧 K-means:    {time_kmeans:.2f} giây")
        print(f"   ⚡ Tỷ lệ:      Histogram nhanh hơn {time_kmeans/time_hist:.1f}x")
    else:
        extract_and_analyze_colors(args.image, method=args.method)
