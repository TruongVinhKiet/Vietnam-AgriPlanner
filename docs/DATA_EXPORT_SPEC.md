# Xuất dữ liệu chăn nuôi — Đặc tả tính năng

> **Phiên bản:** 1.0  
> **Ngày:** 2025  
> **Mục tiêu:** Cho phép chủ trang trại xuất dữ liệu chăn nuôi ra file Excel (.xlsx) phục vụ báo cáo thú y, kế toán, và lưu trữ offline.

---

## 1. Tổng quan

### 1.1 Dữ liệu có thể xuất

Dựa trên các model hiện có trong hệ thống:

| Model | Bảng DB | Mô tả |
|-------|---------|--------|
| `Pen` | `pens` | Thông tin chuồng trại |
| `FeedingLog` | `feeding_logs` | Lịch sử cho ăn |
| `HealthRecord` | `health_records` | Sức khỏe, vaccine, bệnh, hao hụt |
| `AnimalGrowth` | `animal_growth` | Tăng trưởng cân nặng |
| `ByproductLog` | `byproduct_logs` | Sản phẩm phụ (trứng, sữa, mật ong) |
| `AssetTransaction` | `asset_transactions` | Giao dịch thu/chi |
| `OperatingCost` | `operating_costs` | Chi phí vận hành (khi feature mới deploy) |
| `VaccinationSchedule` | `vaccination_schedules` | Lịch tiêm phòng theo loài |

### 1.2 Hiện trạng

- **Không có dependency xuất file** — `pom.xml` chưa có Apache POI hoặc OpenCSV.
- **Không có endpoint export** trong bất kỳ controller nào.
- **Không có UI xuất dữ liệu** trên frontend.

---

## 2. Yêu cầu chức năng

### 2.1 Các loại báo cáo xuất

#### A. Báo cáo tổng hợp chuồng trại (Farm Report)
- Danh sách tất cả chuồng của trang trại
- Thông tin: mã chuồng, loại vật nuôi, số lượng, trạng thái, ngày bắt đầu, ngày dự kiến thu hoạch
- Tổng vốn đầu tư

#### B. Báo cáo thú y (Veterinary Report)
- Danh sách sự kiện sức khỏe (HealthRecord) cho từng chuồng hoặc toàn trang trại
- Bao gồm: VACCINE, SICKNESS, CHECKUP, MORTALITY
- Lọc theo khoảng thời gian
- **Quan trọng cho kiểm tra thú y và tuân thủ quy định**

#### C. Báo cáo cho ăn (Feeding Report)
- Lịch sử cho ăn theo chuồng hoặc toàn trang trại
- Tổng hợp: kg tiêu thụ, chi phí, theo loại thức ăn
- Lọc theo khoảng thời gian

#### D. Báo cáo tài chính (Financial Report)
- Thu nhập từ thu hoạch (`AssetTransaction` INCOME/LIVESTOCK)
- Chi phí hao hụt (`AssetTransaction` EXPENSE/LIVESTOCK_LOSS)
- Chi phí thức ăn (từ `FeedingLog.cost`)
- Chi phí vận hành (từ `OperatingCost` — nếu đã deploy)
- Tổng: Doanh thu, Chi phí, Lợi nhuận

#### E. Báo cáo tăng trưởng (Growth Report)
- Cân nặng theo thời gian cho từng chuồng
- Sản phẩm phụ (trứng/sữa/mật ong) theo thời gian

### 2.2 Định dạng xuất

- **Excel (.xlsx)** — Ưu tiên chính, phổ biến nhất tại Việt Nam
- **CSV (.csv)** — Tùy chọn phụ, dễ import vào phần mềm khác

### 2.3 Tùy chọn khi xuất

- Chọn chuồng cụ thể hoặc tất cả
- Chọn khoảng thời gian (từ ngày — đến ngày)
- Chọn loại báo cáo (multi-select)

---

## 3. Thiết kế Backend

### 3.1 Dependency (pom.xml)

```xml
<!-- Apache POI for Excel export -->
<dependency>
    <groupId>org.apache.poi</groupId>
    <artifactId>poi-ooxml</artifactId>
    <version>5.2.5</version>
</dependency>
```

### 3.2 Service: `ExportService`

```java
@Service
public class ExportService {

    // Generate Excel workbook with multiple sheets
    public byte[] exportFarmReport(Long farmId, ExportRequest request) {
        Workbook workbook = new XSSFWorkbook();

        if (request.isIncludePens()) {
            createPenSheet(workbook, farmId);
        }
        if (request.isIncludeHealth()) {
            createHealthSheet(workbook, farmId, request.getFrom(), request.getTo());
        }
        if (request.isIncludeFeeding()) {
            createFeedingSheet(workbook, farmId, request.getFrom(), request.getTo());
        }
        if (request.isIncludeFinancial()) {
            createFinancialSheet(workbook, farmId, request.getFrom(), request.getTo());
        }
        if (request.isIncludeGrowth()) {
            createGrowthSheet(workbook, farmId, request.getFrom(), request.getTo());
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        workbook.write(out);
        workbook.close();
        return out.toByteArray();
    }
}
```

