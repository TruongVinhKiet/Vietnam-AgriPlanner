Chào bạn, đây là **Tài liệu Đặc tả Chức năng (Functional Specification Document)** được viết dưới dạng văn bản chi tiết.

Tài liệu này kể lại "câu chuyện" hoạt động của hệ thống từ góc nhìn kỹ thuật, mô tả luồng dữ liệu đi từ giao diện (Frontend) xuống cơ sở dữ liệu (Backend). Bạn có thể dùng văn bản này để đưa vào báo cáo đồ án hoặc làm đề bài để thực hiện việc code.

---

# ĐẶC TẢ CHỨC NĂNG HỆ THỐNG AGRIPLANNER

## PHẦN 1: PHÂN HỆ CÔNG KHAI & XÁC THỰC (PUBLIC & AUTH)

### 1. Trang Đích (Landing Page)

Đây là bộ mặt của hệ thống, nơi khách hàng tiềm năng tiếp cận đầu tiên. Giao diện tập trung vào việc giới thiệu tính năng, hiển thị các gói cước (Pricing) và tạo niềm tin.

* **Hoạt động:** Người dùng lướt xem thông tin. Khi họ nhấn nút "Bắt đầu ngay" hoặc "Dùng thử miễn phí", hệ thống sẽ điều hướng sang trang Đăng ký. Không có tương tác dữ liệu phức tạp tại đây ngoài việc hiển thị nội dung tĩnh.

### 2. Trang Đăng nhập (Login Page)

Chức năng này đảm bảo tính bảo mật, ngăn chặn truy cập trái phép. Hệ thống hỗ trợ đăng nhập theo hai hình thức: tài khoản truyền thống (Email/Password) và xác thực qua Google (OAuth2).

* **Quy trình hoạt động:**
1. Người dùng nhập Email và Mật khẩu. Frontend mã hóa sơ bộ và gửi yêu cầu `POST` đến API xác thực.
2. Backend tiếp nhận, so sánh mật khẩu (đã được băm/hash bằng BCrypt) với dữ liệu trong bảng `users`. Đồng thời, hệ thống kiểm tra trạng thái gói cước trong bảng `subscriptions` (xem còn hạn hay không).
3. Nếu hợp lệ, Backend trả về một chuỗi mã hóa **JWT (JSON Web Token)** chứa thông tin định danh và `farm_id`. Frontend lưu token này vào LocalStorage để dùng cho các phiên làm việc sau.



### 3. Trang Đăng ký (Registration Page)

Đây là chức năng khởi tạo quan trọng nhất đối với mô hình SaaS (Software as a Service). Việc đăng ký không chỉ tạo người dùng mà còn phải khởi tạo môi trường làm việc riêng biệt (Tenant).

* **Quy trình hoạt động:**
1. Người dùng nhập Họ tên, Email, Mật khẩu và đặc biệt là **Tên Nông Trại** (Ví dụ: "Trại Heo Bình Phước").
2. Khi nhấn "Đăng ký", Backend sẽ thực hiện một **Transaction** (Giao dịch) bao gồm 3 bước bắt buộc phải thành công cùng lúc:
* Tạo bản ghi mới trong bảng `users`.
* Tạo bản ghi mới trong bảng `farms` (lấy ID người dùng vừa tạo làm chủ sở hữu).
* Tạo bản ghi trong bảng `subscriptions` với gói mặc định (Free Tier).


3. Nếu bất kỳ bước nào lỗi, hệ thống sẽ rollback (hoàn tác) toàn bộ để tránh rác dữ liệu.



---

## PHẦN 2: PHÂN HỆ QUẢN TRỊ TRUNG TÂM (CORE DASHBOARD)

### 4. Bảng Điều khiển (Dashboard)

Đây là trung tâm chỉ huy, nơi người quản lý có cái nhìn toàn cảnh về sức khỏe của nông trại ngay sau khi đăng nhập.

