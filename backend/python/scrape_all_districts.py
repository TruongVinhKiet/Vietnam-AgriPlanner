"""
Scraper: Cào dữ liệu thửa đất TOÀN BỘ Cà Mau từ ilis.camau.gov.vn
=====================================================================
Mở rộng từ scrape_land_parcels.py để cào tất cả 9 huyện/thành phố.
Sử dụng WFS (Web Feature Service) từ GeoServer của VNPT iLIS SDK.

Huyện/Thành phố Cà Mau (có trên GeoServer):
1. Thới Bình (đã cào ~129,000 thửa)
2. Cái Nước
3. Đầm Dơi
4. Phú Tân
5. Trần Văn Thời
6. U Minh
7. TP Cà Mau

Lưu ý: Năm Căn và Ngọc Hiển chưa có layer trên GeoServer iLIS.

Sử dụng:
    python scrape_all_districts.py                 # Cào tất cả huyện chưa cào
    python scrape_all_districts.py --district "Cái Nước"  # Cào 1 huyện cụ thể
    python scrape_all_districts.py --list           # Liệt kê layer names
    python scrape_all_districts.py --check          # Kiểm tra trạng thái
    python scrape_all_districts.py --skip-done      # Bỏ qua huyện đã cào
"""

import json
import sys
import time
import math
import argparse
import urllib.request
import urllib.error
import psycopg2
import psycopg2.extras
from datetime import datetime

# ============= CẤU HÌNH =============
WFS_BASE_URL = "https://ilis-sdk.vnpt.vn/map/geoserver/iLIS_CMU/wfs"
BATCH_SIZE = 1000
MAX_RETRIES = 3
RETRY_DELAY = 5

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "AgriPlanner",
    "user": "postgres",
    "password": "Kiet2004"
}

PROVINCE = "Cà Mau"

# ============= DANH SÁCH HUYỆN =============
# Layer names theo pattern: iLIS_CMU:cmu_thuadat_huyen<tên_không_dấu_viết_liền>
# hoặc iLIS_CMU:cmu_thuadat_tp<tên>
DISTRICTS = {
    "Thới Bình": {
        "layer": "iLIS_CMU:cmu_thuadat_huyenthoibinh",
        "bbox": {"sw_lat": 9.18, "sw_lng": 104.95, "ne_lat": 9.48, "ne_lng": 105.32}
    },
    "Cái Nước": {
        "layer": "iLIS_CMU:cmu_thuadat_huyencainuoc",
        "bbox": {"sw_lat": 8.85, "sw_lng": 104.85, "ne_lat": 9.15, "ne_lng": 105.15}
    },
    "Đầm Dơi": {
        "layer": "iLIS_CMU:cmu_thuadat_huyendamdoi",
        "bbox": {"sw_lat": 8.80, "sw_lng": 105.00, "ne_lat": 9.10, "ne_lng": 105.35}
    },
    "Phú Tân": {
        "layer": "iLIS_CMU:cmu_thuadat_huyenphutan",
        "bbox": {"sw_lat": 8.90, "sw_lng": 104.85, "ne_lat": 9.15, "ne_lng": 105.10}
    },
    "Trần Văn Thời": {
        "layer": "iLIS_CMU:cmu_thuadat_huyentranvanthoi",
        "bbox": {"sw_lat": 9.00, "sw_lng": 104.80, "ne_lat": 9.35, "ne_lng": 105.10}
    },
    "U Minh": {
        "layer": "iLIS_CMU:cmu_thuadat_huyenuminh",
        "bbox": {"sw_lat": 9.20, "sw_lng": 104.85, "ne_lat": 9.55, "ne_lng": 105.10}
    },
    "TP Cà Mau": {
        "layer": "iLIS_CMU:cmu_thuadat_tpcamau",
        "bbox": {"sw_lat": 9.10, "sw_lng": 105.10, "ne_lat": 9.25, "ne_lng": 105.25}
    },
}

