#!/usr/bin/env python3
"""
TEST NHANH - IMPROVED POLYGON EXTRACTION
=========================================
Kiểm tra cải tiến mới:
- min_percentage tăng từ 0.15% → 0.5%
- min_area_percent tăng từ 0.02% → 0.3%
- Morphology operations mạnh hơn
- Polygon simplification aggressively hơn
"""

import cv2
import numpy as np
import sys
import os
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from map_polygon_extractor import analyze_map_image

def quick_test():
    # Test với ảnh demo chính thức
    test_image = r"E:\Agriplanner\backend\python\image\Cà Mau_Thổ Nhưỡng.jpeg"
    
    if not os.path.exists(test_image):
        print(f"❌ File not found: {test_image}")
        return
    
    print("=" * 80)
    print("QUICK TEST - IMPROVED POLYGON EXTRACTION")
    print("=" * 80)
    print(f"Image: {os.path.basename(test_image)}")
    print()
    
    # Geo bounds for Cà Mau
    geo_bounds = {
        "sw": {"lat": 9.0, "lng": 105.0},
        "ne": {"lat": 9.25, "lng": 105.25}
    }
    
    # Output file
    output_file = "test_output_improved.json"
    
    # Run analysis
    print("Running analysis...")
    print()
    
    result = analyze_map_image(
        image_path=test_image,
        output_json_path=output_file,
        extract_legend=True,
        geo_bounds=geo_bounds,
        max_dimension=2000
    )
    
    if result:
        print()
        print("=" * 80)
        print("RESULTS SUMMARY")
        print("=" * 80)
        
        # Count zones by color
        color_counts = {}
        total_zones = 0
        
        for color_hex, data in result.get('zones_by_color', {}).items():
            zones = data.get('zones', [])
            count = len(zones)
            total_zones += count
            color_counts[color_hex] = count
        
        print(f"Total colors detected: {len(result.get('zones_by_color', {}))}")
        print(f"Total polygon zones: {total_zones}")
        print()
        
        # Show top colors
        sorted_colors = sorted(color_counts.items(), key=lambda x: x[1], reverse=True)
        print("Top 10 colors by polygon count:")
        for i, (color, count) in enumerate(sorted_colors[:10], 1):
            print(f"  {i}. {color}: {count} polygons")
        print()
        
        # Statistics
        all_zones = []
        for data in result.get('zones_by_color', {}).values():
            all_zones.extend(data.get('zones', []))
        
        if all_zones:
            areas = [z['areaPercent'] for z in all_zones]
            points = [z['pointCount'] for z in all_zones]
            
            print(f"Area distribution:")
            print(f"  Min: {min(areas):.3f}%")
            print(f"  Max: {max(areas):.3f}%")
            print(f"  Avg: {sum(areas)/len(areas):.3f}%")
            print()
            print(f"Points per polygon:")
            print(f"  Min: {min(points)}")
            print(f"  Max: {max(points)}")
            print(f"  Avg: {sum(points)/len(points):.1f}")
        
        print()
        print(f"✅ Output saved to: {output_file}")
        
        # Compare with old version
        print()
        print("COMPARISON:")
        print("  Old settings: min_percentage=0.15%, min_area=0.02%, max_points=20")
        print("  New settings: min_percentage=0.5%, min_area=0.3%, max_points=15")
        print("  Expected: FEWER polygons, SMOOTHER shapes, NO black frames")
        
    else:
        print("❌ Analysis failed")

if __name__ == "__main__":
    quick_test()
