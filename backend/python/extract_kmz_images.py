# -*- coding: utf-8 -*-
"""
Extract ảnh từ file KMZ để chuẩn bị cho auto digitization
"""

import zipfile
import os
import sys
from pathlib import Path

def extract_images_from_kmz(kmz_path, output_dir="extracted_images"):
    """
    Giải nén ảnh từ KMZ file
    
    Args:
        kmz_path: Đường dẫn file KMZ
        output_dir: Thư mục lưu ảnh
    """
    print(f"📦 Giải nén: {kmz_path}")
    
    if not os.path.exists(kmz_path):
        print(f"❌ File không tồn tại: {kmz_path}")
        return None
    
    # Tạo thư mục output
    os.makedirs(output_dir, exist_ok=True)
    
    # Giải nén KMZ (là file ZIP)
    image_files = []
    
    with zipfile.ZipFile(kmz_path, 'r') as zip_ref:
        # List tất cả files
        all_files = zip_ref.namelist()
        print(f"\nTìm thấy {len(all_files)} files trong KMZ:")
        
        for filename in all_files:
            print(f"  - {filename}")
            
            # Chỉ extract ảnh
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.tif', '.tiff')):
                # Extract
                zip_ref.extract(filename, output_dir)
                
                # Copy với tên đơn giản hơn
                src_path = os.path.join(output_dir, filename)
                base_name = Path(kmz_path).stem
                ext = Path(filename).suffix
                new_name = f"{base_name}_image_{len(image_files)+1}{ext}"
                dst_path = os.path.join(output_dir, new_name)
                
                # Di chuyển file
                import shutil
                shutil.move(src_path, dst_path)
                
                image_files.append(dst_path)
                print(f"    ✅ Đã lưu: {new_name}")
    
    # Cleanup thư mục rỗng
    for root, dirs, files in os.walk(output_dir, topdown=False):
        for dirname in dirs:
            dir_path = os.path.join(root, dirname)
            if not os.listdir(dir_path):
                os.rmdir(dir_path)
    
    if not image_files:
        print("\n⚠️  Không tìm thấy file ảnh nào trong KMZ!")
        print("   KMZ này có thể là Vector KMZ (đã có polygon), không cần auto digitize.")
        return None
    
    print(f"\n✅ Đã extract {len(image_files)} ảnh:")
    for img in image_files:
        file_size = os.path.getsize(img) / 1024  # KB
        print(f"   {os.path.basename(img)} ({file_size:.1f} KB)")
    
    return image_files


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Sử dụng: python extract_kmz_images.py <file.kmz>")
        print("\nVí dụ:")
        print('  python extract_kmz_images.py "Ca Mau.kmz"')
        sys.exit(1)
    
    kmz_path = sys.argv[1]
    images = extract_images_from_kmz(kmz_path)
    
    if images:
        print("\n" + "="*60)
        print("📖 Bước tiếp theo:")
        print("="*60)
        print("\n1. Kiểm tra ảnh trong thư mục: extracted_images/")
        print("\n2. Chạy auto digitize:")
        for img in images:
            print(f'   python auto_digitize.py "{img}"')
        print("\n3. Upload file KMZ vào AgriPlanner")
