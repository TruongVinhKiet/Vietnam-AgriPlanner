#!/usr/bin/env python3
"""
Map Polygon Extractor - Hybrid Approach
Sử dụng OpenCV để tách các vùng màu và tạo polygon chính xác.
AI chỉ cần đọc legend và gán nhãn cho các màu.

Supports TWO MODES:
1. POLYGON MODE (default): Extract polygon coordinates for each color zone
2. IMAGE OVERLAY MODE (--image-overlay): Save processed map image for overlay display (like KMZ)

Usage:
    python map_polygon_extractor.py <input_image> <output_json>
    python map_polygon_extractor.py <input_image> <output_json> --with-legend
    python map_polygon_extractor.py <input_image> <output_json> --with-legend --image-overlay
"""

import cv2
import numpy as np
import json
import sys
import os
import base64
import math
from pathlib import Path
from collections import Counter

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import soil type data for classification
try:
    from ca_mau_soil_data import CA_MAU_SOIL_TYPES
    SOIL_DATA_AVAILABLE = True
except ImportError:
    CA_MAU_SOIL_TYPES = {}
    SOIL_DATA_AVAILABLE = False

# Import planning zone data for classification
try:
    from ca_mau_planning_data import CA_MAU_PLANNING_ZONES
    PLANNING_DATA_AVAILABLE = True
except ImportError:
    CA_MAU_PLANNING_ZONES = {}
    PLANNING_DATA_AVAILABLE = False

# Fix Unicode encoding for Windows console
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass  # Older Python versions

def log(message):
    """Print log message - handles Unicode safely"""
    try:
        print(f"[MapExtractor] {message}", flush=True)
    except UnicodeEncodeError:
        # Fallback: replace non-ASCII characters
        safe_msg = str(message).encode('ascii', 'replace').decode('ascii')
        print(f"[MapExtractor] {safe_msg}", flush=True)

def rgb_to_hex(rgb):
    """Convert RGB tuple to hex string"""
    return "#{:02x}{:02x}{:02x}".format(int(rgb[0]), int(rgb[1]), int(rgb[2]))

