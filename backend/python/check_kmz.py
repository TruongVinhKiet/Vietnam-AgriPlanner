import zipfile
import os
import sys
import xml.etree.ElementTree as ET

def check_kmz_type(kmz_path):
    """
    Kiểm tra file KMZ là loại Vector hay Raster
    """
    print(f"\n{'='*60}")
    print(f"Kiểm tra file KMZ: {os.path.basename(kmz_path)}")
    print(f"{'='*60}\n")
    
    if not os.path.exists(kmz_path):
        print(f"❌ File không tồn tại: {kmz_path}")
        return
    
    # Giải nén KMZ (KMZ là file ZIP)
    temp_dir = f"{kmz_path}_extracted"
    os.makedirs(temp_dir, exist_ok=True)
    
    try:
        with zipfile.ZipFile(kmz_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        print(f"✅ Đã giải nén vào: {temp_dir}\n")
        
        # Tìm file KML
        kml_files = []
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.lower().endswith('.kml'):
                    kml_files.append(os.path.join(root, file))
        
        if not kml_files:
            print("❌ Không tìm thấy file KML trong KMZ!")
            return
        
        print(f"Tìm thấy {len(kml_files)} file KML:")
        for kml in kml_files:
            print(f"  - {os.path.basename(kml)}")
        print()
        
        # Phân tích file KML chính (thường là doc.kml hoặc file đầu tiên)
        kml_file = kml_files[0]
        print(f"Phân tích: {os.path.basename(kml_file)}\n")
        
        with open(kml_file, 'r', encoding='utf-8') as f:
            kml_content = f.read()
        
        # Parse XML
        # Loại bỏ namespace để dễ parse
        kml_content_cleaned = kml_content.replace('xmlns=', 'xmlnsremoved=')
        
        try:
            root = ET.fromstring(kml_content_cleaned)
        except:
            # Fallback: đọc như text thuần
            analyze_kml_text(kml_content)
            return
        
        # Đếm các thành phần
        placemarks = root.findall('.//Placemark')
        polygons = root.findall('.//Polygon')
        multigeometries = root.findall('.//MultiGeometry')
        ground_overlays = root.findall('.//GroundOverlay')
        coordinates = root.findall('.//coordinates')
        
        print(f"📊 Thống kê:")
        print(f"  - Placemarks: {len(placemarks)}")
        print(f"  - Polygons: {len(polygons)}")
        print(f"  - MultiGeometry: {len(multigeometries)}")
        print(f"  - GroundOverlays: {len(ground_overlays)}")
        print(f"  - Coordinates: {len(coordinates)}")
        print()
        
        # Phân loại
        if len(polygons) > 0 or len(multigeometries) > 0:
            print("✅ ĐÂY LÀ VECTOR KMZ - TỐT!")
            print("   → Có polygon geometry thật")
            print("   → Có thể lưu vào database như vùng thực")
            print("   → Khi click sẽ có thông tin chi tiết")
            print()
            
            # Hiển thị mẫu
            if placemarks:
                print("Ví dụ vùng đầu tiên:")
                sample = placemarks[0]
                name_elem = sample.find('.//name')
                name = name_elem.text if name_elem is not None else "Không có tên"
                desc_elem = sample.find('.//description')
                desc = desc_elem.text if desc_elem is not None else "Không có mô tả"
                
                print(f"  Tên: {name}")
                print(f"  Mô tả: {desc[:100]}..." if len(desc) > 100 else f"  Mô tả: {desc}")
                
                # Lấy coordinates đầu tiên
                coord_elem = sample.find('.//coordinates')
                if coord_elem is not None:
                    coords_text = coord_elem.text.strip()
                    coord_lines = coords_text.split()[:3]  # Lấy 3 điểm đầu
                    print(f"  Tọa độ (3 điểm đầu):")
                    for coord in coord_lines:
                        if ',' in coord:
                            parts = coord.split(',')
                            if len(parts) >= 2:
                                lon, lat = parts[0], parts[1]
                                print(f"    Lon: {lon}, Lat: {lat}")
        
        elif len(ground_overlays) > 0:
            print("❌ ĐÂY LÀ RASTER KMZ - KHÔNG TỐT!")
            print("   → Chỉ là ảnh overlay, không có geometry thật")
            print("   → Hệ thống chỉ lưu như ảnh, không có vùng polygon")
            print("   → Khi click KHÔNG có thông tin")
            print()
            print("💡 Giải pháp:")
            print("   1. Dùng QGIS để digitize (vẽ lại polygon)")
            print("   2. Hoặc dùng Google Earth Pro để vẽ thủ công")
            print("   3. Xem hướng dẫn trong file: docs/KMZ_File_Check_Guide.md")
            print()
            
            # Hiển thị thông tin overlay
            overlay = ground_overlays[0]
            name_elem = overlay.find('.//name')
            name = name_elem.text if name_elem is not None else "Không có tên"
            
            icon_elem = overlay.find('.//Icon/href')
            icon = icon_elem.text if icon_elem is not None else "Không có"
            
            latlonbox = overlay.find('.//LatLonBox')
            if latlonbox is not None:
                north = latlonbox.find('north')
                south = latlonbox.find('south')
                east = latlonbox.find('east')
                west = latlonbox.find('west')
                
                print(f"  Tên overlay: {name}")
                print(f"  File ảnh: {icon}")
                print(f"  Bounding box:")
                if north is not None: print(f"    North: {north.text}")
                if south is not None: print(f"    South: {south.text}")
                if east is not None: print(f"    East: {east.text}")
                if west is not None: print(f"    West: {west.text}")
        
        else:
            print("⚠️  KHÔNG XÁC ĐỊNH ĐƯỢC LOẠI!")
            print("   → Không tìm thấy Polygon hoặc GroundOverlay")
            print("   → File KMZ có thể bị lỗi hoặc định dạng đặc biệt")
            print()
            print("Nội dung XML (100 dòng đầu):")
            lines = kml_content.split('\n')[:100]
            for line in lines:
                print(f"  {line}")
    
    finally:
        # Cleanup
        import shutil
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                print(f"\n🧹 Đã xóa thư mục tạm: {temp_dir}")
            except:
                print(f"\n⚠️  Không thể xóa thư mục tạm: {temp_dir}")

def analyze_kml_text(kml_content):
    """Phân tích KML như text thuần (fallback)"""
    print("⚠️  Không parse được XML, phân tích như text...\n")
    
    placemark_count = kml_content.count('<Placemark')
    polygon_count = kml_content.count('<Polygon')
    overlay_count = kml_content.count('<GroundOverlay')
    coord_count = kml_content.count('<coordinates')
    
    print(f"📊 Thống kê (text-based):")
    print(f"  - Placemarks: {placemark_count}")
    print(f"  - Polygons: {polygon_count}")
    print(f"  - GroundOverlays: {overlay_count}")
    print(f"  - Coordinates: {coord_count}")
    print()
    
    if polygon_count > 0:
        print("✅ ĐÂY LÀ VECTOR KMZ - TỐT!")
    elif overlay_count > 0:
        print("❌ ĐÂY LÀ RASTER KMZ - KHÔNG TỐT!")
    else:
        print("⚠️  KHÔNG XÁC ĐỊNH ĐƯỢC LOẠI!")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Sử dụng: python check_kmz.py <đường_dẫn_file.kmz>")
        print()
        print("Ví dụ:")
        print("  python check_kmz.py camau_soil.kmz")
        print("  python check_kmz.py \"E:\\maps\\can_tho_planning.kmz\"")
        sys.exit(1)
    
    kmz_path = sys.argv[1]
    check_kmz_type(kmz_path)
