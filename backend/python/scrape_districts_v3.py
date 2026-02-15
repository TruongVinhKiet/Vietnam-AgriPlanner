"""
Scraper v3: Cào ĐẦY ĐỦ 100% thửa đất từ iLIS Cà Mau
=======================================================
Thuật toán: Phân trang theo idthuadat (UUID) + sortBy + CQL_FILTER
Server hỗ trợ maxFeatures lên tới 50,000 → chỉ cần vài request/huyện

5 huyện/TP có dữ liệu chi tiết:
  1. Cái Nước    (~101,918 thửa)
  2. Đầm Dơi     (~109,736 thửa)
  3. TP Cà Mau   (~146,708 thửa)
  4. Trần Văn Thời (~131,329 thửa)
  5. U Minh      (~71,939 thửa)

Sử dụng:
  python scrape_districts_v3.py --district "Cái Nước"
  python scrape_districts_v3.py --all
  python scrape_districts_v3.py --check
  python scrape_districts_v3.py --clean "Cái Nước"
  python scrape_districts_v3.py --clean-all
  python scrape_districts_v3.py --summary
"""

import json
import sys
import time
import re
import argparse
import urllib.request
import urllib.error
import urllib.parse
import psycopg2
import psycopg2.extras

# ============= CONFIG =============
WFS_BASE_URL = "https://ilis-sdk.vnpt.vn/map/geoserver/iLIS_CMU/wfs"
BATCH_SIZE = 10000      # features per request (server supports up to 50K)
MAX_RETRIES = 4
RETRY_DELAY = 5
RATE_LIMIT = 0.3        # seconds between requests

DB_CONFIG = {
    "host": "localhost", "port": 5432,
    "dbname": "AgriPlanner", "user": "postgres", "password": "Kiet2004"
}
PROVINCE = "Cà Mau"

# ============= DISTRICTS =============
DISTRICTS = {
    "Cái Nước": {
        "layer": "iLIS_CMU:cmu_thuadat_huyencainuoc",
    },
    "Đầm Dơi": {
        "layer": "iLIS_CMU:cmu_thuadat_huyendamdoi",
    },
    "TP Cà Mau": {
        "layer": "iLIS_CMU:cmu_thuadat_tpcamau",
    },
    "Trần Văn Thời": {
        "layer": "iLIS_CMU:cmu_thuadat_huyentranvanthoi",
    },
    "U Minh": {
        "layer": "iLIS_CMU:cmu_thuadat_huyenuminh",
    },
}

