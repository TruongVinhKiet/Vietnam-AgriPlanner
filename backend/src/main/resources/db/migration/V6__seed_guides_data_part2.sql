-- =====================================================
-- AgriPlanner - Seed Data for Guides (Part 2)
-- CHĂN NUÔI - 5 bài viết
-- =====================================================

INSERT INTO guides (title, slug, content, excerpt, cover_image, category_id, author_id, view_count, is_published, is_featured, created_at, updated_at, published_at) VALUES
-- Bài 1: Nuôi heo
('Kỹ thuật nuôi heo thịt công nghiệp', 'ky-thuat-nuoi-heo-thit',
'<h2>Giới thiệu về chăn nuôi heo</h2>
<p>Chăn nuôi heo thịt là ngành kinh tế quan trọng. Áp dụng kỹ thuật đúng giúp tăng trọng nhanh, giảm chi phí.</p>
<img src="https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=800" alt="Trang trại heo" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Chuồng trại</h2>
<ul><li>Diện tích: 1.5-2m²/con</li><li>Thông thoáng, có hệ thống làm mát</li><li>Nền chuồng dễ vệ sinh</li></ul>
<h2>2. Chế độ dinh dưỡng</h2>
<table style="width:100%; border-collapse:collapse; margin:16px 0;">
<tr style="background:#f0f0f0;"><th style="padding:8px; border:1px solid #ddd;">Giai đoạn</th><th style="padding:8px; border:1px solid #ddd;">Trọng lượng</th><th style="padding:8px; border:1px solid #ddd;">Thức ăn/ngày</th></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Heo con</td><td style="padding:8px; border:1px solid #ddd;">10-30kg</td><td style="padding:8px; border:1px solid #ddd;">1-1.5kg</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Heo choai</td><td style="padding:8px; border:1px solid #ddd;">30-60kg</td><td style="padding:8px; border:1px solid #ddd;">2-2.5kg</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Heo vỗ béo</td><td style="padding:8px; border:1px solid #ddd;">60-100kg</td><td style="padding:8px; border:1px solid #ddd;">3-3.5kg</td></tr>
</table>',
'Hướng dẫn kỹ thuật nuôi heo thịt công nghiệp từ chuồng trại đến chế độ dinh dưỡng.',
'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=600', 2, NULL, 890, true, true, NOW(), NOW(), NOW()),

-- Bài 2: Nuôi gà
('Kỹ thuật nuôi gà thả vườn và gà công nghiệp', 'ky-thuat-nuoi-ga',
'<h2>Các hình thức nuôi gà</h2>
<p>Gà là vật nuôi phổ biến với hai hình thức: thả vườn và công nghiệp, mỗi loại có ưu nhược điểm riêng.</p>
<img src="https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800" alt="Gà thả vườn" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Chuồng nuôi</h2>
<p>Mật độ: 8-10 con/m² (gà công nghiệp), 4-5 con/m² (gà thả vườn)</p>
<h2>2. Tiêm phòng vaccine</h2>
<ul><li>Ngày 1: Marek</li><li>7-10 ngày: Newcastle + Gumboro</li><li>21 ngày: Nhắc lại</li></ul>',
'Hướng dẫn nuôi gà thả vườn và gà công nghiệp hiệu quả, năng suất cao.',
'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600', 2, NULL, 720, true, false, NOW(), NOW(), NOW()),

