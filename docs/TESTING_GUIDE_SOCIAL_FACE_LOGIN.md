# Hướng Dẫn Test Chức Năng Đăng Nhập Mạng Xã Hội & Khuôn Mặt

## Mục Lục
1. [Yêu Cầu Chuẩn Bị](#1-yêu-cầu-chuẩn-bị)
2. [Khởi Động Hệ Thống](#2-khởi-động-hệ-thống)
3. [Test Đăng Nhập Google](#3-test-đăng-nhập-google)
4. [Test Đăng Nhập Facebook](#4-test-đăng-nhập-facebook)
5. [Test Đăng Nhập GitHub](#5-test-đăng-nhập-github)
6. [Test Đăng Nhập Khuôn Mặt](#6-test-đăng-nhập-khuôn-mặt)
7. [Test Các Trường Hợp Lỗi](#7-test-các-trường-hợp-lỗi)
8. [Checklist Tổng Hợp](#8-checklist-tổng-hợp)

---

## 1. Yêu Cầu Chuẩn Bị

### Phần mềm cần thiết
- **Java 17+**: Cho Spring Boot backend
- **PostgreSQL**: Database đang chạy với schema đã migrate
- **Python 3.10+**: Cho Face Recognition Service
- **Trình duyệt**: Chrome/Edge (cần webcam cho face login)
- **Node.js** (tùy chọn): Cho lite-server frontend

### Tài khoản test
| Loại | Yêu cầu |
|------|---------|
| Google | Tài khoản Google thật (Gmail) |
| Facebook | Tài khoản Facebook Developer + test user |
| GitHub | Tài khoản GitHub thật |
| Khuôn mặt | Webcam hoặc ảnh chân dung rõ nét |

### Cấu hình OAuth
Đảm bảo file `.env` có đầy đủ thông tin:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

---

## 2. Khởi Động Hệ Thống

### Bước 1: Khởi động PostgreSQL
Đảm bảo PostgreSQL đang chạy và database `agriplanner` tồn tại.

### Bước 2: Khởi động Spring Boot Backend
```bash
cd backend
mvn spring-boot:run
```
Backend sẽ chạy tại `http://localhost:8080`

### Bước 3: Khởi động Face Recognition Service (Python)
```bash
cd backend/python
# Kích hoạt virtual environment
..\..\.venv\Scripts\activate    # Windows
# hoặc
source ../../.venv/bin/activate  # Linux/Mac

# Chạy service
python face_service.py
```
Service sẽ chạy tại `http://localhost:5001`

**Kiểm tra health:**
```bash
curl http://localhost:5001/health
```
Kết quả mong đợi:
```json
{"service": "Face Recognition Service", "status": "ok", "tolerance": 0.5}
```

### Bước 4: Khởi động Frontend
```bash
# Từ thư mục gốc
npx lite-server
# hoặc
npm start
```
Frontend sẽ chạy tại `http://localhost:3000`

---

## 3. Test Đăng Nhập Google

### 3.1. Test đăng ký bằng Google (lần đầu)
1. Truy cập `http://localhost:3000/pages/register.html`
2. Nhấn nút **"Google"** trong phần "Đăng ký nhanh bằng"
3. Chọn tài khoản Google trong popup
4. **Kết quả mong đợi**: Hiện hộp thoại "Chọn vai trò"
5. Chọn vai trò:
   - **Chủ trang trại (OWNER)**: Nhập tên nông trại → Nhấn "Đăng ký"
   - **Người lao động (WORKER)**: Chọn nông trại + nhập CV → Nhấn "Đăng ký"
6. **Kết quả mong đợi**:
   - OWNER: Chuyển hướng đến trang Admin (`admin.html`)
   - WORKER: Hiện thông báo "Chờ duyệt"

### 3.2. Test đăng nhập bằng Google (đã có tài khoản)
1. Truy cập `http://localhost:3000/pages/login.html`
2. Nhấn nút **"Google"**
3. Chọn tài khoản Google đã đăng ký
4. **Kết quả mong đợi**: Đăng nhập thành công, chuyển hướng theo vai trò

### 3.3. Test đăng nhập Google khi chưa đăng ký
1. Dùng tài khoản Google **chưa đăng ký**
2. Nhấn nút "Google" trên trang login
3. **Kết quả mong đợi**: Hiện modal thông báo "Chưa có tài khoản" với link đăng ký

---

## 4. Test Đăng Nhập Facebook

### 4.1. Cấu hình Facebook Developer
1. Vào [Facebook Developer Console](https://developers.facebook.com)
2. Chọn ứng dụng → **Settings** → **Basic**
3. Thêm domain `localhost` vào **App Domains**
4. Trong **Facebook Login** → **Settings**:
   - Valid OAuth Redirect URIs: `http://localhost:3000/pages/login.html`
5. Đảm bảo ứng dụng ở chế độ **Development** (hoặc thêm test user)

### 4.2. Test đăng ký bằng Facebook
1. Truy cập trang đăng ký
2. Nhấn nút **"Facebook"**
3. Đăng nhập Facebook trong popup → Cấp quyền email
4. **Kết quả mong đợi**: Hiện hộp thoại chọn vai trò
5. Hoàn tất đăng ký như Google

### 4.3. Test đăng nhập bằng Facebook
1. Truy cập trang đăng nhập
2. Nhấn nút **"Facebook"**
3. **Kết quả mong đợi**: Đăng nhập thành công nếu đã đăng ký

### 4.4. Test khi không cấp quyền email
1. Đăng nhập Facebook nhưng **bỏ quyền email**
2. **Kết quả mong đợi**: Hiện lỗi "Facebook không cung cấp email"

---

## 5. Test Đăng Nhập GitHub

### 5.1. Cấu hình GitHub OAuth App
1. Vào [GitHub Settings → Developer Settings → OAuth Apps](https://github.com/settings/developers)
2. Đảm bảo **Authorization callback URL** là:
   ```
   http://localhost:3000/pages/login.html
   ```
   (Và cũng thêm `http://localhost:3000/pages/register.html` nếu cần)

### 5.2. Test đăng ký bằng GitHub
1. Truy cập trang đăng ký
2. Nhấn nút **"GitHub"**
3. **Kết quả**: Chuyển hướng sang GitHub → Authorize app
4. Quay về trang register → Hiện hộp thoại chọn vai trò
5. Chọn vai trò và hoàn tất

### 5.3. Test đăng nhập bằng GitHub
1. Truy cập trang đăng nhập
2. Nhấn nút **"GitHub"**
3. **Kết quả**: Chuyển hướng → Authorize → Quay về → Đăng nhập thành công

### 5.4. Test đăng nhập GitHub khi chưa đăng ký
1. Dùng tài khoản GitHub chưa đăng ký
2. **Kết quả mong đợi**: Hiện modal "Chưa có tài khoản" với link đăng ký

---

## 6. Test Đăng Nhập Khuôn Mặt

### 6.1. Đăng ký khuôn mặt (trong Cài đặt)
1. Đăng nhập bình thường (email/mật khẩu hoặc mạng xã hội)
2. Vào **Cài đặt** (`settings.html`) → Phần **Bảo mật**
3. Tìm mục **"Đăng nhập bằng khuôn mặt"**
4. Bật toggle → Panel thiết lập xuất hiện

#### a) Đăng ký qua Camera:
5. Nhấn **"Sử dụng Camera"**
6. Cho phép trình duyệt truy cập webcam
7. Đưa khuôn mặt vào khung (đảm bảo đủ sáng, chỉ 1 người)
8. Hệ thống tự phát hiện khuôn mặt (viền xanh)
9. Nhấn **"Chụp & Đăng ký"**
10. **Kết quả mong đợi**: 
    - Hiện trạng thái "Đang xử lý..."→ 4 bước (encode → check unique → upload → register)
    - Thành công: Hiện "✓ Đã đăng ký khuôn mặt"
    - Thông báo toast "Đăng ký khuôn mặt thành công!"

#### b) Đăng ký qua Upload ảnh:
5. Nhấn **"Tải ảnh lên"**
6. Chọn ảnh chân dung rõ nét (JPG/PNG)
7. **Kết quả mong đợi**: Tương tự camera

### 6.2. Test đăng nhập bằng khuôn mặt
1. Đăng xuất
2. Vào trang đăng nhập
3. Nhấn nút **"Khuôn mặt"** (biểu tượng mặt)
4. Modal hiện ra với 2 tùy chọn:

#### a) Đăng nhập qua Camera:
5. Nhấn **"Sử dụng camera"**
6. Cho phép webcam → Đưa mặt vào khung
7. Hệ thống tự phát hiện → Hiện "Đang xác thực..."
8. **Kết quả mong đợi**: 
   - Nếu khớp: Đăng nhập thành công → Chuyển hướng
   - Nếu không khớp: Hiện "Khuôn mặt không khớp"

#### b) Đăng nhập qua Upload ảnh:
5. Nhấn **"Tải ảnh lên"**
6. Chọn ảnh chân dung
7. **Kết quả mong đợi**: Tương tự camera

### 6.3. Tắt đăng nhập khuôn mặt
1. Đăng nhập → Vào Cài đặt → Bảo mật
2. Tắt toggle "Đăng nhập bằng khuôn mặt"
3. **Kết quả mong đợi**: 
   - Dữ liệu khuôn mặt bị xóa
   - Toggle về trạng thái tắt
   - Thử đăng nhập bằng khuôn mặt → Lỗi "Chưa kích hoạt"

### 6.4. Test trùng khuôn mặt
1. Đăng ký khuôn mặt cho tài khoản A
2. Đăng nhập tài khoản B → Cài đặt → Đăng ký **cùng khuôn mặt**
3. **Kết quả mong đợi**: Lỗi "Khuôn mặt đã được đăng ký cho tài khoản khác"

---

## 7. Test Các Trường Hợp Lỗi

### 7.1. Tài khoản bị khóa
1. Khóa tài khoản qua Admin
2. Thử đăng nhập bằng Google/Facebook/GitHub/Khuôn mặt
3. **Kết quả mong đợi**: Hiện modal "Tài khoản đã bị khóa" với lý do + nút gửi mail mở khóa

### 7.2. Mất kết nối Backend
1. Tắt Spring Boot server
2. Thử đăng nhập bằng bất kỳ phương thức nào
3. **Kết quả mong đợi**: Hiện lỗi "Không thể kết nối đến máy chủ"

### 7.3. Face Service không chạy
1. Tắt Python face service
2. Thử đăng nhập bằng khuôn mặt
3. **Kết quả mong đợi**: Hiện lỗi "Không thể kết nối đến dịch vụ nhận diện khuôn mặt"

### 7.4. Ảnh không hợp lệ
1. Thử đăng ký/đăng nhập khuôn mặt với:
   - Ảnh không có người (phong cảnh)
   - Ảnh có nhiều người
   - Ảnh mờ/tối
2. **Kết quả mong đợi**:
   - Không có mặt: "Không phát hiện khuôn mặt trong ảnh"
   - Nhiều mặt: "Phát hiện nhiều khuôn mặt. Vui lòng chỉ đưa một khuôn mặt"

### 7.5. Google SDK chưa tải
1. Chặn `accounts.google.com` (dùng hosts file hoặc DevTools)
2. Nhấn nút Google login
3. **Kết quả mong đợi**: Hiện lỗi "Google SDK chưa được tải"

### 7.6. WORKER đăng ký chờ duyệt
1. Đăng ký bằng mạng xã hội với vai trò WORKER
2. **Kết quả mong đợi**: Thông báo "Chờ Chủ trang trại duyệt"
3. Thử đăng nhập lại → Lỗi "Tài khoản đã bị khóa" (isActive=false khi chờ duyệt)

---

## 8. Checklist Tổng Hợp

### Đăng ký (Register)
| # | Test Case | Google | Facebook | GitHub |
|---|-----------|--------|----------|--------|
| 1 | Hiện nút đăng ký | ☐ | ☐ | ☐ |
| 2 | Popup/redirect OAuth hoạt động | ☐ | ☐ | ☐ |
| 3 | Hiện hộp thoại chọn vai trò | ☐ | ☐ | ☐ |
| 4 | Đăng ký OWNER thành công | ☐ | ☐ | ☐ |
| 5 | Đăng ký WORKER thành công | ☐ | ☐ | ☐ |
| 6 | Lỗi khi email đã tồn tại | ☐ | ☐ | ☐ |
| 7 | Lỗi khi tài khoản MXH đã liên kết | ☐ | ☐ | ☐ |

### Đăng nhập (Login)
| # | Test Case | Google | Facebook | GitHub | Face |
|---|-----------|--------|----------|--------|------|
| 1 | Hiện nút đăng nhập | ☐ | ☐ | ☐ | ☐ |
| 2 | Đăng nhập thành công | ☐ | ☐ | ☐ | ☐ |
| 3 | Chuyển hướng đúng vai trò | ☐ | ☐ | ☐ | ☐ |
| 4 | Lỗi khi chưa đăng ký | ☐ | ☐ | ☐ | N/A |
| 5 | Lỗi khi tài khoản bị khóa | ☐ | ☐ | ☐ | ☐ |
| 6 | Avatar được lưu | ☐ | ☐ | ☐ | N/A |

### Khuôn mặt (Face)
| # | Test Case | Trạng thái |
|---|-----------|------------|
| 1 | Đăng ký khuôn mặt qua camera | ☐ |
| 2 | Đăng ký khuôn mặt qua upload | ☐ |
| 3 | Đăng nhập qua camera | ☐ |
| 4 | Đăng nhập qua upload ảnh | ☐ |
| 5 | Tắt đăng nhập khuôn mặt | ☐ |
| 6 | Trùng khuôn mặt bị chặn | ☐ |
| 7 | Ảnh không có mặt → lỗi | ☐ |
| 8 | Ảnh nhiều mặt → lỗi | ☐ |
| 9 | Face service tắt → lỗi rõ ràng | ☐ |

---

## Lưu Ý Quan Trọng

1. **HTTPS**: Google OAuth yêu cầu HTTPS trong production. Khi test local với `localhost`, Google cho phép HTTP.

2. **Facebook Test Users**: Ứng dụng ở chế độ Development chỉ cho phép admin/developer/test user đăng nhập. Thêm test user trong Facebook Developer Console.

3. **GitHub Callback URL**: Phải khớp chính xác với URL đã cấu hình trong GitHub OAuth App settings. Nếu frontend chạy trên port khác, cần cập nhật.

4. **Face Recognition Accuracy**: 
   - Tolerance mặc định: `0.5` (có thể điều chỉnh qua biến môi trường `FACE_TOLERANCE`)
   - Giá trị thấp hơn = nghiêm ngặt hơn (ít false positive, nhiều false negative)
   - Giá trị cao hơn = dễ dãi hơn (nhiều false positive, ít false negative)
   - Khuyến nghị: `0.4` ~ `0.6`

5. **Webcam**: Đảm bảo trình duyệt có quyền truy cập webcam. Một số trình duyệt yêu cầu HTTPS để cấp quyền camera.

6. **face-api.js Models**: Frontend sử dụng TinyFaceDetector của face-api.js để phát hiện khuôn mặt real-time. Models được tải từ CDN. Lần đầu có thể hơi chậm.
