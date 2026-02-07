#!/usr/bin/env python3
"""
Universal Color Zone Detector
Finds ALL distinct color regions on the map and draws boundaries around them
Uses color quantization to identify similar colors and group them
Then finds connected components for each quantized color group
"""

import cv2
import numpy as np
import sys
import os
import json
from scipy.interpolate import splprep, splev
from collections import Counter

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
        print(f"[UniversalZone] {message}", flush=True)
    except:
        pass


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


def classify_color(rgb, tolerance=35):
    """Find best matching soil type for given RGB"""
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
                best_match = (soil_key, soil_data, best_distance)
    
    if best_match and best_distance <= tolerance * 2:
        return best_match[0], best_match[1]
    return None, None


def detect_universal_zones(image_path, output_path, n_colors=32, min_area_pct=0.01):
    """
    Detect ALL color zones using color quantization.
    1. Quantize image colors to n_colors
    2. For each quantized color, find connected components
    3. Draw boundaries around each component
    4. Try to classify each zone by matching to known soil types
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
    log(f"Color quantization: {n_colors} colors")
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    output = image.copy()
    
    # Step 1: Filter out non-soil elements
    # Remove white (background)
    white_mask = cv2.inRange(image_rgb, np.array([240, 240, 240]), np.array([255, 255, 255]))
    
    # Remove black/dark (borders, text)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, black_mask = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY_INV)
    
    # Remove red (roads)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    red_mask1 = cv2.inRange(hsv, np.array([0, 80, 80]), np.array([10, 255, 255]))
    red_mask2 = cv2.inRange(hsv, np.array([160, 80, 80]), np.array([180, 255, 255]))
    red_mask = cv2.bitwise_or(red_mask1, red_mask2)
    
    # Combined exclude mask
    exclude_mask = cv2.bitwise_or(white_mask, black_mask)
    exclude_mask = cv2.bitwise_or(exclude_mask, red_mask)
    
    # Valid pixels mask (soil regions only)
    valid_mask = cv2.bitwise_not(exclude_mask)
    
    log(f"Valid soil pixels: {cv2.countNonZero(valid_mask):,} ({cv2.countNonZero(valid_mask)*100/total_pixels:.1f}%)")
    
    # Step 2: Color quantization using K-means
    log("Performing color quantization...")
    
    # Get valid pixels for clustering
    valid_pixels = image_rgb[valid_mask > 0]
    
    if len(valid_pixels) < 100:
        log("ERROR: Too few valid pixels")
        return None
    
    # Sample for speed
    sample_size = min(500000, len(valid_pixels))
    indices = np.random.choice(len(valid_pixels), sample_size, replace=False)
    samples = valid_pixels[indices].astype(np.float32)
    
    # K-means clustering
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, labels_sample, centers = cv2.kmeans(samples, n_colors, None, criteria, 10, cv2.KMEANS_PP_CENTERS)
    centers = centers.astype(np.uint8)
    
    log(f"Found {len(centers)} color clusters")
    
    # Step 3: Assign each pixel to nearest cluster (memory-efficient)
    log("Assigning pixels to clusters...")
    
    centers_float = centers.astype(np.float32)
    labels_full = np.zeros((h, w), dtype=np.int32)
    
    # Process in chunks to avoid memory issues
    chunk_size = 1000  # rows at a time
    for start_row in range(0, h, chunk_size):
        end_row = min(start_row + chunk_size, h)
        chunk = image_rgb[start_row:end_row].reshape(-1, 3).astype(np.float32)
        
        # Calculate distances for this chunk
        distances = np.zeros((len(chunk), len(centers)), dtype=np.float32)
        for i, center in enumerate(centers_float):
            diff = chunk - center
            distances[:, i] = np.sum(diff ** 2, axis=1)
        
        # Assign to nearest
        labels_chunk = np.argmin(distances, axis=1)
        labels_full[start_row:end_row] = labels_chunk.reshape(end_row - start_row, w)
    
    # Mask out invalid pixels
    labels_full[valid_mask == 0] = -1
    
    # Step 4: Process each color cluster
    log("Processing color clusters...")
    
    all_zones = []
    zone_count = 0
    soil_type_stats = {}
    
    for cluster_idx in range(len(centers)):
        cluster_color = tuple(centers[cluster_idx])
        
        # Create mask for this cluster
        cluster_mask = (labels_full == cluster_idx).astype(np.uint8) * 255
        
        if cv2.countNonZero(cluster_mask) == 0:
            continue
        
        # Morphological cleanup
        kernel = np.ones((5, 5), np.uint8)
        cluster_mask = cv2.morphologyEx(cluster_mask, cv2.MORPH_CLOSE, kernel)
        cluster_mask = cv2.morphologyEx(cluster_mask, cv2.MORPH_OPEN, kernel)
        
        # Find connected components
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
            cluster_mask, connectivity=8
        )
        
        for label_idx in range(1, num_labels):
            area = stats[label_idx, cv2.CC_STAT_AREA]
            
            if area < min_area:
                continue
            
            # Create zone mask
            zone_mask = (labels == label_idx).astype(np.uint8) * 255
            
            # Classify by representative color
            soil_key, soil_data = classify_color(cluster_color)
            
            if soil_data:
                name = soil_data["name_vi"]
            else:
                name = f"Màu RGB{cluster_color}"
                soil_key = f"COLOR_{cluster_color[0]}_{cluster_color[1]}_{cluster_color[2]}"
            
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
                soil_type_stats[soil_key] = {"name": name, "count": 0, "area": 0, "color": cluster_color}
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
            
            cx, cy = centroids[label_idx]
            all_zones.append({
                "soil_type": soil_key,
                "name": name,
                "area_pixels": int(area),
                "area_percent": area / total_pixels * 100,
                "center": [float(cx), float(cy)],
                "color": list(cluster_color)
            })
    
    # Summary
    log(f"\n{'='*60}")
    log(f"SUMMARY: {zone_count} zones detected from {n_colors} color clusters")
    
    sorted_stats = sorted(soil_type_stats.items(), key=lambda x: x[1]['area'], reverse=True)
    for soil_key, stats_data in sorted_stats[:20]:  # Top 20
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
        print("Usage: python universal_zone_detector.py <input_image> [output_image]")
        print("Options:")
        print("  --n-colors N     Number of color clusters (default: 32)")
        print("  --min-area N     Min area percentage (default: 0.01)")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else input_path.rsplit('.', 1)[0] + "_universal_zones.jpg"
    
    n_colors = 32
    min_area = 0.01
    
    for i, arg in enumerate(sys.argv):
        if arg == "--n-colors" and i + 1 < len(sys.argv):
            n_colors = int(sys.argv[i + 1])
        if arg == "--min-area" and i + 1 < len(sys.argv):
            min_area = float(sys.argv[i + 1])
    
    detect_universal_zones(input_path, output_path, n_colors=n_colors, min_area_pct=min_area)
