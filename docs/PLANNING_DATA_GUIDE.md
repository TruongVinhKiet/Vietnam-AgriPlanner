# Hướng dẫn Nhập Dữ liệu Quy hoạch Đất đai

## Nguồn Dữ liệu Chính thức cho Cần Thơ

### 1. Cổng GIS Cần Thơ (Nguồn ưu tiên)

**URL:** https://gisportal.cantho.gov.vn

Đây là nguồn dữ liệu chính thức từ UBND TP Cần Thơ.

#### Các lớp dữ liệu có sẵn:
- **Quy hoạch TP Cần Thơ 2021-2030, tầm nhìn 2050**
  - Phân vùng chức năng
  - Phương án phân bổ và khoanh vùng đất đai theo loại đất cấp tỉnh
  - Định hướng khu công nghiệp
  - Định hướng khu xử lý chất thải
  - Và nhiều lớp khác...

#### Cách truy cập:
1. Truy cập: https://gisportal.cantho.gov.vn/maps/web/kg/e574cba1-8f4b-4b4a-b654-5593045ba85b/0/home
2. Bật/tắt các lớp bản đồ trong mục "LỚP BẢN ĐỒ"
3. Zoom đến khu vực cần tra cứu
4. Click vào từng vùng để xem thông tin chi tiết

### 2. Sở Tài nguyên & Môi trường Cần Thơ

**URL:** https://sonnmt.cantho.gov.vn

Đây là cơ quan quản lý nhà nước về đất đai cấp tỉnh.

#### Cách lấy dữ liệu:
- Liên hệ trực tiếp để yêu cầu dữ liệu số
- Địa chỉ: Số 02 Hòa Bình, P. Tân An, Q. Ninh Kiều, TP. Cần Thơ
- Email: banbientap@cantho.gov.vn

### 3. Guland.vn (Nguồn tham khảo)

**URL:** https://guland.vn/soi-quy-hoach

⚠️ **Lưu ý:** Đây là nguồn tham khảo, cần đối chiếu với nguồn chính thức trước khi sử dụng.

---

## Quy trình Nhập Dữ liệu vào AgriPlanner

### Cách 1: Nhập thủ công qua giao diện web

1. Mở trang Trồng trọt > Click nút "Quy hoạch"
2. Click "Vẽ vùng mới" để vẽ polygon trên bản đồ
3. Điền thông tin:
   - Tên vùng
   - Loại đất (chọn từ danh mục 25+ loại đất theo Luật Đất đai)
   - Mục đích sử dụng
   - Nguồn dữ liệu (bắt buộc ghi rõ nguồn)
   - Địa điểm (Tỉnh/Quận-Huyện/Xã-Phường)
4. Lưu vùng quy hoạch

### Cách 2: Import hàng loạt qua API

```bash
POST /api/planning-zones
Content-Type: application/json

{
  "name": "Khu đất trồng lúa Phong Điền",
  "boundaryCoordinates": "[[10.0342, 105.7705], [10.0342, 105.7805], [10.0442, 105.7805], [10.0442, 105.7705]]",
  "areaSqm": 100000,
  "centerLat": 10.0392,
  "centerLng": 105.7755,
  "zoneType": "Đất nông nghiệp",
  "zoneCode": "LUC",
  "landUsePurpose": "Đất chuyên trồng lúa nước",
  "planningPeriod": "2021-2030",
  "province": "Cần Thơ",
  "district": "Phong Điền",
  "commune": "Xã Nhơn Ái",
  "source": "Cổng GIS Cần Thơ - gisportal.cantho.gov.vn",
  "sourceUrl": "https://gisportal.cantho.gov.vn/maps/web/kg/e574cba1-8f4b-4b4a-b654-5593045ba85b/0/home",
  "fillColor": "#22c55e",
  "strokeColor": "#15803d",
  "fillOpacity": 0.4,
  "notes": "Dữ liệu từ lớp 'Phương án phân bổ và khoanh vùng đất đai'"
}
```

---

## Danh mục Loại đất theo Luật Đất đai Việt Nam

