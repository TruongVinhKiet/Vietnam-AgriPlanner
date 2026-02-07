"""
Scraper: Cào dữ liệu thửa đất Huyện Thới Bình từ ilis.camau.gov.vn
======================================================================
Sử dụng WFS (Web Feature Service) từ GeoServer của VNPT iLIS SDK
để tải dữ liệu 129,000+ thửa đất của Huyện Thới Bình, Cà Mau.

Tính năng:
- Tải dữ liệu theo batch (1000 features/batch) để tránh timeout
- Lưu vào PostgreSQL (bảng land_parcels)
- Tính tọa độ tâm từ geometry
- Map mã loại đất sang tên tiếng Việt
- Resume từ batch cuối nếu bị gián đoạn
- Hiển thị progress bar

Sử dụng:
    python scrape_land_parcels.py
"""

import json
import sys
import time
import math
import urllib.request
import urllib.error
import psycopg2
import psycopg2.extras
from datetime import datetime

# ============= CẤU HÌNH =============
WFS_BASE_URL = "https://ilis-sdk.vnpt.vn/map/geoserver/iLIS_CMU/wfs"
LAYER_NAME = "iLIS_CMU:cmu_thuadat_huyenthoibinh"
BATCH_SIZE = 1000  # Số features mỗi lần request
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "AgriPlanner",
    "user": "postgres",
    "password": "Kiet2004"
}

DISTRICT = "Thới Bình"
PROVINCE = "Cà Mau"

# Thời Bình bounding box (approximate)
THOI_BINH_BBOX = {
    "sw_lat": 9.18,
    "sw_lng": 104.95,
    "ne_lat": 9.48,
    "ne_lng": 105.32
}

# Bảng mã loại đất → tên tiếng Việt (theo Luật Đất đai)
LAND_USE_MAP = {
    "LUC": "Đất chuyên trồng lúa nước",
    "LUK": "Đất trồng lúa nước còn lại",
    "LUN": "Đất lúa nương",
    "CHN": "Đất trồng cây hàng năm khác",
    "BHK": "Đất bằng trồng cây hàng năm khác",
    "HNK": "Đất nương rẫy",
    "CLN": "Đất trồng cây lâu năm",
    "RSX": "Đất rừng sản xuất",
    "RPH": "Đất rừng phòng hộ",
    "RDD": "Đất rừng đặc dụng",
    "NTS": "Đất nuôi trồng thủy sản",
    "LMU": "Đất làm muối",
    "NKH": "Đất nông nghiệp khác",
    "ONT": "Đất ở nông thôn",
    "ODT": "Đất ở đô thị",
    "TSC": "Đất trụ sở cơ quan",
    "DGD": "Đất cơ sở giáo dục đào tạo",
    "DYT": "Đất cơ sở y tế",
    "DVH": "Đất cơ sở văn hóa",
    "DTT": "Đất cơ sở thể dục thể thao",
    "DGT": "Đất giao thông",
    "DTL": "Đất thủy lợi",
    "DNL": "Đất công trình năng lượng",
    "DBV": "Đất công trình bưu chính viễn thông",
    "SKC": "Đất cụm khu công nghiệp",
    "SKK": "Đất khu kinh tế",
    "SKT": "Đất khu công nghệ cao",
    "TMD": "Đất thương mại dịch vụ",
    "NTD": "Đất cơ sở nghĩa trang, nhà tang lễ",
    "SON": "Đất mặt nước sông ngòi, kênh rạch, suối",
    "MNC": "Đất mặt nước chuyên dùng",
    "PNK": "Đất phi nông nghiệp khác",
    "BCS": "Đất bằng chưa sử dụng",
    "DCS": "Đất đồi chưa sử dụng",
    "NCS": "Núi đá không có rừng cây",
    "CSD": "Đất chưa sử dụng",
    # Mã kết hợp phổ biến
    "ONT+CLN": "Đất ở + Cây lâu năm",
    "CLN+LUK": "Đất cây lâu năm + Lúa",
    "NTS+CLN": "Đất thủy sản + Cây lâu năm",
    "LUK+CLN": "Đất lúa + Cây lâu năm",
    "ONT+LUK": "Đất ở + Lúa",
    "CLN+NTS": "Đất cây lâu năm + Thủy sản",
    "LUK+NTS": "Đất lúa + Thủy sản",
    "NTS+LUK": "Đất thủy sản + Lúa",
}


