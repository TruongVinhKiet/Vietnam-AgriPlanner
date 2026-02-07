#!/usr/bin/env python3
"""
Edge-Based Zone Detection
Uses actual map boundary lines (black contours drawn on map) to find zones
Then classifies each zone by its dominant color
"""

import cv2
import numpy as np
import sys
import os
import json
from scipy.interpolate import splprep, splev

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ca_mau_soil_data import CA_MAU_SOIL_TYPES

# Fix Unicode
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

def log(message):
    try:
        print(f"[EdgeDetector] {message}", flush=True)
    except:
        pass


def get_dominant_color(image_rgb, mask):
    """Get the most common color in the masked region"""
    pixels = image_rgb[mask > 0]
    if len(pixels) == 0:
        return None
    
    # Use median for stability
    return (int(np.median(pixels[:, 0])),
            int(np.median(pixels[:, 1])),
            int(np.median(pixels[:, 2])))


def classify_color(rgb, tolerance=25):
    """Find best matching soil type for given RGB color"""
    if rgb is None:
        return None, None
    
    r, g, b = rgb
    best_match = None
    best_distance = float('inf')
    
    for soil_key, soil_data in CA_MAU_SOIL_TYPES.items():
        if soil_data.get("percentage", 0) == 0:
            continue
        
        for ref_color in soil_data["colors"]:
            ref_r, ref_g, ref_b = ref_color
            distance = ((r - ref_r) ** 2 + (g - ref_g) ** 2 + (b - ref_b) ** 2) ** 0.5
            
            if distance < best_distance:
                best_distance = distance
                best_match = (soil_key, soil_data)
    
    if best_match and best_distance <= tolerance * 2:  # Relaxed for classification only
        return best_match
    return None, None


def smooth_contour_spline(contour, num_points=80, smoothing=2):
    """Smooth contour using B-spline"""
    try:
        if contour is None or len(contour) < 5:
            return contour
        
        points = contour.reshape(-1, 2)
        if len(points) < 5:
            return contour
        
        x = points[:, 0].astype(float)
        y = points[:, 1].astype(float)
        
        try:
            tck, u = splprep([x, y], s=smoothing * len(points), per=True, k=3)
            u_new = np.linspace(0, 1, num_points)
            x_new, y_new = splev(u_new, tck)
            smooth_points = np.column_stack([x_new, y_new]).astype(np.int32)
            return smooth_points.reshape(-1, 1, 2)
        except:
            epsilon = 0.005 * cv2.arcLength(contour, True)
            return cv2.approxPolyDP(contour, epsilon, True)
    except:
        return contour