# ============= LAND USE CODES =============
LAND_USE_MAP = {
    "LUC": "Đất chuyên trồng lúa nước", "LUK": "Đất trồng lúa nước còn lại",
    "LUN": "Đất lúa nương", "LUA": "Đất trồng lúa",
    "CHN": "Đất trồng cây hàng năm khác", "BHK": "Đất bằng trồng cây hàng năm khác",
    "HNK": "Đất nương rẫy", "CLN": "Đất trồng cây lâu năm",
    "RSX": "Đất rừng sản xuất", "RPH": "Đất rừng phòng hộ",
    "RDD": "Đất rừng đặc dụng", "NTS": "Đất nuôi trồng thủy sản",
    "LMU": "Đất làm muối", "NKH": "Đất nông nghiệp khác",
    "ONT": "Đất ở nông thôn", "ODT": "Đất ở đô thị",
    "TSC": "Đất trụ sở cơ quan", "DGD": "Đất cơ sở giáo dục đào tạo",
    "DYT": "Đất cơ sở y tế", "DVH": "Đất cơ sở văn hóa",
    "DTT": "Đất cơ sở thể dục thể thao", "DGT": "Đất giao thông",
    "DTL": "Đất thủy lợi", "DNL": "Đất công trình năng lượng",
    "DBV": "Đất bưu chính viễn thông",
    "SKC": "Đất cụm khu công nghiệp", "SKK": "Đất khu kinh tế",
    "SKT": "Đất khu công nghệ cao", "TMD": "Đất thương mại dịch vụ",
    "NTD": "Đất nghĩa trang, nhà tang lễ",
    "SON": "Đất sông ngòi, kênh rạch, suối",
    "MNC": "Đất mặt nước chuyên dùng", "PNK": "Đất phi nông nghiệp khác",
    "BCS": "Đất bằng chưa sử dụng", "DCS": "Đất đồi chưa sử dụng",
    "NCS": "Núi đá không có rừng cây", "CSD": "Đất chưa sử dụng",
    "TIN": "Đất tôn giáo", "CQP": "Đất quốc phòng", "CAN": "Đất an ninh",
    "DHT": "Đất hạ tầng", "DCH": "Đất chợ", "DRA": "Đất bãi thải",
    "SKX": "Đất sản xuất phi nông nghiệp", "TSL": "Đất cây thực lâm",
    "DKV": "Đất khu vui chơi", "TON": "Đất tôn giáo",
    "LNK": "Đất lâm nghiệp khác", "DDT": "Đất đô thị",
    "DSH": "Đất sinh hoạt cộng đồng",
    "ONT+CLN": "Đất ở + Cây lâu năm", "ODT+CLN": "Đất ở ĐT + Cây lâu năm",
    "CLN+LUK": "Cây lâu năm + Lúa", "NTS+CLN": "Thủy sản + Cây lâu năm",
    "LUK+CLN": "Lúa + Cây lâu năm", "ONT+LUK": "Đất ở + Lúa",
    "CLN+NTS": "Cây lâu năm + Thủy sản", "LUK+NTS": "Lúa + Thủy sản",
    "NTS+LUK": "Thủy sản + Lúa", "ODT+LNK": "Đất ở ĐT + Lâm nghiệp",
    "CLN+ODT": "Cây lâu năm + Ở đô thị", "CLN+ONT": "Cây lâu năm + Ở nông thôn",
    "ODT+NTS": "Đất ở ĐT + Thủy sản",
}


def lookup_land_use_name(code):
    if not code:
        return None
    code = code.strip()
    if code in LAND_USE_MAP:
        return LAND_USE_MAP[code]
    parts = code.replace("+", ",").replace("/", ",").split(",")
    names = [LAND_USE_MAP.get(p.strip(), p.strip()) for p in parts]
    return " + ".join(names) if names else code


def calculate_centroid(geometry):
    if not geometry or not geometry.get("coordinates"):
        return None, None
    all_coords = []

    def extract(c):
        if not c:
            return
        if isinstance(c, list) and len(c) >= 2 and isinstance(c[0], (int, float)):
            all_coords.append(c)
        elif isinstance(c, list):
            for item in c:
                extract(item)

    extract(geometry["coordinates"])
    if not all_coords:
        return None, None
    lngs = [c[0] for c in all_coords]
    lats = [c[1] for c in all_coords]
    return round(sum(lats) / len(lats), 7), round(sum(lngs) / len(lngs), 7)


# ============= WFS =============

def get_total_features(layer_name):
    url = (
        f"{WFS_BASE_URL}?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature"
        f"&typeName={layer_name}&resultType=hits"
    )
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "AgriPlanner/3"})
            r = urllib.request.urlopen(req, timeout=30)
            data = r.read().decode("utf-8")
            m = re.search(r'numberOfFeatures="(\d+)"', data)
            if m:
                return int(m.group(1))
        except Exception:
            time.sleep(RETRY_DELAY)
    return 0


