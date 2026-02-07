#!/usr/bin/env python3
"""
Complete Soil Zone Detection - Covers ALL color regions
Uses higher tolerance and processes all distinct colors in the map
Runs on original image to preserve all map details
"""

import cv2
import numpy as np
import sys
import os
import json
from scipy.interpolate import splprep, splev

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ca_mau_soil_data import CA_MAU_SOIL_TYPES

# Fix Unicode encoding
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

def log(message):
    try:
        print(f"[ZoneDetector] {message}", flush=True)
    except:
        pass


def smooth_contour_spline(contour, num_points=80, smoothing=2):
    """Smooth contour using B-spline interpolation"""
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


def detect_all_zones(image_path, output_path, tolerance=45, min_area_pct=0.01):
    """
    Detect soil zones covering ALL color regions.
    Key improvements:
    1. Higher tolerance for better color matching
    2. Uses LAB color space for better perceptual matching
    3. Morphological closing to merge nearby same-color regions
    4. Draws boundaries on ALL detected regions
    """
    log(f"Loading: {image_path}")
    
    # Load image
    try:
        with open(image_path, 'rb') as f:
            file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    except:
        image = cv2.imread(image_path)
    
    if image is None:
        log("ERROR: Failed to load image")
        return None
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image_lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)  # LAB for better color matching
    h, w = image.shape[:2]
    total_pixels = h * w
    min_area = int(total_pixels * (min_area_pct / 100))
    
    log(f"Image: {w}x{h} = {total_pixels:,} pixels")
    log(f"Min area: {min_area_pct}% = {min_area:,} pixels")
    log(f"Color tolerance: {tolerance}")
    
    # Create output image
    output = image.copy()
    
    # Track assigned pixels
    assigned_mask = np.zeros((h, w), dtype=np.uint8)
    
    # Statistics
    all_zones = []
    total_zones = 0
    
    # Sort by percentage (largest first)
    sorted_soil_types = sorted(
        [(k, v) for k, v in CA_MAU_SOIL_TYPES.items() if v.get('percentage', 0) > 0],
        key=lambda x: x[1]['percentage'],
        reverse=True
    )
    
    log(f"Processing {len(sorted_soil_types)} soil types...")
    
    for soil_key, soil_data in sorted_soil_types:
        name = soil_data["name_vi"]
        
        # Create mask for this soil type (using multiple color refs)
        combined_mask = np.zeros((h, w), dtype=np.uint8)
        
        for ref_color in soil_data["colors"]:
            # Convert reference color to LAB
            ref_rgb = np.array([[ref_color]], dtype=np.uint8)
            ref_lab = cv2.cvtColor(ref_rgb, cv2.COLOR_RGB2LAB)[0, 0]
            
            # Calculate distance in LAB space (more perceptually uniform)
            diff_lab = image_lab.astype(np.float32) - ref_lab.astype(np.float32)
            # Weight L less, a and b more for color matching
            distance = np.sqrt(
                (diff_lab[:, :, 0] * 0.5) ** 2 +  # L - lightness
                (diff_lab[:, :, 1] * 1.2) ** 2 +  # a - green-red
                (diff_lab[:, :, 2] * 1.2) ** 2    # b - blue-yellow
            )
            
            color_mask = (distance <= tolerance).astype(np.uint8) * 255
            combined_mask = cv2.bitwise_or(combined_mask, color_mask)
        
        # Remove already assigned pixels
        combined_mask = cv2.bitwise_and(combined_mask, cv2.bitwise_not(assigned_mask))
        
        if cv2.countNonZero(combined_mask) == 0:
            continue
        
        # Strong morphological operations to merge regions and fill gaps
        kernel = np.ones((7, 7), np.uint8)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        
        # Connected component analysis
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
            combined_mask, connectivity=8
        )
        
        zone_count = 0
        total_area = 0
        
        for label_idx in range(1, num_labels):
            area = stats[label_idx, cv2.CC_STAT_AREA]
            
            if area < min_area:
                continue
            
            # Create mask for this component
            component_mask = (labels == label_idx).astype(np.uint8) * 255
            
            # Find outer contour only
            contours, _ = cv2.findContours(
                component_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            
            if not contours:
                continue
            
            contour = max(contours, key=cv2.contourArea)
            
            if len(contour) < 5:
                continue
            
            zone_count += 1
            total_area += area
            
            # Mark as assigned
            assigned_mask = cv2.bitwise_or(assigned_mask, component_mask)
            
            # Smooth contour
            num_pts = min(150, max(30, len(contour)))
            smoothed = smooth_contour_spline(contour, num_points=num_pts, smoothing=1)
            
            if smoothed is None or len(smoothed) < 3:
                smoothed = contour
            
            # Draw boundary
            pts = smoothed.reshape(-1, 2)
            cv2.polylines(output, [pts], isClosed=True, 
                         color=(30, 30, 30), thickness=2, lineType=cv2.LINE_AA)
            
            # Store zone info
            cx, cy = centroids[label_idx]
            all_zones.append({
                "soil_type": soil_key,
                "name": name,
                "area_pixels": int(area),
                "area_percent": area / total_pixels * 100,
                "center": [float(cx), float(cy)]
            })
        
        if zone_count > 0:
            area_pct = (total_area / total_pixels) * 100
            total_zones += zone_count
            log(f"  {name[:38]:38} | {zone_count:4} zones | {area_pct:5.1f}%")
    
    # Summary
    log(f"\n{'='*60}")
    log(f"SUMMARY: {len(sorted_soil_types)} soil types, {total_zones} unified zones")
    total_coverage = sum(z['area_percent'] for z in all_zones)
    log(f"Coverage: {total_coverage:.1f}%")
    log(f"Assigned pixels: {cv2.countNonZero(assigned_mask):,} / {total_pixels:,}")
    
    # Save output
    cv2.imwrite(output_path, output)
    log(f"Saved: {output_path}")
    
    # Save JSON
    json_path = output_path.rsplit('.', 1)[0] + "_zones.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump({
            "total_zones": total_zones,
            "total_coverage_percent": total_coverage,
            "zones": all_zones
        }, f, ensure_ascii=False, indent=2)
    log(f"Zone data: {json_path}")
    
    return output, all_zones


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python complete_zone_detector.py <input_image> [output_image]")
        print("Options:")
        print("  --tolerance N    Color tolerance (default: 45)")
        print("  --min-area N     Min area percentage (default: 0.01)")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else input_path.rsplit('.', 1)[0] + "_complete_zones.jpg"
    
    tolerance = 45
    min_area = 0.01
    
    for i, arg in enumerate(sys.argv):
        if arg == "--tolerance" and i + 1 < len(sys.argv):
            tolerance = int(sys.argv[i + 1])
        if arg == "--min-area" and i + 1 < len(sys.argv):
            min_area = float(sys.argv[i + 1])
    
    detect_all_zones(input_path, output_path, tolerance=tolerance, min_area_pct=min_area)
