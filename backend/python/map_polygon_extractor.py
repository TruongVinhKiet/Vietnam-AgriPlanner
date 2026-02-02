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
import base64
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

def quantize_colors(image, n_colors=16):
    """
    Giảm số lượng màu trong ảnh xuống n_colors màu chính.
    Giúp gom các vùng màu tương tự thành một.
    Returns the quantized image (same size as input).
    """
    h, w = image.shape[:2]
    
    # For k-means, use a smaller sample for speed
    max_samples = 100000
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

def get_dominant_colors(image, n_colors=20, min_percentage=0.15):
    """
    Lấy danh sách các màu chiếm diện tích đáng kể trong ảnh.
    Loại bỏ các màu quá gần trắng/đen (nền, viền).
    Reduced min_percentage from 1.0 to 0.15 for soil maps with many small zones.
    Increased n_colors to 20 for maps with many soil types.
    """
    # Quantize with more colors to capture all soil types
    quantized, centers = quantize_colors(image, min(n_colors * 3, 64))
    
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
    
    for color, count in color_counts.most_common():
        percentage = (count / total_pixels) * 100
        
        if percentage < min_percentage:
            skipped_small += 1
            continue
            
        # Skip colors too close to white (background) - relaxed threshold
        r, g, b = int(color[0]), int(color[1]), int(color[2])  # Convert numpy to int to avoid overflow
        if r > 245 and g > 245 and b > 245:
            skipped_white += 1
            continue
        # Skip colors too close to black (borders)
        if r < 10 and g < 10 and b < 10:
            skipped_black += 1
            continue
        # Skip grayscale (text, lines) - but allow slightly off-gray colors
        if abs(r - g) < 8 and abs(g - b) < 8 and abs(r - b) < 8 and min(r,g,b) < 230:
            skipped_gray += 1
            continue
            
        dominant.append({
            'rgb': [r, g, b],
            'hex': rgb_to_hex((r, g, b)),
            'percentage': round(percentage, 2),
            'pixel_count': count
        })
    
    log(f"  Skipped colors: white={skipped_white}, black={skipped_black}, gray={skipped_gray}, small={skipped_small}")
    log(f"  Accepted {len(dominant)} dominant colors")
    
    return dominant[:n_colors]

def create_color_mask(image, target_rgb, tolerance=35):
    """
    Tạo mask cho một màu cụ thể với độ chấp nhận sai số.
    Increased tolerance to 35 for better matching with gradient maps.
    """
    lower = np.array([max(0, c - tolerance) for c in target_rgb])
    upper = np.array([min(255, c + tolerance) for c in target_rgb])
    
    mask = cv2.inRange(image, lower, upper)
    
    # Clean up mask
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    
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

