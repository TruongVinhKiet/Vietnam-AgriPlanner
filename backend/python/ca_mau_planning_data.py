#!/usr/bin/env python3
"""
Cà Mau Planning Zone Data
==========================
Dữ liệu các loại đất quy hoạch sử dụng đất tỉnh Cà Mau.
Màu sắc dựa trên quy ước bản đồ quy hoạch Việt Nam (BTNMT).
Mỗi loại đất có màu chính và các biến thể (do quét/nén JPEG).

Sử dụng:
    from ca_mau_planning_data import CA_MAU_PLANNING_ZONES
    
References:
    - Bản đồ quy hoạch sử dụng đất huyện Thới Bình, Cà Mau 2022
    - Quy chuẩn BTNMT về ký hiệu bản đồ quy hoạch sử dụng đất
"""

# Màu sắc ở định dạng RGB (R, G, B)

CA_MAU_PLANNING_ZONES = {
    # ═══════════════════════════════════════════════════════════════════════════
    # NHÓM ĐẤT NÔNG NGHIỆP
    # ═══════════════════════════════════════════════════════════════════════════
    
    "LUC": {
        "name_vi": "Đất trồng lúa",
        "code": "LUC",
        "category": "Đất nông nghiệp",
        "description": "Đất chuyên trồng lúa nước",
        "colors": [
            (0, 200, 100),     # Green
            (50, 200, 80),
            (0, 180, 70),
            (34, 180, 100),
            (80, 200, 100),
        ],
    },
    
    "LUK": {
        "name_vi": "Đất trồng lúa khác",
        "code": "LUK",
        "category": "Đất nông nghiệp",
        "description": "Đất trồng lúa nương, lúa rẫy",
        "colors": [
            (0, 210, 190),     # Cyan-green (phổ biến trên bản đồ Ca Mau)
            (100, 220, 200),
            (0, 200, 180),
            (80, 230, 210),
            (50, 210, 190),
            (0, 230, 200),
            (120, 225, 210),
        ],
    },
    
    "CHN": {
        "name_vi": "Đất trồng cây hàng năm khác",
        "code": "CHN",
        "category": "Đất nông nghiệp",
        "description": "Đất trồng màu, rau củ",
        "colors": [
            (134, 239, 172),   # Light green
            (100, 220, 140),
            (144, 238, 144),
            (120, 230, 160),
        ],
    },
    
    "CLN": {
        "name_vi": "Đất trồng cây lâu năm",
        "code": "CLN",
        "category": "Đất nông nghiệp",
        "description": "Đất trồng cây ăn quả, cây công nghiệp lâu năm",
        "colors": [
            (0, 128, 0),       # Dark green
            (0, 100, 0),
            (34, 139, 34),
            (21, 128, 61),
            (0, 130, 50),
        ],
    },
    
    "RSX": {
        "name_vi": "Đất rừng sản xuất",
        "code": "RSX",
        "category": "Đất nông nghiệp",
        "description": "Đất rừng trồng, rừng tự nhiên sản xuất",
        "colors": [
            (22, 101, 52),     # Forest green
            (0, 100, 0),
            (0, 80, 0),
            (20, 90, 40),
        ],
    },
    
    "RPH": {
        "name_vi": "Đất rừng phòng hộ",
        "code": "RPH",
        "category": "Đất nông nghiệp",
        "description": "Đất rừng phòng hộ đầu nguồn, ven biển",
        "colors": [
            (0, 60, 0),        # Very dark green
            (20, 83, 45),
            (0, 50, 0),
            (5, 46, 22),
        ],
    },
    
    "RDD": {
        "name_vi": "Đất rừng đặc dụng",
        "code": "RDD",
        "category": "Đất nông nghiệp",
        "description": "Vườn quốc gia, khu bảo tồn thiên nhiên",
        "colors": [
            (0, 40, 0),        # Darkest green
            (5, 30, 6),
            (0, 50, 20),
        ],
    },
    
    "NTS": {
        "name_vi": "Đất nuôi trồng thủy sản",
        "code": "NTS",
        "category": "Đất nông nghiệp",
        "description": "Đất ao, hồ nuôi trồng thủy sản (tôm, cá)",
        "colors": [
            # Light cyan - Ca Mau planning maps (dominant color for aquaculture)
            (170, 255, 255),
            (165, 255, 255),
            (175, 250, 250),
            (160, 255, 255),
            (180, 250, 250),
            (160, 240, 240),
            (150, 245, 245),
            # Deeper cyan variants
            (0, 180, 220),
            (0, 200, 240),
            (100, 210, 230),
            (6, 182, 212),
            (0, 190, 210),
            (80, 200, 230),
        ],
    },
    
    "LMU": {
        "name_vi": "Đất làm muối",
        "code": "LMU",
        "category": "Đất nông nghiệp",
        "description": "Đất ruộng muối",
        "colors": [
            (224, 231, 255),   # Very light blue/lavender
            (200, 210, 240),
            (210, 220, 245),
        ],
    },
    
    "NKH": {
        "name_vi": "Đất nông nghiệp khác",
        "code": "NKH",
        "category": "Đất nông nghiệp",
        "description": "Đất nông nghiệp khác",
        "colors": [
            (163, 230, 53),    # Yellow-green
            (180, 230, 80),
            (150, 220, 50),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # NHÓM ĐẤT PHI NÔNG NGHIỆP
    # ═══════════════════════════════════════════════════════════════════════════
    
    "ONT": {
        "name_vi": "Đất ở nông thôn",
        "code": "ONT",
        "category": "Đất phi nông nghiệp",
        "description": "Đất ở tại nông thôn, khu dân cư",
        "colors": [
            (255, 252, 150),   # Light yellow - Ca Mau planning maps
            (255, 255, 120),
            (255, 250, 130),
            (255, 200, 0),     # Yellow/amber
            (251, 191, 36),
            (255, 210, 50),
            (255, 190, 0),
            (240, 200, 30),
            (255, 220, 80),
            (250, 240, 100),
        ],
    },
    
    "ODT": {
        "name_vi": "Đất ở đô thị",
        "code": "ODT",
        "category": "Đất phi nông nghiệp",
        "description": "Đất ở tại đô thị, thị trấn",
        "colors": [
            (245, 158, 11),    # Orange
            (255, 170, 0),
            (255, 165, 0),
            (230, 150, 20),
        ],
    },
    
    "TSC": {
        "name_vi": "Đất trụ sở cơ quan",
        "code": "TSC",
        "category": "Đất phi nông nghiệp",
        "description": "Đất trụ sở cơ quan nhà nước, công sở",
        "colors": [
            (239, 68, 68),     # Red
            (220, 60, 60),
            (200, 50, 50),
        ],
    },
    
    "DGD": {
        "name_vi": "Đất giáo dục",
        "code": "DGD",
        "category": "Đất phi nông nghiệp",
        "description": "Đất trường học, cơ sở giáo dục",
        "colors": [
            (139, 92, 246),    # Purple
            (120, 80, 230),
            (150, 100, 240),
        ],
    },
    
    "DYT": {
        "name_vi": "Đất y tế",
        "code": "DYT",
        "category": "Đất phi nông nghiệp",
        "description": "Đất bệnh viện, cơ sở y tế",
        "colors": [
            (236, 72, 153),    # Pink
            (220, 80, 140),
            (240, 90, 160),
        ],
    },
    
    "DVH": {
        "name_vi": "Đất văn hóa",
        "code": "DVH",
        "category": "Đất phi nông nghiệp",
        "description": "Đất công trình văn hóa",
        "colors": [
            (244, 114, 182),   # Light pink
            (230, 120, 170),
            (250, 130, 190),
        ],
    },
    
    "DTT": {
        "name_vi": "Đất thể thao",
        "code": "DTT",
        "category": "Đất phi nông nghiệp",
        "description": "Đất sân vận động, cơ sở thể thao",
        "colors": [
            (251, 146, 60),    # Orange
            (240, 150, 70),
            (255, 160, 80),
        ],
    },
    
    "DGT": {
        "name_vi": "Đất giao thông",
        "code": "DGT",
        "category": "Đất phi nông nghiệp",
        "description": "Đất đường giao thông, cầu, cảng",
        "colors": [
            (148, 163, 184),   # Gray/slate
            (150, 150, 150),
            (180, 180, 180),
            (128, 128, 128),
            (160, 160, 170),
            (252, 170, 51),    # Orange road (detected from Quy Hoạch PNG)
            (255, 165, 50),    # Orange highway
            (250, 170, 60),
            (240, 160, 50),
            (255, 175, 70),
        ],
    },
    
    "DTL": {
        "name_vi": "Đất thủy lợi",
        "code": "DTL",
        "category": "Đất phi nông nghiệp",
        "description": "Đất kênh mương, công trình thủy lợi",
        "colors": [
            (56, 189, 248),    # Light blue
            (0, 150, 255),
            (100, 180, 255),
            (50, 170, 240),
        ],
    },
    
    "DNL": {
        "name_vi": "Đất năng lượng",
        "code": "DNL",
        "category": "Đất phi nông nghiệp",
        "description": "Đất công trình năng lượng, trạm biến áp",
        "colors": [
            (252, 211, 77),    # Gold/yellow
            (240, 200, 60),
            (255, 220, 100),
        ],
    },
    
    "SKC": {
        "name_vi": "Đất khu công nghiệp",
        "code": "SKC",
        "category": "Đất phi nông nghiệp",
        "description": "Đất khu, cụm công nghiệp, nhà máy",
        "colors": [
            (168, 85, 247),    # Purple
            (147, 51, 234),
            (160, 100, 240),
        ],
    },
    
    "SKK": {
        "name_vi": "Đất khu kinh tế",
        "code": "SKK",
        "category": "Đất phi nông nghiệp",
        "description": "Đất khu kinh tế",
        "colors": [
            (192, 132, 252),   # Light purple
            (180, 120, 240),
            (200, 140, 250),
            (250, 170, 255),   # Bright pink-purple (detected from Quy Hoạch PNG)
            (252, 170, 254),
            (240, 160, 250),
            (255, 180, 255),
        ],
    },
    
    "TMD": {
        "name_vi": "Đất thương mại dịch vụ",
        "code": "TMD",
        "category": "Đất phi nông nghiệp",
        "description": "Đất thương mại, dịch vụ, chợ",
        "colors": [
            (251, 113, 133),   # Rose/salmon
            (240, 100, 120),
            (255, 130, 140),
        ],
    },
    
    "SON": {
        "name_vi": "Đất sông ngòi",
        "code": "SON",
        "category": "Đất phi nông nghiệp",
        "description": "Đất mặt nước sông, kênh, rạch",
        "colors": [
            (14, 165, 233),    # Blue
            (0, 120, 200),
            (30, 144, 255),
            (20, 150, 220),
        ],
    },
    
    "MNC": {
        "name_vi": "Đất mặt nước chuyên dùng",
        "code": "MNC",
        "category": "Đất phi nông nghiệp",
        "description": "Đất mặt nước chuyên dùng",
        "colors": [
            (2, 132, 199),     # Dark blue
            (0, 100, 180),
            (0, 90, 160),
        ],
    },
    
    "NTD": {
        "name_vi": "Đất nghĩa trang",
        "code": "NTD",
        "category": "Đất phi nông nghiệp",
        "description": "Đất nghĩa trang, nghĩa địa",
        "colors": [
            (100, 116, 139),   # Dark gray
            (90, 100, 120),
            (110, 120, 140),
        ],
    },
    
    # ═══════════════════════════════════════════════════════════════════════════
    # NHÓM ĐẤT CHƯA SỬ DỤNG
    # ═══════════════════════════════════════════════════════════════════════════
    
    "BCS": {
        "name_vi": "Đất bằng chưa sử dụng",
        "code": "BCS",
        "category": "Đất chưa sử dụng",
        "description": "Đất bằng chưa sử dụng, đất hoang",
        "colors": [
            (229, 231, 235),   # Light gray
            (220, 220, 220),
            (200, 200, 200),
        ],
    },
    
    "DCS": {
        "name_vi": "Đất đồi núi chưa sử dụng",
        "code": "DCS",
        "category": "Đất chưa sử dụng",
        "description": "Đất đồi núi chưa sử dụng",
        "colors": [
            (209, 213, 219),   # Medium gray
            (190, 195, 200),
            (200, 205, 210),
        ],
    },
}
