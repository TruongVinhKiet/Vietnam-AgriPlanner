# Lịch sử cho ăn — Đặc tả tính năng

> **Phiên bản:** 1.0  
> **Ngày:** 2025  
> **Mục tiêu:** Hiển thị lịch sử cho ăn chi tiết cho từng chuồng, bao gồm biểu đồ theo ngày/tuần, thống kê tiêu thụ thức ăn, và chi phí thức ăn tích lũy.

---

## 1. Tổng quan hệ thống hiện tại

### 1.1 Models đã có

- **`FeedingLog`** — Ghi nhận mỗi lần cho ăn:
  - `penId` — chuồng nào
  - `feedDefinitionId` → `FeedDefinition` (loại thức ăn)
  - `amountKg` — số lượng (kg)
  - `cost` — chi phí lần cho ăn
  - `fedAt` — thời điểm cho ăn
  - `notes` — ghi chú

- **`FeedDefinition`** — Master data loại thức ăn:
  - `name`, `category` (CONCENTRATE, ROUGHAGE, MIXED, AQUATIC, SPECIAL)
  - `pricePerUnit`, `unit`, `proteinPercent`

- **`AnimalFeedCompatibility`** — Mapping loại thức ăn phù hợp cho từng loài

- **`Pen`** — Có `lastFedAt`, `nextFeedingAt`, `feedingStatus` (PENDING/FED/OVERDUE)

### 1.2 API đã có

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/api/feeding/feed` | Ghi nhận cho ăn (trừ tồn kho + tạo FeedingLog) |
| `GET` | `/api/feeding/logs/{penId}` | Lấy danh sách FeedingLog theo chuồng |
| `GET` | `/api/feeding/status/{penId}` | Trạng thái cho ăn hiện tại |
| `GET` | `/api/feeding/calculate/{penId}` | Tính lượng thức ăn đề xuất |
| `GET` | `/api/feeding/growth/{penId}` | Lịch sử tăng trưởng (AnimalGrowth) |

### 1.3 Điểm thiếu

- **Không có UI xem lịch sử cho ăn** — `GET /api/feeding/logs/{penId}` trả data nhưng frontend chưa hiển thị danh sách.
- **Không có biểu đồ tiêu thụ thức ăn** — theo ngày/tuần/tháng.
- **Không có thống kê** — tổng kg đã dùng, tổng chi phí thức ăn, trung bình/ngày.
- **Không có lọc/tìm kiếm** — không lọc theo khoảng thời gian, loại thức ăn.

---

## 2. Yêu cầu chức năng

### 2.1 Tab "Lịch sử cho ăn" trong Pen Detail

Thêm section/tab mới trong `pen-detail-content`:

#### A. Thống kê nhanh (Summary Cards)

| Card | Dữ liệu | Tính toán |
|------|----------|-----------|
| Tổng lần cho ăn | Tổng FeedingLogs | `count(*)` |
| Tổng kg đã dùng | Tổng `amountKg` | `sum(amountKg)` |
| Tổng chi phí thức ăn | Tổng `cost` | `sum(cost)` |
| TB kg/ngày | Trung bình tiêu thụ/ngày | `sum(amountKg) / days_active` |
| Lần cho ăn gần nhất | Thời gian `lastFedAt` | Từ `Pen.lastFedAt` |

#### B. Biểu đồ tiêu thụ (Bar Chart)

- **Trục X:** Ngày (hoặc tuần nếu range > 30 ngày)
- **Trục Y:** Tổng kg cho ăn trong ngày/tuần đó
- **Stacked bar:** Mỗi loại thức ăn là một màu trong cùng cột
- **Filter:** 7 ngày / 30 ngày / 90 ngày / Tất cả

#### C. Biểu đồ chi phí thức ăn tích lũy (Line Chart)

- **Trục X:** Ngày
- **Trục Y:** Chi phí tích lũy (VND)
- Đường tham chiếu: Chi phí trung bình/ngày (đường nằm ngang dashed)

#### D. Danh sách chi tiết (Table/List)

| Cột | Dữ liệu |
|-----|----------|
| Thời gian | `fedAt` formatted |
| Loại thức ăn | `feedDefinition.name` |
| Số lượng | `amountKg` kg |
| Chi phí | `cost` VND |
| Ghi chú | `notes` |

- Sắp xếp: Mới nhất trước
- Phân trang: 10 mục/trang hoặc lazy load
- Tìm kiếm: theo tên thức ăn
- Lọc: theo khoảng ngày, theo loại thức ăn

---

## 3. Thiết kế Backend (Bổ sung API)

### 3.1 Endpoints mới

Thêm vào `FeedingController.java`:

| Method | Path | Mô tả |
|--------|------|--------|
| `GET` | `/api/feeding/logs/{penId}/summary` | Thống kê tổng hợp |
| `GET` | `/api/feeding/logs/{penId}/daily` | Nhóm theo ngày (chart data) |
| `GET` | `/api/feeding/logs/{penId}/by-feed` | Nhóm theo loại thức ăn |

### 3.2 Repository bổ sung

```java
// FeedingLogRepository.java
public interface FeedingLogRepository extends JpaRepository<FeedingLog, Long> {
    // Đã có
    List<FeedingLog> findByPenIdOrderByFedAtDesc(Long penId);