def lookup_land_use_name(code):
    """Tra cứu tên loại đất từ mã, hỗ trợ mã kết hợp"""
    if not code:
        return None
    code = code.strip()
    if code in LAND_USE_MAP:
        return LAND_USE_MAP[code]
    # Thử tách mã kết hợp
    parts = code.replace("+", ",").replace("/", ",").split(",")
    names = []
    for p in parts:
        p = p.strip()
        if p in LAND_USE_MAP:
            names.append(LAND_USE_MAP[p])
        else:
            names.append(p)
    return " + ".join(names) if names else code


def calculate_centroid(geometry):
    """Tính tọa độ tâm từ GeoJSON geometry"""
    if not geometry or not geometry.get("coordinates"):
        return None, None

    all_coords = []
    coords = geometry["coordinates"]
    geo_type = geometry.get("type", "")

    def extract_coords(c):
        if not c:
            return
        if isinstance(c[0], (int, float)):
            all_coords.append(c)
        else:
            for item in c:
                extract_coords(item)

    extract_coords(coords)

    if not all_coords:
        return None, None

    lngs = [c[0] for c in all_coords]
    lats = [c[1] for c in all_coords]
    return round(sum(lats) / len(lats), 7), round(sum(lngs) / len(lngs), 7)


def get_total_features():
    """Lấy tổng số features từ WFS"""
    url = (
        f"{WFS_BASE_URL}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature"
        f"&typeName={LAYER_NAME}&resultType=hits"
    )
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url)
            r = urllib.request.urlopen(req, timeout=30)
            data = r.read().decode("utf-8")
            # Parse numberOfFeatures from XML
            import re
            match = re.search(r'numberOfFeatures="(\d+)"', data)
            if match:
                return int(match.group(1))
        except Exception as e:
            print(f"  Retry {attempt + 1}/{MAX_RETRIES}: {e}")
            time.sleep(RETRY_DELAY)
    return 0


def fetch_batch(start_index, count):
    """Tải 1 batch features từ WFS sử dụng CQL_FILTER pagination trên objectid"""
    # NOTE: This GeoServer does NOT support WFS startIndex
    # We use CQL_FILTER objectid>last_id + sortBy=objectid for pagination
    raise NotImplementedError("Use fetch_by_objectid or fetch_by_bbox instead")


def fetch_by_objectid(last_objectid, count):
    """Tải batch tiếp theo dựa trên objectid > last_objectid"""
    import urllib.parse
    cql = f"objectid>{last_objectid}"
    url = (
        f"{WFS_BASE_URL}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature"
        f"&typeName={LAYER_NAME}"
        f"&outputFormat=application/json"
        f"&srsName=EPSG:4326"
        f"&maxFeatures={count}"
        f"&sortBy=objectid"
        f"&CQL_FILTER={urllib.parse.quote(cql)}"
    )
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url)
            req.add_header("Accept", "application/json")
            r = urllib.request.urlopen(req, timeout=120)
            raw = r.read()
            if not raw or raw[0:1] == b'<':
                # Got XML error instead of JSON
                time.sleep(RETRY_DELAY)
                continue
            data = json.loads(raw.decode("utf-8"))
            return data.get("features", [])
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))
    return []


def fetch_by_bbox(bbox, max_features=5000):
    """Tải features trong 1 bounding box (cho records có objectid=0)"""
    import urllib.parse
    # bbox format: minx,miny,maxx,maxy (lng,lat)
    bbox_str = f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
    cql = "objectid=0"
    url = (
        f"{WFS_BASE_URL}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature"
        f"&typeName={LAYER_NAME}"
        f"&outputFormat=application/json"
        f"&srsName=EPSG:4326"
        f"&maxFeatures={max_features}"
        f"&BBOX={bbox_str},EPSG:4326"
        f"&CQL_FILTER={urllib.parse.quote(cql)}"
    )
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url)
            req.add_header("Accept", "application/json")
            r = urllib.request.urlopen(req, timeout=120)
            raw = r.read()
            if not raw or raw[0:1] == b'<':
                time.sleep(RETRY_DELAY)
                continue
            data = json.loads(raw.decode("utf-8"))
            return data.get("features", [])
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))
    return []


