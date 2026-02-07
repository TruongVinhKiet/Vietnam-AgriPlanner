"""Test both maps with alpha channel fix."""
import sys
sys.path.insert(0, '.')

from map_polygon_extractor import analyze_map_image

geo_bounds = {'sw': {'lat': 8.5, 'lng': 104.7}, 'ne': {'lat': 9.6, 'lng': 105.35}}

# Test soil map
print("=" * 60)
print("TEST 1: SOIL MAP")
print("=" * 60)

result = analyze_map_image(
    'E:/Agriplanner/map/Cà Mau_Thổ Nhưỡng.png',
    'test_soil_alpha2.json',
    map_type='soil',
    geo_bounds=geo_bounds
)

if result:
    zones = result.get('zones', [])
    soil_types = set(z.get('zoneType', '') for z in zones)
    print(f"\nSOIL: {len(zones)} zones, {len(soil_types)} types")
    if result.get('soil_stats'):
        cov = sum(v.get('total_area_pct', 0) for v in result['soil_stats'].values())
        print(f"Coverage: {cov:.1f}%")
else:
    print("SOIL: FAILED!")

# Test planning map
print("\n" + "=" * 60)
print("TEST 2: PLANNING MAP")
print("=" * 60)

result2 = analyze_map_image(
    'E:/Agriplanner/map/Cà Mau_Quy Hoạch.png',
    'test_planning_alpha.json',
    map_type='planning',
    geo_bounds=geo_bounds
)

if result2:
    zones2 = result2.get('zones', [])
    ztypes = set(z.get('zoneType', '') for z in zones2)
    print(f"\nPLANNING: {len(zones2)} zones, {len(ztypes)} types")
    for zt in sorted(ztypes):
        count = sum(1 for z in zones2 if z.get('zoneType') == zt)
        print(f"  {zt}: {count}")
else:
    print("PLANNING: FAILED!")

print("\nAll tests done!")
