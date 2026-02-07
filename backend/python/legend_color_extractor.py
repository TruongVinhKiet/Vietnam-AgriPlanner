#!/usr/bin/env python3
"""
Extract colors from legend image for accurate soil type color mapping
Analyzes the legend boxes to get exact RGB values
"""

import cv2
import numpy as np
import sys
import os

# Fix Unicode encoding
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

def log(message):
    try:
        print(f"[LegendExtractor] {message}", flush=True)
    except:
        pass

# Official soil type names from legend (in order from top to bottom)
LEGEND_SOIL_TYPES = [
    # Đất cát
    ("CAT_GIONG", "Đất cát giồng"),
    # Đất mặn
    ("MAN_NHIEU", "Đất mặn nhiều"),
    ("MAN_TB", "Đất mặn trung bình"),
    ("MAN_IT", "Đất mặn ít"),
    # Đất phèn tiềm tàng nông
    ("PHEN_TT_NONG_RNM", "Đất phèn tiềm tàng nông dưới rừng ngập mặn"),
    ("PHEN_TT_NONG_MAN_NHIEU", "Đất phèn tiềm tàng nông, mặn nhiều"),
    ("PHEN_TT_NONG_MAN_TB", "Đất phèn tiềm tàng nông, mặn trung bình"),
    ("PHEN_TT_NONG_MAN_IT", "Đất phèn tiềm tàng nông, mặn ít"),
    # Đất phèn tiềm tàng sâu
    ("PHEN_TT_SAU_RNM", "Đất phèn tiềm tàng sâu dưới rừng ngập mặn"),
    ("PHEN_TT_SAU_MAN_NHIEU", "Đất phèn tiềm tàng sâu, mặn nhiều"),
    ("PHEN_TT_SAU_MAN_TB", "Đất phèn tiềm tàng sâu, mặn trung bình"),
    ("PHEN_TT_SAU_MAN_IT", "Đất phèn tiềm tàng sâu, mặn ít"),
    # Đất phèn hoạt động nông
    ("PHEN_HD_NONG_MAN_NHIEU", "Đất phèn hoạt động nông, mặn nhiều"),
    ("PHEN_HD_NONG_MAN_TB", "Đất phèn hoạt động nông, mặn trung bình"),
    ("PHEN_HD_NONG_MAN_IT", "Đất phèn hoạt động nông, mặn ít"),
    # Đất phèn hoạt động sâu
    ("PHEN_HD_SAU_MAN_NHIEU", "Đất phèn hoạt động sâu, mặn nhiều"),
    ("PHEN_HD_SAU_MAN_TB", "Đất phèn hoạt động sâu, mặn trung bình"),
    ("PHEN_HD_SAU_MAN_IT", "Đất phèn hoạt động sâu, mặn ít"),
    # Đất đặc biệt
    ("THAN_BUN", "Đất than bùn phèn mặn"),
    ("DAT_VANG_DO", "Đất vàng đỏ trên đá Macma axit"),
]