def init_database(conn):
    """Tạo bảng nếu chưa có"""
    with open(
        "e:/Agriplanner/database/migrations/V41__land_parcels.sql", "r", encoding="utf-8"
    ) as f:
        sql = f.read()

    cur = conn.cursor()
    cur.execute(sql)
    conn.commit()
    cur.close()
    print("✓ Database table ready")


def get_existing_count(conn):
    """Đếm số records đã có trong DB"""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM land_parcels WHERE district = %s", (DISTRICT,))
    count = cur.fetchone()[0]
    cur.close()
    return count


def insert_parcels(conn, features):
    """Insert batch of features vào DB"""
    if not features:
        return 0

    insert_sql = """
        INSERT INTO land_parcels (
            object_id, parcel_id, map_sheet_id,
            map_sheet_number, parcel_number,
            area_sqm, legal_area_sqm,
            land_use_code, land_use_name,
            address, street_name, road, road_section, location,
            admin_unit_code, admin_unit_name, district, province,
            registration_status, change_status, spatial_status,
            area_zone, province_code,
            area_road, area_land, area_river, area_railway,
            boundary_geojson, center_lat, center_lng,
            notes
        ) VALUES (
            %(object_id)s, %(parcel_id)s, %(map_sheet_id)s,
            %(map_sheet_number)s, %(parcel_number)s,
            %(area_sqm)s, %(legal_area_sqm)s,
            %(land_use_code)s, %(land_use_name)s,
            %(address)s, %(street_name)s, %(road)s, %(road_section)s, %(location)s,
            %(admin_unit_code)s, %(admin_unit_name)s, %(district)s, %(province)s,
            %(registration_status)s, %(change_status)s, %(spatial_status)s,
            %(area_zone)s, %(province_code)s,
            %(area_road)s, %(area_land)s, %(area_river)s, %(area_railway)s,
            %(boundary_geojson)s, %(center_lat)s, %(center_lng)s,
            %(notes)s
        )
        ON CONFLICT (parcel_id) WHERE parcel_id IS NOT NULL DO NOTHING
    """

    rows = []
    for f in features:
        props = f.get("properties", {})
        geom = f.get("geometry")

        center_lat, center_lng = calculate_centroid(geom)
        land_code = props.get("loaidat")

        row = {
            "object_id": props.get("objectid"),
            "parcel_id": props.get("idthuadat"),
            "map_sheet_id": props.get("idtobando"),
            "map_sheet_number": props.get("tobandoso"),
            "parcel_number": props.get("sothututhua"),
            "area_sqm": props.get("dientich"),
            "legal_area_sqm": props.get("dientichpl"),
            "land_use_code": land_code,
            "land_use_name": lookup_land_use_name(land_code),
            "address": props.get("diachithua"),
            "street_name": props.get("tenduong"),
            "road": props.get("duong"),
            "road_section": props.get("doanduong"),
            "location": props.get("vitri"),
            "admin_unit_code": props.get("madvhc"),
            "admin_unit_name": props.get("tendvhc"),
            "district": DISTRICT,
            "province": PROVINCE,
            "registration_status": props.get("trangthaidangky"),
            "change_status": props.get("trangthaibiendong"),
            "spatial_status": props.get("trangthaikhonggian"),
            "area_zone": props.get("khuvuc"),
            "province_code": props.get("parmatinh"),
            "area_road": props.get("dientichhlgt"),
            "area_land": props.get("dientichhlld"),
            "area_river": props.get("dientichhlsongsuoi"),
            "area_railway": props.get("dientichhlduongsat"),
            "boundary_geojson": json.dumps(geom) if geom else None,
            "center_lat": center_lat,
            "center_lng": center_lng,
            "notes": props.get("ghichu"),
        }
        rows.append(row)

    cur = conn.cursor()
    inserted = 0
    for row in rows:
        try:
            cur.execute("SAVEPOINT sp1")
            cur.execute(insert_sql, row)
            if cur.rowcount > 0:
                inserted += 1
            cur.execute("RELEASE SAVEPOINT sp1")
        except Exception as e:
            cur.execute("ROLLBACK TO SAVEPOINT sp1")
            # Skip individual errors silently
            continue
    conn.commit()
    cur.close()
    return inserted