-- Bài 3: Nuôi bò
('Kỹ thuật nuôi bò thịt và bò sữa', 'ky-thuat-nuoi-bo',
'<h2>Chăn nuôi bò tại Việt Nam</h2>
<p>Bò thịt và bò sữa đòi hỏi kỹ thuật chăm sóc khác nhau về chuồng trại và khẩu phần ăn.</p>
<img src="https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?w=800" alt="Trang trại bò" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Khẩu phần ăn</h2>
<table style="width:100%; border-collapse:collapse; margin:16px 0;">
<tr style="background:#f0f0f0;"><th style="padding:8px; border:1px solid #ddd;">Loại bò</th><th style="padding:8px; border:1px solid #ddd;">Cỏ tươi</th><th style="padding:8px; border:1px solid #ddd;">Thức ăn tinh</th></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Bò thịt</td><td style="padding:8px; border:1px solid #ddd;">30-40kg/ngày</td><td style="padding:8px; border:1px solid #ddd;">2-3kg</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Bò sữa</td><td style="padding:8px; border:1px solid #ddd;">40-50kg/ngày</td><td style="padding:8px; border:1px solid #ddd;">5-7kg</td></tr>
</table>',
'Kỹ thuật nuôi bò thịt và bò sữa chất lượng cao.',
'https://images.unsplash.com/photo-1527153857715-3908f2bae5e8?w=600', 2, NULL, 540, true, false, NOW(), NOW(), NOW()),

-- Bài 4: Nuôi thủy sản
('Kỹ thuật nuôi cá nước ngọt', 'ky-thuat-nuoi-ca-nuoc-ngot',
'<h2>Nuôi cá nước ngọt tại Việt Nam</h2>
<p>Các loại cá phổ biến: cá tra, cá rô phi, cá chép... mang lại thu nhập cao cho nông dân.</p>
<img src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800" alt="Ao nuôi cá" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Chuẩn bị ao</h2>
<ul><li>Diện tích: 500-5000m²</li><li>Độ sâu: 1.5-2m</li><li>Xử lý vôi trước khi thả</li></ul>
<h2>2. Mật độ thả</h2>
<p>Cá tra: 30-40 con/m², Rô phi: 3-5 con/m²</p>',
'Hướng dẫn nuôi cá tra, cá rô phi và các loại cá nước ngọt.',
'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600', 2, NULL, 680, true, true, NOW(), NOW(), NOW()),

