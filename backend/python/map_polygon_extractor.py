#!/usr/bin/env python3
"""
Map Polygon Extractor - Hybrid Approach
Sử dụng OpenCV để tách các vùng màu và tạo polygon chính xác.
AI chỉ cần đọc legend và gán nhãn cho các màu.

Usage:
    python map_polygon_extractor.py <input_image> <output_json>
    python map_polygon_extractor.py <input_image> <output_json> --with-legend
"""

import cv2
import numpy as np
import json
import sys
import os
from pathlib import Path
from collections import Counter

def log(message):
    """Print log message"""
    print(f"[MapExtractor] {message}", flush=True)

def rgb_to_hex(rgb):
    """Convert RGB tuple to hex string"""
    return "#{:02x}{:02x}{:02x}".format(int(rgb[0]), int(rgb[1]), int(rgb[2]))

def hex_to_rgb(hex_color):
    """Convert hex string to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def quantize_colors(image, n_colors=12):
    """
    Giảm số lượng màu trong ảnh xuống n_colors màu chính.
    Giúp gom các vùng màu tương tự thành một.
    """
    # Resize for faster processing
    h, w = image.shape[:2]
    max_dim = 500  # Process at smaller size for speed
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        image = cv2.resize(image, (int(w * scale), int(h * scale)))
    
    # Reshape for k-means
    pixels = image.reshape(-1, 3).astype(np.float32)
    
    # K-means clustering with fewer iterations for speed
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
    try:
        _, labels, centers = cv2.kmeans(pixels, n_colors, None, criteria, 5, cv2.KMEANS_RANDOM_CENTERS)
    except Exception as e:
        log(f"K-means failed: {e}, using simple color extraction")
        return image, None
    
    # Convert centers to uint8
    centers = np.uint8(centers)
    
    return image, centers

def get_dominant_colors(image, n_colors=10, min_percentage=1.0):
    """
    Lấy danh sách các màu chiếm diện tích đáng kể trong ảnh.
    Loại bỏ các màu quá gần trắng/đen (nền, viền).
    """
    # Quantize first
    quantized, centers = quantize_colors(image, n_colors * 2)
    
    # Count pixels for each color
    pixels = quantized.reshape(-1, 3)
    total_pixels = len(pixels)
    
    # Convert to tuples for counting
    pixel_tuples = [tuple(p) for p in pixels]
    color_counts = Counter(pixel_tuples)
    
    dominant = []
    for color, count in color_counts.most_common():
        percentage = (count / total_pixels) * 100
        
        if percentage < min_percentage:
            continue
            
        # Skip colors too close to white (background)
        r, g, b = color
        if r > 240 and g > 240 and b > 240:
            continue
        # Skip colors too close to black (borders)
        if r < 15 and g < 15 and b < 15:
            continue
        # Skip grayscale (text, lines)
        if abs(r - g) < 10 and abs(g - b) < 10 and abs(r - b) < 10:
            continue
            
        dominant.append({
            'rgb': [int(r), int(g), int(b)],
            'hex': rgb_to_hex((r, g, b)),
            'percentage': round(percentage, 2),
            'pixel_count': count
        })
    
    return dominant[:n_colors]

def create_color_mask(image, target_rgb, tolerance=25):
    """
    Tạo mask cho một màu cụ thể với độ chấp nhận sai số.
    """
    lower = np.array([max(0, c - tolerance) for c in target_rgb])
    upper = np.array([min(255, c + tolerance) for c in target_rgb])
    
    mask = cv2.inRange(image, lower, upper)
    
    # Clean up mask
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    
    return mask

def simplify_contour(contour, max_points=20):
    """
    Đơn giản hóa contour để giảm số điểm xuống tối đa max_points.
    Giúp giảm kích thước JSON output đáng kể.
    """
    # Start with small epsilon and increase until we get <= max_points
    arc_length = cv2.arcLength(contour, True)
    for factor in [0.001, 0.002, 0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.1]:
        epsilon = factor * arc_length
        simplified = cv2.approxPolyDP(contour, epsilon, True)
        if len(simplified) <= max_points:
            return simplified
    # If still too many points, return with highest simplification
    epsilon = 0.15 * arc_length
    return cv2.approxPolyDP(contour, epsilon, True)

def contour_to_polygon(contour, image_shape, geo_bounds=None):
    """
    Chuyển contour thành list tọa độ polygon.
    Nếu có geo_bounds thì chuyển trực tiếp sang lat/lng.
    geo_bounds = {'sw': {'lat': x, 'lng': y}, 'ne': {'lat': x, 'lng': y}}
    """
    h, w = image_shape[:2]
    points = []
    
    for point in contour:
        px, py = point[0]
        # Normalize to 0-1
        nx = px / w
        ny = py / h
        
        if geo_bounds:
            # Transform to geo coordinates
            sw_lat = geo_bounds['sw']['lat']
            sw_lng = geo_bounds['sw']['lng']
            ne_lat = geo_bounds['ne']['lat']
            ne_lng = geo_bounds['ne']['lng']
            
            # Map pixel coords to geo coords
            # Note: y increases downward in image, but lat increases upward
            lat = ne_lat - ny * (ne_lat - sw_lat)
            lng = sw_lng + nx * (ne_lng - sw_lng)
            points.append([round(lat, 6), round(lng, 6)])
        else:
            # Return normalized 0-1 coords
            points.append([round(nx, 6), round(ny, 6)])
    
    return points

def extract_polygons_for_color(image, color_info, min_area_percent=0.1, geo_bounds=None, max_points=20):
    """
    Trích xuất tất cả polygon cho một màu cụ thể.
    Output format: ready for planning_zones table.
    """
    h, w = image.shape[:2]
    total_pixels = h * w
    min_area = total_pixels * (min_area_percent / 100)
    
    target_rgb = color_info['rgb']
    mask = create_color_mask(image, target_rgb)
    
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    polygons = []
    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        
        if area < min_area:
            continue
            
        # Simplify contour to max 20 points
        simplified = simplify_contour(contour, max_points=max_points)
        
        if len(simplified) < 3:  # Need at least 3 points for polygon
            continue
            
        # Convert to polygon coordinates (with geo transform if available)
        polygon_points = contour_to_polygon(simplified, image.shape, geo_bounds)
        
        # Calculate center (in geo or normalized coords)
        x, y, bw, bh = cv2.boundingRect(contour)
        center_x = (x + bw / 2) / w
        center_y = (y + bh / 2) / h
        
        if geo_bounds:
            sw_lat = geo_bounds['sw']['lat']
            sw_lng = geo_bounds['sw']['lng']
            ne_lat = geo_bounds['ne']['lat']
            ne_lng = geo_bounds['ne']['lng']
            center_lat = ne_lat - center_y * (ne_lat - sw_lat)
            center_lng = sw_lng + center_x * (ne_lng - sw_lng)
            center = {'lat': round(center_lat, 6), 'lng': round(center_lng, 6)}
        else:
            center = [round(center_x, 4), round(center_y, 4)]
        
        polygons.append({
            'areaPercent': round((area / total_pixels) * 100, 3),
            'center': center,
            'boundaryCoordinates': polygon_points,  # Match DB column name
            'pointCount': len(polygon_points)
        })
    
    return polygons

def extract_legend_region(image):
    """
    Cắt vùng legend (thường ở góc trái dưới hoặc phải dưới).
    Trả về image crop của legend để gửi cho AI đọc.
    """
    h, w = image.shape[:2]
    
    # Thử các vị trí legend phổ biến
    legend_candidates = [
        # Góc trái dưới (phổ biến nhất)
        ('left_bottom', image[int(h*0.6):h, 0:int(w*0.35)]),
        # Góc phải trên (mini map)
        ('right_top', image[0:int(h*0.3), int(w*0.7):w]),
        # Góc trái trên
        ('left_top', image[0:int(h*0.35), 0:int(w*0.3)]),
    ]
    
    # Tìm vùng có nhiều chi tiết nhất (variance cao)
    best_legend = None
    best_variance = 0
    
    for name, crop in legend_candidates:
        if crop.size == 0:
            continue
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        variance = np.var(gray)
        
        if variance > best_variance and variance > 500:  # Threshold
            best_variance = variance
            best_legend = (name, crop)
    
    return best_legend

def crop_to_map_content(image):
    """
    Tự động cắt bỏ viền trắng va các chi tiết thừa bên ngoài bản đồ.
    Tìm contour lớn nhất (khung bản đồ) và crop theo nó.
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Threshold to find black borders or map content
    # Invert because map content is usually darker than white paper
    _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
    
    # Dilate to connect broken lines
    kernel = np.ones((5,5), np.uint8)
    dilated = cv2.dilate(thresh, kernel, iterations=2)
    
    # Find contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return image, (0, 0, w, h)
        
    # Find largest contour (assumed to be the map)
    largest_contour = max(contours, key=cv2.contourArea)
    
    # If largest contour is too small (< 20% of image), return original
    if cv2.contourArea(largest_contour) < (h * w * 0.2):
        log("Warning: Largest contour too small, keeping original image")
        return image, (0, 0, w, h)
        
    # Get bounding box
    x, y, w_crop, h_crop = cv2.boundingRect(largest_contour)
    
    # Add a small padding (margin)
    padding = 10
    x = max(0, x - padding)
    y = max(0, y - padding)
    w_crop = min(w - x, w_crop + 2*padding)
    h_crop = min(h - y, h_crop + 2*padding)
    
    cropped = image[y:y+h_crop, x:x+w_crop]
    log(f"Cropped image to: {w_crop}x{h_crop} (from {w}x{h})")
    
    return cropped, (x, y, w_crop, h_crop)