def fetch_page(layer_name, after_id=None, batch_size=BATCH_SIZE):
    """Fetch a page of features sorted by idthuadat, optionally after a specific ID."""
    params = (
        f"SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature"
        f"&typeName={layer_name}"
        f"&outputFormat=application/json"
        f"&srsName=EPSG:4326"
        f"&maxFeatures={batch_size}"
        f"&sortBy=idthuadat"
    )
    if after_id:
        cql = urllib.parse.quote(f"idthuadat>'{after_id}'")
        params += f"&CQL_FILTER={cql}"

    url = f"{WFS_BASE_URL}?{params}"

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "AgriPlanner/3", "Accept": "application/json"
            })
            r = urllib.request.urlopen(req, timeout=300)
            raw = r.read()
            if not raw or raw[0:1] == b'<':
                print(f"\n     ⚠ XML response (attempt {attempt+1}), retrying...")
                time.sleep(RETRY_DELAY * (attempt + 1))
                continue
            data = json.loads(raw.decode("utf-8"))
            return data.get("features", [])
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                print(f"\n     ⚠ Error: {e} (attempt {attempt+1}), retrying...")
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                print(f"\n     ❌ Failed after {MAX_RETRIES} attempts: {e}")
    return []


# ============= DATABASE =============

def get_db_connection():
    conn = psycopg2.connect(**DB_CONFIG)
    conn.set_client_encoding("UTF8")
    return conn


def ensure_columns(conn):
    sqls = [
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS raw_properties JSONB;",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS source_system VARCHAR(50) DEFAULT 'iLIS';",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS owner_name VARCHAR(200);",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS owner_address TEXT;",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS certificate_number VARCHAR(100);",
        "ALTER TABLE land_parcels ADD COLUMN IF NOT EXISTS certificate_date DATE;",
    ]
    for sql in sqls:
        try:
            cur = conn.cursor()
            cur.execute(sql)
            conn.commit()
            cur.close()
        except Exception:
            conn.rollback()


def get_district_count(conn, district_name):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM land_parcels WHERE district = %s", (district_name,))
    c = cur.fetchone()[0]
    cur.close()
    return c


def delete_district_data(conn, district_name):
    cur = conn.cursor()
    cur.execute("DELETE FROM land_parcels WHERE district = %s", (district_name,))
    d = cur.rowcount
    conn.commit()
    cur.close()
    return d


def get_last_parcel_id(conn, district_name):
    """Get the last (max) parcel_id for resume support."""
    cur = conn.cursor()
    cur.execute(
        "SELECT MAX(parcel_id) FROM land_parcels WHERE district = %s AND parcel_id IS NOT NULL",
        (district_name,)
    )
    row = cur.fetchone()
    cur.close()
    return row[0] if row and row[0] else None


def insert_batch(conn, features, district_name):
    if not features:
        return 0

    sql = """
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
            notes, source_system, raw_properties
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
            %(notes)s, 'iLIS', %(raw_properties)s
        )
        ON CONFLICT (parcel_id) WHERE parcel_id IS NOT NULL DO NOTHING
    """

    inserted = 0
    skipped = 0
    cur = conn.cursor()

    for f in features:
        props = f.get("properties", {})
        geom = f.get("geometry")
        parcel_id = props.get("idthuadat")
        if not parcel_id:
            skipped += 1
            continue

        center_lat, center_lng = calculate_centroid(geom)
        lc = (props.get("loaidat") or "").strip()

        row = {
            "object_id": props.get("objectid"),
            "parcel_id": parcel_id,
            "map_sheet_id": props.get("idtobando"),
            "map_sheet_number": props.get("tobandoso"),
            "parcel_number": props.get("sothututhua"),
            "area_sqm": props.get("dientich"),
            "legal_area_sqm": props.get("dientichpl"),
            "land_use_code": lc or None,
            "land_use_name": lookup_land_use_name(lc),
            "address": props.get("diachithua"),
            "street_name": props.get("tenduong"),
            "road": props.get("duong"),
            "road_section": props.get("doanduong"),
            "location": props.get("vitri"),
            "admin_unit_code": props.get("madvhc"),
            "admin_unit_name": props.get("tendvhc"),
            "district": district_name,
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
            "raw_properties": json.dumps(props),
        }

        try:
            cur.execute("SAVEPOINT sp")
            cur.execute(sql, row)
            if cur.rowcount > 0:
                inserted += 1
            cur.execute("RELEASE SAVEPOINT sp")
        except Exception:
            cur.execute("ROLLBACK TO SAVEPOINT sp")

    conn.commit()
    cur.close()
    return inserted