### 3.3 DTO: `ExportRequest`

```java
@Data
public class ExportRequest {
    private Long farmId;
    private Long penId;          // null = tất cả chuồng
    private LocalDate from;
    private LocalDate to;
    private boolean includePens = true;
    private boolean includeHealth = true;
    private boolean includeFeeding = true;
    private boolean includeFinancial = true;
    private boolean includeGrowth = false;
    private String format = "xlsx"; // xlsx hoặc csv
}
```

### 3.4 Controller: `ExportController`

```java
@RestController
@RequestMapping("/api/export")
public class ExportController {

    @PostMapping("/livestock")
    public ResponseEntity<byte[]> exportLivestock(@RequestBody ExportRequest request) {
        byte[] data = exportService.exportFarmReport(request.getFarmId(), request);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        String filename = "BaoCao_ChanNuoi_" +
            LocalDate.now().format(DateTimeFormatter.ofPattern("dd-MM-yyyy")) + ".xlsx";
        headers.setContentDispositionFormData("attachment", filename);

        return new ResponseEntity<>(data, headers, HttpStatus.OK);
    }

    @GetMapping("/livestock/pen/{penId}")
    public ResponseEntity<byte[]> exportPenReport(
            @PathVariable Long penId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        // Export data for a single pen
        ...
    }
}
```

### 3.5 Security

```java
// SecurityConfig.java
.requestMatchers("/api/export/**").hasAnyRole("OWNER", "SYSTEM_ADMIN")
```

---

## 4. Chi tiết các Sheet Excel

### 4.1 Sheet "Chuồng trại" (Pens)

| Cột | Dữ liệu | Nguồn |
|-----|----------|-------|
| A - Mã chuồng | `pen.code` | Pen |
| B - Loại vật nuôi | `animalDefinition.name` | AnimalDefinition |
| C - Số lượng | `pen.animalCount` | Pen |
| D - Sức chứa | `pen.capacity` | Pen |
| E - Loại hình | `pen.farmingType` | Pen |
| F - Trạng thái | `pen.status` | Pen |
| G - Ngày bắt đầu | `pen.startDate` | Pen |
| H - Ngày dự kiến thu hoạch | `pen.expectedHarvestDate` | Pen |
| I - Diện tích (m²) | `pen.areaSqm` | Pen |
| J - Vốn đầu tư | `pen.totalInvestment` | Pen |

**Header row:** Bold, background color `#4CAF50`, white text  
**Date format:** `dd/MM/yyyy`  
**Currency format:** `#,##0 ₫`

### 4.2 Sheet "Sức khỏe & Thú y" (Health Records)

| Cột | Dữ liệu | Nguồn |
|-----|----------|-------|
| A - Chuồng | `pen.code` | Pen (join) |
| B - Loại sự kiện | `eventType` → Vietnamese | HealthRecord |
| C - Tên | `name` | HealthRecord |
| D - Ngày | `eventDate` | HealthRecord |
| E - Trạng thái | `status` → Vietnamese | HealthRecord |
| F - Ghi chú | `notes` | HealthRecord |

**Event type mapping:**
- `VACCINE` → Tiêm phòng
- `SICKNESS` → Bệnh
- `CHECKUP` → Kiểm tra
- `MORTALITY` → Hao hụt

**Status mapping:**
- `PLANNED` → Đã lên kế hoạch
- `COMPLETED` → Đã thực hiện
- `OVERDUE` → Quá hạn

### 4.3 Sheet "Cho ăn" (Feeding Logs)

| Cột | Dữ liệu | Nguồn |
|-----|----------|-------|
| A - Chuồng | `pen.code` | Pen (join by penId) |
| B - Thời gian | `fedAt` | FeedingLog |
| C - Loại thức ăn | `feedDefinition.name` | FeedDefinition (eager) |
| D - Số lượng (kg) | `amountKg` | FeedingLog |
| E - Chi phí (VND) | `cost` | FeedingLog |
| F - Ghi chú | `notes` | FeedingLog |

**Summary row ở cuối:**
- Tổng kg: `SUM(D)`
- Tổng chi phí: `SUM(E)`

### 4.4 Sheet "Tài chính" (Financial)