# Bảng mã loại đất → tên tiếng Việt
LAND_USE_MAP = {
    "LUC": "Đất chuyên trồng lúa nước", "LUK": "Đất trồng lúa nước còn lại",
    "LUN": "Đất lúa nương", "CHN": "Đất trồng cây hàng năm khác",
    "BHK": "Đất bằng trồng cây hàng năm khác", "HNK": "Đất nương rẫy",
    "CLN": "Đất trồng cây lâu năm", "RSX": "Đất rừng sản xuất",
    "RPH": "Đất rừng phòng hộ", "RDD": "Đất rừng đặc dụng",
    "NTS": "Đất nuôi trồng thủy sản", "LMU": "Đất làm muối",
    "NKH": "Đất nông nghiệp khác", "ONT": "Đất ở nông thôn",
    "ODT": "Đất ở đô thị", "TSC": "Đất trụ sở cơ quan",
    "DGD": "Đất cơ sở giáo dục đào tạo", "DYT": "Đất cơ sở y tế",
    "DVH": "Đất cơ sở văn hóa", "DTT": "Đất cơ sở thể dục thể thao",
    "DGT": "Đất giao thông", "DTL": "Đất thủy lợi",
    "DNL": "Đất công trình năng lượng", "DBV": "Đất công trình bưu chính viễn thông",
    "SKC": "Đất cụm khu công nghiệp", "SKK": "Đất khu kinh tế",
    "SKT": "Đất khu công nghệ cao", "TMD": "Đất thương mại dịch vụ",
    "NTD": "Đất cơ sở nghĩa trang, nhà tang lễ",
    "SON": "Đất mặt nước sông ngòi, kênh rạch, suối",
    "MNC": "Đất mặt nước chuyên dùng", "PNK": "Đất phi nông nghiệp khác",
    "BCS": "Đất bằng chưa sử dụng", "DCS": "Đất đồi chưa sử dụng",
    "NCS": "Núi đá không có rừng cây", "CSD": "Đất chưa sử dụng",
    "TIN": "Đất tôn giáo", "CQP": "Đất quốc phòng", "CAN": "Đất an ninh",
    "DHT": "Đất công trình hạ tầng", "TDP": "Đất tôn giáo, tín ngưỡng",
    "ONT+CLN": "Đất ở + Cây lâu năm", "CLN+LUK": "Đất cây lâu năm + Lúa",
    "NTS+CLN": "Đất thủy sản + Cây lâu năm", "LUK+CLN": "Đất lúa + Cây lâu năm",
    "ONT+LUK": "Đất ở + Lúa", "CLN+NTS": "Đất cây lâu năm + Thủy sản",
    "LUK+NTS": "Đất lúa + Thủy sản", "NTS+LUK": "Đất thủy sản + Lúa",
}


def lookup_land_use_name(code):
    if not code:
        return None
    code = code.strip()
    if code in LAND_USE_MAP:
        return LAND_USE_MAP[code]
    parts = code.replace("+", ",").replace("/", ",").split(",")
    names = []
    for p in parts:
        p = p.strip()
        names.append(LAND_USE_MAP.get(p, p))
    return " + ".join(names) if names else None


def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