# ============= MAIN SCRAPING =============

def scrape_district(conn, name, config):
    layer = config["layer"]

    print(f"\n{'='*65}")
    print(f"  🗺️  {name}")
    print(f"  📡 {layer}")
    print(f"{'='*65}")

    print(f"\n  📊 Đếm features trên server...")
    total_server = get_total_features(layer)
    if total_server == 0:
        print(f"  ❌ Layer rỗng hoặc không kết nối được.")
        return 0, 0
    print(f"     Server: {total_server:,}")

    existing = get_district_count(conn, name)
    print(f"     DB:     {existing:,}")

    if existing >= total_server * 0.99:
        pct = existing / total_server * 100
        print(f"  ✅ Đã đủ ({pct:.1f}%).")
        return existing, 0

    # Resume support: get last parcel_id
    last_id = get_last_parcel_id(conn, name)
    if last_id:
        print(f"  ↩️  Resume từ: {last_id}")
    else:
        print(f"  🆕 Bắt đầu từ đầu")

    print(f"\n  🔄 Phân trang theo idthuadat...")
    print(f"     Batch size: {BATCH_SIZE:,}")
    print()

    start_time = time.time()
    total_fetched = 0
    total_inserted = 0
    page = 0
    after_id = last_id  # Resume from last ID

    while True:
        page += 1
        features = fetch_page(layer, after_id, BATCH_SIZE)

        if not features:
            print(f"\n     ✓ Không còn features (trang {page})")
            break

        # Get the last idthuadat for next page
        last_feat_id = None
        for f in reversed(features):
            lid = f.get("properties", {}).get("idthuadat")
            if lid:
                last_feat_id = lid
                break

        total_fetched += len(features)
        ins = insert_batch(conn, features, name)
        total_inserted += ins

        current_db = existing + total_inserted
        pct = current_db / total_server * 100 if total_server > 0 else 0
        elapsed = time.time() - start_time
        rate = total_inserted / elapsed if elapsed > 0 else 0

        sys.stdout.write(
            f"\r     Trang {page:>3}: "
            f"fetch={len(features):>6,} | "
            f"new={ins:>6,} | "
            f"total={current_db:>8,}/{total_server:,} ({pct:>5.1f}%) | "
            f"{rate:>5.0f}/s  "
        )
        sys.stdout.flush()

        if len(features) < BATCH_SIZE:
            print(f"\n     ✓ Trang cuối (< batch_size)")
            break

        if last_feat_id:
            after_id = last_feat_id
        else:
            print(f"\n     ⚠ Không tìm thấy idthuadat trong batch cuối")
            break

        time.sleep(RATE_LIMIT)

    elapsed = time.time() - start_time
    final = get_district_count(conn, name)
    pct = final / total_server * 100 if total_server > 0 else 0

    print()
    print(f"\n  {'─'*60}")
    print(f"  ✅ {name}")
    print(f"     Fetched:   {total_fetched:,}")
    print(f"     Inserted:  {total_inserted:,}")
    print(f"     DB total:  {final:,}/{total_server:,} ({pct:.1f}%)")
    print(f"     Pages:     {page}")
    print(f"     Time:      {int(elapsed//60)}m{int(elapsed%60)}s")
    print(f"  {'─'*60}")
    return final, total_inserted


