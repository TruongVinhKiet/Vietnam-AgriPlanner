"""Test soil map analysis with alpha channel fix."""
import sys
import json

# Add current dir
sys.path.insert(0, '.')

from map_polygon_extractor import analyze_map_image

image_path = 'E:/Agriplanner/map/Cà Mau_Thổ Nhưỡng.png'
output_path = 'test_soil_alpha.json'

result = analyze_map_image(
    image_path,
    output_path,
    map_type='soil',
    geo_bounds={'sw': {'lat': 8.5, 'lng': 104.7}, 'ne': {'lat': 9.6, 'lng': 105.35}}
)

zones = result.get('zones', [])
soil_types = set(z.get('zoneType', '') for z in zones)
print(f"\n=== RESULTS ===")
print(f"Zones: {len(zones)}")
print(f"Soil types: {len(soil_types)}")

if result.get('soil_stats'):
    coverage = sum(v.get('total_area_pct', 0) for v in result['soil_stats'].values())
    print(f"Coverage: {coverage:.1f}%")
    for k, v in sorted(result['soil_stats'].items(), key=lambda x: x[1].get('total_area_pct', 0), reverse=True):
        print(f"  {k}: {v.get('zone_count', 0)} zones, {v.get('total_area_pct', 0):.2f}%")

print("\nDone!")