    // Bổ sung
    List<FeedingLog> findByPenIdAndFedAtBetweenOrderByFedAtDesc(
        Long penId, LocalDateTime from, LocalDateTime to);

    @Query("SELECT CAST(f.fedAt AS LocalDate) as day, SUM(f.amountKg) as totalKg, SUM(f.cost) as totalCost " +
           "FROM FeedingLog f WHERE f.penId = :penId " +
           "AND f.fedAt BETWEEN :from AND :to " +
           "GROUP BY CAST(f.fedAt AS LocalDate) ORDER BY day")
    List<Object[]> sumByDayForPen(@Param("penId") Long penId,
                                   @Param("from") LocalDateTime from,
                                   @Param("to") LocalDateTime to);

    @Query("SELECT f.feedDefinitionId, SUM(f.amountKg), SUM(f.cost), COUNT(f) " +
           "FROM FeedingLog f WHERE f.penId = :penId " +
           "GROUP BY f.feedDefinitionId")
    List<Object[]> sumByFeedType(@Param("penId") Long penId);
}
```

### 3.3 API Response Formats

**GET `/api/feeding/logs/{penId}/summary`**
```json
{
  "totalFeedings": 42,
  "totalAmountKg": 156.5,
  "totalCost": 3500000,
  "avgKgPerDay": 5.2,
  "avgCostPerDay": 116667,
  "lastFedAt": "2025-01-15T08:30:00",
  "firstFedAt": "2024-12-15T07:00:00",
  "daysActive": 30
}
```

**GET `/api/feeding/logs/{penId}/daily?from=2025-01-01&to=2025-01-31`**
```json
[
  {
    "date": "2025-01-15",
    "totalKg": 5.5,
    "totalCost": 125000,
    "feedDetails": [
      { "feedName": "Cám hỗn hợp", "amountKg": 3.0, "cost": 75000 },
      { "feedName": "Rau xanh", "amountKg": 2.5, "cost": 50000 }
    ]
  }
]
```

---

## 4. Thiết kế Frontend

### 4.1 HTML Section (trong livestock.js render)

```html
<!-- Lịch sử cho ăn -->
<div class="detail-section" id="feeding-history-section">
    <div class="detail-section__header">
        <span class="material-symbols-outlined">restaurant</span>
        <h3>Lịch sử cho ăn</h3>
        <div class="feeding-history__filters">
            <button class="filter-btn active" data-range="7">7 ngày</button>
            <button class="filter-btn" data-range="30">30 ngày</button>
            <button class="filter-btn" data-range="90">90 ngày</button>
            <button class="filter-btn" data-range="all">Tất cả</button>
        </div>
    </div>

    <!-- Summary cards -->
    <div class="feeding-summary-cards">
        <div class="feeding-stat-card">
            <span class="material-symbols-outlined">counter_1</span>
            <div>
                <small>Tổng lần cho ăn</small>
                <strong id="feed-total-count">0</strong>
            </div>
        </div>
        <div class="feeding-stat-card">
            <span class="material-symbols-outlined">scale</span>
            <div>
                <small>Tổng kg đã dùng</small>
                <strong id="feed-total-kg">0 kg</strong>
            </div>
        </div>
        <div class="feeding-stat-card">
            <span class="material-symbols-outlined">payments</span>
            <div>
                <small>Tổng chi phí</small>
                <strong id="feed-total-spent">0 ₫</strong>
            </div>
        </div>
        <div class="feeding-stat-card">
            <span class="material-symbols-outlined">avg_pace</span>
            <div>
                <small>TB kg/ngày</small>
                <strong id="feed-avg-daily">0 kg</strong>
            </div>
        </div>
    </div>

    <!-- Bar chart: Tiêu thụ theo ngày -->
    <div class="feeding-chart-container">
        <h4>Lượng thức ăn theo ngày</h4>
        <canvas id="feeding-daily-chart" height="250"></canvas>
    </div>

    <!-- Line chart: Chi phí tích lũy -->
    <div class="feeding-chart-container">
        <h4>Chi phí thức ăn tích lũy</h4>
        <canvas id="feeding-cost-chart" height="200"></canvas>
    </div>

    <!-- Feeding log table -->
    <div class="feeding-log-table">
        <h4>Chi tiết</h4>
        <table>
            <thead>
                <tr>
                    <th>Thời gian</th>
                    <th>Loại thức ăn</th>
                    <th>Số lượng</th>
                    <th>Chi phí</th>
                    <th>Ghi chú</th>
                </tr>
            </thead>
            <tbody id="feeding-log-tbody">
                <!-- Rendered by JS -->
            </tbody>
        </table>
        <div class="feeding-log-pagination" id="feeding-log-pagination"></div>
    </div>