def ensure_table_exists(conn):
    """Ensure the land_parcels table exists"""
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS land_parcels (
            id SERIAL PRIMARY KEY,
            parcel_id VARCHAR(100),
            object_id BIGINT,
            map_sheet_number VARCHAR(50),
            parcel_number VARCHAR(50),
            area_sqm DOUBLE PRECISION,
            legal_area_sqm DOUBLE PRECISION,
            land_use_code VARCHAR(30),
            land_use_name VARCHAR(100),
            address TEXT,
            admin_unit_code VARCHAR(20),
            admin_unit_name VARCHAR(100),
            district VARCHAR(100),
            province VARCHAR(50) DEFAULT 'Cà Mau',
            center_lat DOUBLE PRECISION,
            center_lng DOUBLE PRECISION,
            boundary_geojson JSONB,
            owner_name VARCHAR(200),
            owner_address TEXT,
            certificate_number VARCHAR(100),
            certificate_date DATE,
            source_system VARCHAR(50) DEFAULT 'iLIS',
            raw_properties JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(parcel_id)
        );
    """)
    # Add indexes
    for idx_sql in [
        "CREATE INDEX IF NOT EXISTS idx_land_parcels_district ON land_parcels(district);",
        "CREATE INDEX IF NOT EXISTS idx_land_parcels_admin_unit ON land_parcels(admin_unit_name);",
        "CREATE INDEX IF NOT EXISTS idx_land_parcels_land_use ON land_parcels(land_use_code);",
        "CREATE INDEX IF NOT EXISTS idx_land_parcels_location ON land_parcels(center_lat, center_lng);",
        "CREATE INDEX IF NOT EXISTS idx_land_parcels_geom ON land_parcels USING GIN(boundary_geojson);",
    ]:
        try:
            cur.execute(idx_sql)
        except Exception:
            pass
    conn.commit()
    cur.close()

    # Add columns that may be missing from older schema
    alter_columns = [
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS raw_properties JSONB;",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS owner_name VARCHAR(200);",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS owner_address TEXT;",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS certificate_number VARCHAR(100);",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS certificate_date DATE;",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS source_system VARCHAR(50) DEFAULT 'iLIS';",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS scrape_batch VARCHAR(50);",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS data_version INTEGER DEFAULT 1;",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
        # Fix column types for data compatibility
        "ALTER TABLE land_parcels ALTER COLUMN object_id TYPE BIGINT;",
        "ALTER TABLE land_parcels ALTER COLUMN parcel_number TYPE VARCHAR(50);",
        # Ensure unique constraint on parcel_id for ON CONFLICT
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_land_parcels_parcel_id ON land_parcels (parcel_id);",
    ]
    for col_sql in alter_columns:
        try:
            cur2 = conn.cursor()
            cur2.execute(col_sql)
            conn.commit()
            cur2.close()
        except Exception:
            conn.rollback()


def compute_centroid(geometry):
    """Calculate approximate centroid from GeoJSON geometry"""
    coords = geometry.get("coordinates", [])
    geo_type = geometry.get("type", "")

    all_points = []

    def flatten_coords(c, depth=0):
        if depth > 5:
            return
        if isinstance(c, list) and len(c) >= 2 and isinstance(c[0], (int, float)):
            all_points.append(c)
        elif isinstance(c, list):
            for item in c:
                flatten_coords(item, depth + 1)

    flatten_coords(coords)

    if not all_points:
        return None, None

    avg_lng = sum(p[0] for p in all_points) / len(all_points)
    avg_lat = sum(p[1] for p in all_points) / len(all_points)
    return avg_lat, avg_lng


def fetch_wfs_features(layer_name, cql_filter=None, bbox=None, max_features=BATCH_SIZE):
    """Fetch features from WFS service"""
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": layer_name,
        "outputFormat": "application/json",
        "count": str(max_features),
        "srsName": "EPSG:4326",
    }

    if cql_filter:
        params["CQL_FILTER"] = cql_filter
    if bbox:
        params["BBOX"] = bbox

    query_string = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in params.items())
    url = f"{WFS_BASE_URL}?{query_string}"

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "AgriPlanner-Scraper/2.0",
                "Accept": "application/json"
            })
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("features", [])
        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as e:
            if attempt < MAX_RETRIES - 1:
                print(f"\n   ⚠ Retry {attempt + 1}/{MAX_RETRIES}: {str(e)[:80]}")
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                print(f"\n   ❌ Failed after {MAX_RETRIES} retries: {str(e)[:100]}")
                return []
        except Exception as e:
            print(f"\n   ❌ Unexpected error: {e}")
            return []


def insert_parcels(conn, features, district_name):
    """Insert features into PostgreSQL"""
    if not features:
        return 0

    inserted = 0
    cur = conn.cursor()

    for f in features:
        props = f.get("properties", {})
        geometry = f.get("geometry")
        
        parcel_id = props.get("uuid") or props.get("objectid") or f.get("id", "")
        if not parcel_id:
            continue

        parcel_id = str(parcel_id)
        center_lat, center_lng = compute_centroid(geometry) if geometry else (None, None)
        land_use_code = (props.get("loaidat") or "").strip()
        land_use_name = lookup_land_use_name(land_use_code)

        try:
            cur.execute("SAVEPOINT sp_insert")
            cur.execute("""
                INSERT INTO land_parcels (
                    parcel_id, object_id, map_sheet_number, parcel_number,
                    area_sqm, legal_area_sqm, land_use_code, land_use_name,
                    address, admin_unit_code, admin_unit_name,
                    district, province, center_lat, center_lng,
                    boundary_geojson, raw_properties, source_system
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, 'iLIS'
                )
                ON CONFLICT (parcel_id) DO UPDATE SET
                    area_sqm = EXCLUDED.area_sqm,
                    land_use_code = EXCLUDED.land_use_code,
                    land_use_name = EXCLUDED.land_use_name,
                    boundary_geojson = EXCLUDED.boundary_geojson,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                parcel_id,
                props.get("objectid"),
                props.get("tobandoso"),
                props.get("sothututhua"),
                props.get("dientich"),
                props.get("dientichpl"),
                land_use_code or None,
                land_use_name,
                props.get("diachithua"),
                props.get("madvhc"),
                props.get("tendvhc"),
                district_name,
                PROVINCE,
                center_lat,
                center_lng,
                json.dumps(geometry) if geometry else None,
                json.dumps(props),
            ))
            cur.execute("RELEASE SAVEPOINT sp_insert")
            inserted += 1
        except psycopg2.errors.UniqueViolation:
            cur.execute("ROLLBACK TO SAVEPOINT sp_insert")
        except Exception as e:
            cur.execute("ROLLBACK TO SAVEPOINT sp_insert")
            print(f"\n   ⚠ Insert error: {str(e)[:80]}")

    conn.commit()
    cur.close()
    return inserted