| Cột | Dữ liệu | Nguồn |
|-----|----------|-------|
| A - Ngày | `createdAt` | AssetTransaction |
| B - Loại | INCOME/EXPENSE → Thu/Chi | AssetTransaction |
| C - Danh mục | `category` → Vietnamese | AssetTransaction |
| D - Số tiền | `amount` | AssetTransaction |
| E - Mô tả | `description` | AssetTransaction |
| F - Ghi chú | `notes` | AssetTransaction |

**Category mapping:**
- `LIVESTOCK` → Chăn nuôi (Thu hoạch)
- `LIVESTOCK_LOSS` → Hao hụt vật nuôi
- `LIVESTOCK_OPERATING` → Chi phí vận hành

**Summary section:**
- Tổng thu nhập: `SUM(D WHERE B='Thu')`
- Tổng chi phí: `SUM(D WHERE B='Chi')`
- Lợi nhuận ròng: Thu nhập - Chi phí

### 4.5 Sheet "Tăng trưởng" (Growth — tùy chọn)

| Cột | Dữ liệu | Nguồn |
|-----|----------|-------|
| A - Chuồng | `pen.code` | Pen |
| B - Ngày ghi nhận | `recordedDate` | AnimalGrowth |
| C - TB cân nặng (kg) | `avgWeightKg` | AnimalGrowth |
| D - Tổng cân nặng (kg) | `totalWeightKg` | AnimalGrowth |
| E - Ghi chú | `notes` | AnimalGrowth |

---

## 5. Thiết kế Frontend

### 5.1 Nút xuất dữ liệu

Thêm vào **pen detail header** (cạnh nút phân tích):

```html
<button class="btn btn--sm btn--outline" onclick="openExportModal()" title="Xuất dữ liệu">
    <span class="material-symbols-outlined">download</span>
    Xuất Excel
</button>
```

Và thêm vào **livestock toolbar** (cho toàn trang trại):

```html
<button class="btn btn--sm" onclick="openExportModal('farm')" id="btn-export-farm">
    <span class="material-symbols-outlined">summarize</span>
    Xuất báo cáo
</button>
```

### 5.2 Modal xuất dữ liệu

```html
<div class="modal" id="export-modal">
    <div class="modal__content">
        <div class="modal__header">
            <span class="material-symbols-outlined">download</span>
            <h3>Xuất dữ liệu chăn nuôi</h3>
        </div>

        <!-- Phạm vi -->
        <div class="form-group">
            <label>Phạm vi</label>
            <select id="export-scope">
                <option value="pen">Chuồng hiện tại</option>
                <option value="farm">Toàn trang trại</option>
            </select>
        </div>

        <!-- Khoảng thời gian -->
        <div class="form-group">
            <label>Từ ngày</label>
            <input type="date" id="export-from">
        </div>
        <div class="form-group">
            <label>Đến ngày</label>
            <input type="date" id="export-to">
        </div>

        <!-- Chọn nội dung -->
        <div class="form-group">
            <label>Nội dung xuất</label>
            <div class="export-checkboxes">
                <label>
                    <input type="checkbox" id="export-pens" checked>
                    <span class="material-symbols-outlined">fence</span>
                    Thông tin chuồng
                </label>
                <label>
                    <input type="checkbox" id="export-health" checked>
                    <span class="material-symbols-outlined">health_and_safety</span>
                    Sức khỏe & Thú y
                </label>
                <label>
                    <input type="checkbox" id="export-feeding" checked>
                    <span class="material-symbols-outlined">restaurant</span>
                    Lịch sử cho ăn
                </label>
                <label>
                    <input type="checkbox" id="export-financial" checked>
                    <span class="material-symbols-outlined">payments</span>
                    Tài chính
                </label>
                <label>
                    <input type="checkbox" id="export-growth">
                    <span class="material-symbols-outlined">trending_up</span>
                    Tăng trưởng
                </label>
            </div>
        </div>

        <!-- Actions -->
        <div class="modal__actions">
            <button onclick="closeExportModal()">Hủy</button>
            <button class="btn--primary" onclick="downloadExport()">
                <span class="material-symbols-outlined">download</span>
                Tải xuống Excel
            </button>
        </div>
    </div>
</div>
```

### 5.3 JavaScript Functions (thêm vào livestock.js)