* **Thẻ Chỉ số (KPI Cards):** Hệ thống hiển thị 4 chỉ số quan trọng: Tổng diện tích, Vốn khả dụng, Lợi nhuận dự kiến và Cảnh báo thời tiết. Dữ liệu này được Backend tính toán bằng cách tổng hợp (Aggregate) từ các bảng `fields` và `transactions` theo thời gian thực. Riêng dữ liệu thời tiết được lấy từ API bên thứ 3 (như OpenWeatherMap) dựa trên tọa độ GPS của nông trại.
* **Widget Công việc (Daily Tasks):** Một danh sách "To-do list" tương tác. Người dùng có thể đánh dấu tích vào ô vuông để hoàn thành công việc (ví dụ: "Tưới nước Khu A"). Khi đó, Backend cập nhật trạng thái công việc trong bảng `tasks` sang 'COMPLETED', và giao diện sẽ gạch ngang dòng đó.
* **Biểu đồ Tài chính:** Một biểu đồ cột chồng thể hiện dòng tiền Thu/Chi theo từng tháng. Backend truy vấn bảng `transactions`, nhóm dữ liệu theo tháng và trả về mảng JSON để Frontend vẽ biểu đồ.

---

## PHẦN 3: PHÂN HỆ QUẢN LÝ TRỒNG TRỌT (CULTIVATION)

### 5. Trang Quản lý Đất & Bản đồ Số (Cultivation & GIS Map)

Đây là tính năng cốt lõi thể hiện sự "thông minh" của hệ thống, thay thế việc quản lý bằng sổ sách.

* **Bản đồ Tương tác (Interactive Map):** Giao diện hiển thị bản đồ vệ tinh với các lớp phủ là các đa giác (Polygon) đại diện cho từng lô đất.
* *Hoạt động:* Khi trang tải, hệ thống lấy dữ liệu tọa độ `JSONB` từ bảng `fields`. Frontend sử dụng thư viện bản đồ (như Leaflet) để vẽ các đa giác này. Màu sắc của đa giác thay đổi dựa trên trạng thái cây trồng (Xanh: Đang tốt, Vàng: Cần nước, Đỏ: Sâu bệnh).


* **Giám sát IoT (IoT Monitoring):** Khi người dùng nhấp vào một lô đất, panel bên phải sẽ hiện thông số cảm biến thời gian thực. Hệ thống truy xuất bản ghi mới nhất từ bảng `telemetry_data`. Nếu độ ẩm đất thấp hơn ngưỡng cài đặt, biểu tượng giọt nước sẽ chuyển đỏ và nhấp nháy cảnh báo.
* **Quản lý Vụ mùa (Crop Cycle):** Cho phép người dùng bắt đầu một vụ mùa mới. Hệ thống sẽ ghi nhận ngày xuống giống, loại cây (lấy từ `master_data`) vào bảng `crop_cycles`. Từ đó, hệ thống tự động tính toán ngày thu hoạch dự kiến dựa trên đặc tính sinh học của cây.

---

## PHẦN 4: PHÂN HỆ QUẢN LÝ CHĂN NUÔI (LIVESTOCK)

### 6. Trang Chuồng trại & Phả hệ (Livestock & Genealogy)

Trang này chuyển đổi mô hình quản lý từ không gian rộng (cánh đồng) sang không gian hẹp và chi tiết (chuồng trại).

* **Sơ đồ Chuồng trại (Barn Blueprint):** Thay vì bản đồ vệ tinh, giao diện hiển thị sơ đồ dạng lưới (Grid View). Mỗi ô vuông đại diện cho một ô chuồng (Pen).
* *Hoạt động:* Hệ thống render các ô dựa trên dữ liệu bảng `pens`. Ô nào bẩn (`status='DIRTY'`) sẽ có màu nâu, ô nào có vật nuôi sẽ hiện icon tương ứng.


* **Kiểm tra Phả hệ (Genealogy Check - Tính năng Nâng cao):** Đây là thuật toán giúp tránh hiện tượng trùng huyết. Khi người dùng chọn chức năng "Phối giống", họ chọn con Đực và con Cái. Backend sẽ sử dụng **thuật toán đệ quy** truy xuất ngược bảng `animals` qua các trường `father_id` và `mother_id`. Nếu phát hiện hai con vật có chung tổ tiên trong vòng 3 đời, hệ thống sẽ trả về cảnh báo đỏ "Nguy cơ trùng huyết cao".
* **Lịch Tiêm chủng Tự động:** Khi nhập đàn vật nuôi mới, hệ thống tự động quét quy định tiêm phòng và tạo sẵn các lịch hẹn trong bảng `vaccinations`. Đến ngày tiêm, thông báo sẽ hiện lên Dashboard nhắc nhở người dùng.

---

## PHẦN 5: PHÂN HỆ KHO & CHUỖI CUNG ỨNG (INVENTORY)

### 7. Trang Quản lý Kho (Inventory Management)

