# -*- coding: utf-8 -*-
"""
Remove White Background from Map Images
Loại bỏ nền trắng từ ảnh bản đồ KMZ

Sử dụng: python remove_white_bg.py <input_image> <output_image>

Functions:
- remove_white_background: Loại bỏ nền trắng cơ bản
- remove_white_background_smooth: Loại bỏ nền trắng với edge smoothing
- crop_to_map_content: Cắt bỏ phần thừa, chỉ giữ bản đồ
"""

import cv2  # type: ignore - OpenCV library
import numpy as np
import sys
import os

def remove_white_background(input_path, output_path, threshold=240):
    """
    Loại bỏ nền trắng từ ảnh, chuyển thành transparent
    
    Args:
        input_path: Đường dẫn ảnh đầu vào
        output_path: Đường dẫn ảnh đầu ra (PNG với alpha channel)
        threshold: Ngưỡng màu trắng (0-255), mặc định 240
    """
    print(f"📖 Đọc ảnh: {input_path}", file=sys.stderr)
    
    # Đọc ảnh
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"❌ Không đọc được ảnh: {input_path}", file=sys.stderr)
        return False
    
    print(f"   Kích thước: {img.shape[1]}x{img.shape[0]} pixels", file=sys.stderr)
    
    # Chuyển sang BGRA nếu chưa có alpha channel
    if len(img.shape) == 2:
        # Grayscale
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        # BGR -> BGRA
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    
    # Tìm pixels màu trắng (hoặc gần trắng)
    # Điều kiện: R > threshold AND G > threshold AND B > threshold
    white_mask = (img[:, :, 0] > threshold) & \
                 (img[:, :, 1] > threshold) & \
                 (img[:, :, 2] > threshold)
    
    # Đặt alpha = 0 cho pixels trắng (transparent)
    img[:, :, 3] = np.where(white_mask, 0, 255)
    
    # Lưu ảnh PNG với alpha channel
    cv2.imwrite(output_path, img)
    
    # Thống kê
    total_pixels = img.shape[0] * img.shape[1]
    transparent_pixels = np.sum(white_mask)
    percent = (transparent_pixels / total_pixels) * 100
    
    print(f"✅ Đã xử lý xong!", file=sys.stderr)
    print(f"   - Tổng pixels: {total_pixels:,}", file=sys.stderr)
    print(f"   - Pixels trong suốt: {transparent_pixels:,} ({percent:.1f}%)", file=sys.stderr)
    print(f"   - Lưu tại: {output_path}", file=sys.stderr)
    
    return True


def remove_white_background_smooth(input_path, output_path, threshold=240, feather=5):
    """
    Loại bỏ nền trắng với edge smoothing (mượt hơn)
    
    Args:
        input_path: Đường dẫn ảnh đầu vào
        output_path: Đường dẫn ảnh đầu ra
        threshold: Ngưỡng màu trắng
        feather: Độ mượt viền (pixels)
    """
    print(f"📖 Đọc ảnh: {input_path}", file=sys.stderr)
    
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"❌ Không đọc được ảnh: {input_path}", file=sys.stderr)
        return False
    
    # Chuyển sang BGRA
    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    
    # Tạo grayscale để tìm vùng trắng
    gray = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY)
    
    # Threshold để tìm vùng trắng
    _, white_mask = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)
    
    # Erode để thu nhỏ vùng trắng một chút (tránh mất viền)
    kernel = np.ones((3, 3), np.uint8)
    white_mask = cv2.erode(white_mask, kernel, iterations=1)
    
    # Blur để tạo feather effect
    if feather > 0:
        alpha_mask = cv2.GaussianBlur(white_mask, (feather*2+1, feather*2+1), 0)
    else:
        alpha_mask = white_mask
    
    # Invert mask (trắng = transparent)
    alpha_mask = 255 - alpha_mask
    
    # Áp dụng alpha
    img[:, :, 3] = alpha_mask
    
    cv2.imwrite(output_path, img)
    
    print(f"✅ Đã xử lý xong với feather={feather}px", file=sys.stderr)
    print(f"   Lưu tại: {output_path}", file=sys.stderr)
    
    return True