def detect_edge_zones(image_path, output_path, min_area_pct=0.01):
    """
    Detect zones using edge detection rather than color matching.
    Steps:
    1. Find black/dark boundary lines on the map
    2. Remove them to create clean color regions
    3. Use watershed or connected components to find zones
    4. Classify each zone by its dominant color
    """
    log(f"Loading: {image_path}")
    
    try:
        with open(image_path, 'rb') as f:
            file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    except:
        image = cv2.imread(image_path)
    
    if image is None:
        log("ERROR: Failed to load image")
        return None
    
    h, w = image.shape[:2]
    total_pixels = h * w
    min_area = int(total_pixels * (min_area_pct / 100))
    
    log(f"Image: {w}x{h} = {total_pixels:,} pixels")
    log(f"Min area: {min_area_pct}% = {min_area:,} pixels")
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    output = image.copy()
    
    # Step 1: Detect black/dark boundary lines
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Black lines (including dashed lines, borders)
    _, black_mask = cv2.threshold(gray, 60, 255, cv2.THRESH_BINARY_INV)
    
    # Also detect red lines (roads)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    red_mask1 = cv2.inRange(hsv, np.array([0, 100, 100]), np.array([10, 255, 255]))
    red_mask2 = cv2.inRange(hsv, np.array([160, 100, 100]), np.array([180, 255, 255]))
    red_mask = cv2.bitwise_or(red_mask1, red_mask2)
    
    # Combine boundary masks
    boundary_mask = cv2.bitwise_or(black_mask, red_mask)
    
    # Dilate boundaries slightly to ensure they separate regions
    boundary_mask = cv2.dilate(boundary_mask, np.ones((3, 3), np.uint8), iterations=2)
    
    log(f"Boundary pixels: {cv2.countNonZero(boundary_mask):,}")
    
    # Step 2: Create region mask (non-boundary areas)
    region_mask = cv2.bitwise_not(boundary_mask)
    
    # Remove white areas (outside map)
    white_mask = cv2.inRange(image_rgb, np.array([240, 240, 240]), np.array([255, 255, 255]))
    region_mask = cv2.bitwise_and(region_mask, cv2.bitwise_not(white_mask))
    
    # Clean up
    kernel = np.ones((5, 5), np.uint8)
    region_mask = cv2.morphologyEx(region_mask, cv2.MORPH_CLOSE, kernel)
    region_mask = cv2.morphologyEx(region_mask, cv2.MORPH_OPEN, kernel)
    
    log(f"Region pixels: {cv2.countNonZero(region_mask):,}")
    
    # Step 3: Find connected components (each = one zone)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        region_mask, connectivity=4  # 4-connectivity to respect boundaries
    )
    
    log(f"Raw zones found: {num_labels - 1}")
    
    # Step 4: Process each zone
    all_zones = []
    zone_count = 0
    soil_type_stats = {}
    
    for label_idx in range(1, num_labels):
        area = stats[label_idx, cv2.CC_STAT_AREA]
        
        if area < min_area:
            continue
        
        # Create mask for this zone
        zone_mask = (labels == label_idx).astype(np.uint8) * 255
        
        # Get dominant color
        dom_color = get_dominant_color(image_rgb, zone_mask)
        
        # Classify by color
        soil_key, soil_data = classify_color(dom_color, tolerance=30)
        
        if soil_data is None:
            name = "Không xác định"
            soil_key = "UNKNOWN"
        else:
            name = soil_data["name_vi"]
        
        # Find contour
        contours, _ = cv2.findContours(zone_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            continue
        
        contour = max(contours, key=cv2.contourArea)
        
        if len(contour) < 5:
            continue
        
        zone_count += 1
        
        # Track stats
        if soil_key not in soil_type_stats:
            soil_type_stats[soil_key] = {"name": name, "count": 0, "area": 0}
        soil_type_stats[soil_key]["count"] += 1
        soil_type_stats[soil_key]["area"] += area
        
        # Smooth and draw
        num_pts = min(150, max(30, len(contour)))
        smoothed = smooth_contour_spline(contour, num_points=num_pts, smoothing=1)
        
        if smoothed is None or len(smoothed) < 3:
            smoothed = contour
        
        pts = smoothed.reshape(-1, 2)
        cv2.polylines(output, [pts], isClosed=True, 
                     color=(30, 30, 30), thickness=2, lineType=cv2.LINE_AA)
        
        # Store info
        cx, cy = centroids[label_idx]
        all_zones.append({
            "soil_type": soil_key,
            "name": name,
            "area_pixels": int(area),
            "area_percent": area / total_pixels * 100,
            "center": [float(cx), float(cy)],
            "dominant_color": dom_color
        })
    
    # Summary
    log(f"\n{'='*60}")
    log(f"SUMMARY: {zone_count} zones detected")
    
    # Print by soil type
    sorted_stats = sorted(soil_type_stats.items(), key=lambda x: x[1]['area'], reverse=True)
    for soil_key, stats_data in sorted_stats:
        area_pct = (stats_data["area"] / total_pixels) * 100
        log(f"  {stats_data['name'][:38]:38} | {stats_data['count']:4} zones | {area_pct:5.1f}%")
    
    total_coverage = sum(z['area_percent'] for z in all_zones)
    log(f"Total coverage: {total_coverage:.1f}%")
    
    # Save
    cv2.imwrite(output_path, output)
    log(f"Saved: {output_path}")
    
    json_path = output_path.rsplit('.', 1)[0] + "_zones.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({
            "total_zones": zone_count,
            "total_coverage_percent": total_coverage,
            "zones": all_zones
        }, f, ensure_ascii=False, indent=2)
    log(f"JSON: {json_path}")
    
    return output, all_zones


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python edge_zone_detector.py <input_image> [output_image]")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else input_path.rsplit('.', 1)[0] + "_edge_zones.jpg"
    
    min_area = 0.005
    
    for i, arg in enumerate(sys.argv):
        if arg == "--min-area" and i + 1 < len(sys.argv):
            min_area = float(sys.argv[i + 1])
    
    detect_edge_zones(input_path, output_path, min_area_pct=min_area)