def check_layer_exists(layer_name):
    """Check if a WFS layer exists by requesting 1 feature"""
    try:
        features = fetch_wfs_features(layer_name, max_features=1)
        return len(features) > 0
    except Exception:
        return False


def get_district_count(conn, district_name):
    """Get number of parcels already in DB for a district"""
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM land_parcels WHERE district = %s", (district_name,))
    count = cur.fetchone()[0]
    cur.close()
    return count


def scrape_district(conn, district_name, district_config, skip_if_exists=False):
    """Scrape all land parcels for a single district"""
    layer_name = district_config["layer"]
    bbox = district_config["bbox"]
    
    existing_count = get_district_count(conn, district_name)
    
    print(f"\n{'='*65}")
    print(f"  🏘️  Huyện/TP: {district_name}")
    print(f"  📡 Layer:    {layer_name}")
    print(f"  💾 Đã có:    {existing_count:,} thửa trong DB")
    print(f"{'='*65}")

    if skip_if_exists and existing_count > 1000:
        print(f"  ⏩ Bỏ qua (đã có {existing_count:,} thửa)")
        return existing_count, 0

    # Check layer exists
    print(f"  🔍 Kiểm tra layer...")
    if not check_layer_exists(layer_name):
        print(f"  ❌ Layer không tồn tại hoặc không trả dữ liệu!")
        print(f"     Thử các tên layer khác...")
        
        # Try alternate layer name patterns
        alt_names = [
            layer_name.replace("huyen", "h."),
            layer_name.replace("cmu_thuadat_", "cmu_thuadat_h"),
            f"iLIS_CMU:cmu_thuadat_{district_name.lower().replace(' ', '')}",
        ]
        found = False
        for alt in alt_names:
            if check_layer_exists(alt):
                print(f"  ✓ Tìm thấy layer: {alt}")
                layer_name = alt
                found = True
                break
        
        if not found:
            print(f"  ⚠ Không tìm thấy layer cho {district_name}. Bỏ qua.")
            return existing_count, 0

    # Phase 1: Paginate by objectid > last_id
    print(f"\n  📥 Phase 1: Pagination by objectid...")
    start_time = time.time()
    fetched_total = 0
    inserted_total = 0
    last_id = 0
    empty_batches = 0

    while True:
        cql_filter = f"objectid>{last_id}"
        features = fetch_wfs_features(layer_name, cql_filter=cql_filter)

        if not features:
            empty_batches += 1
            if empty_batches >= 2:
                break
            last_id += BATCH_SIZE
            continue

        empty_batches = 0
        fetched_total += len(features)

        # Find max objectid for next batch
        max_oid = 0
        for f in features:
            oid = f.get("properties", {}).get("objectid", 0) or 0
            try:
                oid = int(oid)
            except (ValueError, TypeError):
                oid = 0
            if oid > max_oid:
                max_oid = oid

        if max_oid <= last_id:
            break
        last_id = max_oid

        ins = insert_parcels(conn, features, district_name)
        inserted_total += ins

        sys.stdout.write(f"\r   Batch: objectid>{last_id:,} | Tải: {fetched_total:,} | Lưu: {inserted_total:,}  ")
        sys.stdout.flush()
        time.sleep(0.3)

    print(f"\n   ✓ Phase 1: {fetched_total:,} features, {inserted_total:,} inserted")

    # Phase 2: Grid-based scraping for records missed by objectid pagination
    print(f"\n  📥 Phase 2: Grid-based (BBOX only)...")
    grid_rows, grid_cols = 5, 5
    lat_step = (bbox["ne_lat"] - bbox["sw_lat"]) / grid_rows
    lng_step = (bbox["ne_lng"] - bbox["sw_lng"]) / grid_cols
    phase2_fetched = 0
    phase2_inserted = 0
    seen_uuids = set()

    for row in range(grid_rows):
        for col in range(grid_cols):
            cell_sw_lat = bbox["sw_lat"] + row * lat_step
            cell_sw_lng = bbox["sw_lng"] + col * lng_step
            cell_ne_lat = cell_sw_lat + lat_step
            cell_ne_lng = cell_sw_lng + lng_step

            bbox_str = f"{cell_sw_lng},{cell_sw_lat},{cell_ne_lng},{cell_ne_lat}"
            try:
                features = fetch_wfs_features(
                    layer_name,
                    bbox=bbox_str
                )
            except Exception:
                features = []

            if features:
                unique = []
                for f in features:
                    uid = f.get("properties", {}).get("uuid", "")
                    if uid and uid not in seen_uuids:
                        seen_uuids.add(uid)
                        unique.append(f)

                if unique:
                    phase2_fetched += len(unique)
                    ins = insert_parcels(conn, unique, district_name)
                    phase2_inserted += ins

            cell_idx = row * grid_cols + col + 1
            sys.stdout.write(f"\r   Grid {cell_idx}/{grid_rows*grid_cols} | Phase 2: {phase2_fetched:,} fetched, {phase2_inserted:,} inserted  ")
            sys.stdout.flush()
            time.sleep(0.3)

    print(f"\n   ✓ Phase 2: {phase2_fetched:,} features, {phase2_inserted:,} inserted")

    elapsed = time.time() - start_time
    total_new = inserted_total + phase2_inserted
    total_fetched = fetched_total + phase2_fetched
    
    print(f"\n  ✅ {district_name}: {total_fetched:,} fetched, {total_new:,} new | ⏱ {int(elapsed//60)}m{int(elapsed%60)}s")
    
    return get_district_count(conn, district_name), total_new