def crop_to_map_content(input_path, output_path, margin=10):
    """
    Cắt bỏ viền trắng và các phần thừa, chỉ giữ lại nội dung bản đồ
    
    Args:
        input_path: Đường dẫn ảnh đầu vào
        output_path: Đường dẫn ảnh đầu ra
        margin: Lề xung quanh (pixels)
    """
    print(f"📖 Đọc ảnh: {input_path}", file=sys.stderr)
    
    img = cv2.imread(input_path)
    if img is None:
        print(f"❌ Không đọc được ảnh: {input_path}", file=sys.stderr)
        return False
    
    original_height, original_width = img.shape[:2]
    print(f"   Kích thước gốc: {original_width}x{original_height}", file=sys.stderr)
    
    # Chuyển sang grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Threshold để tìm vùng không phải trắng
    _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
    
    # Làm sạch nhiễu
    kernel = np.ones((5, 5), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    
    # Tìm contour lớn nhất (vùng bản đồ)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        print("   ⚠️ Không tìm thấy vùng nội dung, giữ nguyên ảnh", file=sys.stderr)
        cv2.imwrite(output_path, img)
        return True
    
    # Tìm contour lớn nhất
    largest_contour = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(largest_contour)
    
    # Thêm margin
    x = max(0, x - margin)
    y = max(0, y - margin)
    w = min(original_width - x, w + 2 * margin)
    h = min(original_height - y, h + 2 * margin)
    
    # Cắt ảnh
    cropped = img[y:y+h, x:x+w]
    
    cv2.imwrite(output_path, cropped)
    
    print(f"✅ Đã cắt ảnh!", file=sys.stderr)
    print(f"   Kích thước mới: {w}x{h}", file=sys.stderr)
    print(f"   Lưu tại: {output_path}", file=sys.stderr)
    
    return True


def process_kmz_images(kmz_images_dir, output_dir=None):
    """
    Xử lý tất cả ảnh trong thư mục KMZ images
    """
    if output_dir is None:
        output_dir = kmz_images_dir + "_transparent"
    
    os.makedirs(output_dir, exist_ok=True)
    
    image_extensions = ['.png', '.jpg', '.jpeg', '.gif']
    
    processed = 0
    for filename in os.listdir(kmz_images_dir):
        if any(filename.lower().endswith(ext) for ext in image_extensions):
            input_path = os.path.join(kmz_images_dir, filename)
            output_path = os.path.join(output_dir, os.path.splitext(filename)[0] + '.png')
            
            if remove_white_background_smooth(input_path, output_path):
                processed += 1
    
    print(f"\n🎉 Hoàn thành! Đã xử lý {processed} ảnh", file=sys.stderr)
    return processed


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Sử dụng:", file=sys.stderr)
        print("  python remove_white_bg.py <input_image> [output_image]", file=sys.stderr)
        print("  python remove_white_bg.py --dir <images_directory>", file=sys.stderr)
        print("  python remove_white_bg.py --crop <input_image> [output_image]", file=sys.stderr)
        print(file=sys.stderr)
        print("Ví dụ:", file=sys.stderr)
        print("  python remove_white_bg.py map.png map_transparent.png", file=sys.stderr)
        print("  python remove_white_bg.py --dir uploads/kmz/images/1", file=sys.stderr)
        print("  python remove_white_bg.py --crop map.jpg cropped_map.jpg", file=sys.stderr)
        sys.exit(1)
    
    if sys.argv[1] == "--dir":
        if len(sys.argv) < 3:
            print("❌ Thiếu thư mục ảnh", file=sys.stderr)
            sys.exit(1)
        process_kmz_images(sys.argv[2])
    elif sys.argv[1] == "--crop":
        if len(sys.argv) < 3:
            print("❌ Thiếu đường dẫn ảnh", file=sys.stderr)
            sys.exit(1)
        input_path = sys.argv[2]
        output_path = sys.argv[3] if len(sys.argv) > 3 else \
                      os.path.splitext(input_path)[0] + "_cropped.jpg"
        crop_to_map_content(input_path, output_path)
    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else \
                      os.path.splitext(input_path)[0] + "_transparent.png"
        
        remove_white_background_smooth(input_path, output_path)
