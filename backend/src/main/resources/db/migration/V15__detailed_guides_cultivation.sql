-- =====================================================
-- AgriPlanner - Detailed Guide Content V7
-- TRỒNG TRỌT - 5 bài chi tiết (thay thế V5)
-- =====================================================

-- Xóa dữ liệu cũ nếu có
DELETE FROM guides WHERE slug IN (
    'ky-thuat-trong-lua-nuoc', 'trong-rau-sach-tai-nha', 'trong-cay-an-trai',
    'ky-thuat-trong-ca-phe', 'trong-hoa-mau-ngan-ngay',
    'ky-thuat-nuoi-heo-thit', 'ky-thuat-nuoi-ga', 'ky-thuat-nuoi-bo',
    'ky-thuat-nuoi-ca-nuoc-ngot', 'ky-thuat-nuoi-ong-lay-mat',
    'he-thong-tuoi-nho-giot', 'ky-thuat-u-phan-huu-co', 'quan-ly-dich-hai-tong-hop-ipm',
    'ky-thuat-trong-rau-nha-kinh', 'su-dung-may-moc-nong-nghiep',
    'phan-tich-thi-truong-lua-gao', 'xu-huong-xuat-khau-rau-qua', 'bien-dong-gia-ca-phe',
    'thi-truong-xuat-khau-thuy-san', 'xu-huong-nong-san-huu-co'
);