def extract_polygons_for_color(image, color_info, min_area_percent=0.02, geo_bounds=None, max_points=20):
    """
    Trích xuất tất cả polygon cho một màu cụ thể.
    Output format: ready for planning_zones table.
    Reduced min_area_percent from 0.1 to 0.02 (2% -> 0.2% of image) for small soil zones.
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
    
    return cropped, (x, y, w_crop, h_crop)

def analyze_map_image(image_path, output_json_path, extract_legend=False, geo_bounds=None, max_dimension=2000):
    """
    Phân tích ảnh bản đồ và trích xuất polygons theo màu.
    Output format: ready for planning_zones database table.
    
    Args:
        image_path: Đường dẫn ảnh đầu vào (PNG, JPG, JPEG)
        output_json_path: Đường dẫn lưu kết quả JSON
        extract_legend: Có trích xuất vùng legend không
        geo_bounds: Tọa độ địa lý của bản đồ
        max_dimension: Kích thước tối đa để resize (default 2000px)
    """
    log(f"Loading image: {image_path}")
    
    # Validate file extension
    valid_extensions = ['.png', '.jpg', '.jpeg']
    file_ext = os.path.splitext(image_path)[1].lower()
    if file_ext not in valid_extensions:
        log(f"WARNING: File extension '{file_ext}' may not be supported. Supported: {valid_extensions}")
    
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
    file_size_mb = os.path.getsize(image_path) / (1024 * 1024)
    log(f"Original image: {w_orig}x{h_orig} ({file_size_mb:.2f} MB)")
    
    # Step 0a: Smart resize to optimize processing
    log("Step 0a: Smart resize for optimal processing...")
    image, resize_info = smart_resize_image(image, max_dimension=max_dimension)
    
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
    
    # Step 1: Determine which colors to extract
    if legend_colors:
        # LEGEND-BASED MODE: Only extract colors that match the legend
        log("Step 1: Using LEGEND-BASED color extraction...")
        log(f"  Will only extract polygons for {len(legend_colors)} colors from legend")
        colors = legend_colors
    else:
        # FALLBACK: Auto-detect dominant colors
        log("Step 1: Detecting dominant colors (no legend)...")
        colors = get_dominant_colors(image, n_colors=20, min_percentage=0.15)
        log(f"  Found {len(colors)} significant colors")
        
        if len(colors) == 0:
            log("  WARNING: No dominant colors found! Trying with lower threshold...")
            colors = get_dominant_colors(image, n_colors=20, min_percentage=0.1)
            log(f"  Retry found {len(colors)} colors with 0.1% threshold")
    
    # Step 2: Extract polygons for each color (max 20 points per polygon)
    log("Step 2: Extracting polygons for each color (max 20 points)...")
    zones = []
    zone_id = 1
    color_summary = []
    
    for color in colors:
        color_hex = color['hex']
        log(f"  Processing color {color_hex}...")
        polygons = extract_polygons_for_color(
            image, color, 
            min_area_percent=0.02,  # Reduced from 0.05 for small soil zones
            geo_bounds=geo_bounds,
            max_points=20
        )
        
        total_area_percent = sum(p['areaPercent'] for p in polygons)
        log(f"    -> Found {len(polygons)} polygons ({total_area_percent:.2f}% total area)")
        
        # Track color summary for GPT-4o labeling
        if polygons:
            color_summary.append({
                'color': color_hex,
                'rgb': color['rgb'],
                'percentage': round(total_area_percent, 2),
                'polygonCount': len(polygons),
                'fromLegend': 'position' in color  # Flag if color came from legend
            })
        
        for polygon in polygons:
            # Output matches planning_zones table columns
            zones.append({
                'id': zone_id,
                'name': f"Zone {zone_id}",
                # From OpenCV
                'fillColor': color_hex,  # fill_color in DB
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
                'landUsePurpose': None, # land_use_purpose
                'fromLegend': 'position' in color  # Mark if matched from legend
            })
            zone_id += 1
    
    log(f"  Total zones extracted: {len(zones)}")
    log(f"  Colors from legend: {sum(1 for c in color_summary if c.get('fromLegend'))}")
    log(f"  Colors auto-detected: {sum(1 for c in color_summary if not c.get('fromLegend'))}")
    
    # Step 3: Legend info was already extracted in Step 0b
    # No need to do it again
    
    # Build result
    result = {
        'success': True,
        'imageSize': {'width': w, 'height': h},
        'originalSize': {'width': w_orig, 'height': h_orig},
        'resizeInfo': resize_info,  # Include resize details
        'colorSummary': color_summary,  # Now includes fromLegend flag
        'totalZones': len(zones),
        'zones': zones,
        'legend': legend_info,
        'legendBasedExtraction': len(legend_colors) > 0  # Flag indicating if legend was used
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
        "originalSize": result.get("originalSize"),
        "processedSize": result.get("imageSize"),
        "resized": resize_info.get("resized", False),
        "hasLegend": legend_info is not None,
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
    parser.add_argument("--geo-bounds", help="JSON string of geometric bounds (sw, ne, center)")
    parser.add_argument("--max-dimension", type=int, default=2000, 
                        help="Maximum image dimension for resize (default: 2000px)")

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
    
    # Use max_dimension from CLI args (default: 2000px)
    max_dim = args.max_dimension
    log(f"Using max dimension: {max_dim}px")
    
    result = analyze_map_image(input_path, output_path, extract_legend, geo_bounds, max_dimension=max_dim)
    
    if result:
        log(f"SUCCESS: Extracted {result['totalZones']} zones")
        sys.exit(0)
    else:
        log("FAILED: Could not analyze image")
        sys.exit(1)

if __name__ == "__main__":
    main()