### Nhóm đất Nông nghiệp
| Mã | Tên | Mô tả |
|----|-----|-------|
| LUC | Đất trồng lúa | Đất chuyên trồng lúa nước |
| LUK | Đất trồng lúa khác | Đất trồng lúa nương, lúa rẫy |
| CHN | Đất trồng cây hàng năm khác | Đất trồng màu, rau củ |
| CLN | Đất trồng cây lâu năm | Đất trồng cây ăn quả, cây công nghiệp |
| RSX | Đất rừng sản xuất | Đất rừng trồng, rừng tự nhiên sản xuất |
| RPH | Đất rừng phòng hộ | Đất rừng phòng hộ đầu nguồn |
| RDD | Đất rừng đặc dụng | Vườn quốc gia, khu bảo tồn |
| NTS | Đất nuôi trồng thủy sản | Đất ao, hồ nuôi trồng thủy sản |
| LMU | Đất làm muối | Đất ruộng muối |
| NKH | Đất nông nghiệp khác | Đất nông nghiệp khác |

### Nhóm đất Phi nông nghiệp
| Mã | Tên | Mô tả |
|----|-----|-------|
| ONT | Đất ở nông thôn | Đất ở tại nông thôn |
| ODT | Đất ở đô thị | Đất ở tại đô thị |
| TSC | Đất trụ sở cơ quan | Đất trụ sở cơ quan nhà nước |
| DGD | Đất giáo dục | Đất trường học, cơ sở giáo dục |
| DYT | Đất y tế | Đất bệnh viện, cơ sở y tế |
| DVH | Đất văn hóa | Đất công trình văn hóa |
| DTT | Đất thể thao | Đất sân vận động, cơ sở thể thao |
| DGT | Đất giao thông | Đất đường giao thông |
| DTL | Đất thủy lợi | Đất công trình thủy lợi |
| DNL | Đất năng lượng | Đất công trình năng lượng |
| SKC | Đất khu công nghiệp | Đất khu, cụm công nghiệp |
| SKK | Đất khu kinh tế | Đất khu kinh tế |
| SKT | Đất khu công nghệ cao | Đất khu công nghệ cao |
| TMD | Đất thương mại dịch vụ | Đất thương mại, dịch vụ |
| NTD | Đất nghĩa trang | Đất nghĩa trang, nghĩa địa |
| SON | Đất sông ngòi | Đất mặt nước sông, kênh |
| MNC | Đất mặt nước chuyên dùng | Đất mặt nước chuyên dùng |
| PNK | Đất phi nông nghiệp khác | Đất phi nông nghiệp khác |

### Nhóm đất Chưa sử dụng
| Mã | Tên | Mô tả |
|----|-----|-------|
| BCS | Đất bằng chưa sử dụng | Đất bằng chưa sử dụng |
| DCS | Đất đồi núi chưa sử dụng | Đất đồi núi chưa sử dụng |
| NCS | Núi đá không có rừng cây | Núi đá không có rừng cây |

---

## Các quận/huyện TP Cần Thơ

| Mã | Tên | Tọa độ tâm |
|----|-----|------------|
| NK | Quận Ninh Kiều | 10.0306, 105.7701 |
| BT | Quận Bình Thủy | 10.0833, 105.7333 |
| CR | Quận Cái Răng | 10.0000, 105.7500 |
| OT | Quận Ô Môn | 10.1167, 105.6333 |
| TN | Quận Thốt Nốt | 10.2333, 105.5833 |
| PD | Huyện Phong Điền | 10.0500, 105.7167 |
| CD | Huyện Cờ Đỏ | 10.0167, 105.5167 |
| VT | Huyện Vĩnh Thạnh | 10.2000, 105.4667 |
| TL | Huyện Thới Lai | 10.0667, 105.5667 |

---

## Lưu ý Pháp lý

⚠️ **Quan trọng:**

1. Dữ liệu quy hoạch chỉ mang tính chất **tham khảo**.
2. Để xác nhận chính xác, cần liên hệ với **Sở TN&MT** hoặc **UBND địa phương**.
3. Việc sử dụng đất phải tuân theo **quy định của pháp luật** về đất đai hiện hành.
4. Thông tin quy hoạch có thể thay đổi theo các quyết định của cơ quan có thẩm quyền.

---

## Liên hệ Hỗ trợ

- **Cổng GIS Cần Thơ:** banbientap@cantho.gov.vn
- **Sở TN&MT Cần Thơ:** https://sonnmt.cantho.gov.vn
- **UBND TP Cần Thơ:** https://cantho.gov.vn