def print_summary(conn):
    """Print summary statistics for all districts"""
    print(f"\n{'='*65}")
    print(f"  📊 TỔNG KẾT TOÀN TỈNH CÀ MAU")
    print(f"{'='*65}")

    cur = conn.cursor()
    
    # By district
    cur.execute("""
        SELECT district, COUNT(*) as cnt,
               ROUND(SUM(area_sqm)::numeric / 10000, 2) as total_ha
        FROM land_parcels
        WHERE province = %s
        GROUP BY district
        ORDER BY cnt DESC
    """, (PROVINCE,))
    rows = cur.fetchall()
    
    print(f"\n  {'Huyện/TP':<25} {'Số thửa':>10} {'DT (ha)':>12}")
    print(f"  {'-'*25} {'-'*10} {'-'*12}")
    grand_total = 0
    grand_ha = 0
    for name, cnt, ha in rows:
        ha_str = f"{ha:,.2f}" if ha else "N/A"
        print(f"  {(name or '?'):<25} {cnt:>10,} {ha_str:>12}")
        grand_total += cnt
        grand_ha += (ha or 0)
    print(f"  {'-'*25} {'-'*10} {'-'*12}")
    print(f"  {'TỔNG':<25} {grand_total:>10,} {grand_ha:>12,.2f}")

    # Top land use types
    print(f"\n  📊 Top 10 loại đất:")
    cur.execute("""
        SELECT land_use_code, land_use_name, COUNT(*) as cnt,
               ROUND(SUM(area_sqm)::numeric / 10000, 2) as total_ha
        FROM land_parcels
        WHERE province = %s
        GROUP BY land_use_code, land_use_name
        ORDER BY cnt DESC
        LIMIT 10
    """, (PROVINCE,))
    rows = cur.fetchall()
    print(f"  {'Mã':<10} {'Tên':<35} {'Số thửa':>8} {'DT (ha)':>12}")
    print(f"  {'-'*10} {'-'*35} {'-'*8} {'-'*12}")
    for code, name, cnt, ha in rows:
        name_d = (name or code or "?")[:35]
        ha_str = f"{ha:,.2f}" if ha else "N/A"
        print(f"  {(code or '?'):<10} {name_d:<35} {cnt:>8,} {ha_str:>12}")

    cur.close()