def hex_to_rgb(hex_color):
    """Convert hex string to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def classify_color_to_soil(rgb, max_distance=50):
    """
    Classify a color to a soil type based on CA_MAU_SOIL_TYPES data.
    
    Args:
        rgb: [r, g, b] color values
        max_distance: Maximum Euclidean distance for color matching
        
    Returns:
        dict with soil_type, soil_name, soil_code or None
    """
    if not SOIL_DATA_AVAILABLE or not CA_MAU_SOIL_TYPES:
        return None
    
    r, g, b = int(rgb[0]), int(rgb[1]), int(rgb[2])
    best_match = None
    best_distance = float('inf')
    
    for soil_key, soil_data in CA_MAU_SOIL_TYPES.items():
        for ref_color in soil_data.get("colors", []):
            ref_r, ref_g, ref_b = int(ref_color[0]), int(ref_color[1]), int(ref_color[2])
            # Euclidean distance in RGB space
            distance = math.sqrt((r - ref_r) ** 2 + (g - ref_g) ** 2 + (b - ref_b) ** 2)
            if distance < best_distance:
                best_distance = distance
                best_match = (soil_key, soil_data)
    
    if best_match and best_distance <= max_distance:
        soil_key, soil_data = best_match
        return {
            'soil_type': soil_key,
            'soil_name': soil_data.get('name_vi', soil_key),
            'soil_code': soil_data.get('code', '?'),
            'soil_description': soil_data.get('description', ''),
            'match_distance': round(best_distance, 2)
        }
    
    return None


def calculate_area_hectares(area_percent, geo_bounds):
    """
    Calculate area in hectares from percentage and geo bounds.
    
    Args:
        area_percent: Percentage of image area
        geo_bounds: dict with sw/ne coordinates
        
    Returns:
        dict with area in different units (ha, km2, m2)
    """
    if not geo_bounds:
        return None
    
    try:
        sw_lat = geo_bounds['sw']['lat']
        sw_lng = geo_bounds['sw']['lng']
        ne_lat = geo_bounds['ne']['lat']
        ne_lng = geo_bounds['ne']['lng']
        
        # Calculate width and height in meters using Haversine
        # Latitude: 1 degree ≈ 111,000 meters
        # Longitude: varies by latitude, ≈ 111,000 * cos(lat) meters
        lat_center = (sw_lat + ne_lat) / 2
        lat_rad = math.radians(lat_center)
        
        height_m = abs(ne_lat - sw_lat) * 111000
        width_m = abs(ne_lng - sw_lng) * 111000 * math.cos(lat_rad)
        
        total_area_m2 = width_m * height_m
        zone_area_m2 = total_area_m2 * (area_percent / 100)
        
        return {
            'area_m2': round(zone_area_m2, 2),
            'area_ha': round(zone_area_m2 / 10000, 4),  # 1 ha = 10,000 m2
            'area_km2': round(zone_area_m2 / 1000000, 6)  # 1 km2 = 1,000,000 m2
        }
    except Exception as e:
        return None

def quantize_colors(image, n_colors=16):
    """
    Giảm số lượng màu trong ảnh xuống n_colors màu chính.
    Giúp gom các vùng màu tương tự thành một.
    Returns the quantized image (same size as input).
    
    NOTE: Increased samples for PIXEL ACCURACY as required.
    """
    h, w = image.shape[:2]
    
    # Use MORE samples for better pixel accuracy (was 100000)
    max_samples = 200000
    pixels = image.reshape(-1, 3)
    
    if len(pixels) > max_samples:
        # Random sample for faster k-means
        indices = np.random.choice(len(pixels), max_samples, replace=False)
        sample_pixels = pixels[indices].astype(np.float32)
    else:
        sample_pixels = pixels.astype(np.float32)
    
    # K-means clustering
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.5)
    try:
        _, labels, centers = cv2.kmeans(sample_pixels, n_colors, None, criteria, 5, cv2.KMEANS_RANDOM_CENTERS)
    except Exception as e:
        log(f"K-means failed: {e}, using simple color extraction")
        return image, None
    
    # Convert centers to uint8
    centers = np.uint8(centers)
    
    # Now assign every pixel to nearest center (apply quantization to full image)
    # This ensures the quantized image has exactly n_colors colors
    pixels_float = pixels.astype(np.float32)
    
    # Calculate distance from each pixel to each center
    # Use broadcasting: pixels (N,3), centers (K,3) -> distances (N,K)
    diff = pixels_float[:, np.newaxis, :] - centers[np.newaxis, :, :]
    distances = np.sum(diff ** 2, axis=2)
    nearest = np.argmin(distances, axis=1)
    
    # Create quantized image
    quantized = centers[nearest].reshape(h, w, 3)
    
    return quantized, centers

def get_dominant_colors(image, n_colors=20, min_percentage=0.5):
    """
    Lấy danh sách các màu chiếm diện tích đáng kể trong ảnh.
    Loại bỏ các màu quá gần trắng/đen (nền, viền).
    min_percentage=0.5% để chỉ lấy các vùng màu lớn, tránh nhiễu.
    """
    # Quantize with MORE colors for PIXEL ACCURACY (was 32, now 48)
    quantized, centers = quantize_colors(image, min(n_colors * 2, 48))
    
    # Count pixels for each color
    pixels = quantized.reshape(-1, 3)
    total_pixels = len(pixels)
    
    # Convert to tuples for counting
    pixel_tuples = [tuple(p) for p in pixels]
    color_counts = Counter(pixel_tuples)
    
    log(f"  Color quantization found {len(color_counts)} unique colors (top 5: {list(color_counts.most_common(5))})")
    
    dominant = []
    skipped_white = 0
    skipped_black = 0
    skipped_gray = 0
    skipped_small = 0
    skipped_red = 0
    skipped_cyan = 0
    
    for color, count in color_counts.most_common():
        percentage = (count / total_pixels) * 100
        
        if percentage < min_percentage:
            skipped_small += 1
            continue
            
        # Skip colors too close to white (background)
        r, g, b = int(color[0]), int(color[1]), int(color[2])  # Convert numpy to int to avoid overflow
        if r > 240 and g > 240 and b > 240:
            skipped_white += 1
            continue
        # Skip colors too close to black (borders) - stronger filter
        if r < 30 and g < 30 and b < 30:
            skipped_black += 1
            continue
        # Skip dark borders (charcoal, dark gray)
        if max(r,g,b) < 60:
            skipped_black += 1
            continue
        # Skip grayscale (text, lines, coordinate grids)
        if abs(r - g) < 12 and abs(g - b) < 12 and abs(r - b) < 12 and min(r,g,b) < 230:
            skipped_gray += 1
            continue
        # Skip RED lines (roads on map)
        if r > 180 and g < 100 and b < 100:
            skipped_red += 1
            continue
        # Skip CYAN/blue grid lines (coordinate grid) - R low, G & B high
        if r < 120 and g > 180 and b > 220 and (b > r + 80):
            skipped_cyan += 1
            continue
        # Skip light blue grid lines
        if r < 150 and g > 200 and b > 240 and abs(g - b) < 40:
            skipped_cyan += 1
            continue
            
        dominant.append({
            'rgb': [r, g, b],
            'hex': rgb_to_hex((r, g, b)),
            'percentage': round(percentage, 2),
            'pixel_count': count
        })
    
    log(f"  Skipped colors: white={skipped_white}, black={skipped_black}, gray={skipped_gray}, red={skipped_red}, cyan={skipped_cyan}, small={skipped_small}")
    log(f"  Accepted {len(dominant)} dominant colors")
    
    return dominant[:n_colors]

def create_color_mask(image, target_rgb, tolerance=25):
    """
    Tạo mask cho một màu cụ thể với độ chấp nhận sai số.
    tolerance=25 for PIXEL ACCURACY (was 35).
    Giảm tolerance để phân biệt tốt hơn các màu tương tự.
    """
    lower = np.array([max(0, c - tolerance) for c in target_rgb])
    upper = np.array([min(255, c + tolerance) for c in target_rgb])
    
    mask = cv2.inRange(image, lower, upper)
    
    # LIGHTER morphology to preserve original shape
    kernel_tiny = np.ones((3, 3), np.uint8)
    kernel_small = np.ones((5, 5), np.uint8)
    
    # Remove only very small noise
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_tiny, iterations=1)
    # Fill small gaps but don't merge separate regions
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_small, iterations=2)
    # Light smoothing
    mask = cv2.GaussianBlur(mask, (5, 5), 0)
    _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
    
    return mask

def extract_colors_from_legend(legend_image, min_color_area=50):
    """
    Extract các màu chính xác từ legend (bảng chú thích).
    Hỗ trợ 2 format:
    1. Danh sách dọc (thổ nhưỡng) - scan row strips bên trái
    2. Bảng grid (quy hoạch) - scan toàn bộ grid
    
    Args:
        legend_image: Ảnh crop của legend
        min_color_area: Diện tích tối thiểu (không dùng trong row strips)
    
    Returns:
        List of color dicts: [{'rgb': [r,g,b], 'hex': '#...', 'position': (x,y)}]
    """
    if legend_image is None or legend_image.size == 0:
        return []
    
    h, w = legend_image.shape[:2]
    
    # Try both methods and combine results
    colors_method1 = _extract_colors_row_strips(legend_image, h, w)
    colors_method2 = _extract_colors_grid_scan(legend_image, h, w)
    
    # Combine and deduplicate with higher tolerance to avoid similar colors
    all_colors = colors_method1 + colors_method2
    
    seen_colors = set()
    unique_colors = []
    for c in all_colors:
        r, g, b = c['rgb']
        # Use larger tolerance (25) to merge similar colors
        color_key = (r // 25, g // 25, b // 25)
        if color_key not in seen_colors:
            seen_colors.add(color_key)
            unique_colors.append(c)
    
    log(f"  Extracted {len(unique_colors)} unique colors from legend (method1: {len(colors_method1)}, method2: {len(colors_method2)})")
    
    return unique_colors


def _extract_colors_row_strips(legend_image, h, w):
    """Method 1: Row strips - for vertical legend lists (thổ nhưỡng)"""
    legend_colors = []
    seen_colors = set()
    
    strip_height = max(15, h // 40)
    sample_width = min(80, w // 3)
    
    for strip_y in range(0, h, strip_height):
        strip = legend_image[strip_y:min(strip_y + strip_height, h), 0:sample_width]
        if strip.size == 0:
            continue
        
        color = _get_dominant_color_from_region(strip)
        if color is None:
            continue
        
        r, g, b = color
        color_key = (r // 20, g // 20, b // 20)
        if color_key in seen_colors:
            continue
        seen_colors.add(color_key)
        
        hex_color = "#{:02x}{:02x}{:02x}".format(r, g, b)
        legend_colors.append({
            'rgb': [r, g, b],
            'hex': hex_color,
            'position': (sample_width // 2, strip_y + strip_height // 2),
            'area': strip_height * sample_width
        })
    
    return legend_colors


def _extract_colors_grid_scan(legend_image, h, w):
    """Method 2: Grid scan - for table legends (quy hoạch) with multiple columns"""
    legend_colors = []
    seen_colors = set()
    
    # Scan with smaller cells for table format
    cell_size = max(20, min(h, w) // 20)
    
    for y in range(0, h, cell_size):
        for x in range(0, w, cell_size):
            cell = legend_image[y:min(y + cell_size, h), x:min(x + cell_size, w)]
            if cell.size == 0:
                continue
            
            color = _get_dominant_color_from_region(cell)
            if color is None:
                continue
            
            r, g, b = color
            color_key = (r // 20, g // 20, b // 20)
            if color_key in seen_colors:
                continue
            seen_colors.add(color_key)
            
            hex_color = "#{:02x}{:02x}{:02x}".format(r, g, b)
            legend_colors.append({
                'rgb': [r, g, b],
                'hex': hex_color,
                'position': (x + cell_size // 2, y + cell_size // 2),
                'area': cell_size * cell_size
            })
    
    return legend_colors


def _get_dominant_color_from_region(region):
    """Extract dominant non-white/black/gray color from a region"""
    pixels = region.reshape(-1, 3)
    
    valid_pixels = []
    for p in pixels:
        b, g, r = int(p[0]), int(p[1]), int(p[2])
        
        # Skip white
        if r > 235 and g > 235 and b > 235:
            continue
        # Skip black
        if r < 25 and g < 25 and b < 25:
            continue
        # Skip gray
        max_diff = max(abs(r - g), abs(g - b), abs(r - b))
        if max_diff < 20 and r > 80:
            continue
        
        valid_pixels.append([r, g, b])
    
    if not valid_pixels:
        return None
    
    # Get mean color
    valid_pixels = np.array(valid_pixels)
    mean_color = np.mean(valid_pixels, axis=0).astype(int)
    r, g, b = int(mean_color[0]), int(mean_color[1]), int(mean_color[2])
    
    # Skip if too dark (likely text)
    if r < 50 and g < 50 and b < 50:
        return None
    
    # Skip gray
    max_diff = max(abs(r - g), abs(g - b), abs(r - b))
    if max_diff < 15 and r > 80:
        return None
    
    return (r, g, b)

def match_color_to_legend(target_rgb, legend_colors, tolerance=30):
    """
    Tìm màu trong legend gần nhất với target color.
    
    Args:
        target_rgb: [r, g, b] màu cần match
        legend_colors: List màu từ legend
        tolerance: Độ chấp nhận sai số màu (Euclidean distance)
    
    Returns:
        matched legend color dict or None
    """
    if not legend_colors:
        return None
    
    best_match = None
    min_distance = float('inf')
    
    r, g, b = target_rgb
    
    for lc in legend_colors:
        lr, lg, lb = lc['rgb']
        # Euclidean distance in RGB space
        distance = np.sqrt((r-lr)**2 + (g-lg)**2 + (b-lb)**2)
        
        if distance < min_distance and distance <= tolerance:
            min_distance = distance
            best_match = lc
    
    return best_match

def simplify_contour(contour, max_points=50):
    """
    Đơn giản hóa contour nhưng giữ hình dạng tự nhiên.
    max_points=50 để giữ nhiều chi tiết hơn.
    """
    arc_length = cv2.arcLength(contour, True)
    area = cv2.contourArea(contour)
    
    # Không dùng convex hull - giữ hình dạng thực
    # Chỉ dùng approxPolyDP với epsilon nhỏ
    
    # Start with small epsilon, increase gradually
    for factor in [0.002, 0.004, 0.006, 0.008, 0.01, 0.015, 0.02, 0.03, 0.04, 0.05]:
        epsilon = factor * arc_length
        simplified = cv2.approxPolyDP(contour, epsilon, True)
        if len(simplified) <= max_points:
            return simplified
    
    # If still too many points, use slightly larger epsilon
    epsilon = 0.06 * arc_length
    return cv2.approxPolyDP(contour, epsilon, True)

# ═══════════════════════════════════════════════════════════════════════════════
# AFFINE TRANSFORM using 4 GCPs (like Global Mapper)
# ═══════════════════════════════════════════════════════════════════════════════

def build_affine_transform(control_points, image_shape, resize_info=None):
    """
    Build affine transform matrix from 4 Ground Control Points.
    Uses least-squares fit for pixel→geo coordinate mapping.
    
    This replaces the simple linear sw/ne mapping with proper affine transform
    that handles rotation, skew, and non-uniform scaling — matching Global Mapper output.
    
    Args:
        control_points: dict with point1..point4, each having pixel_x, pixel_y, lat, lng
        image_shape: (h, w) of the image AFTER resize/crop
        resize_info: dict with scale_factor to adjust pixel coordinates
        
    Returns:
        transform_func: function(px, py) -> (lat, lng)
        inverse_func: function(lat, lng) -> (px, py) 
    """
    if not control_points:
        return None, None
    
    # Extract pixel and geo coordinates from control points
    src_pts = []  # pixel coordinates
    dst_pts = []  # geo coordinates (lng, lat)
    
    for key in sorted(control_points.keys()):
        cp = control_points[key]
        px = float(cp.get('pixel_x', cp.get('pixelX', 0)))
        py = float(cp.get('pixel_y', cp.get('pixelY', 0)))
        lat = float(cp.get('lat', 0))
        lng = float(cp.get('lng', 0))
        
        # Adjust pixel coords if image was resized
        if resize_info and resize_info.get('resized'):
            scale = resize_info.get('scale_factor', 1.0)
            px *= scale
            py *= scale
        
        src_pts.append([px, py])
        dst_pts.append([lng, lat])
    
    if len(src_pts) < 3:
        return None, None
    
    src = np.array(src_pts, dtype=np.float64)
    dst = np.array(dst_pts, dtype=np.float64)
    
    # Solve affine transform: [lng, lat] = A * [px, py, 1]
    # Using least-squares with 4 points for best fit
    # Build matrix: [[px1, py1, 1], [px2, py2, 1], ...]
    n = len(src)
    A_mat = np.zeros((n, 3))
    A_mat[:, 0] = src[:, 0]  # px
    A_mat[:, 1] = src[:, 1]  # py
    A_mat[:, 2] = 1           # bias
    
    # Solve for lng = a1*px + b1*py + c1
    lng_coeffs, _, _, _ = np.linalg.lstsq(A_mat, dst[:, 0], rcond=None)
    # Solve for lat = a2*px + b2*py + c2
    lat_coeffs, _, _, _ = np.linalg.lstsq(A_mat, dst[:, 1], rcond=None)
    
    # Verify accuracy
    max_error = 0
    for i in range(n):
        pred_lng = lng_coeffs[0] * src[i, 0] + lng_coeffs[1] * src[i, 1] + lng_coeffs[2]
        pred_lat = lat_coeffs[0] * src[i, 0] + lat_coeffs[1] * src[i, 1] + lat_coeffs[2]
        err = math.sqrt((pred_lng - dst[i, 0])**2 + (pred_lat - dst[i, 1])**2)
        max_error = max(max_error, err)
    
    log(f"  Affine transform: max GCP error = {max_error:.8f} degrees")
    
    def pixel_to_geo(px, py):
        """Convert pixel coordinate to (lat, lng)"""
        lng = lng_coeffs[0] * px + lng_coeffs[1] * py + lng_coeffs[2]
        lat = lat_coeffs[0] * px + lat_coeffs[1] * py + lat_coeffs[2]
        return (float(lat), float(lng))
    
    # Build inverse transform: [px, py] = B * [lng, lat, 1]
    B_mat = np.zeros((n, 3))
    B_mat[:, 0] = dst[:, 0]  # lng
    B_mat[:, 1] = dst[:, 1]  # lat
    B_mat[:, 2] = 1
    px_coeffs, _, _, _ = np.linalg.lstsq(B_mat, src[:, 0], rcond=None)
    py_coeffs, _, _, _ = np.linalg.lstsq(B_mat, src[:, 1], rcond=None)
    
    def geo_to_pixel(lat, lng):
        """Convert (lat, lng) to pixel coordinate"""
        px = px_coeffs[0] * lng + px_coeffs[1] * lat + px_coeffs[2]
        py = py_coeffs[0] * lng + py_coeffs[1] * lat + py_coeffs[2]
        return (float(px), float(py))
    
    return pixel_to_geo, geo_to_pixel


def contour_to_polygon_affine(contour, pixel_to_geo_func):
    """
    Convert contour points to geo coordinates using affine transform.
    More accurate than simple linear sw/ne mapping.
    """
    points = []
    for point in contour:
        px, py = point[0]
        lat, lng = pixel_to_geo_func(float(px), float(py))
        points.append([round(lat, 6), round(lng, 6)])
    return points


# Global variable to hold affine transform for current analysis
_current_affine_transform = None


def contour_to_polygon(contour, image_shape, geo_bounds=None):
    """
    Chuyển contour thành list tọa độ polygon.
    Uses affine transform if available, otherwise falls back to linear mapping.
    """
    global _current_affine_transform
    
    # Use affine transform if available (more accurate)
    if _current_affine_transform is not None:
        return contour_to_polygon_affine(contour, _current_affine_transform)
    
    h, w = image_shape[:2]
    points = []
    
    for point in contour:
        px, py = point[0]
        nx = px / w
        ny = py / h
        
        if geo_bounds:
            sw_lat = geo_bounds['sw']['lat']
            sw_lng = geo_bounds['sw']['lng']
            ne_lat = geo_bounds['ne']['lat']
            ne_lng = geo_bounds['ne']['lng']
            lat = ne_lat - ny * (ne_lat - sw_lat)
            lng = sw_lng + nx * (ne_lng - sw_lng)
            points.append([round(lat, 6), round(lng, 6)])
        else:
            points.append([round(nx, 6), round(ny, 6)])
    
    return points


def extract_polygons_for_color(image, color_info, geo_bounds=None, min_area_percent=0.1, max_points=50):
    """
    Trích xuất tất cả polygon cho một màu cụ thể.
    Output format: ready for planning_zones table.
    """
    global _current_affine_transform
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
        
        area_percent = (area / total_pixels) * 100
        if area_percent > 90:
            continue
        
        perimeter = cv2.arcLength(contour, True)
        circularity = 4 * np.pi * area / (perimeter * perimeter + 1)
        if circularity < 0.02:
            continue
            
        simplified = simplify_contour(contour, max_points=max_points)
        
        if len(simplified) < 3:
            continue
            
        polygon_points = contour_to_polygon(simplified, image.shape, geo_bounds)
        
        # Calculate center
        x, y, bw, bh = cv2.boundingRect(contour)
        center_x = (x + bw / 2) / w
        center_y = (y + bh / 2) / h
        
        if _current_affine_transform is not None:
            cx_px = x + bw / 2
            cy_px = y + bh / 2
            c_lat, c_lng = _current_affine_transform(float(cx_px), float(cy_px))
            center = {'lat': round(c_lat, 6), 'lng': round(c_lng, 6)}
        elif geo_bounds:
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
            'areaPercent': round(area_percent, 3),
            'center': center,
            'boundaryCoordinates': polygon_points,
            'pointCount': len(polygon_points)
        })
    
    return polygons


# ═══════════════════════════════════════════════════════════════════════════════
# PLANNING MAP ALGORITHM - Thuật toán chuyên biệt cho bản đồ Quy hoạch
# ═══════════════════════════════════════════════════════════════════════════════
# Khác với Thổ nhưỡng (K-means clustering màu), Quy hoạch dùng:
# 1. Loại bỏ lưới tọa độ (coordinate grid) - cyan/blue lines
# 2. Phát hiện đường ranh giới (boundary lines) - red/dark lines
# 3. Watershed segmentation để tách các vùng đất nhà nước đã chia
# 4. Phân loại từng vùng theo màu dominant bên trong
# ═══════════════════════════════════════════════════════════════════════════════

def classify_color_to_planning(rgb, max_distance=60):
    """
    Phân loại màu sang loại đất quy hoạch dựa trên CA_MAU_PLANNING_ZONES.
    
    Args:
        rgb: [r, g, b] màu cần phân loại
        max_distance: Khoảng cách Euclidean tối đa cho color matching
        
    Returns:
        dict với zone_type, zone_name, zone_code hoặc None
    """
    if not PLANNING_DATA_AVAILABLE or not CA_MAU_PLANNING_ZONES:
        return None
    
    r, g, b = int(rgb[0]), int(rgb[1]), int(rgb[2])
    best_match = None
    best_distance = float('inf')
    
    for zone_key, zone_data in CA_MAU_PLANNING_ZONES.items():
        for ref_color in zone_data.get("colors", []):
            ref_r, ref_g, ref_b = int(ref_color[0]), int(ref_color[1]), int(ref_color[2])
            distance = math.sqrt((r - ref_r) ** 2 + (g - ref_g) ** 2 + (b - ref_b) ** 2)
            if distance < best_distance:
                best_distance = distance
                best_match = (zone_key, zone_data)
    
    if best_match and best_distance <= max_distance:
        zone_key, zone_data = best_match
        return {
            'zone_type': zone_key,
            'zone_name': zone_data.get('name_vi', zone_key),
            'zone_code': zone_data.get('code', '?'),
            'category': zone_data.get('category', ''),
            'description': zone_data.get('description', ''),
            'match_distance': round(best_distance, 2)
        }
    
    return None


def remove_coordinate_grid(image):
    """
    Loại bỏ lưới tọa độ (coordinate grid) trên bản đồ quy hoạch.
    Lưới thường là các đường mỏng cyan/blue chạy ngang và dọc đều đặn.
    
    IMPROVED: Phân biệt giữa đường grid mỏng và vùng cyan lớn (NTS/LUK).
    Chỉ xóa đường mỏng (<6px), giữ nguyên vùng màu cyan rộng.
    
    Phương pháp:
    1. HSV filter để phát hiện màu cyan/blue
    2. Loại bỏ vùng cyan dày (>6px) - đó là vùng đất, không phải grid
    3. Từ cyan còn lại (mỏng), detect đường ngang/dọc dài
    4. cv2.inpaint() để lấp đầy bằng màu xung quanh
    
    Args:
        image: OpenCV image (BGR)
        
    Returns:
        clean_image: Ảnh đã xóa grid
    """
    h, w = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Detect cyan-blue colors (grid lines: H=80-130 in HSV)
    lower_cyan = np.array([80, 30, 80])
    upper_cyan = np.array([130, 255, 255])
    cyan_mask = cv2.inRange(hsv, lower_cyan, upper_cyan)
    
    # === KEY FIX: Separate THIN lines from THICK cyan zones ===
    # Thick cyan areas are map content (NTS, LUK zones), NOT grid lines
    # Grid lines are thin (1-5px) in at least one dimension
    
    thickness_threshold = 8  # Zones thicker than this are NOT grid lines
    
    # Find horizontally-thick cyan (zones that are >= threshold px tall)
    kernel_v = np.ones((thickness_threshold, 1), np.uint8)
    thick_cyan_v = cv2.erode(cyan_mask, kernel_v, iterations=1)
    thick_cyan_v = cv2.dilate(thick_cyan_v, kernel_v, iterations=1)
    
    # Find vertically-thick cyan (zones that are >= threshold px wide)
    kernel_h = np.ones((1, thickness_threshold), np.uint8)
    thick_cyan_h = cv2.erode(cyan_mask, kernel_h, iterations=1)
    thick_cyan_h = cv2.dilate(thick_cyan_h, kernel_h, iterations=1)
    
    # Thick cyan = areas thick in BOTH dimensions
    thick_cyan = cv2.bitwise_or(thick_cyan_v, thick_cyan_h)
    
    # Thin cyan = total cyan MINUS thick cyan areas = potential grid lines  
    thin_cyan = cv2.subtract(cyan_mask, thick_cyan)
    
    # Now only keep LONG LINE structures from thin cyan
    min_line_length = max(w // 25, 20)
    
    # Detect horizontal lines from thin cyan
    kernel_h_line = cv2.getStructuringElement(cv2.MORPH_RECT, (min_line_length, 1))
    h_lines = cv2.morphologyEx(thin_cyan, cv2.MORPH_OPEN, kernel_h_line)
    
    # Detect vertical lines from thin cyan
    kernel_v_line = cv2.getStructuringElement(cv2.MORPH_RECT, (1, min_line_length))
    v_lines = cv2.morphologyEx(thin_cyan, cv2.MORPH_OPEN, kernel_v_line)
    
    # Combine horizontal and vertical grid lines
    grid_mask = cv2.bitwise_or(h_lines, v_lines)
    
    # Dilate slightly for better inpainting coverage
    grid_mask = cv2.dilate(grid_mask, np.ones((3, 3), np.uint8), iterations=1)
    
    # Count grid pixels
    grid_pixels = np.sum(grid_mask > 0)
    total_pixels = h * w
    grid_pct = (grid_pixels / total_pixels) * 100
    log(f"  Cyan total: {np.sum(cyan_mask > 0)} px ({np.sum(cyan_mask > 0) / total_pixels * 100:.1f}%)")
    log(f"  Thick cyan zones (kept): {np.sum(thick_cyan > 0)} px")
    log(f"  Grid lines (removed): {grid_pixels} px ({grid_pct:.2f}%)")
    
    if grid_pixels < 100:
        log("  No significant grid lines found, skipping removal")
        return image
    
    # Safety check: if grid > 30%, algo might be wrong - be conservative
    if grid_pct > 30:
        log("  WARNING: Grid detection >30%, likely false positives. Using stricter filter.")
        # Re-detect with stricter parameters
        thin_cyan2 = cv2.subtract(thin_cyan, cv2.dilate(thick_cyan, np.ones((5, 5), np.uint8)))
        h_lines2 = cv2.morphologyEx(thin_cyan2, cv2.MORPH_OPEN, 
                                     cv2.getStructuringElement(cv2.MORPH_RECT, (min_line_length * 2, 1)))
        v_lines2 = cv2.morphologyEx(thin_cyan2, cv2.MORPH_OPEN,
                                     cv2.getStructuringElement(cv2.MORPH_RECT, (1, min_line_length * 2)))
        grid_mask = cv2.bitwise_or(h_lines2, v_lines2)
        grid_mask = cv2.dilate(grid_mask, np.ones((3, 3), np.uint8), iterations=1)
        grid_pixels = np.sum(grid_mask > 0)
        grid_pct = (grid_pixels / total_pixels) * 100
        log(f"  Strict grid lines: {grid_pixels} px ({grid_pct:.2f}%)")
    
    # Inpaint to fill grid lines with surrounding colors
    clean = cv2.inpaint(image, grid_mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
    
    log(f"  Grid lines removed via inpainting")
    return clean


def detect_boundary_lines(image):
    """
    Phát hiện đường ranh giới trên bản đồ quy hoạch.
    Bản đồ quy hoạch có đường ranh giới rõ ràng: đường đỏ, đường đen/nâu.
    Đường này chia các vùng đất mà nhà nước đã quy hoạch.
    
    IMPROVED: Tự động phát hiện loại nền (đen hoặc trắng).
    Bản đồ QH.png thường có nền ĐEN (77% pixel), nội dung bản đồ chỉ 22%.
    
    Phương pháp:
    1. Tạo content mask (loại bỏ nền đen HOẶC nền trắng)
    2. HSV filter cho đường đỏ (primary boundary)
    3. Threshold cho đường tối BÊN TRONG vùng content 
    4. Kết hợp = boundary mask CHỈ trong vùng có nội dung bản đồ
    
    Args:
        image: Ảnh đã xóa grid (BGR)
        
    Returns:
        boundary_mask: Binary mask (255 = boundary, 0 = zone interior)
    """
    h, w = image.shape[:2]
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    total_pixels = h * w
    
    # === 0. Create CONTENT MASK - auto-detect background type ===
    # Check for BLACK background (common in planning map PNGs)
    is_black = gray < 10
    black_pct = np.sum(is_black) / total_pixels * 100
    
    # Check for WHITE background  
    is_white = (hsv[:, :, 1] < 25) & (hsv[:, :, 2] > 225)
    white_pct = np.sum(is_white) / total_pixels * 100
    
    # Pick whichever background type is dominant
    if black_pct > 10:
        # BLACK background detected (e.g., Quy Hoạch PNG with black border)
        bg_type = "BLACK"
        is_background = is_black
        log(f"  Background type: BLACK ({black_pct:.1f}% of image)")
    elif white_pct > 10:
        # WHITE background detected
        bg_type = "WHITE" 
        is_background = is_white
        log(f"  Background type: WHITE ({white_pct:.1f}% of image)")
    else:
        # No significant background - full content
        bg_type = "NONE"
        is_background = np.zeros((h, w), dtype=bool)
        log(f"  Background type: NONE (full map content)")
    
    content_mask = np.uint8(~is_background) * 255
    
    # Clean up content mask - fill small holes, remove noise
    kernel_cm = np.ones((7, 7), np.uint8)
    content_mask = cv2.morphologyEx(content_mask, cv2.MORPH_CLOSE, kernel_cm, iterations=3)
    content_mask = cv2.morphologyEx(content_mask, cv2.MORPH_OPEN, kernel_cm, iterations=1)
    
    content_pct = np.sum(content_mask > 0) / total_pixels * 100
    log(f"  Map content area: {content_pct:.1f}% of image")
    
    # === 1. Detect RED lines (primary boundary) ===
    # Red wraps around in HSV (H: 0-10 và 165-180)
    lower_red1 = np.array([0, 70, 70])
    upper_red1 = np.array([12, 255, 255])
    lower_red2 = np.array([165, 70, 70])
    upper_red2 = np.array([180, 255, 255])
    
    red_mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    red_mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    red_mask = cv2.bitwise_or(red_mask1, red_mask2)
    
    # Only keep red lines inside content area
    red_mask = cv2.bitwise_and(red_mask, content_mask)
    
    # === 2. Detect DARK lines ONLY within content area ===
    # For maps with black background, dark boundary lines are still darker
    # than the map content (which is typically bright/colored)
    dark_mask = np.zeros((h, w), dtype=np.uint8)
    
    if bg_type == "BLACK":
        # Content is bright (mean ~210), boundary lines are dark relative to content
        # Use higher threshold since content pixels start at gray ~30+
        content_gray = gray.copy()
        content_gray[content_mask == 0] = 255  # Ignore non-content
        dark_mask[(content_gray < 80) & (content_mask > 0)] = 255
    else:
        # Normal: dark lines are gray < 50
        dark_mask[(gray < 50) & (content_mask > 0)] = 255
    
    # Remove small dots/text - only keep line-like structures
    kernel_open = np.ones((2, 2), np.uint8)
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, kernel_open, iterations=1)
    
    # === 3. Combine boundary indicators ===
    boundary_mask = cv2.bitwise_or(red_mask, dark_mask)
    
    # Morphological close to connect broken boundary lines
    kernel_close = np.ones((3, 3), np.uint8)
    boundary_mask = cv2.morphologyEx(boundary_mask, cv2.MORPH_CLOSE, kernel_close, iterations=1)
    
    # === 4. CRITICAL: Only keep boundaries INSIDE map content ===
    boundary_mask = cv2.bitwise_and(boundary_mask, content_mask)
    
    # === 5. Add background as EXTERNAL boundary ===
    # Background area (black or white) acts as outer boundary for zones at map edge
    bg_mask = np.uint8(is_background) * 255
    boundary_mask = cv2.bitwise_or(boundary_mask, bg_mask)
    
    boundary_pixels = np.sum(boundary_mask > 0)
    real_boundary = boundary_pixels - np.sum(bg_mask > 0)
    boundary_pct = (real_boundary / (h * w)) * 100
    log(f"  Boundary lines (inside map): {real_boundary} pixels ({boundary_pct:.1f}%)")
    log(f"  Red lines: {np.sum(red_mask > 0)} px, Dark lines: {np.sum(dark_mask > 0)} px")
    
    return boundary_mask


def _analyze_planning_zones(image, output_json_path, geo_bounds, legend_info, legend_colors,
                            w, h, w_orig, h_orig, resize_info, content_mask_alpha=None):
    """
    Pipeline phân tích chuyên biệt cho bản đồ QUY HOẠCH.
    
    Thuật toán BOUNDARY-BASED:
    - Step 1: Tạo content mask (loại bỏ nền trắng/đen ngoài bản đồ)
    - Step 2: Detect boundary lines (red/dark lines nhà nước vẽ)
    - Step 3: Boundary lines tạo separator → flood-fill enclosed regions
    - Step 4: Mỗi region gán màu dominant → classify planning zone type
    
    Mục tiêu: Tạo polygons đúng theo đường ranh giới nhà nước đã vẽ,
    giống bản đồ gốc, chỉ thêm gán định nghĩa loại đất.
    """
    global _current_affine_transform
    total_pixels = h * w
    
    # === Step 1: Create content mask ===
    log("Step P1: Creating content mask...")
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # If alpha mask provided, use it directly as the primary content mask
    if content_mask_alpha is not None:
        content_pixels_alpha = np.count_nonzero(content_mask_alpha)
        log(f"  Using alpha-based content mask: {content_pixels_alpha:,} pixels ({100*content_pixels_alpha/total_pixels:.1f}%)")
        content_mask = content_mask_alpha.copy()
    else:
        is_black = gray < 10
        black_pct = np.sum(is_black) / total_pixels * 100
        is_white = (hsv[:, :, 1] < 25) & (hsv[:, :, 2] > 225)
        white_pct = np.sum(is_white) / total_pixels * 100
        
        if black_pct > 10:
            is_background = is_black
            log(f"  Background: BLACK ({black_pct:.1f}%)")
        elif white_pct > 10:
            is_background = is_white
            log(f"  Background: WHITE ({white_pct:.1f}%)")
        else:
            is_background = np.zeros((h, w), dtype=bool)
            log(f"  Background: NONE (full content)")
        
        content_mask = np.uint8(~is_background) * 255
    kernel_cm = np.ones((5, 5), np.uint8)
    content_mask = cv2.morphologyEx(content_mask, cv2.MORPH_CLOSE, kernel_cm, iterations=2)
    content_mask = cv2.morphologyEx(content_mask, cv2.MORPH_OPEN, kernel_cm, iterations=1)
    
    content_pct = np.sum(content_mask > 0) / total_pixels * 100
    log(f"  Map content area: {content_pct:.1f}%")
    
    # Clean grid lines
    clean_image = remove_coordinate_grid(image)
    
    # === Step 2: Detect ALL boundary lines ===
    log("Step P2: Detecting boundary lines...")
    
    # Red boundary lines (HSV)
    lower_red1 = np.array([0, 60, 60])
    upper_red1 = np.array([12, 255, 255])
    lower_red2 = np.array([165, 60, 60])
    upper_red2 = np.array([180, 255, 255])
    red_mask = cv2.bitwise_or(
        cv2.inRange(hsv, lower_red1, upper_red1),
        cv2.inRange(hsv, lower_red2, upper_red2)
    )
    red_mask = cv2.bitwise_and(red_mask, content_mask)
    
    # Dark/black boundary lines
    _, dark_mask = cv2.threshold(gray, 60, 255, cv2.THRESH_BINARY_INV)
    dark_mask = cv2.bitwise_and(dark_mask, content_mask)
    
    # Combine into boundary mask and dilate to ensure continuous separation
    boundary_mask = cv2.bitwise_or(red_mask, dark_mask)
    boundary_mask = cv2.dilate(boundary_mask, np.ones((3, 3), np.uint8), iterations=1)
    
    boundary_count = np.count_nonzero(boundary_mask)
    log(f"  Boundary pixels: {boundary_count:,} ({boundary_count/total_pixels*100:.1f}%)")
    
    # === Step 3: Regions = content minus boundaries ===
    log("Step P3: Extracting enclosed regions...")
    
    # Subtract boundary lines from content → remaining enclosed regions
    regions_mask = cv2.bitwise_and(content_mask, cv2.bitwise_not(boundary_mask))
    
    # Morphological cleanup to merge tiny gaps
    kernel_clean = np.ones((3, 3), np.uint8)
    regions_mask = cv2.morphologyEx(regions_mask, cv2.MORPH_CLOSE, kernel_clean, iterations=2)
    regions_mask = cv2.morphologyEx(regions_mask, cv2.MORPH_OPEN, kernel_clean, iterations=1)
    
    # Connected component analysis — each connected region = one zone
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
        regions_mask, connectivity=4  # 4-connectivity for tighter separation
    )
    
    log(f"  Found {num_labels - 1} connected regions")
    
    # === Step 4: Classify each region by dominant color ===
    log("Step P4: Classifying regions by dominant color...")
    
    zones = []
    zone_id = 1
    color_summary_map = {}
    zone_stats = {}
    # Use content area (not total) for min_area calculation — avoids skipping
    # small but important zones when background takes up most of the image
    content_pixels = np.count_nonzero(content_mask)
    min_area = max(content_pixels * 0.0005, 200)  # 0.05% of content or min 200px
    log(f"  Min area threshold: {int(min_area)} pixels ({min_area/total_pixels*100:.3f}% of total)")
    skipped_small = 0
    skipped_bg = 0
    
    image_rgb = cv2.cvtColor(clean_image, cv2.COLOR_BGR2RGB)
    
    for label_idx in range(1, num_labels):  # Skip background
        area_pixels = stats[label_idx, cv2.CC_STAT_AREA]
        
        if area_pixels < min_area:
            skipped_small += 1
            continue
        
        area_percent = (area_pixels / total_pixels) * 100
        if area_percent > 60:
            skipped_bg += 1
            continue
        
        # Get dominant color of this region
        region_pixels = image_rgb[labels == label_idx]
        if len(region_pixels) < 10:
            continue
        
        # Use median for robustness (ignores outlier boundary pixels)
        median_color = np.median(region_pixels, axis=0).astype(int)
        r, g, b = int(median_color[0]), int(median_color[1]), int(median_color[2])
        
        # Skip very dark regions (boundary remnants)
        if max(r, g, b) < 35:
            skipped_bg += 1
            continue
        
        # Create contour for this region
        component_mask = (labels == label_idx).astype(np.uint8) * 255
        contours, _ = cv2.findContours(
            component_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            continue
        
        contour = max(contours, key=cv2.contourArea)
        if len(contour) < 5:
            continue
        
        # Smooth contour
        num_pts = min(120, max(30, len(contour)))
        smoothed = _smooth_contour_spline(contour, num_points=num_pts, smoothing=1)
        if smoothed is None or len(smoothed) < 3:
            smoothed = simplify_contour(contour, max_points=60)
        
        # Convert to geo coordinates
        polygon_points = contour_to_polygon(smoothed, clean_image.shape, geo_bounds)
        
        # Calculate center
        cx_px = centroids[label_idx][0]
        cy_px = centroids[label_idx][1]
        
        if _current_affine_transform is not None:
            c_lat, c_lng = _current_affine_transform(float(cx_px), float(cy_px))
            center = {'lat': round(c_lat, 6), 'lng': round(c_lng, 6)}
        elif geo_bounds:
            cx = cx_px / w
            cy = cy_px / h
            sw = geo_bounds['sw']
            ne = geo_bounds['ne']
            center = {
                'lat': round(ne['lat'] - cy * (ne['lat'] - sw['lat']), 6),
                'lng': round(sw['lng'] + cx * (ne['lng'] - sw['lng']), 6)
            }
        else:
            center = [round(cx_px / w, 4), round(cy_px / h, 4)]
        
        # Classify planning zone type
        planning_info = classify_color_to_planning([r, g, b], max_distance=60)
        
        # Calculate area in hectares
        area_info = calculate_area_hectares(area_percent, geo_bounds)
        
        color_hex = rgb_to_hex((r, g, b))
        
        # Track color summary
        if color_hex not in color_summary_map:
            color_summary_map[color_hex] = {
                'color': color_hex, 'rgb': [r, g, b],
                'percentage': 0, 'polygonCount': 0, 'fromLegend': False
            }
        color_summary_map[color_hex]['percentage'] += area_percent
        color_summary_map[color_hex]['polygonCount'] += 1
        
        zone_data = {
            'id': zone_id,
            'name': planning_info['zone_name'] if planning_info else f"Zone {zone_id}",
            'fillColor': color_hex,
            'colorRgb': [r, g, b],
            'areaPercent': round(area_percent, 3),
            'centerLat': center.get('lat') if isinstance(center, dict) else None,
            'centerLng': center.get('lng') if isinstance(center, dict) else None,
            'center': center,
            'boundaryCoordinates': json.dumps(polygon_points),
            'pointCount': len(polygon_points),
            'zoneType': planning_info['zone_type'] if planning_info else 'Unknown',
            'zoneCode': planning_info['zone_code'] if planning_info else None,
            'zoneName': planning_info['zone_name'] if planning_info else f"Zone {zone_id}",
            'landUsePurpose': planning_info['description'] if planning_info else 'Chưa phân loại',
            'planningCategory': planning_info['category'] if planning_info else None,
            'soilMatchDistance': planning_info['match_distance'] if planning_info else None,
            'fromLegend': False,
            'mapType': 'planning'
        }
        
        if area_info:
            zone_data['areaHectares'] = area_info['area_ha']
            zone_data['areaKm2'] = area_info['area_km2']
            zone_data['areaM2'] = area_info['area_m2']
            zone_data['areaSqm'] = area_info['area_m2']
        
        zones.append(zone_data)
        zone_id += 1
        
        # Build zone type stats
        zt = zone_data.get('zoneType')
        if zt:
            if zt not in zone_stats:
                zone_stats[zt] = {
                    'zoneType': zt, 'zoneName': zone_data.get('zoneName', zt),
                    'zoneCode': zone_data.get('zoneCode', '?'),
                    'zoneCount': 0, 'totalAreaPercent': 0, 'totalAreaHa': 0
                }
            zone_stats[zt]['zoneCount'] += 1
            zone_stats[zt]['totalAreaPercent'] += area_percent
            zone_stats[zt]['totalAreaHa'] += zone_data.get('areaHectares', 0)
    
    # Round stats
    for zt in zone_stats:
        zone_stats[zt]['totalAreaPercent'] = round(zone_stats[zt]['totalAreaPercent'], 2)
        zone_stats[zt]['totalAreaHa'] = round(zone_stats[zt]['totalAreaHa'], 4)
    for cs in color_summary_map.values():
        cs['percentage'] = round(cs['percentage'], 2)
    
    # === Gap Fill: Assign remaining content pixels to nearest zone color ===
    log("Step P5: Filling remaining content gaps...")
    
    # Build assigned_mask from all existing zones
    assigned_mask_p = np.zeros((h, w), dtype=np.uint8)
    for label_idx in range(1, num_labels):
        area_pixels = stats[label_idx, cv2.CC_STAT_AREA]
        if area_pixels >= min_area:
            assigned_mask_p = cv2.bitwise_or(
                assigned_mask_p,
                (labels == label_idx).astype(np.uint8) * 255
            )
    
    unassigned_p = cv2.bitwise_and(
        cv2.bitwise_not(assigned_mask_p),
        content_mask
    )
    unassigned_count_p = cv2.countNonZero(unassigned_p)
    
    if unassigned_count_p > 0 and len(zones) > 0:
        log(f"  Unassigned content pixels: {unassigned_count_p:,} ({100*unassigned_count_p/total_pixels:.1f}%)")
        
        # Collect reference colors from existing zones
        ref_colors_p = []
        ref_zone_indices = []
        seen_colors_p = set()
        for zi, z in enumerate(zones):
            rgb_tuple = tuple(z.get('colorRgb', [128, 128, 128]))
            if rgb_tuple not in seen_colors_p:
                seen_colors_p.add(rgb_tuple)
                ref_colors_p.append(list(rgb_tuple))
                ref_zone_indices.append(zi)
        
        if ref_colors_p:
            ref_array_p = np.array(ref_colors_p, dtype=np.float32)
            
            uy_p, ux_p = np.where(unassigned_p > 0)
            
            if len(uy_p) > 0:
                gap_pixels_p = image_rgb[uy_p, ux_p].astype(np.float32)
                
                batch_size = 50000
                gap_labels_p = np.zeros(len(uy_p), dtype=np.int32)
                
                for bi in range(0, len(uy_p), batch_size):
                    be = min(bi + batch_size, len(uy_p))
                    batch = gap_pixels_p[bi:be]
                    diffs = batch[:, np.newaxis, :] - ref_array_p[np.newaxis, :, :]
                    dists = np.sqrt(np.sum(diffs ** 2, axis=2))
                    gap_labels_p[bi:be] = np.argmin(dists, axis=1)
                
                # Group gap pixels per zone color and create new zones
                gap_zone_map = {}
                for i, lbl in enumerate(gap_labels_p):
                    zi = ref_zone_indices[lbl]
                    if zi not in gap_zone_map:
                        gap_zone_map[zi] = np.zeros((h, w), dtype=np.uint8)
                    gap_zone_map[zi][uy_p[i], ux_p[i]] = 255
                
                gap_zones_added_p = 0
                for source_zi, gap_mask in gap_zone_map.items():
                    gap_mask = cv2.morphologyEx(gap_mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
                    gap_mask = cv2.bitwise_and(gap_mask, cv2.bitwise_not(assigned_mask_p))
                    gap_mask = cv2.bitwise_and(gap_mask, content_mask)
                    
                    num_labels_g, labels_g, stats_g, centroids_g = cv2.connectedComponentsWithStats(
                        gap_mask, connectivity=8
                    )
                    
                    src_zone = zones[source_zi]
                    
                    # Use smaller min_area for gap zones
                    gap_min_area_p = max(min_area // 4, 30)
                    
                    for label_idx_g in range(1, num_labels_g):
                        area_g = stats_g[label_idx_g, cv2.CC_STAT_AREA]
                        if area_g < gap_min_area_p:
                            continue
                        
                        area_percent_g = (area_g / total_pixels) * 100
                        comp_mask_g = (labels_g == label_idx_g).astype(np.uint8) * 255
                        assigned_mask_p = cv2.bitwise_or(assigned_mask_p, comp_mask_g)
                        
                        contours_g, _ = cv2.findContours(comp_mask_g, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                        if not contours_g:
                            continue
                        contour_g = max(contours_g, key=cv2.contourArea)
                        if len(contour_g) < 5:
                            continue
                        
                        num_pts_g = min(120, max(30, len(contour_g)))
                        smoothed_g = _smooth_contour_spline(contour_g, num_points=num_pts_g, smoothing=1)
                        if smoothed_g is None or len(smoothed_g) < 3:
                            smoothed_g = simplify_contour(contour_g, max_points=60)
                        
                        polygon_pts_g = contour_to_polygon(smoothed_g, clean_image.shape, geo_bounds)
                        
                        cx_g = centroids_g[label_idx_g][0]
                        cy_g = centroids_g[label_idx_g][1]
                        
                        if _current_affine_transform is not None:
                            c_lat_g, c_lng_g = _current_affine_transform(float(cx_g), float(cy_g))
                            center_g = {'lat': round(c_lat_g, 6), 'lng': round(c_lng_g, 6)}
                        elif geo_bounds:
                            sw = geo_bounds['sw']
                            ne = geo_bounds['ne']
                            center_g = {
                                'lat': round(ne['lat'] - (cy_g/h) * (ne['lat'] - sw['lat']), 6),
                                'lng': round(sw['lng'] + (cx_g/w) * (ne['lng'] - sw['lng']), 6)
                            }
                        else:
                            center_g = {'lat': 0, 'lng': 0}
                        
                        area_info_g = calculate_area_hectares(area_percent_g, geo_bounds)
                        
                        zone_id += 1
                        new_zone = {
                            'id': zone_id,
                            'name': src_zone.get('zoneName', f'Zone {zone_id}') + f' #{zone_id}',
                            'fillColor': src_zone.get('fillColor', '#808080'),
                            'colorRgb': src_zone.get('colorRgb', [128, 128, 128]),
                            'areaPercent': round(area_percent_g, 3),
                            'centerLat': center_g.get('lat'),
                            'centerLng': center_g.get('lng'),
                            'center': center_g,
                            'boundaryCoordinates': json.dumps(polygon_pts_g),
                            'pointCount': len(polygon_pts_g),
                            'zoneType': src_zone.get('zoneType'),
                            'zoneCode': src_zone.get('zoneCode'),
                            'zoneName': src_zone.get('zoneName'),
                            'landUsePurpose': src_zone.get('landUsePurpose'),
                            'planningCategory': src_zone.get('planningCategory'),
                            'soilMatchDistance': -1,
                            'fromLegend': False,
                            'mapType': 'planning'
                        }
                        
                        if area_info_g:
                            new_zone['areaHectares'] = area_info_g['area_ha']
                            new_zone['areaKm2'] = area_info_g['area_km2']
                            new_zone['areaM2'] = area_info_g['area_m2']
                            new_zone['areaSqm'] = area_info_g['area_m2']
                        
                        zones.append(new_zone)
                        gap_zones_added_p += 1
                        
                        # Update stats
                        zt_g = new_zone.get('zoneType')
                        if zt_g and zt_g in zone_stats:
                            zone_stats[zt_g]['zoneCount'] += 1
                            zone_stats[zt_g]['totalAreaPercent'] += area_percent_g
                            zone_stats[zt_g]['totalAreaHa'] += new_zone.get('areaHectares', 0)
                        
                        # Update color summary
                        ch_g = new_zone['fillColor']
                        if ch_g in color_summary_map:
                            color_summary_map[ch_g]['percentage'] += area_percent_g
                            color_summary_map[ch_g]['polygonCount'] += 1
                
                log(f"  Gap fill: added {gap_zones_added_p} gap zones")
    else:
        log(f"  No unassigned content pixels to fill")
    
    # Re-round stats after gap fill
    for zt in zone_stats:
        zone_stats[zt]['totalAreaPercent'] = round(zone_stats[zt]['totalAreaPercent'], 2)
        zone_stats[zt]['totalAreaHa'] = round(zone_stats[zt]['totalAreaHa'], 4)
    for cs in color_summary_map.values():
        cs['percentage'] = round(cs['percentage'], 2)
    
    color_summary = list(color_summary_map.values())
    
    log(f"  Total planning zones (after gap fill): {len(zones)}")
    log(f"  Skipped: small={skipped_small}, background={skipped_bg}")
    
    zone_types_found = set(z['zoneType'] for z in zones if z.get('zoneType'))
    log(f"  Planning zone types: {len(zone_types_found)}")
    for zt in zone_types_found:
        count = sum(1 for z in zones if z.get('zoneType') == zt)
        name = next((z.get('zoneName', zt) for z in zones if z.get('zoneType') == zt), zt)
        log(f"    - {name} ({zt}): {count} zones")
    
    # === Step 6: Build result (same format as soil mode) ===
    result = {
        'success': True,
        'mode': 'PLANNING',
        'algorithm': 'boundary_detection',
        'imageSize': {'width': w, 'height': h},
        'originalSize': {'width': w_orig, 'height': h_orig},
        'resizeInfo': resize_info,
        'colorSummary': color_summary,
        'soilStatistics': list(zone_stats.values()),  # Reuse field name for compatibility
        'totalZones': len(zones),
        'soilTypesCount': len(zone_stats),  # Reuse field name for compatibility
        'zones': zones,
        'legend': legend_info,
        'legendBasedExtraction': len(legend_colors) > 0 if legend_colors else False,
        'hasGeoBounds': geo_bounds is not None,
        'soilDataAvailable': PLANNING_DATA_AVAILABLE,
        'planningMode': True  # Flag for frontend
    }
    
    # Save JSON
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    log(f"Planning result saved to: {output_json_path}")
    
    # Stdout for Java
    stdout_status = {
        "status": "SUCCESS",
        "mode": "PLANNING",
        "algorithm": "boundary_detection",
        "totalZones": result.get("totalZones", 0),
        "soilTypesCount": result.get("soilTypesCount", 0),
        "originalSize": result.get("originalSize"),
        "processedSize": result.get("imageSize"),
        "resized": resize_info.get("resized", False),
        "hasLegend": legend_info is not None,
        "soilDataAvailable": PLANNING_DATA_AVAILABLE,
        "outputFile": output_json_path
    }
    
    print("===JSON_START===")
    print(json.dumps(stdout_status, ensure_ascii=False))
    print("===JSON_END===")
    
    return result


def extract_legend_region(image):
    """
    Cắt vùng legend (thường ở góc trái dưới hoặc phải dưới).
    Trả về image crop của legend để gửi cho AI đọc.
    """
    h, w = image.shape[:2]
    
    # Thử các vị trí legend phổ biến - mở rộng vùng tìm kiếm
    legend_candidates = [
        # Góc trái dưới (phổ biến nhất cho bản đồ quy hoạch) - mở rộng
        ('left_bottom', image[int(h*0.5):h, 0:int(w*0.45)]),
        # Góc trái dưới nhỏ hơn (cho thổ nhưỡng)
        ('left_bottom_small', image[int(h*0.6):h, 0:int(w*0.35)]),
        # Góc phải trên (mini map)
        ('right_top', image[0:int(h*0.3), int(w*0.7):w]),
        # Góc trái trên (chú dẫn thổ nhưỡng)
        ('left_top', image[0:int(h*0.35), 0:int(w*0.3)]),
        # Góc phải dưới
        ('right_bottom', image[int(h*0.6):h, int(w*0.6):w]),
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


def create_image_overlay(image, output_path, geo_bounds=None, quality=85):
    """
    Tạo ảnh overlay để hiển thị trên bản đồ (như KMZ GroundOverlay).
    Loại bỏ nền trắng và vùng không có dữ liệu để overlay trong suốt.
    
    IMPROVED VERSION:
    - Giữ nguyên hình dạng gốc của bản đồ
    - Loại bỏ nền trắng triệt để hơn  
    - Bảo toàn các đường viền và ranh giới
    - Giữ lại cả vùng nhỏ
    
    Args:
        image: OpenCV image (BGR)
        output_path: Đường dẫn lưu ảnh PNG với alpha channel
        geo_bounds: dict với sw/ne coordinates để tính boundaryCoordinates
        quality: Chất lượng nén PNG (không dùng cho PNG, chỉ cho JPEG fallback)
    
    Returns:
        dict với thông tin overlay: imageUrl, boundaryCoordinates, dimensions
    """
    h, w = image.shape[:2]
    log(f"  Creating enhanced image overlay: {w}x{h}")
    
    # Chuyển sang RGBA (thêm alpha channel)
    bgra = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    
    # Convert to multiple color spaces for better detection
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    
    # ===== IMPROVED WHITE DETECTION =====
    # 1. Near-white detection using HSV (saturation < 25, value > 235)
    white_hsv = (hsv[:, :, 1] < 25) & (hsv[:, :, 2] > 235)
    
    # 2. Near-white detection using LAB (L > 245, a and b near center)
    # LAB is better at detecting off-white colors
    white_lab = (lab[:, :, 0] > 245) & (np.abs(lab[:, :, 1] - 128) < 10) & (np.abs(lab[:, :, 2] - 128) < 10)
    
    # 3. Light gray detection (very low saturation, high value but not map content)
    light_gray = (hsv[:, :, 1] < 12) & (hsv[:, :, 2] > 200)
    
    # 4. Black/very dark detection (for borders that should remain)
    # Keep black areas visible (they're usually borders)
    
    # Combine white/gray masks
    white_mask = white_hsv | white_lab | light_gray
    
    # ===== EDGE PRESERVATION =====
    # Detect edges to preserve colored region boundaries
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    
    # Dilate edges slightly to ensure they're not made transparent
    kernel = np.ones((3, 3), np.uint8)
    edges_dilated = cv2.dilate(edges, kernel, iterations=1)
    edge_mask = edges_dilated > 0
    
    # ===== COLOR REGION DETECTION =====
    # Pixels with significant saturation are map content (not background)
    colored_mask = hsv[:, :, 1] > 30  # Saturation > 30 means it has color
    
    # Pixels with medium brightness range (not too dark, not too light)
    medium_value_mask = (hsv[:, :, 2] > 30) & (hsv[:, :, 2] < 235)
    
    # ===== FINAL ALPHA CALCULATION =====
    # Keep visible: colored pixels, edges, medium value pixels
    # Make transparent: white background, light gray areas
    keep_visible = colored_mask | edge_mask | (medium_value_mask & ~white_mask)
    
    # Apply morphological closing to fill small holes in regions
    kernel_close = np.ones((5, 5), np.uint8)
    keep_visible = keep_visible.astype(np.uint8) * 255
    keep_visible = cv2.morphologyEx(keep_visible, cv2.MORPH_CLOSE, kernel_close, iterations=2)
    
    # Apply slight smoothing to reduce jagged edges
    keep_visible = cv2.GaussianBlur(keep_visible, (3, 3), 0)
    
    # Convert back to boolean
    keep_visible = keep_visible > 127
    
    # Set alpha: 0 for transparent, 240 for semi-transparent colored areas
    # Use higher opacity (240/255 = 94%) to make colors more visible
    bgra[:, :, 3] = np.where(keep_visible, 240, 0)
    
    # ===== SAVE OUTPUT =====
    # Save as PNG with alpha
    png_path = output_path.replace('.json', '_overlay.png')
    cv2.imwrite(png_path, bgra, [cv2.IMWRITE_PNG_COMPRESSION, 6])
    log(f"  Overlay image saved: {png_path}")
    
    # Log statistics
    total_pixels = h * w
    visible_pixels = np.sum(keep_visible)
    log(f"  Overlay stats: {visible_pixels}/{total_pixels} visible ({100*visible_pixels/total_pixels:.1f}%)")
    
    # Calculate boundary coordinates (4 corners in lat/lng)
    if geo_bounds and 'sw' in geo_bounds and 'ne' in geo_bounds:
        sw = geo_bounds['sw']
        ne = geo_bounds['ne']
        boundary_coords = [
            [sw['lat'], sw['lng']],  # SW corner
            [sw['lat'], ne['lng']],  # SE corner
            [ne['lat'], ne['lng']],  # NE corner
            [ne['lat'], sw['lng']]   # NW corner
        ]
    else:
        # Fallback: normalized coordinates (0-1)
        boundary_coords = [
            [0, 0], [0, 1], [1, 1], [1, 0]
        ]
    
    return {
        'imagePath': png_path,
        'imageFilename': os.path.basename(png_path),
        'boundaryCoordinates': boundary_coords,
        'width': w,
        'height': h,
        'opacity': 0.94  # 94% opacity for overlay
    }


def smart_resize_image(image, max_dimension=2000):
    """
    Smart resize ảnh để tối ưu xử lý:
    - Giảm kích thước nếu > max_dimension
    - Giữ nguyên tỷ lệ (aspect ratio)
    - Giữ normalized coordinates (0-1) nên không ảnh hưởng độ chính xác
    
    Benefits:
    - Giảm 60-80% token khi gửi GPT-4o
    - Tăng tốc OpenCV 2-3x
    - Vẫn đủ độ nét để nhận diện màu và polygon
    
    Args:
        image: OpenCV image (BGR)
        max_dimension: Kích thước tối đa (chiều dài nhất), default 2000px
        
    Returns:
        resized_image, resize_info dict
    """
    h, w = image.shape[:2]
    original_size = (w, h)
    file_size_estimate = h * w * 3  # Approximate uncompressed size
    
    # Check if resize needed
    if max(h, w) <= max_dimension:
        log(f"  Image size {w}x{h} is within limit ({max_dimension}px), no resize needed")
        return image, {
            'resized': False,
            'original_width': w,
            'original_height': h,
            'new_width': w,
            'new_height': h,
            'scale_factor': 1.0
        }
    
    # Calculate scale factor
    scale = max_dimension / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)
    
    # Use INTER_AREA for shrinking (best quality)
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    
    log(f"  Resized: {w}x{h} -> {new_w}x{new_h} (scale: {scale:.2f})")
    log(f"  Estimated size reduction: {(1-scale**2)*100:.0f}%")
    
    return resized, {
        'resized': True,
        'original_width': w,
        'original_height': h,
        'new_width': new_w,
        'new_height': new_h,
        'scale_factor': round(scale, 4)
    }

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
    
    cropped = image[y:y+h_crop, x:x+w_crop]
    log(f"Cropped image to: {w_crop}x{h_crop} (from {w}x{h})")
    
    return cropped, (x, y, w_crop, h_crop)


# ═══════════════════════════════════════════════════════════════════════════════
# SOIL PREPROCESSING - Remove non-soil elements (grid, text, roads, borders)
# ═══════════════════════════════════════════════════════════════════════════════

def _preprocess_soil_image(image, content_mask_alpha=None):
    """
    Preprocess soil map image by removing non-soil elements and inpainting.
    Removes: grid lines, text labels, red roads/dots, black dashed borders.
    Inpaints removed regions with nearest soil color.
    
    If content_mask_alpha is provided, only processes within content area
    (skips transparent/background regions).
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Content mask: where actual map data exists (not transparent background)
    if content_mask_alpha is not None:
        content_area = content_mask_alpha
        content_pct = np.count_nonzero(content_area) / (h * w) * 100
        log(f"  Content area from alpha: {content_pct:.1f}%")
    else:
        content_area = np.ones((h, w), dtype=np.uint8) * 255
    
    removal_mask = np.zeros((h, w), dtype=np.uint8)
    
    # 1. Remove cyan/blue grid lines (tọa độ) — only thin lines within content
    lower_blue = np.array([80, 40, 100])
    upper_blue = np.array([130, 255, 255])
    blue_mask = cv2.inRange(hsv, lower_blue, upper_blue)
    blue_mask = cv2.bitwise_and(blue_mask, content_area)
    # Only keep thin horizontal/vertical lines (grid), not large cyan areas
    kernel_h = np.ones((1, 20), np.uint8)
    kernel_v = np.ones((20, 1), np.uint8)
    h_lines = cv2.morphologyEx(blue_mask, cv2.MORPH_OPEN, kernel_h)
    v_lines = cv2.morphologyEx(blue_mask, cv2.MORPH_OPEN, kernel_v)
    grid_mask = cv2.bitwise_or(h_lines, v_lines)
    grid_mask = cv2.dilate(grid_mask, np.ones((3, 3), np.uint8), iterations=1)
    removal_mask = cv2.bitwise_or(removal_mask, grid_mask)
    log(f"  Grid lines: {np.count_nonzero(grid_mask):,} pixels")
    
    # 2. Remove red elements (roads, dots, tên đường) — within content only
    lower_red1 = np.array([0, 120, 100])
    upper_red1 = np.array([8, 255, 255])
    lower_red2 = np.array([170, 120, 100])
    upper_red2 = np.array([180, 255, 255])
    red_mask = cv2.bitwise_or(
        cv2.inRange(hsv, lower_red1, upper_red1),
        cv2.inRange(hsv, lower_red2, upper_red2)
    )
    red_mask = cv2.bitwise_and(red_mask, content_area)
    red_mask = cv2.dilate(red_mask, np.ones((3, 3), np.uint8), iterations=1)
    removal_mask = cv2.bitwise_or(removal_mask, red_mask)
    log(f"  Red elements: {np.count_nonzero(red_mask):,} pixels")
    
    # 3. Remove black dashed border lines (ranh giới hành chính) — within content only
    # Only very dark pixels that form LINE structures (not dark soil)
    _, black_mask = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY_INV)
    black_mask = cv2.bitwise_and(black_mask, content_area)
    # Detect line structures: must be continuous for 25+ pixels in some direction
    k_h = np.ones((1, 25), np.uint8)
    k_v = np.ones((25, 1), np.uint8)
    k_d1 = np.eye(20, dtype=np.uint8)
    k_d2 = np.fliplr(np.eye(20, dtype=np.uint8))
    line_h = cv2.morphologyEx(black_mask, cv2.MORPH_OPEN, k_h)
    line_v = cv2.morphologyEx(black_mask, cv2.MORPH_OPEN, k_v)
    line_d1 = cv2.morphologyEx(black_mask, cv2.MORPH_OPEN, k_d1)
    line_d2 = cv2.morphologyEx(black_mask, cv2.MORPH_OPEN, k_d2)
    black_lines = cv2.bitwise_or(line_h, line_v)
    black_lines = cv2.bitwise_or(black_lines, line_d1)
    black_lines = cv2.bitwise_or(black_lines, line_d2)
    black_lines = cv2.dilate(black_lines, np.ones((2, 2), np.uint8), iterations=1)
    removal_mask = cv2.bitwise_or(removal_mask, black_lines)
    log(f"  Border lines: {np.count_nonzero(black_lines):,} pixels")
    
    # 4. Remove text labels (tên huyện, địa danh) — within content only
    edges = cv2.Canny(gray, 100, 200)
    edges = cv2.bitwise_and(edges, content_area)
    text_regions = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    text_contours, _ = cv2.findContours(text_regions, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    text_mask = np.zeros((h, w), dtype=np.uint8)
    for cnt in text_contours:
        area = cv2.contourArea(cnt)
        if 100 < area < 30000:
            x, y, bw, bh = cv2.boundingRect(cnt)
            aspect = max(bw, bh) / (min(bw, bh) + 1)
            if aspect < 8:
                roi = gray[y:y+bh, x:x+bw]
                if np.mean(roi) < 180:
                    cv2.drawContours(text_mask, [cnt], -1, 255, -1)
    text_mask = cv2.dilate(text_mask, np.ones((5, 5), np.uint8), iterations=1)
    removal_mask = cv2.bitwise_or(removal_mask, text_mask)
    log(f"  Text regions: {np.count_nonzero(text_mask):,} pixels")
    
    # Only count removal within content area
    removal_in_content = cv2.bitwise_and(removal_mask, content_area)
    content_total = max(np.count_nonzero(content_area), 1)
    removed_count = np.count_nonzero(removal_in_content)
    log(f"  Removed in content: {removed_count:,} pixels ({100*removed_count/content_total:.1f}% of content)")
    
    # 5. Inpaint removed regions with surrounding soil colors
    log("  Inpainting removed regions...")
    cleaned = cv2.inpaint(image, removal_mask, inpaintRadius=7, flags=cv2.INPAINT_TELEA)
    
    # 6. Light bilateral filter to smooth within color regions (preserves edges)
    smoothed = cv2.bilateralFilter(cleaned, d=9, sigmaColor=50, sigmaSpace=50)
    
    return smoothed


# ═══════════════════════════════════════════════════════════════════════════════
# PIXEL-ACCURATE SOIL ZONE DETECTION
# ═══════════════════════════════════════════════════════════════════════════════

def _smooth_contour_spline(contour, num_points=80, smoothing=2):
    """Smooth contour using B-spline interpolation for curved boundaries."""
    try:
        if contour is None or len(contour) < 5:
            return contour
        points = contour.reshape(-1, 2)
        if len(points) < 5:
            return contour
        x = points[:, 0].astype(float)
        y = points[:, 1].astype(float)
        try:
            from scipy.interpolate import splprep, splev
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


def _detect_soil_zones_pixel_accurate(image, original_shape, geo_bounds, content_mask_alpha=None):
    """
    Detect soil zones using pixel-accurate Euclidean distance color matching.
    
    Algorithm:
    1. For each soil type (sorted by expected area, largest first):
       - Match pixels within RGB Euclidean distance tolerance
       - Exclude already-assigned pixels (priority-based)
       - Exclude transparent/background pixels via content_mask_alpha
    2. Connected component analysis: same-color adjacent pixels → one zone
    3. Smooth contour boundaries with B-spline
    4. Convert to geo coordinates using affine transform or linear mapping
    
    Returns: (zones, color_summary, soil_stats)
    """
    global _current_affine_transform
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    h, w = image.shape[:2]
    
    # Use content pixels (non-transparent) for area calculations
    if content_mask_alpha is not None:
        content_pixels = np.count_nonzero(content_mask_alpha)
        log(f"  Content pixels from alpha: {content_pixels:,} / {h*w:,} ({100*content_pixels/(h*w):.1f}%)")
    else:
        content_pixels = h * w
        content_mask_alpha = np.ones((h, w), dtype=np.uint8) * 255
    
    total_pixels = content_pixels
    tolerance = 25  # Euclidean distance threshold in RGB space
    min_area_pct = 0.01  # 0.01% = detect very small zones
    min_area = int(total_pixels * (min_area_pct / 100))
    
    log(f"  Image: {w}x{h}, tolerance={tolerance}, min_area={min_area_pct}%")
    
    if not SOIL_DATA_AVAILABLE:
        log("  WARNING: CA_MAU_SOIL_TYPES not available, falling back to K-means")
        return [], [], {}
    
    # Track assigned pixels — start with background (transparent) already excluded
    assigned_mask = cv2.bitwise_not(content_mask_alpha)
    
    zones = []
    color_summary = []
    soil_stats = {}
    zone_id = 1
    
    # Sort soil types by percentage if available, otherwise use all
    sorted_soil_types = sorted(
        [(k, v) for k, v in CA_MAU_SOIL_TYPES.items() if len(v.get('colors', [])) > 0],
        key=lambda x: x[1].get('percentage', 50),
        reverse=True
    )
    
    log(f"  Processing {len(sorted_soil_types)} soil types...")
    
    # ==========================================================
    # PHASE 1: Build per-soil-type pixel masks (NO zones yet)
    # ==========================================================
    type_masks = {}     # soil_key → mask (uint8)
    type_ref_color = {} # soil_key → best reference color [R, G, B]
    
    for soil_key, soil_data in sorted_soil_types:
        combined_mask = np.zeros((h, w), dtype=np.uint8)
        best_ref_color = None
        
        for ref_color in soil_data.get("colors", []):
            ref_rgb = np.array(ref_color, dtype=np.float32)
            diff = image_rgb.astype(np.float32) - ref_rgb
            distance = np.sqrt(np.sum(diff ** 2, axis=2))
            color_mask = (distance <= tolerance).astype(np.uint8) * 255
            combined_mask = cv2.bitwise_or(combined_mask, color_mask)
            if best_ref_color is None:
                best_ref_color = ref_color
        
        # Exclude already-assigned and non-content pixels
        combined_mask = cv2.bitwise_and(combined_mask, cv2.bitwise_not(assigned_mask))
        combined_mask = cv2.bitwise_and(combined_mask, content_mask_alpha)
        
        px_count = cv2.countNonZero(combined_mask)
        if px_count == 0:
            continue
        
        type_masks[soil_key] = combined_mask
        type_ref_color[soil_key] = best_ref_color if best_ref_color else [128, 128, 128]
        
        # Mark these pixels as assigned (priority for earlier soil types)
        assigned_mask = cv2.bitwise_or(assigned_mask, combined_mask)
    
    initial_assigned = cv2.bitwise_and(assigned_mask, content_mask_alpha)
    initial_pct = cv2.countNonZero(initial_assigned) / total_pixels * 100
    log(f"  Phase 1 color match: {initial_pct:.1f}% content pixels assigned to {len(type_masks)} types")
    
    # ==========================================================
    # PHASE 2: Gap fill — assign remaining pixels to nearest type
    # ==========================================================
    unassigned = cv2.bitwise_and(
        cv2.bitwise_not(assigned_mask),
        content_mask_alpha
    )
    unassigned_count = cv2.countNonZero(unassigned)
    
    if unassigned_count > 0 and len(sorted_soil_types) > 0:
        log(f"  Phase 2 gap fill: {unassigned_count:,} pixels ({100*unassigned_count/total_pixels:.1f}%)")
        
        all_ref_colors = []
        all_ref_keys = []
        for soil_key, soil_data in sorted_soil_types:
            for ref_color in soil_data.get("colors", []):
                all_ref_colors.append(ref_color)
                all_ref_keys.append(soil_key)
        
        if all_ref_colors:
            ref_array = np.array(all_ref_colors, dtype=np.float32)
            uy, ux = np.where(unassigned > 0)
            
            if len(uy) > 0:
                gap_pixels = image_rgb[uy, ux].astype(np.float32)
                batch_size = 50000
                gap_labels = np.zeros(len(uy), dtype=np.int32)
                
                for bi in range(0, len(uy), batch_size):
                    be = min(bi + batch_size, len(uy))
                    batch = gap_pixels[bi:be]
                    diffs = batch[:, np.newaxis, :] - ref_array[np.newaxis, :, :]
                    dists = np.sqrt(np.sum(diffs ** 2, axis=2))
                    gap_labels[bi:be] = np.argmin(dists, axis=1)
                
                # Add gap pixels INTO existing type_masks (merge)
                for i, lbl in enumerate(gap_labels):
                    sk = all_ref_keys[lbl]
                    if sk not in type_masks:
                        type_masks[sk] = np.zeros((h, w), dtype=np.uint8)
                        type_ref_color[sk] = all_ref_colors[lbl]
                    type_masks[sk][uy[i], ux[i]] = 255
                
                log(f"  Gap pixels merged into {len(type_masks)} type masks")
    
    # ==========================================================
    # PHASE 3: Morphological merge → connected components → zones
    # ==========================================================
    log(f"  Phase 3: Creating merged zones from {len(type_masks)} soil types...")
    
    zones = []
    color_summary = []
    soil_stats = {}
    zone_id = 1
    
    for soil_key, type_mask in type_masks.items():
        soil_data = dict(sorted_soil_types).get(soil_key, {})
        name_vi = soil_data.get("name_vi", soil_key)
        soil_code = soil_data.get("code", "?")
        description = soil_data.get("description", "")
        best_ref_color = type_ref_color.get(soil_key, [128, 128, 128])
        rgb_hex = '#{:02x}{:02x}{:02x}'.format(
            int(best_ref_color[0]), int(best_ref_color[1]), int(best_ref_color[2])
        )
        
        # Morphological close with LARGE kernel to merge nearby fragments
        merged = cv2.morphologyEx(type_mask, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8), iterations=2)
        merged = cv2.morphologyEx(merged, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        # Re-clip to content area
        merged = cv2.bitwise_and(merged, content_mask_alpha)
        
        # Connected components on the MERGED mask = fewer, larger zones
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
            merged, connectivity=8
        )
        
        soil_zone_count = 0
        soil_total_area = 0
        
        for label_idx in range(1, num_labels):
            area = stats[label_idx, cv2.CC_STAT_AREA]
            if area < min_area:
                continue
            
            area_percent = (area / total_pixels) * 100
            if area_percent > 90:
                continue
            
            component_mask = (labels == label_idx).astype(np.uint8) * 255
            
            contours, _ = cv2.findContours(
                component_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            if not contours:
                continue
            
            contour = max(contours, key=cv2.contourArea)
            if len(contour) < 5:
                continue
            
            # Smooth contour with B-spline for curved boundaries
            num_pts = min(120, max(30, len(contour)))
            smoothed = _smooth_contour_spline(contour, num_points=num_pts, smoothing=2)
            if smoothed is None or len(smoothed) < 3:
                smoothed = simplify_contour(contour, max_points=60)
            
            polygon_points = contour_to_polygon(smoothed, image.shape, geo_bounds)
            
            cx = centroids[label_idx][0]
            cy = centroids[label_idx][1]
            
            if _current_affine_transform is not None:
                c_lat, c_lng = _current_affine_transform(float(cx), float(cy))
                center = {'lat': round(c_lat, 6), 'lng': round(c_lng, 6)}
            elif geo_bounds:
                center_nx = cx / w
                center_ny = cy / h
                sw = geo_bounds['sw']
                ne = geo_bounds['ne']
                center = {
                    'lat': round(ne['lat'] - center_ny * (ne['lat'] - sw['lat']), 6),
                    'lng': round(sw['lng'] + center_nx * (ne['lng'] - sw['lng']), 6)
                }
            else:
                center = [round(cx / w, 4), round(cy / h, 4)]
            
            area_info = calculate_area_hectares(area_percent, geo_bounds)
            
            zone_data = {
                'id': zone_id,
                'name': f"{name_vi} #{soil_zone_count + 1}",
                'fillColor': rgb_hex,
                'colorRgb': list(best_ref_color),
                'areaPercent': round(area_percent, 3),
                'centerLat': center.get('lat') if isinstance(center, dict) else None,
                'centerLng': center.get('lng') if isinstance(center, dict) else None,
                'center': center,
                'boundaryCoordinates': json.dumps(polygon_points),
                'pointCount': len(polygon_points),
                'zoneType': soil_key,
                'zoneCode': soil_code,
                'zoneName': name_vi,
                'landUsePurpose': description,
                'soilMatchDistance': 0,
                'fromLegend': False,
                'mapType': 'soil'
            }
            
            if area_info:
                zone_data['areaHectares'] = area_info['area_ha']
                zone_data['areaKm2'] = area_info['area_km2']
                zone_data['areaM2'] = area_info['area_m2']
                zone_data['areaSqm'] = area_info['area_m2']
            
            zones.append(zone_data)
            zone_id += 1
            soil_zone_count += 1
            soil_total_area += area
        
        if soil_zone_count > 0:
            total_area_pct = (soil_total_area / total_pixels) * 100
            log(f"    {name_vi[:38]:38} | {soil_zone_count:4} zones | {total_area_pct:5.1f}%")
            
            color_summary.append({
                'color': rgb_hex,
                'rgb': list(best_ref_color),
                'percentage': round(total_area_pct, 2),
                'polygonCount': soil_zone_count,
                'fromLegend': False,
                'soilType': soil_key,
                'soilName': name_vi
            })
            
            soil_stats[soil_key] = {
                'zoneType': soil_key,
                'zoneName': name_vi,
                'zoneCode': soil_code,
                'zoneCount': soil_zone_count,
                'totalAreaPercent': round(total_area_pct, 2),
                'totalAreaHa': round(sum(z.get('areaHectares', 0) for z in zones if z.get('zoneType') == soil_key), 4)
            }
    
    # Final stats
    final_coverage = sum(z['areaPercent'] for z in zones)
    log(f"  Total zones: {len(zones)}, coverage: {final_coverage:.1f}%")
    log(f"  Soil types: {len(soil_stats)}")
    for sk, ss in soil_stats.items():
        log(f"    - {ss['zoneName']}: {ss['zoneCount']} zones, {ss['totalAreaPercent']:.1f}%")
    
    return zones, color_summary, soil_stats


def analyze_map_image(image_path, output_json_path, extract_legend=False, geo_bounds=None, max_dimension=2000, image_overlay=False, map_type='soil', control_points=None):
    """
    Phân tích ảnh bản đồ và trích xuất polygons theo màu.
    Output format: ready for planning_zones database table.
    
    THREE MODES based on map_type and image_overlay:
    1. SOIL MODE (map_type='soil'): K-means clustering + color matching từ legend/soil data
    2. PLANNING MODE (map_type='planning'): Watershed + boundary detection
    3. IMAGE OVERLAY MODE (image_overlay=True): Save processed map image for overlay
    
    Args:
        image_path: Đường dẫn ảnh đầu vào (PNG, JPG, JPEG)
        output_json_path: Đường dẫn lưu kết quả JSON
        extract_legend: Có trích xuất vùng legend không
        geo_bounds: Tọa độ địa lý của bản đồ {'sw': {lat, lng}, 'ne': {lat, lng}}
        max_dimension: Kích thước tối đa để resize (default 2000px)
        image_overlay: Bật chế độ Image Overlay (như KMZ)
        map_type: Loại bản đồ - 'soil' (Thổ nhưỡng) hoặc 'planning' (Quy hoạch)
    """
    log(f"Loading image: {image_path}")
    log(f"Map type: {map_type.upper()}")
    log(f"Mode: {'IMAGE OVERLAY' if image_overlay else 'POLYGON EXTRACTION'}")
    
    # Validate file extension
    valid_extensions = ['.png', '.jpg', '.jpeg']
    file_ext = os.path.splitext(image_path)[1].lower()
    if file_ext not in valid_extensions:
        log(f"WARNING: File extension '{file_ext}' may not be supported. Supported: {valid_extensions}")
    
    # Read file using numpy to handle Unicode paths (OpenCV cv2.imread has issues)
    content_mask_alpha = None  # Will hold content mask from alpha channel if PNG
    try:
        with open(image_path, 'rb') as f:
            file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
        # First try UNCHANGED to detect alpha channel
        image_raw = cv2.imdecode(file_bytes, cv2.IMREAD_UNCHANGED)
        if image_raw is not None and len(image_raw.shape) == 3 and image_raw.shape[2] == 4:
            alpha = image_raw[:, :, 3]
            content_mask_alpha = (alpha > 10).astype(np.uint8) * 255
            transparent_pct = (1 - np.count_nonzero(content_mask_alpha) / (alpha.shape[0] * alpha.shape[1])) * 100
            log(f"PNG with alpha channel detected: {transparent_pct:.1f}% transparent")
            # Convert BGRA to BGR, filling transparent areas with white
            image = image_raw[:, :, :3].copy()
            image[alpha < 10] = [255, 255, 255]  # White background for transparent
        else:
            image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    except Exception as e:
        log(f"ERROR: Cannot read file {image_path}: {e}")
        return None
        
    if image is None:
        log(f"ERROR: Cannot decode image {image_path}")
        return None
    
    h_orig, w_orig = image.shape[:2]
    file_size_mb = os.path.getsize(image_path) / (1024 * 1024)
    log(f"Original image: {w_orig}x{h_orig} ({file_size_mb:.2f} MB)")
    
    # Step 0a: Smart resize to optimize processing
    log("Step 0a: Smart resize for optimal processing...")
    image, resize_info = smart_resize_image(image, max_dimension=max_dimension)
    
    # Resize content mask if alpha channel was present
    if content_mask_alpha is not None and resize_info.get('resized'):
        new_h, new_w = image.shape[:2]
        content_mask_alpha = cv2.resize(content_mask_alpha, (new_w, new_h), interpolation=cv2.INTER_NEAREST)
    
    # Step 0a2: Build affine transform from control points if available
    global _current_affine_transform
    _current_affine_transform = None
    if control_points:
        log("Step 0a2: Building affine transform from GCP control points...")
        pixel_to_geo, geo_to_pixel = build_affine_transform(control_points, image.shape, resize_info)
        if pixel_to_geo:
            _current_affine_transform = pixel_to_geo
            log("  Affine transform ACTIVE - using GCP-based coordinate mapping")
        else:
            log("  WARNING: Could not build affine transform, falling back to linear mapping")
    
    # Step 0b: Extract legend BEFORE cropping (legend is usually outside main map area)
    legend_info = None
    legend_colors = []
    if extract_legend:
        log("Step 0b: Extracting legend region and colors...")
        legend_result = extract_legend_region(image)
        if legend_result:
            legend_name, legend_crop = legend_result
            log(f"  Found legend at: {legend_name}")
            
            # Extract colors from legend
            legend_colors = extract_colors_from_legend(legend_crop)
            
            if legend_colors:
                log(f"  Legend contains {len(legend_colors)} unique colors")
                for i, lc in enumerate(legend_colors[:5]):  # Show first 5
                    log(f"    {i+1}. {lc['hex']} at position {lc['position']}")
                if len(legend_colors) > 5:
                    log(f"    ... and {len(legend_colors) - 5} more")
            
            # Save legend image for AI labeling
            legend_output_path = output_json_path.replace('.json', '_legend.jpg')
            cv2.imwrite(legend_output_path, legend_crop)
            
            # Convert to base64 for API
            _, buffer = cv2.imencode('.jpg', legend_crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
            legend_base64 = base64.b64encode(buffer).decode('utf-8')
            
            legend_info = {
                'position': legend_name,
                'base64': legend_base64,
                'width': legend_crop.shape[1],
                'height': legend_crop.shape[0],
                'colors': legend_colors  # Colors extracted from legend
            }
            log(f"  Legend saved to: {legend_output_path}")
    
    # Step 0c: Auto-crop to remove borders/legends
    log("Step 0c: Auto-cropping map content...")
    image, crop_rect = crop_to_map_content(image)
    h, w = image.shape[:2]
    
    log(f"Final processing size: {w}x{h}")
    
    # ============ IMAGE OVERLAY MODE ============
    # Nếu bật image_overlay, tạo ảnh overlay và return ngay
    # Không cần extract polygons - frontend sẽ dùng L.imageOverlay như KMZ
    overlay_info = None
    if image_overlay:
        log("=== IMAGE OVERLAY MODE ===")
        log("Creating map overlay image (like KMZ GroundOverlay)...")
        overlay_info = create_image_overlay(image, output_json_path, geo_bounds)
        
        # Build simple result with overlay info
        result = {
            'success': True,
            'mode': 'IMAGE_OVERLAY',
            'imageSize': {'width': w, 'height': h},
            'originalSize': {'width': w_orig, 'height': h_orig},
            'resizeInfo': resize_info,
            'overlay': overlay_info,  # Contains imagePath, boundaryCoordinates
            'legend': legend_info,
            'colorSummary': [{'color': c['hex'], 'rgb': c['rgb']} for c in legend_colors] if legend_colors else [],
            'totalZones': 1,  # Single zone: the entire map overlay
            'zones': [{
                'id': 1,
                'name': 'Map Overlay',
                'imageUrl': '/api/files/map-overlays/' + overlay_info['imageFilename'],  # URL for frontend
                'boundaryCoordinates': json.dumps(overlay_info['boundaryCoordinates']),
                'fillOpacity': overlay_info['opacity'],
                'isOverlay': True  # Flag to identify as image overlay
            }]
        }
        
        # Save JSON
        with open(output_json_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        log(f"Image overlay result saved to: {output_json_path}")
        
        # Stdout for Java
        stdout_status = {
            "status": "SUCCESS",
            "mode": "IMAGE_OVERLAY",
            "totalZones": 1,
            "overlayImage": overlay_info['imageFilename'],
            "outputFile": output_json_path
        }
        print("===JSON_START===")
        print(json.dumps(stdout_status, ensure_ascii=False))
        print("===JSON_END===")
        
        return result
    
    # ============ PLANNING MAP MODE ============
    # Thuật toán khác hoàn toàn: Watershed + Boundary Detection
    if map_type == 'planning':
        log("=== PLANNING MAP MODE (Watershed + Boundary Detection) ===")
        log("Algorithm: Grid removal → Boundary detection → Watershed segmentation")
        return _analyze_planning_zones(
            image, output_json_path, geo_bounds, legend_info, legend_colors,
            w, h, w_orig, h_orig, resize_info, content_mask_alpha
        )
    
    # ============ SOIL MAP MODE (default) ============
    # Pipeline: Preprocess → Pixel-accurate Euclidean matching → Connected components → Smooth contours
    log("=== SOIL MAP MODE (Pixel-Accurate Color Matching) ===")
    log("Pipeline: Preprocess → Euclidean color match → Connected components → Smooth contours")
    
    # Step 1: Preprocess map - remove non-soil elements
    log("Step 1: Preprocessing - removing grid lines, text, roads, borders...")
    preprocessed = _preprocess_soil_image(image, content_mask_alpha)
    
    # Step 2: Pixel-accurate soil zone detection
    log("Step 2: Pixel-accurate soil zone detection using reference colors...")
    zones, color_summary, soil_stats = _detect_soil_zones_pixel_accurate(
        preprocessed, image.shape, geo_bounds, content_mask_alpha
    )
    
    log(f"  Total zones extracted: {len(zones)}")
    soil_types_found = set(z['zoneType'] for z in zones if z.get('zoneType'))
    log(f"  Soil types classified: {len(soil_types_found)}")
    for st in soil_types_found:
        count = sum(1 for z in zones if z.get('zoneType') == st)
        name = next((z.get('zoneName', st) for z in zones if z.get('zoneType') == st), st)
        log(f"    - {name}: {count} zones")
    
    # Build result
    result = {
        'success': True,
        'imageSize': {'width': w, 'height': h},
        'originalSize': {'width': w_orig, 'height': h_orig},
        'resizeInfo': resize_info,  # Include resize details
        'colorSummary': color_summary,  # Now includes fromLegend flag
        'soilStatistics': list(soil_stats.values()),  # NEW: soil type statistics
        'totalZones': len(zones),
        'soilTypesCount': len(soil_stats),  # NEW: number of soil types
        'zones': zones,
        'legend': legend_info,
        'legendBasedExtraction': len(legend_colors) > 0,  # Flag indicating if legend was used
        'hasGeoBounds': geo_bounds is not None,
        'soilDataAvailable': SOIL_DATA_AVAILABLE
    }
    
    # Save JSON
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    log(f"Result saved to: {output_json_path}")
    
    # Create MINIMAL stdout result - just status info
    # Java MUST read full data from output file, NOT from stdout
    # This is critical because zones + boundaries can be 900KB+ which breaks BufferedReader
    stdout_status = {
        "status": "SUCCESS",
        "totalZones": result.get("totalZones", 0),
        "soilTypesCount": result.get("soilTypesCount", 0),
        "originalSize": result.get("originalSize"),
        "processedSize": result.get("imageSize"),
        "resized": resize_info.get("resized", False),
        "hasLegend": legend_info is not None,
        "soilDataAvailable": SOIL_DATA_AVAILABLE,
        "outputFile": output_json_path
    }
    
    print("===JSON_START===")
    print(json.dumps(stdout_status, ensure_ascii=False))
    print("===JSON_END===")
    
    return result

import argparse

def main():
    parser = argparse.ArgumentParser(description="Map Polygon Extractor (OpenCV)")
    parser.add_argument("input_path", help="Path to input image file (PNG, JPG, JPEG)")
    parser.add_argument("output_path", help="Path to save output JSON")
    parser.add_argument("--with-legend", action="store_true", help="Extract legend region")
    parser.add_argument("--image-overlay", action="store_true", 
                        help="Use IMAGE OVERLAY mode (like KMZ GroundOverlay) instead of polygon extraction")
    parser.add_argument("--geo-bounds", help="JSON string of geometric bounds (sw, ne, center)")
    parser.add_argument("--geo-bounds-file", help="Path to JSON file containing geometric bounds")
    parser.add_argument("--control-points-file", help="Path to JSON file with 4 GCP control points for affine transform")
    parser.add_argument("--max-dimension", type=int, default=2000, 
                        help="Maximum image dimension for resize (default: 2000px)")
    parser.add_argument("--map-type", choices=['soil', 'planning'], default='soil',
                        help="Map type: 'soil' (Thổ nhưỡng - K-means) or 'planning' (Quy hoạch - Watershed)")

    args = parser.parse_args()
    
    input_path = args.input_path
    output_path = args.output_path
    extract_legend = args.with_legend
    image_overlay = args.image_overlay
    map_type = args.map_type
    
    geo_bounds = None
    control_points_data = None
    
    # Load control points file for affine transform
    if args.control_points_file:
        try:
            with open(args.control_points_file, 'r', encoding='utf-8') as f:
                control_points_data = json.load(f)
            log(f"Loaded {len(control_points_data)} control points from: {args.control_points_file}")
        except Exception as e:
            log(f"Error reading control points file: {e}")
    
    # Priority 1: Read geo bounds from file (more reliable)
    if args.geo_bounds_file:
        try:
            with open(args.geo_bounds_file, 'r', encoding='utf-8') as f:
                geo_bounds = json.load(f)
            log(f"Loaded geo bounds from file: {args.geo_bounds_file}")
        except Exception as e:
            log(f"Error reading geo bounds file: {e}")
    
    # Priority 2: Parse from command-line argument (legacy support)
    elif args.geo_bounds:
        try:
            json_str = args.geo_bounds.strip()
            if (json_str.startswith("'") and json_str.endswith("'")) or \
               (json_str.startswith('"') and json_str.endswith('"')):
                json_str = json_str[1:-1]
            geo_bounds = json.loads(json_str)
            log(f"Received geo bounds from argument")
        except Exception as e:
            log(f"Error parsing geo bounds argument: {e}")

    if not os.path.exists(input_path):
        log(f"ERROR: File not found: {input_path}")
        sys.exit(1)
    
    # Use max_dimension from CLI args (default: 2000px)
    max_dim = args.max_dimension
    log(f"Using max dimension: {max_dim}px")
    log(f"Map type: {map_type}")
    
    # Call analyze with map_type parameter + control points
    result = analyze_map_image(
        input_path, output_path, extract_legend, geo_bounds, 
        max_dimension=max_dim, image_overlay=image_overlay,
        map_type=map_type, control_points=control_points_data
    )
    
    if result:
        mode = result.get('mode', 'POLYGON')
        log(f"SUCCESS: {mode} mode - {result['totalZones']} zones")
        sys.exit(0)
    else:
        log("FAILED: Could not analyze image")
        sys.exit(1)

if __name__ == "__main__":
    main()