-- Bài 5: Nuôi ong
('Kỹ thuật nuôi ong lấy mật', 'ky-thuat-nuoi-ong-lay-mat',
'<h2>Nghề nuôi ong tại Việt Nam</h2>
<p>Nuôi ong mang lại thu nhập cao với chi phí đầu tư thấp, phù hợp hộ gia đình.</p>
<img src="https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=800" alt="Nuôi ong" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Chọn thùng ong</h2>
<p>Thùng gỗ tiêu chuẩn 10 cầu, đặt nơi thoáng mát.</p>
<h2>2. Thu hoạch mật</h2>
<p>Mùa hoa: 2-3 lần/tháng. Năng suất: 20-40kg mật/thùng/năm.</p>',
'Kỹ thuật nuôi ong lấy mật cho người mới bắt đầu.',
'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=600', 2, NULL, 420, true, false, NOW(), NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- KỸ THUẬT - 5 bài viết
-- =====================================================

INSERT INTO guides (title, slug, content, excerpt, cover_image, category_id, author_id, view_count, is_published, is_featured, created_at, updated_at, published_at) VALUES
-- Bài 1: Tưới nhỏ giọt
('Hệ thống tưới nhỏ giọt tiết kiệm nước', 'he-thong-tuoi-nho-giot',
'<h2>Tưới nhỏ giọt là gì?</h2>
<p>Tưới nhỏ giọt là phương pháp tưới hiện đại, tiết kiệm 50-70% nước so với tưới tràn truyền thống.</p>
<img src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800" alt="Tưới nhỏ giọt" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Thành phần hệ thống</h2>
<ul><li>Bể chứa + bơm</li><li>Ống dẫn chính và phụ</li><li>Đầu nhỏ giọt</li><li>Bộ lọc</li></ul>
<h2>2. Chi phí đầu tư</h2>
<p>Khoảng 20-30 triệu/ha, hoàn vốn sau 2-3 năm.</p>',
'Hướng dẫn lắp đặt và vận hành hệ thống tưới nhỏ giọt.',
'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600', 3, NULL, 560, true, true, NOW(), NOW(), NOW()),

-- Bài 2: Phân bón hữu cơ
('Kỹ thuật ủ phân hữu cơ từ phế phẩm nông nghiệp', 'ky-thuat-u-phan-huu-co',
'<h2>Tại sao nên dùng phân hữu cơ?</h2>
<p>Phân hữu cơ cải thiện cấu trúc đất, tăng vi sinh vật có lợi, an toàn cho môi trường.</p>
<img src="https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=800" alt="Ủ phân hữu cơ" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Nguyên liệu</h2>
<ul><li>Rơm rạ, lá cây, cỏ</li><li>Phân chuồng</li><li>Chế phẩm vi sinh</li></ul>
<h2>2. Quy trình ủ</h2>
<p>Thời gian ủ: 45-60 ngày. Đảo trộn 2 tuần/lần.</p>',
'Cách ủ phân hữu cơ từ rơm rạ và phế phẩm nông nghiệp.',
'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=600', 3, NULL, 480, true, false, NOW(), NOW(), NOW()),

-- Bài 3: IPM
('Quản lý dịch hại tổng hợp IPM', 'quan-ly-dich-hai-tong-hop-ipm',
'<h2>IPM là gì?</h2>
<p>IPM (Integrated Pest Management) là phương pháp kiểm soát sâu bệnh kết hợp nhiều biện pháp.</p>
<img src="https://images.unsplash.com/photo-1586771107445-d3ca888129ce?w=800" alt="IPM" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Các biện pháp IPM</h2>
<ul><li>Canh tác: luân canh, vệ sinh đồng ruộng</li><li>Sinh học: thiên địch, bẫy pheromone</li><li>Hóa học: dùng thuốc BVTV hợp lý</li></ul>',
'Phương pháp quản lý dịch hại tổng hợp an toàn và hiệu quả.',
'https://images.unsplash.com/photo-1586771107445-d3ca888129ce?w=600', 3, NULL, 390, true, false, NOW(), NOW(), NOW()),

-- Bài 4: Nhà kính
('Kỹ thuật trồng rau trong nhà kính', 'ky-thuat-trong-rau-nha-kinh',
'<h2>Ưu điểm của nhà kính</h2>
<p>Nhà kính giúp kiểm soát môi trường, giảm sâu bệnh, tăng năng suất gấp 3-5 lần.</p>
<img src="https://images.unsplash.com/photo-1586771107445-d3ca888129ce?w=800" alt="Nhà kính" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Chi phí đầu tư</h2>
<p>Nhà kính đơn giản: 200-300 triệu/1000m²</p>
<h2>2. Các loại rau phù hợp</h2>
<ul><li>Cà chua, dưa leo</li><li>Ớt chuông, xà lách</li><li>Dâu tây</li></ul>',
'Hướng dẫn trồng rau công nghệ cao trong nhà kính.',
'https://images.unsplash.com/photo-1586771107445-d3ca888129ce?w=600', 3, NULL, 520, true, true, NOW(), NOW(), NOW()),

-- Bài 5: Máy nông nghiệp
('Sử dụng máy móc trong nông nghiệp hiện đại', 'su-dung-may-moc-nong-nghiep',
'<h2>Cơ giới hóa nông nghiệp</h2>
<p>Máy móc giúp tăng năng suất lao động, giảm chi phí nhân công.</p>
<img src="https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=800" alt="Máy nông nghiệp" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Các loại máy phổ biến</h2>
<ul><li>Máy cày, máy bừa</li><li>Máy gặt đập liên hợp</li><li>Máy phun thuốc</li><li>Drone phun thuốc</li></ul>',
'Hướng dẫn sử dụng máy móc nông nghiệp hiệu quả.',
'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=600', 3, NULL, 350, true, false, NOW(), NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- THỊ TRƯỜNG - 5 bài viết
-- =====================================================

INSERT INTO guides (title, slug, content, excerpt, cover_image, category_id, author_id, view_count, is_published, is_featured, created_at, updated_at, published_at) VALUES
-- Bài 1: Giá lúa gạo
('Phân tích thị trường lúa gạo Việt Nam', 'phan-tich-thi-truong-lua-gao',
'<h2>Tổng quan thị trường</h2>
<p>Việt Nam xuất khẩu 6-7 triệu tấn gạo/năm, đứng thứ 2-3 thế giới.</p>
<img src="https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=800" alt="Thị trường gạo" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Giá gạo xuất khẩu 2024</h2>
<table style="width:100%; border-collapse:collapse; margin:16px 0;">
<tr style="background:#f0f0f0;"><th style="padding:8px; border:1px solid #ddd;">Loại gạo</th><th style="padding:8px; border:1px solid #ddd;">Giá (USD/tấn)</th></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Gạo 5% tấm</td><td style="padding:8px; border:1px solid #ddd;">550-600</td></tr>
<tr><td style="padding:8px; border:1px solid #ddd;">Gạo thơm</td><td style="padding:8px; border:1px solid #ddd;">650-750</td></tr>
</table>',
'Phân tích giá cả và xu hướng thị trường lúa gạo.',
'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=600', 4, NULL, 780, true, true, NOW(), NOW(), NOW()),

-- Bài 2: Xuất khẩu rau quả
('Xu hướng xuất khẩu rau quả Việt Nam', 'xu-huong-xuat-khau-rau-qua',
'<h2>Tiềm năng xuất khẩu</h2>
<p>Rau quả Việt Nam xuất khẩu đạt 3-4 tỷ USD/năm với các thị trường: Trung Quốc, Mỹ, EU.</p>
<img src="https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800" alt="Xuất khẩu rau quả" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Sản phẩm chủ lực</h2>
<ul><li>Thanh long, xoài</li><li>Vải, nhãn, sầu riêng</li><li>Dưa hấu, chuối</li></ul>',
'Cơ hội và thách thức xuất khẩu rau quả Việt Nam.',
'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600', 4, NULL, 620, true, false, NOW(), NOW(), NOW()),

-- Bài 3: Giá cà phê
('Biến động giá cà phê thế giới và Việt Nam', 'bien-dong-gia-ca-phe',
'<h2>Thị trường cà phê</h2>
<p>Việt Nam là nước xuất khẩu Robusta lớn nhất thế giới.</p>
<img src="https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800" alt="Cà phê" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Giá cà phê 2024</h2>
<p>Robusta: 3,000-4,000 USD/tấn. Arabica: 5,000-6,000 USD/tấn.</p>',
'Phân tích biến động giá cà phê và dự báo thị trường.',
'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600', 4, NULL, 540, true, false, NOW(), NOW(), NOW()),

-- Bài 4: Thị trường thủy sản
('Thị trường xuất khẩu thủy sản Việt Nam', 'thi-truong-xuat-khau-thuy-san',
'<h2>Xuất khẩu thủy sản</h2>
<p>Việt Nam xuất khẩu 9-10 tỷ USD thủy sản/năm, đứng thứ 3 thế giới.</p>
<img src="https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800" alt="Thủy sản" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Sản phẩm chính</h2>
<ul><li>Tôm: 4 tỷ USD</li><li>Cá tra: 2.5 tỷ USD</li><li>Hải sản khác: 3 tỷ USD</li></ul>',
'Phân tích thị trường xuất khẩu tôm, cá tra.',
'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600', 4, NULL, 480, true, true, NOW(), NOW(), NOW()),

-- Bài 5: Nông sản hữu cơ
('Xu hướng tiêu dùng nông sản hữu cơ', 'xu-huong-nong-san-huu-co',
'<h2>Thị trường organic</h2>
<p>Nhu cầu tiêu thụ nông sản hữu cơ tăng 15-20%/năm tại Việt Nam.</p>
<img src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800" alt="Nông sản hữu cơ" style="width:100%; border-radius:8px; margin:16px 0;">
<h2>1. Yêu cầu chứng nhận</h2>
<ul><li>Chứng nhận hữu cơ Việt Nam</li><li>USDA Organic (Mỹ)</li><li>EU Organic</li></ul>',
'Cơ hội kinh doanh nông sản hữu cơ tại Việt Nam.',
'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600', 4, NULL, 390, true, false, NOW(), NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