def extract_legend_colors(image_path):
    """
    Extract colors from legend image by sampling color boxes
    """
    log(f"Loading legend: {image_path}")
    
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
    
    h, w = image.shape[:2]
    log(f"Image size: {w}x{h}")
    
    # Convert to RGB for analysis
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Find the legend area - look for color boxes on the left side
    # Typically legend has colored rectangles with text on the right
    
    # Sample colors at specific positions based on legend layout
    # From the images, legend boxes appear to be in a vertical list
    # Each box is approximately at the same X position
    
    results = {}
    
    # For the uploaded legend image, estimate box positions
    # The legend appears to have boxes at x~5-30 with text starting at x~35
    
    # Calculate approximate positions for 20 rows
    num_rows = len(LEGEND_SOIL_TYPES)
    
    # Find where the colored boxes start (scan from top)
    start_y = None
    for y in range(h):
        # Check if there's a colored pixel in the left region (not white/near-white)
        for x in range(min(50, w)):
            pixel = image_rgb[y, x]
            if not (pixel[0] > 240 and pixel[1] > 240 and pixel[2] > 240):  # Not white
                if pixel[0] > 150 or pixel[1] > 100 or pixel[2] > 100:  # Has some color
                    start_y = y
                    break
        if start_y:
            break
    
    if start_y is None:
        start_y = 40  # Default
    
    log(f"Legend starts at y={start_y}")
    
    # Estimate row height
    # Scan down to find the bottom of legend
    end_y = h
    for y in range(h - 1, start_y, -1):
        for x in range(min(50, w)):
            pixel = image_rgb[y, x]
            if not (pixel[0] > 240 and pixel[1] > 240 and pixel[2] > 240):
                if pixel[0] > 100 or pixel[1] > 100 or pixel[2] > 100:
                    end_y = y
                    break
        if end_y != h:
            break
    
    legend_height = end_y - start_y
    row_height = legend_height / num_rows
    log(f"Legend height: {legend_height}, row height: {row_height:.1f}")
    
    # Sample each row
    for i, (key, name) in enumerate(LEGEND_SOIL_TYPES):
        y = int(start_y + (i + 0.5) * row_height)
        
        # Find the colored box by scanning left to right
        colors_found = []
        for x in range(min(100, w)):
            pixel = image_rgb[min(y, h-1), x]
            # Skip white/near-white pixels
            if pixel[0] > 240 and pixel[1] > 240 and pixel[2] > 240:
                continue
            # Skip black/near-black pixels (borders)
            if pixel[0] < 30 and pixel[1] < 30 and pixel[2] < 30:
                continue
            
            colors_found.append(tuple(pixel))
        
        if colors_found:
            # Take the most common color (mode)
            from collections import Counter
            color_counts = Counter(colors_found)
            most_common = color_counts.most_common(1)[0][0]
            results[key] = {
                "name": name,
                "rgb": most_common,
                "hex": "#{:02x}{:02x}{:02x}".format(*most_common)
            }
            log(f"  {i+1:2}. {name[:40]:40} -> RGB{most_common} = {results[key]['hex']}")
        else:
            log(f"  {i+1:2}. {name[:40]:40} -> NO COLOR FOUND")
    
    return results


def sample_specific_colors(image_path):
    """
    Manually sample colors at specific pixel locations based on legend layout
    """
    log(f"Loading legend: {image_path}")
    
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
    log(f"Image: {w}x{h}")
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Based on legend image analysis:
    # - Legend title "CHÚ DẪN" at top
    # - Color boxes are approximately 25-30 pixels wide on the left side
    # - Each row is approximately 25-30 pixels tall
    
    # For a typical legend image, sample at fixed positions
    # Adjust these based on actual image dimensions
    
    results = {}
    
    # Define sampling box parameters (adjust for actual legend)
    box_x = 10  # X position of color box center
    box_width = 20  # Width of sampling area
    row_height = 26  # Height of each row
    start_y = 50  # Y offset where first color starts (after header)
    
    for i, (key, name) in enumerate(LEGEND_SOIL_TYPES):
        y_center = start_y + i * row_height + row_height // 2
        
        if y_center >= h:
            log(f"  {i+1}. SKIP (beyond image)")
            continue
        
        # Sample a small region around the center point
        y1 = max(0, y_center - 5)
        y2 = min(h, y_center + 5)
        x1 = max(0, box_x - box_width // 2)
        x2 = min(w, box_x + box_width // 2)
        
        # Get all colors in the sample region (excluding white/black)
        sample = image_rgb[y1:y2, x1:x2]
        colors = []
        for row in sample:
            for pixel in row:
                # Exclude white
                if pixel[0] > 245 and pixel[1] > 245 and pixel[2] > 245:
                    continue
                # Exclude black
                if pixel[0] < 10 and pixel[1] < 10 and pixel[2] < 10:
                    continue
                colors.append(tuple(pixel))
        
        if colors:
            from collections import Counter
            most_common = Counter(colors).most_common(1)[0][0]
            results[key] = {
                "name": name,
                "rgb": most_common,
                "hex": "#{:02x}{:02x}{:02x}".format(*most_common)
            }
            log(f"  {i+1:2}. {name[:40]:40} | RGB{most_common}")
    
    return results


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python legend_color_extractor.py <legend_image>")
        sys.exit(1)
    
    legend_path = sys.argv[1]
    
    log("=== Extracting legend colors ===")
    colors = extract_legend_colors(legend_path)
    
    if colors:
        log(f"\n=== Extracted {len(colors)} colors ===")
        
        # Output as Python code
        print("\n# Python dictionary format:")
        print("EXTRACTED_COLORS = {")
        for key, data in colors.items():
            print(f'    "{key}": {{"name": "{data["name"]}", "rgb": {data["rgb"]}, "hex": "{data["hex"]}"}},')
        print("}")