def main():
    parser = argparse.ArgumentParser(description="Cào dữ liệu thửa đất toàn tỉnh Cà Mau")
    parser.add_argument("--district", type=str, help="Cào 1 huyện cụ thể (tên tiếng Việt)")
    parser.add_argument("--list", action="store_true", help="Liệt kê layer names")
    parser.add_argument("--check", action="store_true", help="Kiểm tra layer có tồn tại")
    parser.add_argument("--skip-done", action="store_true", help="Bỏ qua huyện đã cào (>1000 thửa)")
    parser.add_argument("--summary", action="store_true", help="Chỉ in thống kê")
    args = parser.parse_args()

    if args.list:
        print("\n📋 Danh sách layer names:")
        for name, cfg in DISTRICTS.items():
            print(f"   {name:<20} → {cfg['layer']}")
        return

    conn = get_db_connection()
    ensure_table_exists(conn)

    if args.check:
        print("\n🔍 Kiểm tra layer tồn tại:")
        for name, cfg in DISTRICTS.items():
            exists = check_layer_exists(cfg["layer"])
            count = get_district_count(conn, name)
            status = "✅" if exists else "❌"
            print(f"   {status} {name:<20} Layer: {cfg['layer']:<50} DB: {count:,}")
        conn.close()
        return

    if args.summary:
        print_summary(conn)
        conn.close()
        return

    print()
    print("╔═════════════════════════════════════════════════════════════╗")
    print("║  🗺️  SCRAPER DỮ LIỆU THỬ ĐẤT TOÀN TỈNH CÀ MAU         ║")
    print("║  Nguồn: ilis.camau.gov.vn (GeoServer WFS)                ║")
    print("╚═════════════════════════════════════════════════════════════╝")

    districts_to_scrape = dict(DISTRICTS)
    if args.district:
        # Find matching district
        matched = None
        for name in DISTRICTS:
            if name.lower() == args.district.lower() or args.district.lower() in name.lower():
                matched = name
                break
        if not matched:
            print(f"\n❌ Không tìm thấy huyện '{args.district}'")
            print(f"   Các huyện: {', '.join(DISTRICTS.keys())}")
            conn.close()
            return
        districts_to_scrape = {matched: DISTRICTS[matched]}
    else:
        # Mặc định bỏ qua Thới Bình (đã có ~129K thửa trong DB)
        tb_count = get_district_count(conn, "Thới Bình")
        if tb_count > 1000:
            print(f"\n  ⏩ Tự động bỏ qua Thới Bình (đã có {tb_count:,} thửa trong DB)")
            districts_to_scrape.pop("Thới Bình", None)

    # Scrape each district
    start_all = time.time()
    results = {}

    for idx, (name, cfg) in enumerate(districts_to_scrape.items(), 1):
        print(f"\n{'▓'*65}")
        print(f"  [{idx}/{len(districts_to_scrape)}] Đang xử lý: {name}")
        print(f"{'▓'*65}")

        try:
            total, new = scrape_district(conn, name, cfg, skip_if_exists=args.skip_done)
            results[name] = {"total": total, "new": new, "status": "✅"}
        except KeyboardInterrupt:
            print(f"\n\n⚠ Dừng bởi người dùng. Đã hoàn tất đến huyện {name}.")
            results[name] = {"total": get_district_count(conn, name), "new": 0, "status": "⚠️ Interrupted"}
            break
        except Exception as e:
            print(f"\n❌ Lỗi khi cào {name}: {e}")
            results[name] = {"total": get_district_count(conn, name), "new": 0, "status": f"❌ {str(e)[:50]}"}

    # Final summary
    elapsed_all = time.time() - start_all
    print(f"\n\n{'='*65}")
    print(f"  📊 KẾT QUẢ CHẠY")
    print(f"{'='*65}")
    print(f"  {'Huyện/TP':<20} {'Status':<12} {'Tổng DB':>10} {'Mới':>8}")
    print(f"  {'-'*20} {'-'*12} {'-'*10} {'-'*8}")
    for name, r in results.items():
        print(f"  {name:<20} {r['status']:<12} {r['total']:>10,} {r['new']:>8,}")
    print(f"\n  ⏱ Tổng thời gian: {int(elapsed_all//60)}m{int(elapsed_all%60)}s")

    # Print overall summary
    print_summary(conn)
    conn.close()


if __name__ == "__main__":
    main()
