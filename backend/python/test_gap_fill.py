"""
Test script: Verify gap-fill algorithm eliminates white spots.
Runs both soil and planning analysis, renders output images with colored zones,
and checks for remaining unclassified (white) pixels within the content area.

Outputs:
  - test_gapfill_soil.png: Colored soil zones overlaid on content mask
  - test_gapfill_planning.png: Colored planning zones overlaid on content mask
  - Console report: pixel counts, coverage %, white pixel locations
"""
import sys
import os
import json
import numpy as np
import cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from map_polygon_extractor import analyze_map_image

# === Config ===
SOIL_MAP = 'E:/Agriplanner/map/Cà Mau_Thổ Nhưỡng.png'
PLANNING_MAP = 'E:/Agriplanner/map/Cà Mau_Quy Hoạch.png'
GEO_BOUNDS = {'sw': {'lat': 8.5, 'lng': 104.7}, 'ne': {'lat': 9.6, 'lng': 105.35}}
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))


def hex_to_rgb(hex_color):
    """Convert #RRGGBB to (R, G, B)."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def render_zone_image(image_path, zones, output_path, map_type):
    """
    Render an image where each zone is filled with its assigned color.
    Unclassified content pixels remain WHITE for easy visual inspection.
    """
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"  ERROR: Cannot read {image_path}")
        return None, 0, 0

    # Handle alpha channel
    if img.shape[2] == 4:
        alpha = img[:, :, 3]
        content_mask = (alpha > 10).astype(np.uint8) * 255
        bgr = img[:, :, :3].copy()
        # Fill transparent areas with white
        transparent = alpha <= 10
        bgr[transparent] = [255, 255, 255]
    else:
        bgr = img.copy()
        content_mask = np.ones(img.shape[:2], dtype=np.uint8) * 255

    h, w = bgr.shape[:2]
    total_content = cv2.countNonZero(content_mask)

    # Start with white canvas for content area, black for non-content
    result = np.zeros((h, w, 3), dtype=np.uint8)
    result[content_mask > 0] = [255, 255, 255]  # White = unclassified

    # Draw each zone with its fill color
    zones_drawn = 0
    for zone in zones:
        fill_color = zone.get('fillColor', '#808080')
        r, g, b = hex_to_rgb(fill_color)

        # Parse boundary coordinates
        coords = zone.get('boundaryCoordinates', [])
        if isinstance(coords, str):
            try:
                coords = json.loads(coords)
            except:
                continue
        if not coords or len(coords) < 3:
            continue

        # Convert geo coordinates back to pixel coordinates
        points = []
        for pt in coords:
            lat = pt.get('lat', pt.get(0, 0))
            lng = pt.get('lng', pt.get(1, 0))
            sw = GEO_BOUNDS['sw']
            ne = GEO_BOUNDS['ne']
            px = int((lng - sw['lng']) / (ne['lng'] - sw['lng']) * w)
            py = int((ne['lat'] - lat) / (ne['lat'] - sw['lat']) * h)
            px = max(0, min(w - 1, px))
            py = max(0, min(h - 1, py))
            points.append([px, py])

        if len(points) >= 3:
            pts = np.array(points, dtype=np.int32).reshape((-1, 1, 2))
            cv2.fillPoly(result, [pts], (b, g, r))  # BGR
            zones_drawn += 1

    # Count white pixels in content area
    result_gray = cv2.cvtColor(result, cv2.COLOR_BGR2GRAY)
    # White = all channels > 250
    is_white = np.all(result > 250, axis=2).astype(np.uint8)
    white_in_content = cv2.bitwise_and(is_white * 255, content_mask)
    white_count = cv2.countNonZero(white_in_content)
    white_pct = 100 * white_count / total_content if total_content > 0 else 0

    # Mark remaining white pixels with RED dots for visibility
    if white_count > 0:
        wy, wx = np.where(white_in_content > 0)
        # Sample up to 5000 red markers if too many
        if len(wy) > 5000:
            indices = np.random.choice(len(wy), 5000, replace=False)
            wy, wx = wy[indices], wx[indices]
        result[wy, wx] = [0, 0, 255]  # Red markers

    # Add non-content area as dark gray
    result[content_mask == 0] = [40, 40, 40]

    # Add info text
    cv2.putText(result, f"{map_type.upper()} - {len(zones)} zones, {zones_drawn} drawn",
                (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 0), 2)
    cv2.putText(result, f"White gaps: {white_count:,} px ({white_pct:.2f}%)",
                (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.0,
                (0, 255, 0) if white_pct < 1.0 else (0, 0, 255), 2)

    # Save
    cv2.imwrite(output_path, result)
    print(f"  Output saved: {output_path}")

    return result, white_count, total_content


def test_map(map_path, map_type, output_name):
    """Run analysis and render result image."""
    print(f"\n{'='*60}")
    print(f"TEST: {map_type.upper()} MAP")
    print(f"{'='*60}")

    if not os.path.exists(map_path):
        print(f"  SKIP: File not found: {map_path}")
        return

    json_out = os.path.join(OUTPUT_DIR, f'test_gapfill_{map_type}.json')
    result = analyze_map_image(
        map_path, json_out,
        map_type=map_type,
        geo_bounds=GEO_BOUNDS
    )

    if not result or not result.get('success'):
        print(f"  FAILED: Analysis returned no result")
        return

    zones = result.get('zones', [])
    zone_types = set(z.get('zoneType', 'Unknown') for z in zones if z.get('zoneType'))
    print(f"\n  Zones: {len(zones)}")
    print(f"  Zone types: {len(zone_types)}")
    for zt in sorted(zone_types):
        count = sum(1 for z in zones if z.get('zoneType') == zt)
        area = sum(z.get('areaPercent', 0) for z in zones if z.get('zoneType') == zt)
        name = next((z.get('zoneName', zt) for z in zones if z.get('zoneType') == zt), zt)
        print(f"    {name} ({zt}): {count} zones, {area:.2f}%")

    # Render output image
    img_out = os.path.join(OUTPUT_DIR, output_name)
    _, white_count, total_content = render_zone_image(
        map_path, zones, img_out, map_type
    )

    if white_count is not None:
        white_pct = 100 * white_count / total_content if total_content > 0 else 0
        status = "PASS" if white_pct < 2.0 else "WARN" if white_pct < 5.0 else "FAIL"
        print(f"\n  Gap check: {status}")
        print(f"    White pixels: {white_count:,} / {total_content:,} content pixels")
        print(f"    Gap percentage: {white_pct:.2f}%")
        if white_pct < 2.0:
            print(f"    ✓ Gap fill SUCCESS - less than 2% unclassified")
        else:
            print(f"    ✗ Gap fill INCOMPLETE - {white_pct:.2f}% still unclassified")


if __name__ == '__main__':
    print("Gap Fill Verification Test")
    print("=" * 60)

    test_map(SOIL_MAP, 'soil', 'test_gapfill_soil.png')
    test_map(PLANNING_MAP, 'planning', 'test_gapfill_planning.png')

    print(f"\n{'='*60}")
    print("Test complete. Check output images for visual verification.")
    print(f"  - {os.path.join(OUTPUT_DIR, 'test_gapfill_soil.png')}")
    print(f"  - {os.path.join(OUTPUT_DIR, 'test_gapfill_planning.png')}")
    print("  White pixels = unclassified gaps (marked RED in images)")
