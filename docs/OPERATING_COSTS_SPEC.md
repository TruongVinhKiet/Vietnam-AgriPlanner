# Chi phí vận hành chuồng trại — Đặc tả tính năng

> **Phiên bản:** 1.0  
> **Ngày:** 2025  
> **Mục tiêu:** Theo dõi chi phí vận hành hàng ngày/hàng tháng cho từng chuồng (điện, nước, thuốc, nhân công, v.v.), hiển thị báo cáo tổng hợp và biểu đồ phân tích.

---

## 1. Tổng quan

Hiện tại hệ thống đã có:
- **`AssetTransaction`** — ghi nhận INCOME/EXPENSE với category (TOPUP, HARVEST, SEED, FERTILIZER, PESTICIDE, MACHINERY, LIVESTOCK). Tuy nhiên chỉ dùng cho trồng trọt và giao dịch thu hoạch chăn nuôi.
- **`FeedingLog`** — ghi nhận chi phí thức ăn per lần cho ăn (có trường `cost`).
- **`Pen.totalInvestment`** — tổng vốn đầu tư ban đầu.

**Thiếu:** Không có cơ chế ghi nhận chi phí vận hành định kỳ (điện, nước, nhân công, thuốc thú y, vệ sinh, bảo trì thiết bị) cho từng chuồng.

---

## 2. Yêu cầu chức năng

### 2.1 Thêm chi phí vận hành

- Chủ trang trại có thể thêm **khoản chi phí** cho một chuồng cụ thể.
- Mỗi khoản chi phí gồm:
  - **Loại chi phí** (category): `ELECTRICITY` (Điện), `WATER` (Nước), `MEDICINE` (Thuốc thú y), `LABOR` (Nhân công), `CLEANING` (Vệ sinh), `EQUIPMENT` (Thiết bị/Bảo trì), `OTHER` (Khác)
  - **Số tiền** (amount): BigDecimal, đơn vị VND
  - **Ngày ghi nhận** (recordedDate): LocalDate
  - **Ghi chú** (notes): Text tùy chọn
  - **Hóa đơn/Ảnh** (receiptUrl): URL ảnh chụp hóa đơn (tùy chọn)

### 2.2 Xem chi phí

- Trong trang **chi tiết chuồng** (`pen-detail-content`), thêm section mới **"Chi phí vận hành"**.
- Hiển thị:
  - **Tổng chi phí tháng này** (tất cả category cộng lại)
  - **Biểu đồ tròn (Pie/Doughnut)** phân bổ theo loại chi phí
  - **Biểu đồ đường (Line)** chi phí theo thời gian (7 ngày / 30 ngày / 90 ngày)
  - **Danh sách chi phí gần đây** (5 mục gần nhất, có nút "Xem tất cả")

### 2.3 Báo cáo tổng hợp

- Tại trang **phân tích tài chính** (`analytics.html` / `financial-analysis.js`):
  - Thêm tab/section **"Chi phí chăn nuôi"**
  - Tổng hợp chi phí tất cả chuồng theo tháng
  - So sánh chi phí vs doanh thu (từ `AssetTransaction` INCOME)
  - ROI (Return on Investment) = (Doanh thu - Tổng chi phí) / Tổng đầu tư × 100

---

## 3. Thiết kế Backend

### 3.1 Model: `OperatingCost`

```java
@Entity
@Table(name = "operating_costs")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class OperatingCost {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "pen_id", nullable = false)
    private Long penId;

    @Column(name = "farm_id", nullable = false)
    private Long farmId;

    // ELECTRICITY, WATER, MEDICINE, LABOR, CLEANING, EQUIPMENT, OTHER
    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private BigDecimal amount;

    @Column(name = "recorded_date", nullable = false)
    private LocalDate recordedDate;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "receipt_url", length = 500)
    private String receiptUrl;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
```

### 3.2 Repository: `OperatingCostRepository`

```java
public interface OperatingCostRepository extends JpaRepository<OperatingCost, Long> {
    List<OperatingCost> findByPenIdOrderByRecordedDateDesc(Long penId);
    List<OperatingCost> findByFarmIdOrderByRecordedDateDesc(Long farmId);
    List<OperatingCost> findByPenIdAndRecordedDateBetween(Long penId, LocalDate from, LocalDate to);
    List<OperatingCost> findByFarmIdAndRecordedDateBetween(Long farmId, LocalDate from, LocalDate to);

    @Query("SELECT o.category, SUM(o.amount) FROM OperatingCost o " +
           "WHERE o.penId = :penId AND o.recordedDate BETWEEN :from AND :to " +
           "GROUP BY o.category")
    List<Object[]> sumByCategoryForPen(@Param("penId") Long penId,
                                       @Param("from") LocalDate from,
                                       @Param("to") LocalDate to);
}
```

### 3.3 Controller: `OperatingCostController`