def analyze_map_image(image_path, output_json_path, extract_legend=False, geo_bounds=None):
    """
    Phân tích ảnh bản đồ và trích xuất polygons theo màu.
    Output format: ready for planning_zones database table.
    """
    log(f"Loading image: {image_path}")
    
    # Read file using numpy to handle Unicode paths (OpenCV cv2.imread has issues)
    try:
        with open(image_path, 'rb') as f:
            file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    except Exception as e:
        log(f"ERROR: Cannot read file {image_path}: {e}")
        return None
        
    if image is None:
        log(f"ERROR: Cannot decode image {image_path}")
        return None
    
    h_orig, w_orig = image.shape[:2]
    
    # Step 0: Auto-crop to remove borders/legends
    log("Step 0: Auto-cropping map content...")
    image, crop_rect = crop_to_map_content(image)
    h, w = image.shape[:2]
    
    # Adjust geo_bounds if cropping happened? 
    # Actually, geo_bounds usually applies to the INTERIOR map content, which we just cropped to.
    # So if GPT-4o read coordinates from the corners of this inner map, we are good.
    # If GPT-4o read from the outer paper corners, we might have a slight shift, 
    # but usually the coordinates are printed ON the map frame line.
    
    log(f"Processing image size: {w}x{h}")
    
    # Step 1: Get dominant colors (limit to 15 - will be split across AIs)
    log("Step 1: Detecting dominant colors...")
    colors = get_dominant_colors(image, n_colors=15, min_percentage=0.5)
    log(f"  Found {len(colors)} significant colors")
    
    # Step 2: Extract polygons for each color (max 20 points per polygon)
    log("Step 2: Extracting polygons for each color (max 20 points)...")
    zones = []
    zone_id = 1
    
    for color in colors:
        log(f"  Processing color {color['hex']} ({color['percentage']}%)...")
        polygons = extract_polygons_for_color(
            image, color, 
            min_area_percent=0.05, 
            geo_bounds=geo_bounds,
            max_points=20
        )
        
        for polygon in polygons:
            # Output matches planning_zones table columns
            zones.append({
                'id': zone_id,
                'name': f"Zone {zone_id}",
                # From OpenCV
                'fillColor': color['hex'],  # fill_color in DB
                'colorRgb': color['rgb'],
                'areaPercent': polygon['areaPercent'],
                'centerLat': polygon['center']['lat'] if isinstance(polygon['center'], dict) else None,
                'centerLng': polygon['center']['lng'] if isinstance(polygon['center'], dict) else None,
                'center': polygon['center'],  # Fallback for normalized coords
                'boundaryCoordinates': json.dumps(polygon['boundaryCoordinates']),  # JSON string for DB
                'pointCount': polygon['pointCount'],
                # Placeholder for AI to fill
                'zoneType': None,      # zone_type - loại đất
                'zoneCode': None,      # zone_code - mã LUC, NTS, etc
                'landUsePurpose': None # land_use_purpose
            })
            zone_id += 1
    
    log(f"  Total zones extracted: {len(zones)}")
    
    # Step 3: Extract legend if requested
    legend_base64 = None
    legend_info = None
    
    if extract_legend:
        log("Step 3: Extracting legend region...")
        legend_result = extract_legend_region(image)
        
        if legend_result:
            legend_name, legend_crop = legend_result
            legend_path = output_json_path.replace('.json', '_legend.jpg')
            cv2.imwrite(legend_path, legend_crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
            log(f"  Legend saved to: {legend_path}")
            
            # Convert to base64 for API
            import base64
            _, buffer = cv2.imencode('.jpg', legend_crop)
            legend_base64 = base64.b64encode(buffer).decode('utf-8')
            legend_info = {
                'position': legend_name,
                'path': legend_path,
                'base64': legend_base64
            }
    
    # Build result
    result = {
        'success': True,
        'imageSize': {'width': w, 'height': h},
        'colorSummary': [
            {'color': c['hex'], 'percentage': c['percentage']} 
            for c in colors
        ],
        'totalZones': len(zones),
        'zones': zones,
        'legend': legend_info
    }
    
    # Save JSON
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    log(f"Result saved to: {output_json_path}")
    
    # Also print compact JSON for Java to parse
    print("===JSON_START===")
    print(json.dumps(result, ensure_ascii=False))
    print("===JSON_END===")
    
    return result

import argparse

def main():
    parser = argparse.ArgumentParser(description="Map Polygon Extractor (OpenCV)")
    parser.add_argument("input_path", help="Path to input image file")
    parser.add_argument("output_path", help="Path to save output JSON")
    parser.add_argument("--with-legend", action="store_true", help="Extract legend region")
    parser.add_argument("--geo-bounds", help="JSON string of geometric bounds (sw, ne, center)")

    args = parser.parse_args()
    
    input_path = args.input_path
    output_path = args.output_path
    extract_legend = args.with_legend
    
    geo_bounds = None
    if args.geo_bounds:
        try:
            # Handle potential shell quoting issues
            json_str = args.geo_bounds.strip()
            if (json_str.startswith("'") and json_str.endswith("'")) or \
               (json_str.startswith('"') and json_str.endswith('"')):
                json_str = json_str[1:-1]
            geo_bounds = json.loads(json_str)
            log(f"Received geo bounds: {geo_bounds}")
        except Exception as e:
            log(f"Error parsing geo bounds: {e}")

    if not os.path.exists(input_path):
        log(f"ERROR: File not found: {input_path}")
        sys.exit(1)
    
    result = analyze_map_image(input_path, output_path, extract_legend, geo_bounds)
    
    if result:
        log(f"SUCCESS: Extracted {result['totalZones']} zones")
        sys.exit(0)
    else:
        log("FAILED: Could not analyze image")
        sys.exit(1)

if __name__ == "__main__":
    main()
