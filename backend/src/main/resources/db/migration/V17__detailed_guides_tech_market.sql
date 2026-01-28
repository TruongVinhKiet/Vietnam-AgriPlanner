-- =====================================================
-- AgriPlanner - Detailed Guide Content V9
-- KỸ THUẬT + THỊ TRƯỜNG - Các bài chi tiết
-- =====================================================

-- KỸ THUẬT - Bài 1: Hệ thống tưới nhỏ giọt
INSERT INTO guides (title, slug, content, excerpt, cover_image, category_id, author_id, view_count, is_published, is_featured, created_at, updated_at, published_at) VALUES
('Hướng dẫn lắp đặt và vận hành hệ thống tưới nhỏ giọt tiết kiệm nước', 'he-thong-tuoi-nho-giot',
'<h2>Giới thiệu về công nghệ tưới nhỏ giọt</h2>
<p>Tưới nhỏ giọt (Drip Irrigation) là phương pháp tưới hiện đại nhất hiện nay, đưa nước và phân bón trực tiếp đến vùng rễ cây qua hệ thống ống và đầu nhỏ giọt. Công nghệ này đã được áp dụng rộng rãi tại Israel, Mỹ, Úc và đang phổ biến tại Việt Nam trong các mô hình nông nghiệp công nghệ cao.</p>

<h3>Tại sao cần chuyển sang tưới nhỏ giọt?</h3>
<table style="width:100%; border-collapse:collapse; margin:20px 0;">
<tr style="background:#e3f2fd;"><th style="padding:12px; border:1px solid #bbdefb;">Tiêu chí</th><th style="padding:12px; border:1px solid #bbdefb;">Tưới tràn</th><th style="padding:12px; border:1px solid #bbdefb;">Tưới phun mưa</th><th style="padding:12px; border:1px solid #bbdefb;">Tưới nhỏ giọt</th></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Hiệu suất sử dụng nước</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">40-50%</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">60-70%</td><td style="padding:12px; border:1px solid #ddd; text-align:center; background:#c8e6c9;"><strong>90-95%</strong></td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Chi phí nhân công</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Cao</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Trung bình</td><td style="padding:12px; border:1px solid #ddd; text-align:center; background:#c8e6c9;"><strong>Rất thấp</strong></td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Kiểm soát phân bón</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Kém</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Trung bình</td><td style="padding:12px; border:1px solid #ddd; text-align:center; background:#c8e6c9;"><strong>Chính xác</strong></td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Bệnh cây</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Nhiều (lá ướt)</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Trung bình</td><td style="padding:12px; border:1px solid #ddd; text-align:center; background:#c8e6c9;"><strong>Ít (tưới gốc)</strong></td></tr>
</table>

<img src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800" alt="Hệ thống tưới nhỏ giọt" style="width:100%; border-radius:12px; margin:20px 0;">

<h2>Bước 1: Thiết kế hệ thống phù hợp</h2>

<h3>1.1 Các thành phần chính của hệ thống</h3>
<ol>
<li><strong>Nguồn nước:</strong> Bể chứa, giếng khoan, hồ chứa</li>
<li><strong>Máy bơm:</strong> Công suất phù hợp diện tích và áp lực yêu cầu</li>
<li><strong>Bộ lọc:</strong> Lọc đĩa, lọc cát hoặc lọc lưới (quan trọng nhất!)</li>
<li><strong>Bộ châm phân:</strong> Venturi, bơm châm phân, bồn pha phân</li>
<li><strong>Ống chính (mainline):</strong> PE hoặc PVC, đường kính 50-110mm</li>
<li><strong>Ống phụ (sub-main):</strong> PE 32-50mm</li>
<li><strong>Ống nhỏ giọt (dripline):</strong> PE 16-20mm với đầu nhỏ giọt tích hợp</li>
<li><strong>Van và phụ kiện:</strong> Van điều áp, van xả khí, co, nối...</li>
</ol>

<h3>1.2 Tính toán thiết kế</h3>
<p><strong>Ví dụ: Thiết kế cho vườn cà phê 1 hecta:</strong></p>
<ul>
<li>Mật độ trồng: 1.100 cây (3m x 3m)</li>
<li>Nhu cầu nước: 40-60 lít/cây/ngày</li>
<li>Tổng lưu lượng: 1.100 x 50 = 55.000 lít/ngày</li>
<li>Với đầu nhỏ giọt 4 lít/giờ, 2 đầu/cây: Thời gian tưới = 50/(4x2) = 6.25 giờ/ngày</li>
<li>Áp lực yêu cầu: 1.5-2.5 bar tại đầu nhỏ giọt</li>
</ul>

<h2>Bước 2: Lắp đặt từng bước</h2>

<h3>2.1 Chuẩn bị mặt bằng</h3>
<ol>
<li>San phẳng đất, xác định hướng dốc (để xả cặn)</li>
<li>Đánh dấu vị trí đường ống chính, ống phụ</li>
<li>Đào rãnh sâu 30-40cm cho ống chính (nếu chôn ngầm)</li>
</ol>

<h3>2.2 Lắp đặt bộ lọc và châm phân</h3>
<blockquote style="background:#fff3e0; border-left:4px solid #ff9800; padding:16px; margin:20px 0; border-radius:0 8px 8px 0;">
<strong>⚠️ QUAN TRỌNG:</strong> Bộ lọc là "trái tim" của hệ thống. Không có lọc hoặc lọc kém sẽ làm tắc đầu nhỏ giọt sau 1-2 tháng, hỏng toàn bộ hệ thống!
</blockquote>
<ul>
<li>Lọc đĩa 120 mesh: Phù hợp nước sạch, giếng khoan</li>
<li>Lọc cát + lọc đĩa: Phù hợp nước ao hồ, nhiều tạp chất</li>
<li>Vệ sinh bộ lọc: Ít nhất 1 lần/tuần</li>
</ul>

<h3>2.3 Rải ống và kết nối</h3>
<ol>
<li><strong>Ống chính:</strong> Nối từ máy bơm, qua bộ lọc, châm phân</li>
<li><strong>Ống phụ:</strong> Phân nhánh theo từng khu vực</li>
<li><strong>Ống nhỏ giọt:</strong> Rải dọc theo hàng cây, cách gốc 20-30cm</li>
<li><strong>Đầu cuối:</strong> Lắp van xả để thau rửa định kỳ</li>
</ol>

<h2>Bước 3: Vận hành và bảo dưỡng</h2>

<h3>3.1 Lịch tưới theo loại cây</h3>
<table style="width:100%; border-collapse:collapse; margin:20px 0;">
<tr style="background:#e8f5e9;"><th style="padding:12px; border:1px solid #c8e6c9;">Loại cây</th><th style="padding:12px; border:1px solid #c8e6c9;">Lượng nước/ngày</th><th style="padding:12px; border:1px solid #c8e6c9;">Số lần tưới</th><th style="padding:12px; border:1px solid #c8e6c9;">Thời gian/lần</th></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Rau màu</td><td style="padding:12px; border:1px solid #ddd;">3-5 lít/m²</td><td style="padding:12px; border:1px solid #ddd;">2-3 lần</td><td style="padding:12px; border:1px solid #ddd;">15-20 phút</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Cà phê</td><td style="padding:12px; border:1px solid #ddd;">40-60 lít/cây</td><td style="padding:12px; border:1px solid #ddd;">1 lần</td><td style="padding:12px; border:1px solid #ddd;">4-6 giờ</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Cây ăn trái</td><td style="padding:12px; border:1px solid #ddd;">50-100 lít/cây</td><td style="padding:12px; border:1px solid #ddd;">1 lần</td><td style="padding:12px; border:1px solid #ddd;">5-8 giờ</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Thanh long</td><td style="padding:12px; border:1px solid #ddd;">15-25 lít/trụ</td><td style="padding:12px; border:1px solid #ddd;">1-2 lần</td><td style="padding:12px; border:1px solid #ddd;">2-3 giờ</td></tr>
</table>

<h3>3.2 Bảo dưỡng định kỳ</h3>
<ul>
<li><strong>Hàng tuần:</strong> Vệ sinh bộ lọc, kiểm tra đầu nhỏ giọt</li>
<li><strong>Hàng tháng:</strong> Xả đuôi ống, kiểm tra rò rỉ</li>
<li><strong>Mỗi 3 tháng:</strong> Xử lý axit (HCl 0.5%) để thông tắc</li>
<li><strong>Cuối vụ:</strong> Xả toàn bộ, kiểm tra thay thế phụ kiện hỏng</li>
</ul>

<h2>Chi phí đầu tư và hiệu quả</h2>
<table style="width:100%; border-collapse:collapse; margin:20px 0;">
<tr style="background:#e3f2fd;"><th style="padding:12px; border:1px solid #bbdefb;">Hạng mục</th><th style="padding:12px; border:1px solid #bbdefb;">Chi phí/ha</th></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Ống nhỏ giọt + phụ kiện</td><td style="padding:12px; border:1px solid #ddd;">15-25 triệu</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Bộ lọc + châm phân</td><td style="padding:12px; border:1px solid #ddd;">5-15 triệu</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Máy bơm</td><td style="padding:12px; border:1px solid #ddd;">3-10 triệu</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Công lắp đặt</td><td style="padding:12px; border:1px solid #ddd;">3-5 triệu</td></tr>
<tr style="background:#c8e6c9;"><td style="padding:12px; border:1px solid #ddd;"><strong>Tổng cộng</strong></td><td style="padding:12px; border:1px solid #ddd;"><strong>26-55 triệu/ha</strong></td></tr>
</table>

<p><strong>Hiệu quả:</strong> Tiết kiệm 50-70% nước, giảm 30-40% phân bón, tăng năng suất 20-30%. Thời gian hoàn vốn: 1.5-2 năm.</p>',
'Hướng dẫn toàn diện về hệ thống tưới nhỏ giọt: từ thiết kế, lắp đặt, vận hành đến bảo dưỡng giúp tiết kiệm 50-70% nước và tăng năng suất cây trồng.',
'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600', 3, NULL, 890, true, true, NOW(), NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET content = EXCLUDED.content, excerpt = EXCLUDED.excerpt, updated_at = NOW();

-- THỊ TRƯỜNG - Bài 1: Phân tích thị trường lúa gạo
INSERT INTO guides (title, slug, content, excerpt, cover_image, category_id, author_id, view_count, is_published, is_featured, created_at, updated_at, published_at) VALUES
('Phân tích chi tiết thị trường lúa gạo Việt Nam và cơ hội kinh doanh', 'phan-tich-thi-truong-lua-gao',
'<h2>Tổng quan thị trường lúa gạo Việt Nam 2024</h2>
<p>Việt Nam là quốc gia xuất khẩu gạo lớn thứ 2-3 thế giới với sản lượng trung bình 43-45 triệu tấn lúa/năm (tương đương 27-28 triệu tấn gạo). Năm 2023, kim ngạch xuất khẩu gạo đạt kỷ lục 4.78 tỷ USD với 8.13 triệu tấn, tăng 36% về giá trị so với 2022.</p>

<img src="https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=800" alt="Thị trường gạo Việt Nam" style="width:100%; border-radius:12px; margin:20px 0;">

<h2>1. Cơ cấu sản xuất và vùng nguyên liệu</h2>

<h3>1.1 Phân bố vùng trồng lúa</h3>
<table style="width:100%; border-collapse:collapse; margin:20px 0;">
<tr style="background:#e8f5e9;"><th style="padding:12px; border:1px solid #c8e6c9;">Vùng</th><th style="padding:12px; border:1px solid #c8e6c9;">Diện tích (triệu ha)</th><th style="padding:12px; border:1px solid #c8e6c9;">Sản lượng (triệu tấn)</th><th style="padding:12px; border:1px solid #c8e6c9;">Đặc điểm</th></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">ĐBSCL</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">3.8</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">24-25</td><td style="padding:12px; border:1px solid #ddd;">Vựa lúa lớn nhất, chủ yếu xuất khẩu</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Đồng bằng sông Hồng</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">1.1</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">6.5-7</td><td style="padding:12px; border:1px solid #ddd;">Gạo chất lượng cao, tiêu thụ nội địa</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Tây Nguyên</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">0.2</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">1.2</td><td style="padding:12px; border:1px solid #ddd;">Lúa rẫy, lúa cạn</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Các vùng khác</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">2.5</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">11-12</td><td style="padding:12px; border:1px solid #ddd;">Tiêu thụ địa phương</td></tr>
</table>

<h3>1.2 Các giống lúa phổ biến và giá trị</h3>
<ul>
<li><strong>Gạo thường (IR50404):</strong> Năng suất cao, giá 8.000-10.000đ/kg lúa, phục vụ xuất khẩu cấp thấp</li>
<li><strong>Gạo thơm (DT8, Jasmine 85):</strong> Chất lượng tốt, giá 10.000-12.000đ/kg lúa, xuất khẩu cấp cao</li>
<li><strong>Gạo đặc sản (ST24, ST25, Nàng Nhen):</strong> Giá trị cao, 15.000-25.000đ/kg lúa, tiêu dùng cao cấp</li>
</ul>

<h2>2. Diễn biến giá cả và xu hướng</h2>

<h3>2.1 Giá gạo xuất khẩu 2023-2024</h3>
<table style="width:100%; border-collapse:collapse; margin:20px 0;">
<tr style="background:#e3f2fd;"><th style="padding:12px; border:1px solid #bbdefb;">Loại gạo</th><th style="padding:12px; border:1px solid #bbdefb;">Q1/2023</th><th style="padding:12px; border:1px solid #bbdefb;">Q4/2023</th><th style="padding:12px; border:1px solid #bbdefb;">Biến động</th></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Gạo 5% tấm</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">450 USD/tấn</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">650 USD/tấn</td><td style="padding:12px; border:1px solid #ddd; text-align:center; color:green;">+44%</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Gạo 25% tấm</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">420 USD/tấn</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">600 USD/tấn</td><td style="padding:12px; border:1px solid #ddd; text-align:center; color:green;">+43%</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Gạo thơm Jasmine</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">520 USD/tấn</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">720 USD/tấn</td><td style="padding:12px; border:1px solid #ddd; text-align:center; color:green;">+38%</td></tr>
</table>

<h3>2.2 Các yếu tố ảnh hưởng giá</h3>
<ul>
<li><strong>Lệnh cấm xuất khẩu của Ấn Độ (7/2023):</strong> Tạo cơ hội lớn cho gạo Việt Nam</li>
<li><strong>El Nino:</strong> Giảm sản lượng toàn cầu, đẩy giá lên</li>
<li><strong>Nhu cầu nhập khẩu từ Philippines, Indonesia:</strong> Tăng mạnh do mất mùa</li>
<li><strong>Chính sách an ninh lương thực:</strong> Nhiều quốc gia tăng dự trữ</li>
</ul>

<h2>3. Thị trường xuất khẩu chính</h2>

<table style="width:100%; border-collapse:collapse; margin:20px 0;">
<tr style="background:#f3e5f5;"><th style="padding:12px; border:1px solid #e1bee7;">Thị trường</th><th style="padding:12px; border:1px solid #e1bee7;">Khối lượng 2023</th><th style="padding:12px; border:1px solid #e1bee7;">Giá trị</th><th style="padding:12px; border:1px solid #e1bee7;">Xu hướng 2024</th></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Philippines</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">3.2 triệu tấn</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">1.8 tỷ USD</td><td style="padding:12px; border:1px solid #ddd;">Tăng nhẹ</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Indonesia</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">1.1 triệu tấn</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">0.6 tỷ USD</td><td style="padding:12px; border:1px solid #ddd;">Tăng mạnh</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Trung Quốc</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">0.8 triệu tấn</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">0.5 tỷ USD</td><td style="padding:12px; border:1px solid #ddd;">Ổn định</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Châu Phi</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">1.5 triệu tấn</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">0.9 tỷ USD</td><td style="padding:12px; border:1px solid #ddd;">Tăng</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">EU</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">0.08 triệu tấn</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">0.05 tỷ USD</td><td style="padding:12px; border:1px solid #ddd;">Tăng (EVFTA)</td></tr>
</table>

<h2>4. Cơ hội và thách thức cho nông dân</h2>

<h3>4.1 Cơ hội</h3>
<ul>
<li><strong>Giá cao kỷ lục:</strong> Lợi nhuận tăng 30-50% so với các năm trước</li>
<li><strong>Nhu cầu gạo chất lượng cao:</strong> Gạo thơm, gạo hữu cơ có thị trường tốt</li>
<li><strong>Chính sách hỗ trợ:</strong> Nhà nước hỗ trợ liên kết vùng nguyên liệu</li>
<li><strong>Công nghệ:</strong> Giống mới cho năng suất và chất lượng cao hơn</li>
</ul>

<h3>4.2 Thách thức</h3>
<ul>
<li><strong>Biến đổi khí hậu:</strong> Hạn mặn ĐBSCL, lũ lụt bất thường</li>
<li><strong>Chi phí đầu vào:</strong> Phân bón, thuốc BVTV tăng giá</li>
<li><strong>Cạnh tranh:</strong> Thái Lan, Myanmar đang cải thiện chất lượng</li>
<li><strong>Tiêu chuẩn xuất khẩu:</strong> Yêu cầu truy xuất nguồn gốc, dư lượng thuốc BVTV</li>
</ul>

<h2>5. Khuyến nghị cho nông dân</h2>

<blockquote style="background:#e8f5e9; border-left:4px solid #4caf50; padding:16px; margin:20px 0; border-radius:0 8px 8px 0;">
<strong>💡 Để tận dụng cơ hội thị trường:</strong>
<ol>
<li>Chuyển đổi sang giống lúa chất lượng cao (ST24, ST25, Đài Thơm 8)</li>
<li>Tham gia liên kết với doanh nghiệp xuất khẩu để có đầu ra ổn định</li>
<li>Áp dụng canh tác bền vững, giảm phân bón hóa học</li>
<li>Ghi chép nhật ký đồng ruộng để truy xuất nguồn gốc</li>
<li>Theo dõi thông tin thị trường hàng tuần để quyết định thời điểm bán</li>
</ol>
</blockquote>

<h2>Kết luận</h2>
<p>Thị trường lúa gạo Việt Nam đang trong giai đoạn thuận lợi nhất trong nhiều năm qua. Nông dân cần nắm bắt cơ hội này bằng việc nâng cao chất lượng sản phẩm, liên kết sản xuất và cập nhật thông tin thị trường thường xuyên. Với chiến lược đúng đắn, thu nhập từ trồng lúa có thể tăng 50-100% so với cách làm truyền thống.</p>',
'Phân tích toàn diện thị trường lúa gạo Việt Nam 2024: giá cả, thị trường xuất khẩu, cơ hội và chiến lược kinh doanh cho nông dân.',
'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=600', 4, NULL, 1050, true, true, NOW(), NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET content = EXCLUDED.content, excerpt = EXCLUDED.excerpt, updated_at = NOW();
