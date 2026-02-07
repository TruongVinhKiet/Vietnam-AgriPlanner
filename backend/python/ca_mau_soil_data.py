#!/usr/bin/env python3
"""
Cà Mau Soil Types Data
======================
Dữ liệu 22 loại đất tỉnh Cà Mau với thông tin màu sắc từ bản đồ thổ nhưỡng.
Mỗi loại đất có màu chính (primary) và các biến thể do nén JPEG.

Sử dụng:
    from ca_mau_soil_data import CA_MAU_SOIL_TYPES
"""

# Màu sắc ở định dạng RGB (R, G, B)

CA_MAU_SOIL_TYPES = {
    # ═══════════════════════════════════════════════════════════════════════════
    # 1. ĐẤT CÁT GIỒNG - Màu VÀNG TƯƠI (Yellow)
    # ═══════════════════════════════════════════════════════════════════════════
    "DAT_CAT_GIONG": {
        "name_vi": "Đất cát giồng",
        "code": "Cg",
        "description": "Đất cát giồng - thích hợp trồng hoa màu, cây ăn trái",
        "colors": [
            (255, 255, 0),    # Primary - pure yellow
            (252, 252, 0),
            (248, 248, 0),
            (252, 252, 4),
            (255, 255, 153),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 2. ĐẤT MẶN NHIỀU - Màu HỒNG NHẠT (Light pink)
    # ═══════════════════════════════════════════════════════════════════════════
    "DAT_MAN_NHIEU": {
        "name_vi": "Đất mặn nhiều",
        "code": "M3",
        "description": "Đất mặn nhiều - cần cải tạo trước khi canh tác",
        "colors": [
            (255, 153, 204),  # Primary - light pink
            (255, 170, 200),
            (250, 160, 195),
            (255, 145, 190),
            (248, 155, 198),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 3. ĐẤT MẶN TRUNG BÌNH - Màu HỒNG RẤT NHẠT (Very pale pink)
    # ═══════════════════════════════════════════════════════════════════════════
    "DAT_MAN_TRUNG_BINH": {
        "name_vi": "Đất mặn trung bình",
        "code": "M2",
        "description": "Đất mặn trung bình - có thể canh tác với biện pháp phù hợp",
        "colors": [
            (255, 182, 216),  # Primary
            (250, 180, 210),
            (255, 190, 220),
            (248, 175, 205),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 4. ĐẤT MẶN ÍT - Màu HỒNG PHẤN (Pale pink)
    # ═══════════════════════════════════════════════════════════════════════════
    "DAT_MAN_IT": {
        "name_vi": "Đất mặn ít",
        "code": "M1",
        "description": "Đất mặn ít - thích hợp trồng lúa, hoa màu",
        "colors": [
            (255, 204, 229),  # Primary
            (250, 200, 225),
            (240, 195, 220),
            (245, 198, 222),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 5. ĐẤT PHÈN TIỀM TÀNG NÔNG dưới rừng ngập mặn - TÍM NHẠT (Light lavender)
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_TT_NONG_RNM": {
        "name_vi": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
        "code": "SP-tt-nn-RNM",
        "description": "Đất phèn tiềm tàng nông dưới rừng ngập mặn",
        "colors": [
            (230, 179, 230),  # Primary - light lavender
            (226, 173, 228),
            (222, 180, 242),
            (215, 190, 223),
            (220, 175, 235),
            (216, 176, 252),  # #d8b0fc detected
            (212, 176, 252),
            (220, 176, 252),
            (204, 160, 252),
            (200, 156, 248),
            (204, 164, 252),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 6. ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN NHIỀU - HỒNG TÍM (Magenta pink)
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_TT_NONG_MAN_NHIEU": {
        "name_vi": "Đất phèn tiềm tàng nông, mặn nhiều",
        "code": "SP-tt-nn-M3",
        "description": "Đất phèn tiềm tàng nông, mặn nhiều",
        "colors": [
            (255, 153, 255),  # Primary - bright magenta
            (252, 128, 252),  # #fc80fc
            (252, 132, 252),  # #fc84fc
            (252, 128, 248),
            (252, 124, 248),
            (248, 124, 244),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 7. ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN TRUNG BÌNH - TÍM XANH NHẠT
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_TT_NONG_MAN_TB": {
        "name_vi": "Đất phèn tiềm tàng nông, mặn trung bình",
        "code": "SP-tt-nn-M2",
        "description": "Đất phèn tiềm tàng nông, mặn trung bình",
        "colors": [
            (255, 179, 255),  # Primary
            (200, 216, 252),  # #c8d8fc
            (196, 212, 248),
            (192, 208, 252),
            (188, 208, 252),
            (188, 212, 252),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 8. ĐẤT PHÈN TIỀM TÀNG NÔNG, MẶN ÍT - HỒNG NHẠT
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_TT_NONG_MAN_IT": {
        "name_vi": "Đất phèn tiềm tàng nông, mặn ít",
        "code": "SP-tt-nn-M1",
        "description": "Đất phèn tiềm tàng nông, mặn ít",
        "colors": [
            (255, 204, 255),  # Primary
            (252, 176, 220),  # #fcb0dc
            (252, 180, 220),
            (248, 172, 216),
            (252, 176, 216),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 9. ĐẤT PHÈN TIỀM TÀNG SÂU dưới rừng ngập mặn - TÍM XANH NHẠT
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_TT_SAU_RNM": {
        "name_vi": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",
        "code": "SP-tt-s-RNM",
        "description": "Đất phèn tiềm tàng sâu dưới rừng ngập mặn",
        "colors": [
            (204, 153, 255),  # Primary - light purple
            (200, 200, 252),  # #c8c8fc
            (196, 196, 248),
            (200, 200, 248),
            (204, 204, 252),
            (252, 204, 252),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 10. ĐẤT PHÈN TIỀM TÀNG SÂU, MẶN NHIỀU - HỒNG ĐẬM/MAGENTA
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_TT_SAU_MAN_NHIEU": {
        "name_vi": "Đất phèn tiềm tàng sâu, mặn nhiều",
        "code": "SP-tt-s-M3",
        "description": "Đất phèn tiềm tàng sâu, mặn nhiều",
        "colors": [
            (204, 153, 204),  # Primary
            (252, 96, 176),   # #fc60b0
            (252, 92, 172),
            (248, 88, 168),
            (252, 100, 180),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 11. ĐẤT PHÈN TIỀM TÀNG SÂU, MẶN TRUNG BÌNH - HỒNG TÍM
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_TT_SAU_MAN_TB": {
        "name_vi": "Đất phèn tiềm tàng sâu, mặn trung bình",
        "code": "SP-tt-s-M2",
        "description": "Đất phèn tiềm tàng sâu, mặn trung bình",
        "colors": [
            (204, 179, 230),  # Primary
            (252, 116, 252),  # #fc74fc
            (252, 116, 248),
            (252, 120, 248),
            (252, 112, 244),
            (248, 112, 244),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 12. ĐẤT PHÈN TIỀM TÀNG SÂU, MẶN ÍT - HỒNG NHẠT
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_TT_SAU_MAN_IT": {
        "name_vi": "Đất phèn tiềm tàng sâu, mặn ít",
        "code": "SP-tt-s-M1",
        "description": "Đất phèn tiềm tàng sâu, mặn ít",
        "colors": [
            (204, 204, 255),  # Primary
            (252, 168, 252),  # #fca8fc
            (252, 164, 252),
            (252, 160, 252),
            (252, 164, 248),
            (252, 172, 252),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 13. ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN NHIỀU - HỒNG/MAGENTA
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_HD_NONG_MAN_NHIEU": {
        "name_vi": "Đất phèn hoạt động nông, mặn nhiều",
        "code": "SP-hd-nn-M3",
        "description": "Đất phèn hoạt động nông, mặn nhiều",
        "colors": [
            (204, 102, 204),  # Primary
            (252, 176, 252),  # #fcb0fc
            (252, 180, 252),
            (252, 176, 248),
            (248, 172, 248),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 14. ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN TRUNG BÌNH - HỒNG ĐẬM
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_HD_NONG_MAN_TB": {
        "name_vi": "Đất phèn hoạt động nông, mặn trung bình",
        "code": "SP-hd-nn-M2",
        "description": "Đất phèn hoạt động nông, mặn trung bình",
        "colors": [
            (204, 153, 230),  # Primary
            (252, 100, 176),  # #fc64b0
            (252, 104, 180),
            (248, 96, 172),
            (252, 96, 168),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 15. ĐẤT PHÈN HOẠT ĐỘNG NÔNG, MẶN ÍT - TÍM XANH NHẠT
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_HD_NONG_MAN_IT": {
        "name_vi": "Đất phèn hoạt động nông, mặn ít",
        "code": "SP-hd-nn-M1",
        "description": "Đất phèn hoạt động nông, mặn ít",
        "colors": [
            (177, 181, 241),  # Primary
            (192, 196, 252),  # #c0c4fc
            (196, 200, 252),
            (192, 192, 252),
            (188, 188, 248),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 16. ĐẤT PHÈN HOẠT ĐỘNG SÂU, MẶN NHIỀU - HỒNG
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_HD_SAU_MAN_NHIEU": {
        "name_vi": "Đất phèn hoạt động sâu, mặn nhiều",
        "code": "SP-hd-s-M3",
        "description": "Đất phèn hoạt động sâu, mặn nhiều",
        "colors": [
            (153, 102, 204),  # Primary
            (252, 156, 220),  # #fc9cdc
            (252, 152, 216),
            (248, 148, 212),
            (252, 160, 224),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 17. ĐẤT PHÈN HOẠT ĐỘNG SÂU, MẶN TRUNG BÌNH - HỒNG ĐẬM/ĐỎ HỒNG
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_HD_SAU_MAN_TB": {
        "name_vi": "Đất phèn hoạt động sâu, mặn trung bình",
        "code": "SP-hd-s-M2",
        "description": "Đất phèn hoạt động sâu, mặn trung bình",
        "colors": [
            (153, 128, 204),  # Primary
            (252, 84, 168),   # #fc54a8
            (252, 88, 172),
            (248, 80, 164),
            (252, 80, 164),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 18. ĐẤT PHÈN HOẠT ĐỘNG SÂU, MẶN ÍT - XANH TÍM
    # ═══════════════════════════════════════════════════════════════════════════
    "PHEN_HD_SAU_MAN_IT": {
        "name_vi": "Đất phèn hoạt động sâu, mặn ít",
        "code": "SP-hd-s-M1",
        "description": "Đất phèn hoạt động sâu, mặn ít",
        "colors": [
            (153, 153, 204),  # Primary
            (148, 148, 244),  # #9494f4
            (144, 144, 240),
            (152, 152, 248),
            (140, 140, 236),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 19. ĐẤT THAN BÙN PHÈN MẶN - TÍM ĐẬM/ĐEN TÍM
    # ═══════════════════════════════════════════════════════════════════════════
    "DAT_THAN_BUN": {
        "name_vi": "Đất than bùn phèn mặn",
        "code": "T-p-M",
        "description": "Đất than bùn phèn mặn - vùng U Minh",
        "colors": [
            (51, 0, 102),     # Primary - dark purple
            (40, 0, 80),      # #280050
            (40, 0, 76),
            (36, 0, 72),
            (44, 0, 84),
            (32, 0, 68),
            (48, 0, 88),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 20. ĐẤT VÀNG ĐỎ trên đá Macma axit - CAM NHẠT/SALMON
    # ═══════════════════════════════════════════════════════════════════════════
    "DAT_VANG_DO": {
        "name_vi": "Đất vàng đỏ trên đá Macma axit",
        "code": "Fa",
        "description": "Đất vàng đỏ trên đá Macma axit",
        "colors": [
            (252, 184, 160),  # Primary - light salmon
            (248, 180, 156),
            (252, 188, 164),
            (244, 176, 152),
            (252, 180, 160),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 21. SÔNG, SUỐI, AO HỒ - XANH DA TRỜI/CYAN
    # ═══════════════════════════════════════════════════════════════════════════
    "SONG_SUOI": {
        "name_vi": "Sông, suối, ao hồ",
        "code": "WATER",
        "description": "Sông, suối, ao hồ - mặt nước",
        "colors": [
            (153, 204, 255),  # Primary - light blue
            (80, 252, 252),   # #50fcfc - cyan
            (76, 248, 248),
            (84, 252, 252),
            (0, 252, 252),
            (20, 248, 252),   # #14f8fc detected
            (104, 200, 252),  # #68c8fc detected
            (108, 200, 252),
            (108, 204, 252),
            (120, 200, 252),
            (116, 200, 252),
            (100, 196, 252),
            (96, 192, 252),
            (160, 192, 252),  # #a0c0fc
            (164, 192, 252),
            (168, 196, 252),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 22. BÃI BỒI VEN SÔNG, VEN BIỂN - XANH NHẠT/TRẮNG XANH
    # ═══════════════════════════════════════════════════════════════════════════
    "BAI_BOI": {
        "name_vi": "Bãi bồi ven sông, ven biển",
        "code": "Bb",
        "description": "Bãi bồi ven sông, ven biển",
        "colors": [
            (153, 255, 255),  # Primary - pale cyan
            (212, 252, 252),  # #d4fcfc
            (208, 248, 248),
            (216, 252, 252),
            (204, 244, 244),
            (220, 252, 252),
            (224, 252, 252),
        ],
    },
}

# Helper function để tra cứu soil type từ màu
def get_soil_type_by_color(rgb, max_distance=50):
    """
    Tìm loại đất từ màu RGB.
    
    Args:
        rgb: tuple (R, G, B)
        max_distance: Khoảng cách Euclidean tối đa cho phép
        
    Returns:
        dict hoặc None
    """
    import math
    
    r, g, b = rgb
    best_match = None
    min_distance = float('inf')
    
    for soil_key, soil_data in CA_MAU_SOIL_TYPES.items():
        for ref_color in soil_data.get("colors", []):
            ref_r, ref_g, ref_b = ref_color
            distance = math.sqrt((r - ref_r)**2 + (g - ref_g)**2 + (b - ref_b)**2)
            if distance < min_distance:
                min_distance = distance
                best_match = (soil_key, soil_data)
    
    if best_match and min_distance <= max_distance:
        soil_key, soil_data = best_match
        return {
            'key': soil_key,
            'name': soil_data.get('name_vi', soil_key),
            'code': soil_data.get('code', '?'),
            'description': soil_data.get('description', ''),
            'distance': round(min_distance, 2)
        }
    
    return None


if __name__ == "__main__":
    # Test
    print(f"Loaded {len(CA_MAU_SOIL_TYPES)} soil types")
    for key, data in CA_MAU_SOIL_TYPES.items():
        print(f"  {data['code']}: {data['name_vi']} ({len(data['colors'])} colors)")
