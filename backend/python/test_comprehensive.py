"""
Comprehensive test for soil and planning map analysis
Tests both tabs end-to-end: analysis, field mapping, DB compatibility
"""
import json
import sys
import os
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from map_polygon_extractor import analyze_map_image

REQUIRED_FIELDS = [
    'zoneName', 'zoneCode', 'zoneType', 'fillColor',
    'boundaryCoordinates', 'centerLat', 'centerLng',
    'areaSqm', 'areaHectares', 'areaPercent'
]

ENTITY_FIELDS = {
    'name': 'zoneName',
    'zoneCode': 'zoneCode',
    'zoneType': 'zoneType',
    'landUsePurpose': 'landUsePurpose',
    'fillColor': 'fillColor',
    'boundaryCoordinates': 'boundaryCoordinates',
    'centerLat': 'centerLat',
    'centerLng': 'centerLng',
    'areaSqm': 'areaSqm',
    'mapType': 'mapType'
}

GEO_BOUNDS_SOIL = {'sw': {'lat': 9.0, 'lng': 105.0}, 'ne': {'lat': 9.25, 'lng': 105.25}}
GEO_BOUNDS_PLAN = {'sw': {'lat': 8.55, 'lng': 104.75}, 'ne': {'lat': 9.55, 'lng': 105.45}}


def check_zones(zones, label):
    print(f"Total zones: {len(zones)}")

    # Check required fields
    missing = set()
    for z in zones:
        for f in REQUIRED_FIELDS:
            if f not in z or z[f] is None:
                missing.add(f)
    if missing:
        print(f"WARN - Missing fields: {missing}")
    else:
        print("ALL REQUIRED FIELDS PRESENT")

    # Zone types
    types = Counter(z.get('zoneType', '?') for z in zones)
    print(f"Zone types: {dict(types)}")

    # Unclassified
    uncl = sum(1 for z in zones if z.get('zoneType', '').startswith('UNCL'))
    if uncl:
        print(f"WARNING: {uncl} unclassified zones!")
    else:
        print("0 unclassified zones - ALL CLASSIFIED")

    # Geo coordinates
    has_coords = sum(1 for z in zones if z.get('centerLat') and z.get('centerLng'))
    has_area = sum(1 for z in zones if z.get('areaSqm', 0) > 0)
    has_boundary = sum(1 for z in zones if z.get('boundaryCoordinates'))
    print(f"Has geo coords: {has_coords}/{len(zones)}")
    print(f"Has area (sqm>0): {has_area}/{len(zones)}")
    print(f"Has boundaries: {has_boundary}/{len(zones)}")

    # Sample
    if zones:
        z = zones[0]
        print(f"Sample: code={z.get('zoneCode')}, type={z.get('zoneType')}, "
              f"area={z.get('areaHectares', 0):.2f}ha, "
              f"center=({z.get('centerLat', 0):.4f}, {z.get('centerLng', 0):.4f})")
        bc = z.get('boundaryCoordinates')
        if isinstance(bc, str):
            bc = json.loads(bc)
        if bc and isinstance(bc, list):
            print(f"  Boundary points: {len(bc)}, first={bc[0]}")

    return types


def check_entity_mapping(zones, label):
    if not zones:
        return
    z = zones[0]
    print(f"\n{label} DB entity field mapping:")
    for entity_f, json_f in ENTITY_FIELDS.items():
        val = z.get(json_f, 'MISSING')
        status = 'OK' if val != 'MISSING' else 'MISSING'
        print(f"  {entity_f} <- {json_f}: {status}")


def main():
    soil_img = r"E:\Agriplanner\map\Cà Mau_Thổ Nhưỡng.png"
    plan_img = r"E:\Agriplanner\map\Cà Mau_Quy Hoạch.png"
    soil_out = r"E:\Agriplanner\backend\python\test_soil_output.json"
    plan_out = r"E:\Agriplanner\backend\python\test_plan_output.json"

    # ====== TEST 1: SOIL ======
    print("=" * 60)
    print("TEST 1: SOIL MAP ANALYSIS (Tho nhung)")
    print("=" * 60)

    result_soil = analyze_map_image(
        soil_img, soil_out, extract_legend=True, max_dimension=2000,
        geo_bounds=GEO_BOUNDS_SOIL, map_type='soil'
    )
    zones_soil = result_soil.get('zones', [])
    check_zones(zones_soil, "soil")

    # Soil statistics
    stats = result_soil.get('soilStatistics', [])
    print(f"\nSoil statistics ({len(stats)} types):")
    for s in stats:
        print(f"  {s['zoneCode']}: {s['zoneCount']} zones, "
              f"{s['totalAreaPercent']:.2f}%, "
              f"{s.get('totalAreaHectares', 0):.2f} ha")

    check_entity_mapping(zones_soil, "Soil")

    # ====== TEST 2: PLANNING ======
    print("\n" + "=" * 60)
    print("TEST 2: PLANNING MAP ANALYSIS (Quy hoach)")
    print("=" * 60)

    result_plan = analyze_map_image(
        plan_img, plan_out, extract_legend=False, max_dimension=3000,
        geo_bounds=GEO_BOUNDS_PLAN, map_type='planning'
    )
    zones_plan = result_plan.get('zones', [])
    check_zones(zones_plan, "planning")

    # Planning statistics
    stats2 = result_plan.get('soilStatistics', [])
    print(f"\nPlanning statistics ({len(stats2)} types):")
    for s in stats2:
        print(f"  {s['zoneCode']}: {s['zoneCount']} zones, "
              f"{s['totalAreaPercent']:.2f}%, "
              f"{s.get('totalAreaHectares', 0):.2f} ha")

    check_entity_mapping(zones_plan, "Planning")

    # ====== SUMMARY ======
    print("\n" + "=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)
    
    soil_ok = len(zones_soil) > 0 and all(
        z.get('zoneType') and not z['zoneType'].startswith('UNCL') for z in zones_soil
    )
    plan_ok = len(zones_plan) > 0 and all(
        z.get('zoneType') and not z['zoneType'].startswith('UNCL') for z in zones_plan
    )

    print(f"Soil:     {len(zones_soil)} zones, {len(stats)} types => {'PASS' if soil_ok else 'FAIL'}")
    print(f"Planning: {len(zones_plan)} zones, {len(stats2)} types => {'PASS' if plan_ok else 'FAIL'}")
    print(f"Overall:  {'ALL TESTS PASSED' if soil_ok and plan_ok else 'SOME TESTS FAILED'}")


if __name__ == '__main__':
    main()