def print_progress(current, total, start_time, inserted_total):
    """Hiển thị progress bar đẹp"""
    pct = current / total * 100 if total > 0 else 0
    bar_len = 40
    filled = int(bar_len * current / total) if total > 0 else 0
    bar = "█" * filled + "░" * (bar_len - filled)

    elapsed = time.time() - start_time
    if current > 0:
        eta = elapsed / current * (total - current)
        eta_str = f"{int(eta // 60)}m{int(eta % 60)}s"
    else:
        eta_str = "..."

    sys.stdout.write(
        f"\r  [{bar}] {pct:5.1f}% | {current:,}/{total:,} | "
        f"Inserted: {inserted_total:,} | ETA: {eta_str}  "
    )
    sys.stdout.flush()


def main():
    print("=" * 65)
    print("  🗺️  Scraper: Thửa đất Huyện Thới Bình, Cà Mau")
    print("  📡 Nguồn: ilis.camau.gov.vn (WFS GeoServer)")
    print("=" * 65)
    print()

    # Step 1: Count total features
    print("📊 Đang đếm tổng số thửa đất...")
    total = get_total_features()
    if total == 0:
        print("❌ Không thể lấy tổng số features. Kiểm tra kết nối mạng.")
        return
    print(f"   Tổng cộng: {total:,} thửa đất")
    print()

    # Step 2: Connect to DB
    print("🔗 Kết nối cơ sở dữ liệu...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.set_client_encoding("UTF8")
        print(f"   ✓ Đã kết nối PostgreSQL ({DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['dbname']})")
    except Exception as e:
        print(f"   ❌ Lỗi kết nối DB: {e}")
        return

    # Step 3: Init table
    print("📋 Khởi tạo bảng land_parcels...")
    init_database(conn)

    # Step 4: Check existing data (for resume)
    existing = get_existing_count(conn)
    if existing > 0:
        print(f"   ℹ️  Đã có {existing:,} records trong DB")
        if existing >= total * 0.95:
            print("   ✓ Dữ liệu gần đầy đủ.")

    # Step 5: Phase 1 - Scrape features with objectid > 0
    print()
    print(f"⬇️  Phase 1: Tải thửa đất có objectid > 0...")

    # Find the last objectid we've already stored (for resume)
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(MAX(object_id), 0) FROM land_parcels WHERE object_id > 0 AND district = %s", (DISTRICT,))
    resume_objectid = cur.fetchone()[0]
    cur.close()

    if resume_objectid > 0:
        print(f"   ℹ️  Resuming from objectid > {resume_objectid}")

    inserted_total = 0
    fetched_total = 0
    start_time = time.time()
    last_objectid = resume_objectid
    empty_batches = 0

    while True:
        features = fetch_by_objectid(last_objectid, BATCH_SIZE)
        if not features:
            empty_batches += 1
            if empty_batches >= 3:
                break
            time.sleep(2)
            continue

        empty_batches = 0
        fetched_total += len(features)
        inserted = insert_parcels(conn, features)
        inserted_total += inserted

        # Update last_objectid for next batch
        max_oid = max(f["properties"].get("objectid", 0) for f in features)
        last_objectid = max_oid

        print_progress(fetched_total, total, start_time, inserted_total)

        if len(features) < BATCH_SIZE:
            break  # Last batch

        time.sleep(0.3)  # Rate limiting

    print()
    print(f"   ✓ Phase 1 hoàn tất: {fetched_total:,} features, {inserted_total:,} inserted")

    # Step 6: Phase 2 - Scrape features with objectid = 0 using BBOX grid
    print()
    print(f"⬇️  Phase 2: Tải thửa đất có objectid = 0 (dùng BBOX grid)...")

    bbox = THOI_BINH_BBOX
    lat_range = bbox["ne_lat"] - bbox["sw_lat"]
    lng_range = bbox["ne_lng"] - bbox["sw_lng"]

    # Split into grid cells (6x6 = 36 cells)
    grid_rows = 6
    grid_cols = 6
    lat_step = lat_range / grid_rows
    lng_step = lng_range / grid_cols

    phase2_fetched = 0
    phase2_inserted = 0
    seen_uuids = set()  # Prevent cross-cell duplicates

    for row in range(grid_rows):
        for col in range(grid_cols):
            cell_sw_lng = bbox["sw_lng"] + col * lng_step
            cell_sw_lat = bbox["sw_lat"] + row * lat_step
            cell_ne_lng = cell_sw_lng + lng_step
            cell_ne_lat = cell_sw_lat + lat_step

            cell_bbox = (cell_sw_lng, cell_sw_lat, cell_ne_lng, cell_ne_lat)
            features = fetch_by_bbox(cell_bbox, max_features=5000)

            if features:
                # Deduplicate by parcel_id (idthuadat)
                unique_features = []
                for f in features:
                    uuid = f["properties"].get("idthuadat", "")
                    if uuid and uuid not in seen_uuids:
                        seen_uuids.add(uuid)
                        unique_features.append(f)

                if unique_features:
                    phase2_fetched += len(unique_features)
                    ins = insert_parcels(conn, unique_features)
                    phase2_inserted += ins

            cell_idx = row * grid_cols + col + 1
            total_cells = grid_rows * grid_cols
            sys.stdout.write(f"\r   Grid cell {cell_idx}/{total_cells} | Phase 2: {phase2_fetched:,} fetched, {phase2_inserted:,} inserted  ")
            sys.stdout.flush()
            time.sleep(0.3)

    print()
    print(f"   ✓ Phase 2 hoàn tất: {phase2_fetched:,} features, {phase2_inserted:,} inserted")

    # Final summary
    elapsed = time.time() - start_time
    total_fetched = fetched_total + phase2_fetched
    total_inserted = inserted_total + phase2_inserted
    print()
    print("=" * 65)
    print(f"  ✅ HOÀN TẤT!")
    print(f"  📥 Đã tải:   {total_fetched:,} thửa đất")
    print(f"  💾 Đã lưu:   {total_inserted:,} records mới")
    print(f"  ⏱️  Thời gian: {int(elapsed // 60)} phút {int(elapsed % 60)} giây")
    print("=" * 65)

    # Step 6: Summary statistics
    print()
    print("📊 Thống kê theo loại đất:")
    cur = conn.cursor()
    cur.execute("""
        SELECT land_use_code, land_use_name, COUNT(*) as cnt,
               ROUND(SUM(area_sqm)::numeric, 0) as total_area
        FROM land_parcels
        WHERE district = %s
        GROUP BY land_use_code, land_use_name
        ORDER BY cnt DESC
        LIMIT 15
    """, (DISTRICT,))
    rows = cur.fetchall()
    print(f"   {'Mã':<12} {'Tên':<35} {'Số thửa':>8} {'DT (m²)':>15}")
    print(f"   {'-'*12} {'-'*35} {'-'*8} {'-'*15}")
    for code, name, cnt, area in rows:
        name_display = (name or code or "?")[:35]
        area_str = f"{area:,.0f}" if area else "N/A"
        print(f"   {(code or '?'):<12} {name_display:<35} {cnt:>8,} {area_str:>15}")
    cur.close()

    print()
    print("📊 Thống kê theo xã:")
    cur = conn.cursor()
    cur.execute("""
        SELECT admin_unit_name, COUNT(*) as cnt,
               ROUND(SUM(area_sqm)::numeric / 10000, 2) as total_ha
        FROM land_parcels
        WHERE district = %s
        GROUP BY admin_unit_name
        ORDER BY cnt DESC
    """, (DISTRICT,))
    rows = cur.fetchall()
    print(f"   {'Xã/Phường':<30} {'Số thửa':>8} {'DT (ha)':>12}")
    print(f"   {'-'*30} {'-'*8} {'-'*12}")
    for name, cnt, ha in rows:
        ha_str = f"{ha:,.2f}" if ha else "N/A"
        print(f"   {(name or '?'):<30} {cnt:>8,} {ha_str:>12}")
    cur.close()

    conn.close()


if __name__ == "__main__":
    main()