</div>
```

### 4.2 JavaScript Functions (thêm vào livestock.js)

```javascript
// ==================== FEEDING HISTORY ====================

let feedingHistoryData = [];
let feedingHistoryRange = 30; // default 30 days

// Load feeding history for a pen
async function loadFeedingHistory(penId, rangeDays = 30) { ... }

// Render summary stats
function renderFeedingSummary(summary) { ... }

// Render stacked bar chart (daily consumption by feed type)
function renderFeedingDailyChart(dailyData) {
    // Use Chart.js stacked bar
    // Colors by feed category: CONCENTRATE=#4CAF50, ROUGHAGE=#8BC34A, etc.
}

// Render cumulative cost line chart
function renderFeedingCostChart(dailyData) {
    // Line chart with running total
}

// Render feeding log table with pagination
function renderFeedingLogTable(logs, page = 1, perPage = 10) { ... }

// Filter range buttons handler
function setFeedingRange(days) {
    feedingHistoryRange = days;
    loadFeedingHistory(selectedPen.id, days);
}
```

### 4.3 Color Mapping cho loại thức ăn

| Category | Color | Label |
|----------|-------|-------|
| `CONCENTRATE` | `#4CAF50` | Cám/Thức ăn hỗn hợp |
| `ROUGHAGE` | `#8BC34A` | Rau xanh/Cỏ |
| `MIXED` | `#FF9800` | Hỗn hợp |
| `AQUATIC` | `#2196F3` | Thức ăn thủy sản |
| `SPECIAL` | `#9C27B0` | Đặc biệt |

---

## 5. Tích hợp

### 5.1 Vào `updatePenDetails(pen)`

Thêm gọi `loadFeedingHistory(pen.id)` sau khi load mortality stats:

```javascript
// Trong updatePenDetails(pen):
loadMortalityStats(pen.id);
loadFeedingHistory(pen.id, feedingHistoryRange); // MỚI
```

### 5.2 Sau khi cho ăn thành công

Trong handler `POST /api/feeding/feed` success callback, reload feeding history:

```javascript
// Sau showNotification('Đã ghi nhận cho ăn thành công!')
if (document.getElementById('feeding-history-section')) {
    loadFeedingHistory(currentFeedingPenId, feedingHistoryRange);
}
```

### 5.3 Chart.js

Đã có sẵn trong project (dùng cho growth chart, byproduct chart). Không cần thêm dependency.

---

## 6. Quy trình triển khai

1. **Backend:** Thêm repository queries → controller endpoints (summary, daily, by-feed)
2. **Frontend:** Tạo HTML section (render bởi JS) → gắn vào `updatePenDetails()`
3. **Charts:** Bar chart (tiêu thụ/ngày) + Line chart (chi phí tích lũy)
4. **Table/List:** Danh sách chi tiết với phân trang
5. **Filter:** Nút chọn range (7/30/90/all)
6. **Auto-refresh:** Reload after feeding

---

## 7. Lưu ý kỹ thuật

- **Performance:** API `logs/{penId}` hiện trả TẤT CẢ logs. Cần thêm date range filter (`?from=&to=`) để tránh load quá nhiều data cho chuồng hoạt động lâu.
- **FeedDefinition eager join:** `FeedingLog` đã có `@ManyToOne(fetch = FetchType.EAGER)` tới `FeedDefinition`, nên tên thức ăn sẽ được trả về cùng log.
- **Timezone:** `fedAt` là `LocalDateTime`, cần xử lý timezone đúng khi filter by date.
- **Chart reuse:** Nhớ `destroy()` chart instance cũ trước khi tạo mới (tránh memory leak Chart.js).
