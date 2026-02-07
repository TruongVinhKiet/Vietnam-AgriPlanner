#!/usr/bin/env python3
"""
Map Preprocessor - Clean up map images before analysis
Removes:
- Blue/gray grid lines (tọa độ)
- Black dashed border lines (ranh giới hành chính)
- Place names and text (tên tỉnh, địa danh)
- Red dots and roads (đường giao thông)
- Cyan/blue rivers and waterways (sông suối - optional)

Produces a clean image with only soil color zones for better analysis.
"""

import cv2
import numpy as np
import sys
import os

# Fix Unicode encoding for Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

def log(message):
    try:
        print(f"[Preprocessor] {message}", flush=True)
    except UnicodeEncodeError:
        safe_msg = str(message).encode('ascii', 'replace').decode('ascii')
        print(f"[Preprocessor] {safe_msg}", flush=True)


def remove_grid_lines(image, hsv):
    """
    Remove blue/gray coordinate grid lines
    These are typically thin, straight, and bluish/grayish
    """
    # Detect blue grid lines (dark blue in the map)
    lower_blue = np.array([90, 30, 50])
    upper_blue = np.array([130, 255, 200])
    blue_mask = cv2.inRange(hsv, lower_blue, upper_blue)
    
    # Use morphological operations to find thin lines
    kernel_h = np.ones((1, 15), np.uint8)  # Horizontal lines
    kernel_v = np.ones((15, 1), np.uint8)  # Vertical lines
    
    h_lines = cv2.morphologyEx(blue_mask, cv2.MORPH_OPEN, kernel_h)
    v_lines = cv2.morphologyEx(blue_mask, cv2.MORPH_OPEN, kernel_v)
    
    grid_mask = cv2.bitwise_or(h_lines, v_lines)
    
    # Dilate slightly to cover the full line width
    grid_mask = cv2.dilate(grid_mask, np.ones((3, 3), np.uint8), iterations=1)
    
    return grid_mask


def remove_black_lines(image, gray):
    """
    Remove black dashed border lines between administrative regions
    """
    # Very dark pixels (black lines)
    _, black_mask = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY_INV)
    
    # Find thin line structures using morphology
    kernel_h = np.ones((1, 10), np.uint8)
    kernel_v = np.ones((10, 1), np.uint8)
    kernel_d1 = np.eye(10, dtype=np.uint8)  # Diagonal
    kernel_d2 = np.fliplr(np.eye(10, dtype=np.uint8))  # Other diagonal
    
    h_lines = cv2.morphologyEx(black_mask, cv2.MORPH_OPEN, kernel_h)
    v_lines = cv2.morphologyEx(black_mask, cv2.MORPH_OPEN, kernel_v)
    d1_lines = cv2.morphologyEx(black_mask, cv2.MORPH_OPEN, kernel_d1)
    d2_lines = cv2.morphologyEx(black_mask, cv2.MORPH_OPEN, kernel_d2)
    
    # Combine all line directions
    lines_mask = cv2.bitwise_or(h_lines, v_lines)
    lines_mask = cv2.bitwise_or(lines_mask, d1_lines)
    lines_mask = cv2.bitwise_or(lines_mask, d2_lines)
    
    # Also detect dashed patterns - small isolated black segments
    # This catches the dashed administrative borders
    kernel_small = np.ones((3, 3), np.uint8)
    small_segments = cv2.morphologyEx(black_mask, cv2.MORPH_OPEN, kernel_small)
    
    # Dilate to connect dashed segments
    small_segments = cv2.dilate(small_segments, kernel_small, iterations=2)
    
    # Combine
    black_lines = cv2.bitwise_or(lines_mask, small_segments)
    
    # Dilate slightly
    black_lines = cv2.dilate(black_lines, np.ones((2, 2), np.uint8), iterations=1)
    
    return black_lines


def remove_red_elements(image, hsv):
    """
    Remove red dots (cities) and red roads
    """
    # Red color range (wraps around in HSV)
    lower_red1 = np.array([0, 100, 100])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([160, 100, 100])
    upper_red2 = np.array([180, 255, 255])
    
    red_mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    red_mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    red_mask = cv2.bitwise_or(red_mask1, red_mask2)
    
    # Dilate to fully cover roads and dots
    kernel = np.ones((5, 5), np.uint8)
    red_mask = cv2.dilate(red_mask, kernel, iterations=2)
    
    return red_mask


