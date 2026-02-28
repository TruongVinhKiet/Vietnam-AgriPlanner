"""
Face Recognition Service for AgriPlanner
Flask-based microservice for face encoding and matching.
Uses face_recognition library (dlib-based) for accurate face detection and comparison.

Endpoints:
    POST /encode    - Encode a face image, return 128-d face encoding
    POST /match     - Match a face encoding against registered users
    GET  /health    - Health check

Run: python face_service.py
Requires: pip install flask face_recognition numpy Pillow requests
"""

import os
import sys
import json
import base64
import logging
import numpy as np
from io import BytesIO
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('FaceService')

app = Flask(__name__)
CORS(app)

# Spring Boot backend URL
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:8080')

# Face matching tolerance (lower = stricter)
FACE_TOLERANCE = float(os.environ.get('FACE_TOLERANCE', '0.5'))


def load_image_from_file(file_path):
    """Load an image from file path."""
    import face_recognition
    return face_recognition.load_image_file(file_path)


def load_image_from_base64(base64_str):
    """Load an image from base64 string."""
    import face_recognition
    from PIL import Image

    # Remove data URL prefix if present
    if ',' in base64_str:
        base64_str = base64_str.split(',')[1]

    image_data = base64.b64decode(base64_str)
    image = Image.open(BytesIO(image_data))

    # Convert to 8-bit RGB (handles RGBA, CMYK, P, LA, I, I;16, etc.)
    image = image.convert('RGB')

    arr = np.array(image, dtype=np.uint8)
    logger.info(f"Loaded base64 image: shape={arr.shape}, dtype={arr.dtype}")
    return arr


def get_face_encoding(image):
    """Get face encoding from image. Returns encoding or None."""
    import face_recognition

    # Ensure image is 8-bit with correct channels for dlib
    if image.dtype != np.uint8:
        if image.max() > 255:
            image = (image / image.max() * 255).astype(np.uint8)
        else:
            image = image.astype(np.uint8)

    if image.ndim == 3 and image.shape[2] == 4:
        # Strip alpha channel (RGBA -> RGB)
        image = image[:, :, :3].copy()
        logger.info("Stripped alpha channel from RGBA image")
    elif image.ndim == 3 and image.shape[2] not in (1, 3):
        # Unusual channel count, try to take first 3
        image = image[:, :, :3].copy()
        logger.warning(f"Unusual channel count {image.shape[2]}, truncated to 3")

    logger.info(f"Image for face detection: shape={image.shape}, dtype={image.dtype}")

    # Detect faces
    face_locations = face_recognition.face_locations(image, model='hog')

    if len(face_locations) == 0:
        return None, "Không phát hiện khuôn mặt trong ảnh"

    if len(face_locations) > 1:
        return None, "Phát hiện nhiều khuôn mặt. Vui lòng chỉ đưa một khuôn mặt"

    # Get encoding for the single face
    encodings = face_recognition.face_encodings(image, face_locations)
    if len(encodings) == 0:
        return None, "Không thể mã hóa khuôn mặt"

    return encodings[0], None


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'service': 'Face Recognition Service',
        'tolerance': FACE_TOLERANCE
    })


@app.route('/encode', methods=['POST'])
def encode_face():
    """
    Encode a face image into a 128-dimensional vector.

    Accepts:
        - JSON body with 'image' (base64 string)
        - JSON body with 'filePath' (path to image file)
        - Multipart form with 'file' (image file)

    Returns:
        {
            "success": true,
            "encoding": [0.1, -0.2, ...],  // 128 floats
            "message": "Face encoded successfully"
        }
    """
    try:
        image = None

        # Check for multipart file upload
        if 'file' in request.files:
            file = request.files['file']
            from PIL import Image as PILImage
            img = PILImage.open(file.stream)
            # Always convert to 8-bit RGB (handles RGBA, P, LA, CMYK, I;16, etc.)
            img = img.convert('RGB')
            image = np.array(img, dtype=np.uint8)
            logger.info(f"Loaded uploaded file: mode={img.mode}, size={img.size}, array shape={image.shape}, dtype={image.dtype}")

        # Check for JSON body
        elif request.is_json:
            data = request.get_json()

            if 'image' in data:
                image = load_image_from_base64(data['image'])
            elif 'filePath' in data:
                image = load_image_from_file(data['filePath'])

        if image is None:
            return jsonify({
                'success': False,
                'error': 'Không có ảnh được cung cấp. Gửi file, base64, hoặc đường dẫn file.'
            }), 400

        encoding, error = get_face_encoding(image)

        if error:
            return jsonify({
                'success': False,
                'error': error
            }), 400

        return jsonify({
            'success': True,
            'encoding': encoding.tolist(),
            'message': 'Mã hóa khuôn mặt thành công'
        })

    except ImportError:
        return jsonify({
            'success': False,
            'error': 'Thư viện face_recognition chưa được cài đặt. Chạy: pip install face_recognition'
        }), 500
    except Exception as e:
        logger.error(f"Error encoding face: {e}")
        return jsonify({
            'success': False,
            'error': f'Lỗi mã hóa khuôn mặt: {str(e)}'
        }), 500