def print_stats(conn, name):
    cur = conn.cursor()
    print(f"\n  📊 Loại đất ({name}):")
    cur.execute("""
        SELECT land_use_code, land_use_name, COUNT(*), ROUND(SUM(area_sqm)::numeric/10000, 2)
        FROM land_parcels WHERE district = %s
        GROUP BY land_use_code, land_use_name ORDER BY 3 DESC LIMIT 15
    """, (name,))
    print(f"     {'Mã':<12} {'Tên':<35} {'Thửa':>8} {'DT(ha)':>12}")
    print(f"     {'-'*12} {'-'*35} {'-'*8} {'-'*12}")
    for c, n, cnt, ha in cur.fetchall():
        print(f"     {(c or '?'):<12} {(n or c or '?')[:35]:<35} {cnt:>8,} {(f'{ha:,.2f}' if ha else 'N/A'):>12}")

    print(f"\n  📊 Xã/Phường ({name}):")
    cur.execute("""
        SELECT admin_unit_name, COUNT(*), ROUND(SUM(area_sqm)::numeric/10000, 2)
        FROM land_parcels WHERE district = %s
        GROUP BY admin_unit_name ORDER BY 2 DESC
    """, (name,))
    print(f"     {'Xã/Phường':<30} {'Thửa':>8} {'DT(ha)':>12}")
    print(f"     {'-'*30} {'-'*8} {'-'*12}")
    for n, cnt, ha in cur.fetchall():
        print(f"     {(n or '?'):<30} {cnt:>8,} {(f'{ha:,.2f}' if ha else 'N/A'):>12}")
    cur.close()


def print_summary(conn):
    cur = conn.cursor()
    print(f"\n{'='*65}")
    print(f"  📊 TỔNG KẾT TOÀN TỈNH CÀ MAU")
    print(f"{'='*65}")
    cur.execute("""
        SELECT district, COUNT(*), ROUND(SUM(area_sqm)::numeric/10000, 2)
        FROM land_parcels WHERE province = %s GROUP BY district ORDER BY 2 DESC
    """, (PROVINCE,))
    rows = cur.fetchall()
    print(f"\n  {'Huyện/TP':<25} {'Thửa':>10} {'DT(ha)':>12}")
    print(f"  {'-'*25} {'-'*10} {'-'*12}")
    gt, gh = 0, 0
    for n, c, h in rows:
        hv = h or 0
        print(f"  {(n or '?'):<25} {c:>10,} {(f'{hv:,.2f}' if h else 'N/A'):>12}")
        gt += c; gh += hv
    print(f"  {'-'*25} {'-'*10} {'-'*12}")
    print(f"  {'TỔNG':<25} {gt:>10,} {gh:>12,.2f}")

    print(f"\n  📊 Top 10 loại đất:")
    cur.execute("""
        SELECT land_use_code, land_use_name, COUNT(*), ROUND(SUM(area_sqm)::numeric/10000, 2)
        FROM land_parcels WHERE province = %s GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 10
    """, (PROVINCE,))
    print(f"  {'Mã':<10} {'Tên':<35} {'Thửa':>8} {'DT(ha)':>12}")
    print(f"  {'-'*10} {'-'*35} {'-'*8} {'-'*12}")
    for c, n, cnt, ha in cur.fetchall():
        print(f"  {(c or '?'):<10} {(n or c or '?')[:35]:<35} {cnt:>8,} {(f'{ha:,.2f}' if ha else 'N/A'):>12}")
    cur.close()


# ============= MAIN =============

