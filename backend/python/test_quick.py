"""Quick soil test to verify coverage stat fix."""
import sys
sys.path.insert(0, '.')
from map_polygon_extractor import analyze_map_image

result = analyze_map_image(
    'E:/Agriplanner/map/Cà Mau_Thổ Nhưỡng.png',
    'test_soil_quick.json',
    map_type='soil',
    geo_bounds={'sw': {'lat': 8.5, 'lng': 104.7}, 'ne': {'lat': 9.6, 'lng': 105.35}}
)
if result:
    zones = result.get('zones', [])
    types = set(z.get('zoneType', '') for z in zones)
    print(f"\nSOIL: {len(zones)} zones, {len(types)} types")
    if result.get('soil_stats'):
        cov = sum(v.get('total_area_pct', 0) for v in result['soil_stats'].values())
        print(f"Coverage: {cov:.1f}%")
