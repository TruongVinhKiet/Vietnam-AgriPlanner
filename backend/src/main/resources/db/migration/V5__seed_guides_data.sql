-- =====================================================
-- AgriPlanner - Seed Data for Guides and Categories
-- Tạo 4 danh mục và 20 bài hướng dẫn nông nghiệp
-- =====================================================

-- Insert Guide Categories
INSERT INTO guide_categories (id, name, slug, description, icon, sort_order) VALUES
(1, 'Trồng trọt', 'trong-trot', 'Kỹ thuật trồng và chăm sóc cây trồng', 'potted_plant', 1),
(2, 'Chăn nuôi', 'chan-nuoi', 'Kỹ thuật nuôi và chăm sóc vật nuôi', 'pets', 2),
(3, 'Kỹ thuật', 'ky-thuat', 'Các kỹ thuật nông nghiệp hiện đại', 'science', 3),
(4, 'Thị trường', 'thi-truong', 'Thông tin thị trường và kinh doanh nông sản', 'trending_up', 4)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- TRỒNG TRỌT - 5 bài viết
-- =====================================================

INSERT INTO guides (title, slug, content, excerpt, cover_image, category_id, author_id, view_count, is_published, is_featured, created_at, updated_at, published_at) VALUES
-- Bài 1: Kỹ thuật trồng lúa nước
('Kỹ thuật trồng lúa nước hiệu quả năng suất cao', 'ky-thuat-trong-lua-nuoc', 
'<h2>Giới thiệu về cây lúa nước</h2>
<p>Lúa nước (Oryza sativa) là cây lương thực chủ yếu của Việt Nam và nhiều nước Châu Á. Để đạt năng suất cao, cần áp dụng đúng kỹ thuật canh tác từ khâu chuẩn bị đất đến thu hoạch.</p>

<img src="https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=800" alt="Ruộng lúa" style="width:100%; border-radius:8px; margin:16px 0;">

<h2>1. Chuẩn bị đất</h2>
<p>Đất cần được cày bừa kỹ, san phẳng mặt ruộng để giữ nước đều. Bón lót phân hữu cơ 10-15 tấn/ha kết hợp với phân lân.</p>

<h3>Các bước làm đất:</h3>
<ul>
<li>Cày sâu 15-20cm</li>
<li>Bừa nhỏ đất và dọn sạch cỏ</li>
<li>San phẳng mặt ruộng</li>
<li>Giữ mực nước 3-5cm</li>
</ul>

<h2>2. Thời vụ gieo trồng</h2>
<p><strong>Vụ Đông Xuân:</strong> Gieo từ tháng 11-12, thu hoạch tháng 4-5<br>
<strong>Vụ Hè Thu:</strong> Gieo từ tháng 5-6, thu hoạch tháng 9-10</p>

<img src="https://images.unsplash.com/photo-1559050036-8f5c59e93f8c?w=800" alt="Thu hoạch lúa" style="width:100%; border-radius:8px; margin:16px 0;">

<h2>3. Chăm sóc và bón phân</h2>
<table style="width:100%; border-collapse:collapse; margin:16px 0;">
<tr style="background:#f0f0f0;"><th style="padding:8px; border:1px solid #ddd;">Giai đoạn</th><th style="padding:8px; border:1px solid #ddd;">Phân bón</th><th style="padding:8px; border:1px solid #ddd;">Liều lượng</th></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Bón lót</td><td style="padding:8px; border:1px solid #ddd;">NPK + Hữu cơ</td><td style="padding:8px; border:1px solid #ddd;">300kg/ha</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Bón thúc lần 1</td><td style="padding:8px; border:1px solid #ddd;">Urê</td><td style="padding:8px; border:1px solid #ddd;">80kg/ha</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Bón thúc lần 2</td><td style="padding:8px; border:1px solid #ddd;">Kali</td><td style="padding:8px; border:1px solid #ddd;">50kg/ha</td></tr>
</table>

<h2>4. Phòng trừ sâu bệnh</h2>
<p>Thường xuyên kiểm tra đồng ruộng để phát hiện sớm sâu bệnh. Sử dụng thuốc BVTV theo nguyên tắc 4 đúng.</p>

<blockquote style="background:#e8f5e9; padding:16px; border-left:4px solid #4caf50; margin:16px 0;">
<strong>Lưu ý:</strong> Năng suất lúa có thể đạt 6-8 tấn/ha nếu áp dụng đúng kỹ thuật và sử dụng giống chất lượng cao.
</blockquote>',
'Hướng dẫn chi tiết kỹ thuật trồng lúa nước từ chuẩn bị đất đến thu hoạch, giúp đạt năng suất 6-8 tấn/ha.',
'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=600', 1, NULL, 1250, true, true, NOW(), NOW(), NOW()),

