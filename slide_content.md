# Nội Dung Trình Bày Slide Dự Án AgriPlanner
*Dưới đây là chi tiết nội dung hiển thị trên từng Slide (Bullet points) và **Kịch bản nói (Speaker Notes)** dành cho người thuyết trình.*

---

## PHẦN 1: TỔNG QUAN & MỞ ĐẦU

### Slide 1: Tiêu đề (Title Slide)
**[Hiển thị trên Slide]**
*   **Môn học:** Phát triển ứng dụng J2EE
*   **Đề tài:** AgriPlanner - Nền tảng Nông nghiệp Chuyển đổi số Toàn diện
*   **Giảng viên hướng dẫn:** [Tên Thầy/Cô]
*   **Nhóm thực hiện:** [Tên Nhóm]
    *   Nguyễn Văn A (MSSV) - *Project Lead / Backend*
    *   Trần Thị B (MSSV) - *Frontend / UI-UX*
    *   [Thay bằng tên thật của bạn]

🗣️ **Kịch bản nói:**
> "Kính thưa thầy/cô và các bạn, đại diện cho nhóm, em xin phép trình bày về dự án cuối kỳ môn J2EE với đề tài: AgriPlanner. Đây là một hệ sinh thái hoạch định nguồn lực cốt lõi (ERP) thu nhỏ dành riêng cho các nông trại hiện đại ở quy mô vừa và lớn."

### Slide 2: Đặt vấn đề & Mục tiêu dự án
**[Hiển thị trên Slide]**
*   **Vấn đề:** 
    *   Quản lý nông trại hiện nay manh mún, dựa vào kinh nghiệm cá nhân.
    *   Thiếu dữ liệu chính xác về thổ nhưỡng, quy hoạch để đưa ra quyết định canh tác.
    *   Khó khăn trong quản lý nhân công, tài chính và hao hụt vật tư.
*   **Giải pháp - Mục tiêu AgriPlanner:**
    *   Số hóa mọi quy trình: Từ bản đồ vệ tinh đến chuồng trại ảo.
    *   Phân quyền chuyên sâu 3 đối tượng: Owner (Chủ), Worker (Nhân công), Admin (Quản trị).
    *   Áp dụng công nghệ vào thực tiễn: Bản đồ GIS, AI nhận diện, Gamification.

🗣️ **Kịch bản nói:**
> "Hiện nay, người nông dân hoặc các chủ trang trại thường gặp khó khăn vì quá nhiều thứ phải quản lý: từ việc chọn đúng cây rải đúng đất, quản lý lượng phân bón, đến chấm công cho nhân viên. Giải pháp của chúng em, AgriPlanner, ra đời để thiết lập một tiêu chuẩn quản trị mới. Không chỉ là ghi chép sổ sách dữ liệu, AgriPlanner cung cấp hẳn bản đồ cấp tỉnh trực quan, mô phỏng chuồng trại và hệ thống động viên nhân viên bằng game hóa."

### Slide 3: Hệ Sinh Thái Đa Chiều AgriPlanner (Ecosystem)
**[Hiển thị trên Slide]**
*Hệ thống được thiết kế xoay quanh 3 thực thể tương hỗ lẫn nhau:*
*   👑 **Chủ Trang Trại (Farm Owner):** Trái tim của hệ thống. Người ra quyết định chiến lược, quản lý vi mô và vĩ mô toàn bộ vật tư, nhân sự và tài chính.
*   👨‍🌾 **Nhân Công (Worker):** Khung xương của hệ thống. Người trực tiếp tạo ra giá trị, nhận công việc và được hệ thống đánh giá năng lực một cách công bằng.
*   🛡️ **Quản Trị Viên (System Admin):** Bộ não cung cấp dữ liệu. Đảm bảo tính chính xác của dữ liệu lõi và là nhà cung ứng (Supplier) tài nguyên ban đầu cho hệ thống.

🗣️ **Kịch bản nói:**
> "Thay vì trình bày các quy trình code khô khan, nhóm xin phép nói về tính thực tế của ứng dụng. AgriPlanner không phải là một phần mềm đơn lẻ, mà là một 'Hệ sinh thái' gồm 3 trục: Chủ trại, Nhân công và Quản trị viên. Mỗi đối tượng sẽ có một giao diện, một nghiệp vụ và một luồng dữ liệu hoàn toàn khác biệt nhưng lại móc nối chặt chẽ với nhau để tạo thành chuỗi cung ứng nông nghiệp khép kín."

---

## PHẦN 2: PHÂN TÍCH CHỨC NĂNG & THIẾT KẾ CỐT LÕI

### Slide 4: Chức Năng Chuyên Sâu Theo Từng Đối Tượng
**[Hiển thị trên Slide]**