```javascript
// ==================== DATA EXPORT ====================

function openExportModal(scope = 'pen') {
    document.getElementById('export-scope').value = scope;
    // Default date range: 30 days
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    document.getElementById('export-from').value = from.toISOString().split('T')[0];
    document.getElementById('export-to').value = to.toISOString().split('T')[0];
    document.getElementById('export-modal').classList.add('active');
}

function closeExportModal() {
    document.getElementById('export-modal').classList.remove('active');
}

async function downloadExport() {
    const scope = document.getElementById('export-scope').value;
    const from = document.getElementById('export-from').value;
    const to = document.getElementById('export-to').value;

    const payload = {
        farmId: currentFarmId,
        penId: scope === 'pen' ? selectedPen?.id : null,
        from: from,
        to: to,
        includePens: document.getElementById('export-pens').checked,
        includeHealth: document.getElementById('export-health').checked,
        includeFeeding: document.getElementById('export-feeding').checked,
        includeFinancial: document.getElementById('export-financial').checked,
        includeGrowth: document.getElementById('export-growth').checked
    };

    try {
        showNotification('Đang tạo báo cáo...', 'info');

        const token = getToken();
        const response = await fetch(`${API_BASE_URL}/export/livestock`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BaoCao_ChanNuoi_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        showNotification('Đã tải xuống báo cáo Excel!', 'success');
        closeExportModal();
    } catch (err) {
        console.error('Export error:', err);
        showNotification('Lỗi khi xuất dữ liệu', 'error');
    }
}
```

---

## 6. Excel Styling

### 6.1 Header Style
- **Font:** Bold, size 12, white color
- **Background:** `#388E3C` (green)
- **Border:** Thin, all sides
- **Alignment:** Center

### 6.2 Data Cells
- **Font:** Size 11
- **Border:** Thin, all sides
- **Date format:** `dd/MM/yyyy`
- **Currency format:** `#,##0` (Vietnamese đồng)
- **Alternating row color:** `#F5F5F5` for even rows

### 6.3 Summary Row
- **Font:** Bold, size 11
- **Background:** `#E8F5E9` (light green)
- **Formulas:** Use Excel SUM formulas for totals

### 6.4 Workbook metadata
```java
workbook.getProperties().getCoreProperties().setTitle("Báo cáo Chăn nuôi - AgriPlanner");
workbook.getProperties().getCoreProperties().setCreator("AgriPlanner System");
```

---

## 7. Quy trình triển khai

### Phase 1: Backend
1. **Thêm dependency** Apache POI vào `pom.xml`
2. **Tạo DTO** `ExportRequest`
3. **Tạo Service** `ExportService` — tạo Workbook với 5 sheets
4. **Tạo Controller** `ExportController` — endpoint POST `/api/export/livestock`
5. **Security:** Thêm rule cho `/api/export/**`

### Phase 2: Frontend
6. **Tạo Export Modal** HTML (render bởi JS)
7. **Thêm nút xuất** — pen detail + toolbar farm
8. **JavaScript** `downloadExport()` — POST → blob → download

### Phase 3: Polish
9. **Excel styles** — header colors, date/currency formats
10. **Test** — xuất tất cả loại báo cáo, kiểm tra file Excel mở đúng

---

## 8. Cân nhắc kỹ thuật

### 8.1 Performance
- Với trang trại lớn (>100 chuồng, >10,000 feeding logs), cần **pagination trên server** hoặc giới hạn date range.
- Xem xét **stream export** thay vì load all vào memory.

### 8.2 File size
- Excel file với 10,000 rows ~ 500KB–1MB.
- Set giới hạn: tối đa 50,000 rows hoặc 1 năm dữ liệu.

### 8.3 Alternative: CSV export (đơn giản hơn)
- Nếu muốn nhanh, có thể dùng `StringBuilder` tạo CSV thuần Java (không cần POI).
- Frontend dùng `Blob` type `text/csv`.
- Nhược điểm: không có multiple sheets, không format.

### 8.4 Alternative: Client-side export
- Dùng thư viện JS như **SheetJS (xlsx)** để tạo Excel trên client.
- Ưu điểm: Không cần backend endpoint, không cần dependency POI.
- Nhược điểm: Giới hạn dữ liệu (phải fetch tất cả trước), không thể xử lý dataset lớn.

### 8.5 Encoding
- File name và nội dung Unicode (Vietnamese) — Apache POI hỗ trợ sẵn.
- Content-Disposition header cần URL-encode filename cho browser compatibility.

---

## 9. Mẫu tên file xuất

```
BaoCao_ChanNuoi_15-01-2025.xlsx
BaoCao_ThuY_Chuong_A1_15-01-2025.xlsx
BaoCao_ChoAn_01-2025.xlsx
```

---

## 10. Tương lai (Mở rộng)

- **PDF export** — Dùng iText hoặc JasperReports cho báo cáo chính thức có logo, chữ ký.
- **Scheduled export** — Tự động gửi báo cáo hàng tuần/tháng qua email.
- **Import** — Cho phép import dữ liệu từ Excel (bulk create pens, health records).
- **QR Code** — Mỗi báo cáo có QR code link về trang chi tiết online.