Base path: `/api/livestock/pens/{penId}/costs`

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/api/livestock/pens/{penId}/costs` | Thêm chi phí mới |
| `GET` | `/api/livestock/pens/{penId}/costs` | Danh sách chi phí (có filter date range) |
| `GET` | `/api/livestock/pens/{penId}/costs/summary` | Tổng hợp theo category (pie chart data) |
| `DELETE` | `/api/livestock/costs/{id}` | Xóa khoản chi phí |
| `GET` | `/api/livestock/farm/{farmId}/costs/summary` | Tổng hợp chi phí toàn trang trại |

### 3.4 Flyway Migration

```sql
-- V26__create_operating_costs_table.sql
CREATE TABLE IF NOT EXISTS operating_costs (
    id BIGSERIAL PRIMARY KEY,
    pen_id BIGINT NOT NULL REFERENCES pens(id) ON DELETE CASCADE,
    farm_id BIGINT NOT NULL,
    category VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    recorded_date DATE NOT NULL,
    notes TEXT,
    receipt_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_operating_costs_pen_id ON operating_costs(pen_id);
CREATE INDEX idx_operating_costs_farm_id ON operating_costs(farm_id);
CREATE INDEX idx_operating_costs_date ON operating_costs(recorded_date);
```

---

## 4. Thiết kế Frontend

### 4.1 UI trong Pen Detail (livestock.js)

Thêm section mới vào `pen-detail-content` (sau section "Biểu đồ tăng trưởng"):

```html
<!-- Chi phí vận hành -->
<div class="detail-section" id="operating-cost-section">
    <div class="detail-section__header">
        <span class="material-symbols-outlined">payments</span>
        <h3>Chi phí vận hành</h3>
        <button class="btn btn--sm btn--primary" onclick="openAddCostModal()">
            <span class="material-symbols-outlined">add</span> Thêm chi phí
        </button>
    </div>

    <!-- Tổng chi phí tháng -->
    <div class="cost-summary-cards">
        <div class="cost-card cost-card--total">
            <span>Tháng này</span>
            <strong id="cost-month-total">0 ₫</strong>
        </div>
        <div class="cost-card">
            <span>Điện</span>
            <strong id="cost-electricity">0 ₫</strong>
        </div>
        <div class="cost-card">
            <span>Nước</span>
            <strong id="cost-water">0 ₫</strong>
        </div>
        <div class="cost-card">
            <span>Thuốc</span>
            <strong id="cost-medicine">0 ₫</strong>
        </div>
    </div>

    <!-- Biểu đồ tròn -->
    <div class="cost-chart-container">
        <canvas id="cost-pie-chart" height="200"></canvas>
    </div>

    <!-- Danh sách gần đây -->
    <div class="cost-recent-list" id="cost-recent-list">
        <!-- Rendered by JS -->
    </div>
</div>
```

### 4.2 Modal thêm chi phí

```html
<div class="modal" id="add-cost-modal">
    <div class="modal__content">
        <h3>Thêm chi phí vận hành</h3>
        <div class="form-group">
            <label>Loại chi phí</label>
            <select id="cost-category">
                <option value="ELECTRICITY">⚡ Điện</option>
                <option value="WATER">💧 Nước</option>
                <option value="MEDICINE">💊 Thuốc thú y</option>
                <option value="LABOR">👷 Nhân công</option>
                <option value="CLEANING">🧹 Vệ sinh</option>
                <option value="EQUIPMENT">🔧 Thiết bị/Bảo trì</option>
                <option value="OTHER">📦 Khác</option>
            </select>
        </div>
        <div class="form-group">
            <label>Số tiền (VND)</label>
            <input type="number" id="cost-amount" min="0" step="1000">
        </div>
        <div class="form-group">
            <label>Ngày</label>
            <input type="date" id="cost-date" value="today">
        </div>
        <div class="form-group">
            <label>Ghi chú</label>
            <textarea id="cost-notes" rows="2"></textarea>
        </div>
        <div class="modal__actions">
            <button onclick="closeCostModal()">Hủy</button>
            <button class="btn--primary" onclick="submitCost()">Lưu</button>
        </div>
    </div>
</div>
```

### 4.3 JavaScript Functions (thêm vào livestock.js)

```javascript
// Load operating costs for pen
async function loadOperatingCosts(penId) { ... }

// Render cost summary cards
function renderCostSummary(costs) { ... }

// Render pie chart using Chart.js
function renderCostPieChart(categorySummary) { ... }

// Open/close add cost modal
function openAddCostModal() { ... }
function closeCostModal() { ... }

// Submit new cost
async function submitCost() { ... }
```

---

## 5. Mapping loại chi phí → Vietnamese Labels

| Key | Label | Icon |
|-----|-------|------|
| `ELECTRICITY` | Điện | ⚡ `bolt` |
| `WATER` | Nước | 💧 `water_drop` |
| `MEDICINE` | Thuốc thú y | 💊 `medication` |
| `LABOR` | Nhân công | 👷 `engineering` |
| `CLEANING` | Vệ sinh | 🧹 `cleaning_services` |
| `EQUIPMENT` | Thiết bị/Bảo trì | 🔧 `build` |
| `OTHER` | Khác | 📦 `category` |

---

## 6. Tích hợp với hệ thống hiện tại

### 6.1 AssetTransaction

Khi thêm chi phí vận hành, **đồng thời** tạo `AssetTransaction` với:
- `transactionType = "EXPENSE"`
- `category = "LIVESTOCK_OPERATING"`
- `amount = cost amount`
- `description = "Chi phí {category_label} - Chuồng {pen.code}"`

Điều này giúp chi phí vận hành xuất hiện trong báo cáo tài chính tổng hợp.

### 6.2 Pen Detail Refresh

Tích hợp vào `updatePenDetails(pen)` — gọi `loadOperatingCosts(pen.id)` khi hiển thị chi tiết chuồng.

### 6.3 Tự động refresh

Khi timer 30s refresh pen data, cũng refresh chi phí nếu section đang hiển thị.

---

## 7. Quy trình triển khai

1. **Backend:** Tạo model `OperatingCost` → repository → controller
2. **Migration:** V26 tạo bảng `operating_costs`
3. **Security:** Thêm `/api/livestock/pens/*/costs/**` vào `SecurityConfig` (permitAll hoặc OWNER)
4. **Frontend:** Thêm section vào `pen-detail-content` HTML trong `livestock.js`
5. **Charts:** Dùng Chart.js (đã có) vẽ pie chart + line chart
6. **Test:** Thêm chi phí → kiểm tra hiển thị → kiểm tra tổng hợp