🏢 **1. Dành cho Chủ Trang Trại (Owner)**
*   **Trồng trọt (GIS Bản đồ):** Tích hợp bộ **2 bản đồ** (Quy hoạch & Thổ nhưỡng) lấy từ nguồn Cổng thông tin Chính phủ. Cung cấp thông tin loại đất, mục đích sử dụng để chủ trại **chọn đúng giống cây**.
*   **Chăn nuôi:** Quản lý chuồng trại và vật nuôi quy mô lớn trực quan.
*   **Giao việc:** Hệ thống Task Management cấp doanh nghiệp (lấy cảm hứng từ Jira, Trailhead).
*   **Chuỗi cung ứng:** Quản lý Kho, Mua bán (Shop), Tính lương (Payroll) và Hợp tác xã nội bộ.

👷 **2. Dành cho Nhân Công (Worker)**
*   Quản lý danh sách công việc được giao theo thời gian thực.
*   Môi trường Tuyển dụng & Tạo CV xin việc điện tử chuyên nghiệp theo chuẩn (Mô phỏng cơ chế của TopCV).

⚙️ **3. Dành cho Quản Trị Hệ Thống (Admin)**
*   Quản trị khối lượng Big Data khổng lồ. Đóng vai trò Nhà Cung Ứng gốc bán vật tư/chuẩn hóa dữ liệu cho Owner.
*   **Công nghệ đột phá:** Ứng dụng **Python & Thị giác máy tính (Computer Vision)** để cào (scrape) và số hóa dữ liệu bản đồ từ các website của Chính phủ.

🗣️ **Kịch bản nói:**
> "Đi sâu vào tính năng, đây là bức tranh toàn cảnh của hệ thống. 
> Đầu tiên là **Chủ trang trại**. Tụi em trang bị cho họ công cụ Trồng trọt với 2 lớp bản đồ Quy hoạch và Thổ nhưỡng lấy từ cơ sở dữ liệu chính phủ. Chỉ cần click vào 1 thửa đất, hệ thống sẽ gợi ý ngay nên trồng cây gì. Bên cạnh đó là hệ thống quản lý chuồng trại, và hệ thống giao việc nội bộ mà nhóm đã học hỏi và mô phỏng lại luồng làm việc cực kỳ chuyên nghiệp của **Jira** hay **Trailhead**. Chủ trại cũng nắm trong tay toàn bộ Chuỗi cung ứng từ Kho bãi, Bảng lương cho đến Hợp tác xã.
> 
> Thứ hai là **Nhân công**. Không chỉ nhận việc, ứng dụng còn tích hợp hẳn một hệ thống Tuyển dụng và viết CV xịn sò hệt như **TopCV**, giúp người nông dân hiện đại hóa hồ sơ xin việc của mình.
> 
> Cuối cùng là **Admin**. Admin quản lý nguồn Data khổng lồ và kiêm luôn vai trò nhà cung ứng vật tư gốc. Điểm sáng công nghệ nhất ở đây là nhóm đã kết hợp ngôn ngữ **Python cùng Thị giác máy tính** để cào và đọc bản đồ từ các trang web của Chính phủ, sau đó số hóa ngược lại vào Database cho Admin sử dụng."

### Slide 5: Kiến trúc hệ thống & Tech Stack
**[Hiển thị trên Slide]**
*(Một sơ đồ Server-Client)*
*   **Backend:** Java 17, Spring Boot 3, Spring Security (JWT, RBAC), Spring Data JPA.
*   **Database:** PostgreSQL (Hỗ trợ truy vấn không gian qua extension PostGIS). **50+ file Migrations**.
*   **Frontend:** Vanilla JS (JS thuần) tối ưu hiệu năng.
    *   *Thư viện:* TailwindCSS, GSAP (Hoạt ảnh), Leaflet (Bản đồ), Chart.js, Face-api.js.

🗣️ **Kịch bản nói:**
> "Chúng em sử dụng mô hình RESTful API. Backend được viết 100% bằng Java Spring Boot với tiêu chuẩn doanh nghiệp. Database là PostgreSQL có cài sẵn module PostGIS để xử lý tọa độ đa giác bản đồ. Đặc biệt, Frontend chúng em code bằng JavaScipt thuần (Vanilla JS) kết hợp hệ thống thư viện cực mạnh như Leaflet cho bản đồ hay Face-api để nhận diện khuôn mặt."