-- =====================================================
-- TRỒNG TRỌT - Bài 1: Kỹ thuật trồng lúa nước
-- =====================================================
INSERT INTO guides (title, slug, content, excerpt, cover_image, category_id, author_id, view_count, is_published, is_featured, created_at, updated_at, published_at) VALUES
('Hướng dẫn chi tiết kỹ thuật trồng lúa nước đạt năng suất cao', 'ky-thuat-trong-lua-nuoc',
'<h2>Giới thiệu tổng quan về cây lúa nước</h2>
<p>Lúa nước (Oryza sativa) là cây lương thực quan trọng nhất tại Việt Nam, chiếm hơn 50% diện tích đất nông nghiệp cả nước. Với lịch sử canh tác hàng nghìn năm, người nông dân Việt Nam đã tích lũy được nhiều kinh nghiệm quý báu. Tuy nhiên, để đạt năng suất cao và bền vững, cần áp dụng đúng các kỹ thuật khoa học hiện đại kết hợp với kinh nghiệm truyền thống.</p>

<p><strong>Tầm quan trọng của việc canh tác đúng kỹ thuật:</strong> Một hecta lúa canh tác đúng kỹ thuật có thể đạt 7-8 tấn/vụ, trong khi canh tác không đúng chỉ đạt 4-5 tấn/vụ. Điều này có nghĩa là sự khác biệt về thu nhập lên đến 30-40 triệu đồng/ha/vụ.</p>

<img src="https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=800" alt="Ruộng lúa xanh tốt" style="width:100%; border-radius:12px; margin:20px 0;">

<h2>Bước 1: Chuẩn bị đất và làm đất kỹ lưỡng</h2>

<h3>1.1 Tại sao phải làm đất kỹ?</h3>
<p>Làm đất kỹ quyết định 40% thành công của vụ lúa. Đất được làm kỹ sẽ:</p>
<ul>
<li><strong>Tiêu diệt cỏ dại:</strong> Cày phơi ải giúp diệt 80% hạt cỏ và mầm bệnh trong đất</li>
<li><strong>Tăng dinh dưỡng:</strong> Phân hủy rơm rạ vụ trước, bổ sung chất hữu cơ</li>
<li><strong>Cải thiện cấu trúc:</strong> Đất tơi xốp giúp rễ phát triển mạnh, hấp thu dinh dưỡng tốt hơn</li>
<li><strong>Điều tiết nước:</strong> Đất bằng phẳng giúp quản lý mực nước đồng đều</li>
</ul>

<h3>1.2 Quy trình làm đất chuẩn</h3>
<table style="width:100%; border-collapse:collapse; margin:20px 0;">
<tr style="background:#e8f5e9;"><th style="padding:12px; border:1px solid #c8e6c9; text-align:left;">Công đoạn</th><th style="padding:12px; border:1px solid #c8e6c9;">Thời gian</th><th style="padding:12px; border:1px solid #c8e6c9;">Mục đích</th></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Cày lật đất</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">15-20 ngày trước gieo</td><td style="padding:12px; border:1px solid #ddd;">Vùi rơm rạ, diệt cỏ dại</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Phơi ải</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">7-10 ngày</td><td style="padding:12px; border:1px solid #ddd;">Diệt mầm bệnh, phân hủy hữu cơ</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Bừa lần 1</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">5 ngày trước gieo</td><td style="padding:12px; border:1px solid #ddd;">Làm nhỏ đất, trộn đều</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">San phẳng mặt ruộng</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">1-2 ngày trước gieo</td><td style="padding:12px; border:1px solid #ddd;">Đảm bảo mặt ruộng bằng phẳng</td></tr>
</table>

<blockquote style="background:#fff3e0; border-left:4px solid #ff9800; padding:16px; margin:20px 0; border-radius:0 8px 8px 0;">
<strong>⚠️ Hậu quả nếu không làm đất kỹ:</strong> Cỏ dại phát triển mạnh cạnh tranh dinh dưỡng, lúa mọc không đều, năng suất giảm 20-30%. Chi phí trừ cỏ tăng gấp 2-3 lần.
</blockquote>

<h2>Bước 2: Chọn giống và xử lý hạt giống</h2>

<h3>2.1 Tiêu chí chọn giống lúa</h3>
<p>Chọn giống phù hợp với điều kiện địa phương là yếu tố then chốt. Cần xem xét:</p>
<ul>
<li><strong>Thời gian sinh trưởng:</strong> Ngắn ngày (90-100 ngày), trung ngày (110-120 ngày), dài ngày (130-150 ngày)</li>
<li><strong>Khả năng chống chịu:</strong> Chống đổ ngã, chịu mặn, chịu hạn, kháng sâu bệnh</li>
<li><strong>Chất lượng gạo:</strong> Hạt dài, thơm, ít bạc bụng phù hợp xuất khẩu</li>
<li><strong>Năng suất tiềm năng:</strong> Từ 6-8 tấn/ha tùy giống</li>
</ul>

<h3>2.2 Các giống lúa phổ biến được khuyến cáo</h3>
<table style="width:100%; border-collapse:collapse; margin:20px 0;">
<tr style="background:#e3f2fd;"><th style="padding:12px; border:1px solid #bbdefb;">Giống</th><th style="padding:12px; border:1px solid #bbdefb;">Thời gian</th><th style="padding:12px; border:1px solid #bbdefb;">Năng suất</th><th style="padding:12px; border:1px solid #bbdefb;">Đặc điểm nổi bật</th></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">OM 18</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">95-100 ngày</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">6.5-7.5 tấn/ha</td><td style="padding:12px; border:1px solid #ddd;">Gạo thơm, chất lượng cao</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Đài Thơm 8</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">95-105 ngày</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">6-7 tấn/ha</td><td style="padding:12px; border:1px solid #ddd;">Thơm nhẹ, phù hợp xuất khẩu</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">ST25</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">100-110 ngày</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">5.5-6.5 tấn/ha</td><td style="padding:12px; border:1px solid #ddd;">Gạo ngon nhất thế giới 2019</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">IR 50404</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">90-95 ngày</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">7-8 tấn/ha</td><td style="padding:12px; border:1px solid #ddd;">Năng suất cao, dễ canh tác</td></tr>
</table>

<h3>2.3 Xử lý hạt giống trước khi gieo</h3>
<p>Xử lý hạt giống giúp tăng tỷ lệ nảy mầm từ 75% lên 95% và phòng ngừa bệnh từ hạt:</p>
<ol>
<li><strong>Phơi hạt:</strong> Phơi nắng nhẹ 2-3 giờ để kích hoạt enzyme nảy mầm</li>
<li><strong>Ngâm nước muối:</strong> Pha 150g muối/lít nước, loại bỏ hạt lép nổi lên</li>
<li><strong>Xử lý thuốc:</strong> Ngâm trong dung dịch Cruiser Plus 2ml/lít nước trong 12 giờ</li>
<li><strong>Ủ hạt:</strong> Ủ trong bao ẩm 24-36 giờ đến khi mầm dài 1-2mm</li>
</ol>

<h2>Bước 3: Gieo sạ hoặc cấy mạ</h2>

<h3>3.1 So sánh phương pháp gieo sạ và cấy</h3>
<table style="width:100%; border-collapse:collapse; margin:20px 0;">
<tr style="background:#f3e5f5;"><th style="padding:12px; border:1px solid #e1bee7;">Tiêu chí</th><th style="padding:12px; border:1px solid #e1bee7;">Gieo sạ</th><th style="padding:12px; border:1px solid #e1bee7;">Cấy mạ</th></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Lượng giống</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">120-150 kg/ha</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">40-60 kg/ha</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Công lao động</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Ít (1-2 công/ha)</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Nhiều (15-20 công/ha)</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Kiểm soát cỏ</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Khó khăn hơn</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Dễ dàng hơn</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Năng suất</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Tương đương</td><td style="padding:12px; border:1px solid #ddd; text-align:center;">Tương đương</td></tr>
</table>

<h3>3.2 Kỹ thuật gieo sạ đúng cách</h3>
<p>Sạ hàng (gieo theo hàng) được khuyến khích vì tiết kiệm giống và dễ chăm sóc:</p>
<ul>
<li>Mật độ: 100-120 kg giống/ha (sạ hàng) hoặc 120-150 kg/ha (sạ lan)</li>
<li>Khoảng cách hàng: 20-25 cm</li>
<li>Độ sâu gieo: 1-2 cm, không quá sâu làm mầm yếu</li>
<li>Thời điểm: Sáng sớm hoặc chiều mát, tránh nắng gắt</li>
</ul>

<h2>Bước 4: Quản lý nước khoa học</h2>

<h3>4.1 Nguyên tắc "Nông - Lộ - Phơi"</h3>
<p>Đây là kỹ thuật tưới tiết kiệm nước (AWD - Alternate Wetting and Drying) được FAO khuyến cáo:</p>
<ul>
<li><strong>Giai đoạn mạ (0-20 ngày):</strong> Giữ ẩm, không để ngập nước</li>
<li><strong>Giai đoạn đẻ nhánh (20-45 ngày):</strong> Nước xâm xấp 3-5 cm</li>
<li><strong>Giai đoạn làm đòng (45-60 ngày):</strong> Duy trì 5-7 cm nước</li>
<li><strong>Giai đoạn trổ bông (60-80 ngày):</strong> Giữ 3-5 cm nước ổn định</li>
<li><strong>Giai đoạn chín (80-100 ngày):</strong> Rút nước dần, ngừng tưới trước thu hoạch 10-15 ngày</li>
</ul>

<blockquote style="background:#e3f2fd; border-left:4px solid #2196f3; padding:16px; margin:20px 0; border-radius:0 8px 8px 0;">
<strong>💡 Lợi ích của kỹ thuật AWD:</strong> Tiết kiệm 25-30% nước tưới, giảm phát thải khí methane 30-50%, rễ phát triển khỏe mạnh hơn, lúa ít đổ ngã.
</blockquote>

<h2>Bước 5: Bón phân cân đối và đúng thời điểm</h2>

<h3>5.1 Công thức phân bón chuẩn cho 1 hecta</h3>
<table style="width:100%; border-collapse:collapse; margin:20px 0;">
<tr style="background:#e8f5e9;"><th style="padding:12px; border:1px solid #c8e6c9;">Đợt bón</th><th style="padding:12px; border:1px solid #c8e6c9;">Thời điểm</th><th style="padding:12px; border:1px solid #c8e6c9;">Loại phân</th><th style="padding:12px; border:1px solid #c8e6c9;">Liều lượng</th></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Bón lót</td><td style="padding:12px; border:1px solid #ddd;">Trước gieo</td><td style="padding:12px; border:1px solid #ddd;">DAP + Kali</td><td style="padding:12px; border:1px solid #ddd;">100kg DAP + 30kg KCl</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Bón thúc 1</td><td style="padding:12px; border:1px solid #ddd;">10-15 ngày sau gieo</td><td style="padding:12px; border:1px solid #ddd;">Urê</td><td style="padding:12px; border:1px solid #ddd;">50-60 kg Urê</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Bón thúc 2</td><td style="padding:12px; border:1px solid #ddd;">20-25 ngày sau gieo</td><td style="padding:12px; border:1px solid #ddd;">Urê + Kali</td><td style="padding:12px; border:1px solid #ddd;">40kg Urê + 30kg KCl</td></tr>
<tr><td style="padding:12px; border:1px solid #ddd;">Bón đón đòng</td><td style="padding:12px; border:1px solid #ddd;">40-45 ngày sau gieo</td><td style="padding:12px; border:1px solid #ddd;">Urê + Kali</td><td style="padding:12px; border:1px solid #ddd;">30kg Urê + 40kg KCl</td></tr>
</table>

<h3>5.2 Nguyên tắc bón phân "4 Đúng"</h3>
<ol>
<li><strong>Đúng loại:</strong> Chọn phân phù hợp giai đoạn sinh trưởng</li>
<li><strong>Đúng liều:</strong> Không bón thừa gây lốp đổ, không bón thiếu giảm năng suất</li>
<li><strong>Đúng lúc:</strong> Bón khi lúa cần, không bón khi mưa to</li>
<li><strong>Đúng cách:</strong> Bón đều khắp ruộng, kết hợp với quản lý nước</li>
</ol>

<h2>Bước 6: Phòng trừ sâu bệnh tổng hợp (IPM)</h2>

<h3>6.1 Các sâu bệnh hại chính và cách nhận biết</h3>
<ul>
<li><strong>Sâu cuốn lá:</strong> Lá bị cuốn thành ống, có nhộng bên trong. Phun Regent khi mật độ >20 con/m²</li>
<li><strong>Rầy nâu:</strong> Lúa vàng thành từng chòm (cháy rầy). Phun Chess khi >2000 con/m²</li>
<li><strong>Bệnh đạo ôn:</strong> Vết bệnh hình thoi, viền nâu. Phun Beam hoặc Filia khi phát hiện</li>
<li><strong>Bệnh khô vằn:</strong> Vết bệnh loang lổ ở bẹ lá. Phun Validacin khi bệnh <20%</li>
</ul>

<h3>6.2 Biện pháp phòng ngừa</h3>
<ul>
<li>Sử dụng giống kháng bệnh</li>
<li>Vệ sinh đồng ruộng sau thu hoạch</li>
<li>Bón phân cân đối, không thừa đạm</li>
<li>Bảo vệ thiên địch như nhện, bọ rùa</li>
<li>Thăm đồng thường xuyên 2-3 lần/tuần</li>
</ul>

<h2>Bước 7: Thu hoạch và bảo quản</h2>

<h3>7.1 Xác định thời điểm thu hoạch</h3>
<p>Thu hoạch đúng thời điểm quyết định chất lượng gạo:</p>
<ul>
<li>85-90% hạt trên bông chuyển vàng</li>
<li>Hạt cứng, cắn không vỡ</li>
<li>Độ ẩm hạt 20-25%</li>
<li>Thường 28-32 ngày sau trổ đều</li>
</ul>

<blockquote style="background:#ffebee; border-left:4px solid #f44336; padding:16px; margin:20px 0; border-radius:0 8px 8px 0;">
<strong>⚠️ Hậu quả thu hoạch sai thời điểm:</strong>
<ul>
<li>Thu sớm: Hạt lép, xanh non, năng suất giảm 10-15%</li>
<li>Thu muộn: Hạt rụng, gãy, tỷ lệ gạo nguyên giảm 20-30%</li>
</ul>
</blockquote>

<h2>Kết luận</h2>
<p>Trồng lúa nước đạt năng suất cao đòi hỏi sự kết hợp hài hòa giữa các yếu tố: giống tốt, làm đất kỹ, quản lý nước khoa học, bón phân cân đối và phòng trừ sâu bệnh kịp thời. Áp dụng đúng quy trình kỹ thuật giúp tăng năng suất 30-50%, giảm chi phí 20-30% và nâng cao chất lượng gạo, góp phần tăng thu nhập bền vững cho nông dân.</p>',
'Hướng dẫn đầy đủ chi tiết từng bước trồng lúa nước từ làm đất, chọn giống, gieo sạ, quản lý nước, bón phân đến thu hoạch đạt năng suất 7-8 tấn/ha.',
'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=600', 1, NULL, 1250, true, true, NOW(), NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET
    content = EXCLUDED.content,
    excerpt = EXCLUDED.excerpt,
    updated_at = NOW();