def main():
    p = argparse.ArgumentParser(description="Scraper v3: idthuadat pagination — 100% coverage")
    p.add_argument("--district", type=str)
    p.add_argument("--all", action="store_true")
    p.add_argument("--check", action="store_true")
    p.add_argument("--clean", type=str)
    p.add_argument("--clean-all", action="store_true")
    p.add_argument("--summary", action="store_true")
    args = p.parse_args()

    conn = get_db_connection()
    ensure_columns(conn)

    if args.check:
        print(f"\n{'='*80}")
        print(f"  📊 TRẠNG THÁI")
        print(f"{'='*80}")
        print(f"  {'Huyện/TP':<20} {'Layer':<48} {'DB':>8} {'Server':>8} {'%':>6}")
        print(f"  {'-'*20} {'-'*48} {'-'*8} {'-'*8} {'-'*6}")
        all_d = {"Thới Bình": {"layer": "iLIS_CMU:cmu_thuadat_huyenthoibinh"}}
        all_d.update(DISTRICTS)
        for n, c in all_d.items():
            db = get_district_count(conn, n)
            sv = get_total_features(c["layer"])
            pct = db/sv*100 if sv > 0 else 0
            i = "✅" if pct > 95 else ("🔶" if pct > 50 else ("🔷" if pct > 0 else "⬜"))
            print(f"  {i} {n:<18} {c['layer']:<48} {db:>8,} {sv:>8,} {pct:>5.1f}%")
        conn.close()
        return

    if args.clean:
        matched = None
        for n in list(DISTRICTS.keys()) + ["Phú Tân", "Thới Bình"]:
            if args.clean.lower() in n.lower():
                matched = n
                break
        if matched:
            d = delete_district_data(conn, matched)
            print(f"  🗑️  Xóa {d:,} records {matched}")
        else:
            print(f"  ❌ Không tìm '{args.clean}'")
        conn.close()
        return

    if args.clean_all:
        print(f"\n  🗑️  Xóa dữ liệu cũ 5 huyện + Phú Tân...")
        for n in list(DISTRICTS.keys()) + ["Phú Tân"]:
            d = delete_district_data(conn, n)
            print(f"     {n:<20} → {d:,}")
        conn.close()
        return

    if args.summary:
        print_summary(conn)
        conn.close()
        return

    if args.district:
        matched = None
        for n in DISTRICTS:
            if args.district.lower() in n.lower():
                matched = n
                break
        if not matched:
            print(f"  ❌ Không tìm '{args.district}'. Có: {', '.join(DISTRICTS.keys())}")
            conn.close()
            return
        print("\n╔═══════════════════════════════════════════════════════════════╗")
        print("║  🗺️  SCRAPER V3 — IDTHUADAT PAGINATION — 100% COVERAGE     ║")
        print("╚═══════════════════════════════════════════════════════════════╝")
        scrape_district(conn, matched, DISTRICTS[matched])
        print_stats(conn, matched)
        conn.close()
        return

    if args.all:
        print("\n╔═══════════════════════════════════════════════════════════════╗")
        print("║  🗺️  SCRAPER V3 — TOÀN BỘ 5 HUYỆN — 100% COVERAGE         ║")
        print("╚═══════════════════════════════════════════════════════════════╝")
        start = time.time()
        results = {}
        for idx, (n, c) in enumerate(DISTRICTS.items(), 1):
            print(f"\n{'▓'*65}")
            print(f"  [{idx}/{len(DISTRICTS)}] {n}")
            print(f"{'▓'*65}")
            try:
                t, nw = scrape_district(conn, n, c)
                results[n] = {"total": t, "new": nw, "s": "✅"}
                print_stats(conn, n)
            except KeyboardInterrupt:
                print(f"\n  ⚠ Dừng tại {n}")
                results[n] = {"total": get_district_count(conn, n), "new": 0, "s": "⚠️"}
                break
            except Exception as e:
                print(f"\n  ❌ {e}")
                import traceback
                traceback.print_exc()
                results[n] = {"total": get_district_count(conn, n), "new": 0, "s": "❌"}

        el = time.time() - start
        print(f"\n{'='*65}")
        print(f"  📊 KẾT QUẢ TỔNG HỢP")
        print(f"{'='*65}")
        print(f"  {'Huyện/TP':<20} {'':>4} {'DB':>10} {'Mới':>8}")
        print(f"  {'-'*20} {'-'*4} {'-'*10} {'-'*8}")
        for n, r in results.items():
            print(f"  {n:<20} {r['s']:>4} {r['total']:>10,} {r['new']:>8,}")
        print(f"\n  ⏱ Tổng: {int(el//60)}m{int(el%60)}s")
        print_summary(conn)
        conn.close()
        return

    p.print_help()


if __name__ == "__main__":
    main()