### Slide 6: Thiết kế Cơ sở dữ liệu (Database Design)
**[Hiển thị trên Slide]**
*(Hình ảnh sơ đồ ERD rút gọn tập trung vào các Core Entity)*
*   **Core Tables:** 
    *   `Users` (Role: Owner, Worker, Admin)
    *   `Farm` (Trang trại cốt lõi)
    *   [PlanningZone](file:///e:/Agriplanner/js/admin-advanced.js#618-640) (Lưu tọa độ GeoJSON/Polygon)
    *   [Task](file:///e:/Agriplanner/js/worker_dashboard.js#5126-5144), [WorkLog](file:///e:/Agriplanner/js/worker_dashboard.js#5277-5297) (Log công việc nhân công)
    *   Danh mục: [Crop](file:///e:/Agriplanner/js/admin-advanced.js#2515-2530), `Animal`, `ShopItem`.

🗣️ **Kịch bản nói:**
> "Hệ thống có tổng cộng gần 90 thực thể (Entities), được chia thành các cụm Module rõ rệt: từ Trồng trọt, Chăn nuôi, đến Nhân sự và Kho bãi. Trên slide phân bổ các bảng quan trọng nhất. Đặc biệt bảng quy hoạch (PlanningZone) được thiết kế đặc biệt để lưu dữ liệu dạng GeoJSON bám sát kiến trúc phần mềm GIS."

---

## PHẦN 3: TRÌNH DIỄN SẢN PHẨM

### Slide 7: THÔNG BÁO DEMO
**[Hiển thị trên Slide]**
*(CHỮ DEMO TO ở chính giữa, background là ảnh mờ của giao diện Dashboard AgriPlanner)*

🗣️ **Kịch bản nói:**
> "Và để không mất thời gian của thầy cô, sau đây em xin phép được demo trực tiếp phần mềm AgriPlanner để thầy cô có cái nhìn thực tế và sống động nhất về dự án."
*(Gợi ý trình tự thao tác Demo trực tiếp):*
1.  *Demo luồng Worker:* Mở trình duyệt, sử dụng WebCam để Đăng nhập bằng khuôn mặt -> Trang chủ hiện tiến độ EXP cày cấp -> Kéo thả thẻ công việc Kanban.
2.  *Demo luồng Owner:* Đăng nhập bằng chủ trại -> Mở tab **Quy hoạch (Trồng trọt)**, bật lớp bản đồ WMS lên, click vào 1 thửa đất để xem gợi ý trồng cây theo loại đất -> Qua tab **Chăn nuôi** để kéo thử hình chuồng heo, chuồng gà.
3.  *Demo luồng Admin:* Mở tab Admin, vào mục Quản lý nâng cao để cho thấy chức năng Parse file bản đồ (KMZ).

---

## PHẦN 4: TỔNG KẾT & RÚT KINH NGHIỆM

### Slide 8: Khó khăn & Giải pháp
**[Hiển thị trên Slide]**
*   **Vấn đề 1:** Xử lý dữ liệu Bản đồ Không gian (GIS) khổng lồ trên Java.
    *   *Giải pháp:* Sử dụng PostGIS, kết nối thành công WMS Server của VNPT để load các layer bản đồ thay vì vẽ tay. Viết thuật toán (Ray-casting) đếm tọa độ.
*   **Vấn đề 2:** Bảo mật và Phân quyền chéo (Cross-role Authorization).
    *   *Giải pháp:* Tùy biến sâu bộ lọc `JwtAuthenticationFilter` trong Spring Security, chia API theo prefix `/api/tasks/worker`, `/api/admin` cực kỳ chặt chẽ.
*   **Vấn đề 3:** Tối ưu hiệu năng JS thuần cho các file khổng lồ (>5000 lines).
    *   *Giải pháp:* Chia nhỏ scope, dùng `requestAnimationFrame` và `GSAP` để tránh giật lag trình duyệt.

🗣️ **Kịch bản nói:**
> "Quá trình thực hiện khối lượng tính năng khổng lồ này, nhóm gặp 3 bài toán khó nhất. Khó nhất là việc xử lý tọa độ địa lý (GIS). Nhóm phải học cách dùng PostGIS, và đặc biệt là móc nối được vào Server bản đồ tỉnh Cà Mau để lấy hình ảnh thực tế. Bài toán thứ hai là phân quyền khi 1 hệ thống dùng chung cho cả Chủ và Lính, nhóm đã cấu hình Spring Security ở mức độ phương thức (Method Security) khắt khe."

### Slide 9: Kết quả đạt được & Tương lai
**[Hiển thị trên Slide]**
*   **Kết quả:** 
    *   Hoàn thành 100% Core Requirements.
    *   Tích hợp thành công các tiện ích vệ tinh (AI, Bản đồ, Charts, Canvas).
*   **Hướng phát triển:**
    *   Xây dựng App Mobile (React Native) cho nhân công để thao tác ngoài đồng ruộng tiện hơn.
    *   Tích hợp IoT (Cảm biến đất, nhiệt độ chuồng trại) cắm trực tiếp dữ liệu vào AgriPlanner Backend.

🗣️ **Kịch bản nói:**
> "Nhóm tự hào hoàn thiện được một tác phẩm vượt xa kỳ vọng ban đầu của môn học. Hệ thống hoạt động trơn tru. Ở tương lai, do Backend Java đã được thiết kế chuẩn REST API, chúng em hoàn toàn có thể vác API này gắn vào Mobile App React Native, hay dùng làm máy chủ xử lý dữ liệu cho các cảm biến IoT ngoài vườn cắm vào."

### Slide 10: Hỏi & Đáp (Q&A)
**[Hiển thị trên Slide]**
*   **THANK YOU FOR YOUR ATTENTION!**
*   **Q&A**

🗣️ **Kịch bản nói:**
> "Dạ phần trình bày giới thiệu dự án AgriPlanner của nhóm đến đây là kết thúc. Chúng em xin cảm ơn thầy cô đã lắng nghe và rất mong nhận được những nhận xét, câu hỏi từ phía hội đồng để nhóm hoàn thiện dự án hơn nữa ạ!"