Chức năng này quản lý dòng chảy vật tư, đảm bảo nông trại không bao giờ bị đứt gãy nguồn cung.

* **Giám sát Tồn kho:** Hiển thị danh sách phân bón, thức ăn chăn nuôi. Các mặt hàng có số lượng thấp hơn "mức đặt hàng lại" (Reorder Level) sẽ được tô màu vàng cảnh báo.
* **Nhập/Xuất kho:** Khi người dùng tạo phiếu xuất kho (ví dụ: "Xuất 50kg cám cho heo ăn"), Backend thực hiện một chuỗi hành động: trừ số lượng trong bảng `inventory_items`, tạo phiếu trong `warehouse_movements` để lưu vết, và đồng thời ghi nhận chi phí vào bảng `transactions`. Điều này giúp tính toán chính xác giá thành sản xuất.

---

## PHẦN 6: PHÂN HỆ BÁO CÁO & CẤU HÌNH (ANALYTICS & SETTINGS)

### 8. Trang Báo cáo Phân tích (Analytics)

Dành cho chủ trang trại ra quyết định dựa trên dữ liệu.

* **Báo cáo Chuyên sâu:** Người dùng có thể lọc báo cáo theo thời gian (Tháng này, Quý trước) hoặc theo đối tượng (Khu A, Chuồng B). Hệ thống tính toán các chỉ số như ROI (Tỷ suất hoàn vốn), Tỷ lệ hao hụt và Năng suất.
* **Xuất PDF:** Tính năng cho phép tải báo cáo về máy. Backend sử dụng thư viện tạo file (như JasperReports) để render dữ liệu thành file PDF chuyên nghiệp, sẵn sàng để in ấn hoặc gửi đối tác.

### 9. Trang Cài đặt Hệ thống (Settings)

* **Quản lý Master Data:** Cho phép người dùng tự định nghĩa các danh mục dùng chung. Ví dụ: Thêm một giống cây mới chưa có trong hệ thống, thêm loại phân bón mới. Dữ liệu này sẽ cập nhật vào các Dropdown list trên toàn bộ ứng dụng.
* **Nhật ký Hoạt động (Audit Logs):** Tính năng bảo mật cho phép Admin xem lại lịch sử thao tác của nhân viên. Backend giải mã dữ liệu JSONB trong bảng `audit_logs` để hiển thị chi tiết: "Ai đã sửa cái gì, giá trị cũ là bao nhiêu, giá trị mới là bao nhiêu" vào thời gian cụ thể.

### 10. Trang Trợ giúp (Help Center)

* **Tìm kiếm thông minh:** Thanh tìm kiếm lớn giúp người dùng tra cứu nhanh các vấn đề thường gặp (FAQ).
* **Hỗ trợ trực tuyến:** Tích hợp widget Chat để kết nối trực tiếp với đội ngũ hỗ trợ kỹ thuật khi gặp sự cố khẩn cấp.

Cấp 1: SYSTEM_ADMIN (Quản trị viên SaaS - Là bạn)
Quyền hạn: Truy cập trang "Super Admin Dashboard".

Chức năng: Xem danh sách tất cả users, quản lý bảng subscriptions, xem tổng doanh thu toàn hệ thống, khóa tài khoản vi phạm.

Dữ liệu: Nhìn thấy hết (hoặc chỉ nhìn thấy metadata các farm).

Cấp 2: OWNER (Chủ trang trại)
Quyền hạn: Truy cập đầy đủ các tính năng trong trang trại của mình.

Chức năng: Thêm/Sửa/Xóa fields, animals, employees. Xem báo cáo tài chính chi tiết của trại mình.

Giới hạn: Chỉ nhìn thấy dữ liệu có farm_id thuộc về mình. Không thấy dữ liệu của trại khác.

Cấp 3: MANAGER (Quản lý trại)
Quyền hạn: Giúp ông chủ quản lý.

Chức năng: Được thêm nhật ký harvests, transactions, tasks.

Giới hạn: Không được xóa farm, không được xem doanh thu tổng (tùy bạn cấu hình), không được chỉnh sửa gói cước subscriptions.

Cấp 4: WORKER (Nhân công) / VET (Thú y)
Quyền hạn: Tác nghiệp cụ thể.

Chức năng:

WORKER: Chỉ xem danh sách tasks được giao cho mình và đánh dấu hoàn thành. Không xem được tài chính.

VET: Chỉ xem và cập nhật sức khỏe vật nuôi (animals, vaccinations).