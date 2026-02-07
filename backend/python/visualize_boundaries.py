#!/usr/bin/env python3
"""
Generate smooth boundary visualization for soil map
Creates rounded/curved contours using scipy spline interpolation
Detects all 16+ soil types from ca_mau_soil_data.py
"""

import cv2
import numpy as np
import sys
import os
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
        print(f"[Visualizer] {message}", flush=True)
    except:
        pass


def smooth_contour_spline(contour, num_points=100, smoothing=5):
    """
    Smooth a contour using B-spline interpolation for truly curved boundaries
    
    Args:
        contour: OpenCV contour array
        num_points: Number of points in output smooth curve
        smoothing: Smoothing factor (higher = smoother, less accurate)
    
    Returns:
        Smoothed contour as numpy array
    """
    try:
        if contour is None or len(contour) < 5:
            return contour
        
        # Extract points
        points = contour.reshape(-1, 2)
        n = len(points)
        
        if n < 5:
            return contour
        
        # Get x and y coordinates
        x = points[:, 0].astype(float)
        y = points[:, 1].astype(float)
        
        # Create parameter for spline (0 to 1)
        # Use periodic spline for closed contours
        try:
            # Fit B-spline to the contour
            tck, u = splprep([x, y], s=smoothing * n, per=True, k=3)
            
            # Evaluate spline at more points for smooth curve
            u_new = np.linspace(0, 1, num_points)
            x_new, y_new = splev(u_new, tck)
            
            # Convert back to integer coordinates
            smooth_points = np.column_stack([x_new, y_new]).astype(np.int32)
            
            return smooth_points.reshape(-1, 1, 2)
            
        except Exception:
            # Fallback to approxPolyDP if spline fails
            epsilon = 0.01 * cv2.arcLength(contour, True)
            return cv2.approxPolyDP(contour, epsilon, True)
    
    except Exception:
        return contour


def create_smooth_visualization(image_path, output_path, tolerance=25, min_area_pct=0.05):
    """
    Create visualization with smooth spline-based boundaries for each soil type
    Now detects ALL 16 soil types from CA_MAU_SOIL_TYPES
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
        log("Failed to load image")
        return None
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    h, w = image.shape[:2]
    total_pixels = h * w
    min_area = total_pixels * (min_area_pct / 100)
    
    log(f"Image: {w}x{h}")
    log(f"Min area: {min_area_pct}% = {int(min_area):,} px")
    log(f"Color tolerance: {tolerance}")
    
    # Create output image (copy of original)
    output = image.copy()
    
    # Track statistics
    stats = {}
    total_zones = 0
    
    # Count active soil types
    active_types = [k for k, v in CA_MAU_SOIL_TYPES.items() if v.get('percentage', 0) > 0]
    log(f"Processing {len(active_types)} soil types...")
    
    for soil_key, soil_data in CA_MAU_SOIL_TYPES.items():
        if soil_data.get("percentage", 0) == 0:
            continue
        
        name = soil_data["name_vi"]
        
        # Create combined mask for all colors of this soil type
        combined_mask = np.zeros((h, w), dtype=np.uint8)
        
        for ref_color in soil_data["colors"]:
            ref_rgb = np.array(ref_color, dtype=np.int32)
            
            # Color distance
            diff = np.abs(image_rgb.astype(np.int32) - ref_rgb)
            distance = np.sqrt(np.sum(diff ** 2, axis=2))
            
            mask = (distance <= tolerance).astype(np.uint8) * 255
            combined_mask = cv2.bitwise_or(combined_mask, mask)
        
        # Morphological operations for smoother regions
        kernel = np.ones((5, 5), np.uint8)
        
        # Close small gaps
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_CLOSE, kernel)
        
        # Remove noise
        combined_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel)
        
        # Gaussian blur for smooth edges before finding contours
        combined_mask = cv2.GaussianBlur(combined_mask, (9, 9), 3)
        _, combined_mask = cv2.threshold(combined_mask, 127, 255, cv2.THRESH_BINARY)
        
        # Find contours
        contours, _ = cv2.findContours(combined_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        zone_count = 0
        total_area = 0
        
        for contour in contours:
            area = cv2.contourArea(contour)
            
            if area < min_area:
                continue
            
            perimeter = cv2.arcLength(contour, True)
            circularity = 4 * np.pi * area / (perimeter * perimeter + 1)
            
            # Skip very thin elongated shapes (likely artifacts)
            if circularity < 0.01:
                continue
            
            zone_count += 1
            total_area += area
            
            # Smooth using spline interpolation for truly curved boundaries
            # Adjust num_points based on contour size
            num_pts = min(200, max(30, len(contour) * 2))
            smoothed = smooth_contour_spline(contour, num_points=num_pts, smoothing=3)
            
            # Check valid contour
            if smoothed is None or len(smoothed) < 3:
                continue
            
            # Draw smooth closed curve
            pts = smoothed.reshape(-1, 2)
            pts_closed = np.vstack([pts, pts[0]])  # Close the curve
            cv2.polylines(output, [pts_closed], isClosed=True, color=(40, 40, 40), thickness=2, lineType=cv2.LINE_AA)
        
        if zone_count > 0:
            area_pct = (total_area / total_pixels) * 100
            stats[name] = {"zones": zone_count, "area_pct": area_pct}
            total_zones += zone_count
            
            # Show progress for significant areas
            emoji = "🌊" if "sông" in name.lower() else ("✨" if area_pct < 0.5 else "")
            log(f"  {name[:35]:35} | {zone_count:3} zones | {area_pct:5.1f}% {emoji}")
    
    log(f"\n=== SUMMARY ===")
    log(f"Total: {len(stats)} soil types, {total_zones} zones")
    
    # Calculate total coverage
    total_coverage = sum(s['area_pct'] for s in stats.values())
    log(f"Coverage: {total_coverage:.1f}%")
    
    # Save output
    cv2.imwrite(output_path, output)
    log(f"Saved: {output_path}")
    
    return output


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python visualize_boundaries.py <input_image> [output_image]")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else input_path.rsplit('.', 1)[0] + "_smooth_boundaries.jpg"
    
    # Use tolerance=30 for good detection, min_area=0.05% to catch small zones
    create_smooth_visualization(input_path, output_path, tolerance=30, min_area_pct=0.05)