-- Bài 2: Trồng rau sạch
('Hướng dẫn trồng rau sạch tại nhà và vườn', 'huong-dan-trong-rau-sach',
'<h2>Tại sao nên trồng rau sạch?</h2>
<p>Rau sạch đảm bảo an toàn thực phẩm, không chứa hóa chất độc hại. Việc tự trồng rau còn giúp tiết kiệm chi phí và có nguồn thực phẩm tươi ngon hàng ngày.</p>

<img src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800" alt="Vườn rau sạch" style="width:100%; border-radius:8px; margin:16px 0;">

<h2>1. Chuẩn bị đất trồng</h2>
<p>Đất trồng rau cần tơi xốp, giàu dinh dưỡng. Trộn đất với phân hữu cơ hoai mục theo tỷ lệ 7:3.</p>

<h3>Công thức đất trồng lý tưởng:</h3>
<ul>
<li>70% đất thịt</li>
<li>20% phân hữu cơ</li>
<li>10% xơ dừa</li>
</ul>

<h2>2. Các loại rau dễ trồng</h2>
<img src="https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800" alt="Các loại rau" style="width:100%; border-radius:8px; margin:16px 0;">

<table style="width:100%; border-collapse:collapse; margin:16px 0;">
<tr style="background:#f0f0f0;"><th style="padding:8px; border:1px solid #ddd;">Loại rau</th><th style="padding:8px; border:1px solid #ddd;">Thời gian thu hoạch</th><th style="padding:8px; border:1px solid #ddd;">Độ khó</th></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Rau muống</td><td style="padding:8px; border:1px solid #ddd;">25-30 ngày</td><td style="padding:8px; border:1px solid #ddd;">Dễ</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Xà lách</td><td style="padding:8px; border:1px solid #ddd;">30-35 ngày</td><td style="padding:8px; border:1px solid #ddd;">Dễ</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Cải xanh</td><td style="padding:8px; border:1px solid #ddd;">35-40 ngày</td><td style="padding:8px; border:1px solid #ddd;">Trung bình</td></tr>
</table>

<h2>3. Lịch tưới nước và bón phân</h2>
<p>Tưới nước 2 lần/ngày vào sáng sớm và chiều mát. Bón phân hữu cơ 7-10 ngày/lần.</p>

<blockquote style="background:#fff3e0; padding:16px; border-left:4px solid #ff9800; margin:16px 0;">
<strong>Mẹo:</strong> Dùng nước vo gạo để tưới cây giúp bổ sung vitamin B và khoáng chất tự nhiên.
</blockquote>',
'Cách trồng rau sạch tại nhà từ A-Z: chuẩn bị đất, chọn giống, chăm sóc và thu hoạch rau an toàn.',
'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600', 1, NULL, 980, true, true, NOW(), NOW(), NOW()),

-- Bài 3: Trồng cây ăn trái
('Kỹ thuật trồng và chăm sóc cây ăn trái', 'ky-thuat-trong-cay-an-trai',
'<h2>Cây ăn trái phổ biến tại Việt Nam</h2>
<p>Việt Nam có khí hậu nhiệt đới, thuận lợi cho nhiều loại cây ăn trái như xoài, bưởi, chôm chôm, sầu riêng...</p>

<img src="https://images.unsplash.com/photo-1553279768-865429fa0078?w=800" alt="Vườn cây ăn trái" style="width:100%; border-radius:8px; margin:16px 0;">

<h2>1. Chọn giống và đất trồng</h2>
<p>Chọn giống từ vườn ươm uy tín, cây khỏe mạnh không sâu bệnh. Đất trồng cần thoát nước tốt, pH từ 5.5-6.5.</p>

<h2>2. Kỹ thuật trồng</h2>
<ul>
<li>Đào hố 60x60x60cm trước 1 tháng</li>
<li>Bón lót phân hữu cơ + lân</li>
<li>Trồng vào đầu mùa mưa</li>
<li>Che nắng 2-3 tuần đầu</li>
</ul>

<h2>3. Bảng bón phân cho cây ăn trái</h2>
<table style="width:100%; border-collapse:collapse; margin:16px 0;">
<tr style="background:#f0f0f0;"><th style="padding:8px; border:1px solid #ddd;">Tuổi cây</th><th style="padding:8px; border:1px solid #ddd;">NPK (kg/cây/năm)</th><th style="padding:8px; border:1px solid #ddd;">Hữu cơ (kg/cây)</th></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">1-3 năm</td><td style="padding:8px; border:1px solid #ddd;">0.5-1</td><td style="padding:8px; border:1px solid #ddd;">10-15</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">4-6 năm</td><td style="padding:8px; border:1px solid #ddd;">1-2</td><td style="padding:8px; border:1px solid #ddd;">20-30</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Trên 6 năm</td><td style="padding:8px; border:1px solid #ddd;">2-3</td><td style="padding:8px; border:1px solid #ddd;">30-50</td></tr>
</table>

<img src="https://images.unsplash.com/photo-1596591868231-a15c22c4e5c4?w=800" alt="Thu hoạch trái cây" style="width:100%; border-radius:8px; margin:16px 0;">

<blockquote style="background:#e3f2fd; padding:16px; border-left:4px solid #2196f3; margin:16px 0;">
<strong>Kinh nghiệm:</strong> Cắt tỉa cành sau thu hoạch giúp cây ra hoa đều và năng suất cao hơn.
</blockquote>',
'Hướng dẫn kỹ thuật trồng cây ăn trái từ chọn giống, chuẩn bị đất đến chăm sóc và thu hoạch.',
'https://images.unsplash.com/photo-1553279768-865429fa0078?w=600', 1, NULL, 756, true, false, NOW(), NOW(), NOW()),