def remove_text(image, gray):
    """
    Remove text/labels from the map using edge detection and morphology
    Text typically has high contrast edges in small regions
    """
    # Detect edges
    edges = cv2.Canny(gray, 100, 200)
    
    # Text has many small edge components close together
    # Use morphological closing to connect text components
    kernel = np.ones((5, 5), np.uint8)
    text_regions = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    
    # Find contours that are likely text (small, dense edge regions)
    contours, _ = cv2.findContours(text_regions, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    text_mask = np.zeros(gray.shape, dtype=np.uint8)
    
    h, w = gray.shape
    for contour in contours:
        area = cv2.contourArea(contour)
        x, y, bw, bh = cv2.boundingRect(contour)
        
        # Text characteristics: small area, not too thin/tall
        # Typically text boxes are wider than tall and small relative to map
        if 50 < area < 50000:  # Size range for text
            aspect = max(bw, bh) / (min(bw, bh) + 1)
            if aspect < 10:  # Not too elongated (that would be a line)
                # Check if region has dark content (text is usually black)
                roi = gray[y:y+bh, x:x+bw]
                if np.mean(roi) < 200:  # Has dark content
                    cv2.drawContours(text_mask, [contour], -1, 255, -1)
    
    # Dilate to cover full text
    text_mask = cv2.dilate(text_mask, np.ones((7, 7), np.uint8), iterations=2)
    
    return text_mask


def remove_cyan_rivers(image, hsv):
    """
    Remove cyan/turquoise river lines
    """
    # Cyan color range
    lower_cyan = np.array([80, 100, 100])
    upper_cyan = np.array([100, 255, 255])
    cyan_mask = cv2.inRange(hsv, lower_cyan, upper_cyan)
    
    # Rivers are thin, elongated shapes
    # Find contours and filter for elongated ones
    contours, _ = cv2.findContours(cyan_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    river_mask = np.zeros(cyan_mask.shape, dtype=np.uint8)
    
    for contour in contours:
        area = cv2.contourArea(contour)
        if area > 100:  # Ignore tiny specs
            perimeter = cv2.arcLength(contour, True)
            # Rivers have high perimeter-to-area ratio (thin and long)
            if perimeter > 0:
                compactness = 4 * np.pi * area / (perimeter * perimeter)
                if compactness < 0.3:  # Elongated shape = river
                    cv2.drawContours(river_mask, [contour], -1, 255, -1)
    
    # Dilate slightly
    river_mask = cv2.dilate(river_mask, np.ones((3, 3), np.uint8), iterations=1)
    
    return river_mask


def inpaint_removed_regions(image, mask):
    """
    Fill in removed regions using inpainting with surrounding colors
    """
    # Use OpenCV inpainting for smooth fill
    result = cv2.inpaint(image, mask, inpaintRadius=7, flags=cv2.INPAINT_TELEA)
    return result


def smooth_color_regions(image, d=9, sigma_color=75, sigma_space=75):
    """
    Smooth color regions using bilateral filter (preserves edges but smooths within regions)
    """
    return cv2.bilateralFilter(image, d, sigma_color, sigma_space)


def preprocess_soil_map(image_path, output_path, remove_rivers=False):
    """
    Main preprocessing function
    
    Args:
        image_path: Input map image
        output_path: Output cleaned image
        remove_rivers: Whether to remove river/waterway lines (default False, keep for reference)
    """
    log(f"Loading: {image_path}")
    
    # Read image (handle Unicode paths)
    try:
        with open(image_path, 'rb') as f:
            file_bytes = np.frombuffer(f.read(), dtype=np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    except Exception as e:
        log(f"Error loading: {e}")
        return None
    
    if image is None:
        log("Failed to load image")
        return None
    
    h, w = image.shape[:2]
    log(f"Image size: {w}x{h}")
    
    # Convert to different color spaces
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Create combined removal mask
    removal_mask = np.zeros((h, w), dtype=np.uint8)
    
    # 1. Remove blue grid lines
    log("Detecting grid lines...")
    grid_mask = remove_grid_lines(image, hsv)
    removal_mask = cv2.bitwise_or(removal_mask, grid_mask)
    log(f"  Grid lines: {np.count_nonzero(grid_mask):,} pixels")
    
    # 2. Remove black border lines
    log("Detecting border lines...")
    black_mask = remove_black_lines(image, gray)
    removal_mask = cv2.bitwise_or(removal_mask, black_mask)
    log(f"  Border lines: {np.count_nonzero(black_mask):,} pixels")
    
    # 3. Remove red roads and dots
    log("Detecting red elements...")
    red_mask = remove_red_elements(image, hsv)
    removal_mask = cv2.bitwise_or(removal_mask, red_mask)
    log(f"  Red elements: {np.count_nonzero(red_mask):,} pixels")
    
    # 4. Remove text
    log("Detecting text...")
    text_mask = remove_text(image, gray)
    removal_mask = cv2.bitwise_or(removal_mask, text_mask)
    log(f"  Text regions: {np.count_nonzero(text_mask):,} pixels")
    
    # 5. Optionally remove rivers
    if remove_rivers:
        log("Detecting rivers...")
        river_mask = remove_cyan_rivers(image, hsv)
        removal_mask = cv2.bitwise_or(removal_mask, river_mask)
        log(f"  Rivers: {np.count_nonzero(river_mask):,} pixels")
    
    total_removed = np.count_nonzero(removal_mask)
    total_pixels = h * w
    log(f"Total removed: {total_removed:,} pixels ({100*total_removed/total_pixels:.1f}%)")
    
    # 6. Inpaint the removed regions
    log("Inpainting removed regions...")
    cleaned = inpaint_removed_regions(image, removal_mask)
    
    # 7. Smooth color regions for cleaner boundaries
    log("Smoothing color regions...")
    smoothed = smooth_color_regions(cleaned, d=9, sigma_color=50, sigma_space=50)
    
    # Save result
    cv2.imwrite(output_path, smoothed)
    log(f"Saved: {output_path}")
    
    # Also save the mask for debugging
    mask_path = output_path.rsplit('.', 1)[0] + "_mask.jpg"
    cv2.imwrite(mask_path, removal_mask)
    log(f"Saved mask: {mask_path}")
    
    return smoothed


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python clean_map.py <input_image> [output_image] [--remove-rivers]")
        print("Example: python clean_map.py camau_soil.jpg camau_cleaned.jpg")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith('--') else input_path.rsplit('.', 1)[0] + "_cleaned.jpg"
    remove_rivers = '--remove-rivers' in sys.argv
    
    preprocess_soil_map(input_path, output_path, remove_rivers)