@app.route('/match', methods=['POST'])
def match_face():
    """
    Match a face encoding against all registered face users.

    Accepts JSON body:
        {
            "encoding": [0.1, -0.2, ...],  // 128 floats from /encode
            OR
            "image": "base64...",           // Will encode then match
            OR
            "filePath": "/path/to/image"    // Will encode then match
        }

    Returns:
        {
            "success": true,
            "matched": true,
            "email": "user@example.com",
            "fullName": "User Name",
            "distance": 0.35,
            "confidence": 0.65
        }
    """
    try:
        import face_recognition
        import requests

        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Không có dữ liệu'}), 400

        # Get the encoding to match
        query_encoding = None

        if 'encoding' in data:
            query_encoding = np.array(data['encoding'])
        elif 'image' in data:
            image = load_image_from_base64(data['image'])
            query_encoding, error = get_face_encoding(image)
            if error:
                return jsonify({'success': False, 'error': error}), 400
        elif 'filePath' in data:
            image = load_image_from_file(data['filePath'])
            query_encoding, error = get_face_encoding(image)
            if error:
                return jsonify({'success': False, 'error': error}), 400
        else:
            return jsonify({'success': False, 'error': 'Cần encoding, image, hoặc filePath'}), 400

        # Fetch all face-enabled users from backend
        try:
            resp = requests.get(f'{BACKEND_URL}/api/auth/face/users', timeout=10)
            if resp.status_code != 200:
                return jsonify({'success': False, 'error': 'Không thể lấy danh sách người dùng'}), 500
            users = resp.json()
        except requests.RequestException as e:
            logger.error(f"Error fetching face users: {e}")
            return jsonify({'success': False, 'error': 'Không thể kết nối backend'}), 500

        if not users:
            return jsonify({
                'success': False,
                'matched': False,
                'error': 'Chưa có người dùng nào đăng ký khuôn mặt'
            }), 404

        # Compare with all registered faces
        best_match = None
        best_distance = float('inf')

        for user in users:
            try:
                stored_encoding = np.array(json.loads(user['faceEncoding']))
                distance = face_recognition.face_distance([stored_encoding], query_encoding)[0]

                if distance < best_distance:
                    best_distance = distance
                    best_match = user
            except (json.JSONDecodeError, ValueError, KeyError) as e:
                logger.warning(f"Invalid encoding for user {user.get('email', 'unknown')}: {e}")
                continue

        # Check if best match is within tolerance
        if best_match and best_distance <= FACE_TOLERANCE:
            confidence = round(1.0 - best_distance, 4)
            return jsonify({
                'success': True,
                'matched': True,
                'email': best_match['email'],
                'fullName': best_match.get('fullName', ''),
                'distance': round(float(best_distance), 4),
                'confidence': confidence,
                'message': f'Khớp khuôn mặt với độ tin cậy {confidence * 100:.1f}%'
            })
        else:
            return jsonify({
                'success': True,
                'matched': False,
                'bestDistance': round(float(best_distance), 4) if best_distance != float('inf') else None,
                'message': 'Không tìm thấy khuôn mặt khớp'
            })

    except ImportError:
        return jsonify({
            'success': False,
            'error': 'Thư viện face_recognition chưa được cài đặt'
        }), 500
    except Exception as e:
        logger.error(f"Error matching face: {e}")
        return jsonify({
            'success': False,
            'error': f'Lỗi so khớp khuôn mặt: {str(e)}'
        }), 500


@app.route('/check-unique', methods=['POST'])
def check_unique():
    """
    Check if a face encoding is unique (not already registered).
    Enforces one face = one account rule.

    Accepts JSON body:
        {
            "encoding": [0.1, -0.2, ...],
            "excludeEmail": "current@user.com"  // Exclude current user from check
        }
    """
    try:
        import face_recognition
        import requests

        data = request.get_json()
        if not data or 'encoding' not in data:
            return jsonify({'success': False, 'error': 'Cần encoding'}), 400

        query_encoding = np.array(data['encoding'])
        exclude_email = data.get('excludeEmail', '')

        # Fetch all face-enabled users
        try:
            resp = requests.get(f'{BACKEND_URL}/api/auth/face/users', timeout=10)
            if resp.status_code != 200:
                return jsonify({'success': True, 'unique': True})  # Assume unique if can't check
            users = resp.json()
        except requests.RequestException:
            return jsonify({'success': True, 'unique': True})

        # Check against all registered faces
        for user in users:
            if user.get('email') == exclude_email:
                continue
            try:
                stored_encoding = np.array(json.loads(user['faceEncoding']))
                distance = face_recognition.face_distance([stored_encoding], query_encoding)[0]

                if distance <= FACE_TOLERANCE:
                    return jsonify({
                        'success': True,
                        'unique': False,
                        'message': 'Khuôn mặt này đã được đăng ký cho tài khoản khác',
                        'existingEmail': user['email'][:3] + '***'  # Partially masked
                    })
            except (json.JSONDecodeError, ValueError, KeyError):
                continue

        return jsonify({
            'success': True,
            'unique': True,
            'message': 'Khuôn mặt chưa được đăng ký'
        })

    except Exception as e:
        logger.error(f"Error checking uniqueness: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('FACE_SERVICE_PORT', 5001))
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'

    logger.info(f"Starting Face Recognition Service on port {port}")
    logger.info(f"Backend URL: {BACKEND_URL}")
    logger.info(f"Face tolerance: {FACE_TOLERANCE}")

    app.run(host='0.0.0.0', port=port, debug=debug)