-- Bài 4: Trồng cà phê
('Kỹ thuật trồng cà phê Robusta và Arabica', 'ky-thuat-trong-ca-phe',
'<h2>Tổng quan về cây cà phê</h2>
<p>Việt Nam là nước xuất khẩu cà phê lớn thứ 2 thế giới. Hai giống chính là Robusta (Tây Nguyên) và Arabica (vùng cao).</p>

<img src="https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800" alt="Vườn cà phê" style="width:100%; border-radius:8px; margin:16px 0;">

<h2>1. Điều kiện sinh thái</h2>
<table style="width:100%; border-collapse:collapse; margin:16px 0;">
<tr style="background:#f0f0f0;"><th style="padding:8px; border:1px solid #ddd;">Yếu tố</th><th style="padding:8px; border:1px solid #ddd;">Robusta</th><th style="padding:8px; border:1px solid #ddd;">Arabica</th></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Độ cao</td><td style="padding:8px; border:1px solid #ddd;">400-800m</td><td style="padding:8px; border:1px solid #ddd;">1000-1500m</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Nhiệt độ</td><td style="padding:8px; border:1px solid #ddd;">22-26°C</td><td style="padding:8px; border:1px solid #ddd;">18-22°C</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Lượng mưa</td><td style="padding:8px; border:1px solid #ddd;">1500-2000mm</td><td style="padding:8px; border:1px solid #ddd;">1500-2500mm</td></tr>
</table>

<h2>2. Kỹ thuật canh tác</h2>
<p>Mật độ trồng: 3x3m (1100 cây/ha) hoặc 3x2.5m (1333 cây/ha)</p>

<h2>3. Thu hoạch và sơ chế</h2>
<img src="https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800" alt="Thu hoạch cà phê" style="width:100%; border-radius:8px; margin:16px 0;">
<p>Thu hoạch quả chín đỏ, phơi khô hoặc sơ chế ướt để đạt chất lượng cao nhất.</p>',
'Hướng dẫn kỹ thuật trồng cà phê Robusta và Arabica đạt năng suất và chất lượng cao.',
'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600', 1, NULL, 620, true, false, NOW(), NOW(), NOW()),

-- Bài 5: Trồng hoa màu
('Kỹ thuật trồng các loại hoa màu theo mùa', 'ky-thuat-trong-hoa-mau',
'<h2>Các loại hoa màu phổ biến</h2>
<p>Hoa màu bao gồm ngô, khoai, đậu, lạc... là nguồn thu nhập quan trọng cho nông dân Việt Nam.</p>

<img src="https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800" alt="Ruộng ngô" style="width:100%; border-radius:8px; margin:16px 0;">

<h2>1. Lịch thời vụ</h2>
<table style="width:100%; border-collapse:collapse; margin:16px 0;">
<tr style="background:#f0f0f0;"><th style="padding:8px; border:1px solid #ddd;">Cây trồng</th><th style="padding:8px; border:1px solid #ddd;">Vụ Xuân</th><th style="padding:8px; border:1px solid #ddd;">Vụ Thu-Đông</th></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Ngô</td><td style="padding:8px; border:1px solid #ddd;">Tháng 2-3</td><td style="padding:8px; border:1px solid #ddd;">Tháng 8-9</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Lạc</td><td style="padding:8px; border:1px solid #ddd;">Tháng 1-2</td><td style="padding:8px; border:1px solid #ddd;">Tháng 7-8</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Đậu tương</td><td style="padding:8px; border:1px solid #ddd;">Tháng 2-3</td><td style="padding:8px; border:1px solid #ddd;">Tháng 9-10</td></tr>
</table>

<h2>2. Kỹ thuật luân canh</h2>
<p>Luân canh hoa màu với lúa giúp cải tạo đất, tăng năng suất và giảm sâu bệnh.</p>
<img src="https://images.unsplash.com/photo-1595855759920-86582396756a?w=800" alt="Luân canh" style="width:100%; border-radius:8px; margin:16px 0;">',
'Kỹ thuật trồng ngô, lạc, đậu và các loại hoa màu theo mùa vụ.',
'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=600', 1, NULL, 445, true, false, NOW(), NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
