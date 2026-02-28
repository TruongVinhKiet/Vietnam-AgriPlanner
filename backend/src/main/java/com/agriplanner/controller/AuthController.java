package com.agriplanner.controller;

import com.agriplanner.dto.AuthResponse;
import com.agriplanner.dto.LoginRequest;
import com.agriplanner.dto.RegisterRequest;
import com.agriplanner.model.User;
import com.agriplanner.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;
import java.util.List;

/**
 * Authentication controller for login and registration endpoints
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    /**
     * Login endpoint
     * POST /api/auth/login
     */
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Register endpoint
     * POST /api/auth/register
     * Note: SYSTEM_ADMIN role is blocked
     */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);

        if (response.isSuccess() || response.isRequiresVerification()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Verify registration endpoint
     */
    @PostMapping("/verify-registration")
    public ResponseEntity<AuthResponse> verifyRegistration(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String otp = body.get("otp");

        AuthResponse response = authService.verifyRegistration(email, otp);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    /**
     * Get current user info
     * GET /api/auth/me
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("error", "Chưa đăng nhập"));
        }

        User user = (User) authentication.getPrincipal();
        Map<String, Object> response = new java.util.HashMap<>();
        response.put("success", true);
        response.put("userId", user.getId());
        response.put("email", user.getEmail());
        response.put("fullName", user.getFullName());
        response.put("role", user.getRole().name());
        response.put("avatarUrl", user.getAvatarUrl());
        response.put("faceEnabled", user.getFaceEnabled());
        response.put("authProvider", user.getAuthProvider());
        response.put("message", "Authenticated");
        return ResponseEntity.ok(response);
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }

    /**
     * Google Login endpoint (server-side code exchange)
     * POST /api/auth/google
     */
    @PostMapping("/google")
    public ResponseEntity<AuthResponse> googleLogin(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        String redirectUri = body.get("redirectUri");

        AuthResponse response = authService.loginWithGoogle(code, redirectUri);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        if ("NEEDS_REGISTRATION".equals(response.getMessage())) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Google Register endpoint (server-side code exchange)
     * POST /api/auth/google/register
     */
    @PostMapping("/google/register")
    public ResponseEntity<AuthResponse> googleRegister(@RequestBody Map<String, Object> body) {
        String code = (String) body.get("code");
        String redirectUri = (String) body.get("redirectUri");
        String role = (String) body.get("role");
        String farmName = (String) body.get("farmName");
        Long farmId = body.get("farmId") != null ? Long.valueOf(body.get("farmId").toString()) : null;
        String cvProfile = (String) body.get("cvProfile");

        AuthResponse response = authService.registerWithGoogle(code, redirectUri, role, farmName, farmId, cvProfile);
        if (response.isSuccess() || response.isRequiresApproval()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Facebook Login endpoint (server-side code exchange)
     * POST /api/auth/facebook
     */
    @PostMapping("/facebook")
    public ResponseEntity<AuthResponse> facebookLogin(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        String redirectUri = body.get("redirectUri");

        AuthResponse response = authService.loginWithFacebook(code, redirectUri);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        if ("NEEDS_REGISTRATION".equals(response.getMessage())) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Facebook Register endpoint (server-side code exchange)
     * POST /api/auth/facebook/register
     */
    @PostMapping("/facebook/register")
    public ResponseEntity<AuthResponse> facebookRegister(@RequestBody Map<String, Object> body) {
        String code = (String) body.get("code");
        String redirectUri = (String) body.get("redirectUri");
        String role = (String) body.get("role");
        String farmName = (String) body.get("farmName");
        Long farmId = body.get("farmId") != null ? Long.valueOf(body.get("farmId").toString()) : null;
        String cvProfile = (String) body.get("cvProfile");

        AuthResponse response = authService.registerWithFacebook(code, redirectUri, role, farmName, farmId, cvProfile);
        if (response.isSuccess() || response.isRequiresApproval()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * GitHub Login endpoint
     * POST /api/auth/github
     */
    @PostMapping("/github")
    public ResponseEntity<AuthResponse> githubLogin(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        AuthResponse response = authService.loginWithGithub(code);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        // Special case: NEEDS_REGISTRATION returns 200 with success=false
        if ("NEEDS_REGISTRATION".equals(response.getMessage())) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * GitHub Register endpoint
     * POST /api/auth/github/register
     */
    @PostMapping("/github/register")
    public ResponseEntity<AuthResponse> githubRegister(@RequestBody Map<String, Object> body) {
        String code = (String) body.get("code");
        String role = (String) body.get("role");
        String farmName = (String) body.get("farmName");
        Long farmId = body.get("farmId") != null ? Long.valueOf(body.get("farmId").toString()) : null;
        String cvProfile = (String) body.get("cvProfile");

        AuthResponse response = authService.registerWithGithub(code, role, farmName, farmId, cvProfile);
        if (response.isSuccess() || response.isRequiresApproval()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Register face for current user (Settings page)
     * POST /api/auth/face/register
     */
    @PostMapping("/face/register")
    public ResponseEntity<AuthResponse> registerFace(@RequestBody Map<String, String> body, Authentication authentication) {
        if (authentication == null) return ResponseEntity.status(401).body(AuthResponse.error("Chưa đăng nhập"));
        User user = (User) authentication.getPrincipal();

        String faceEncoding = body.get("faceEncoding");
        String faceImagePath = body.get("faceImagePath");

        AuthResponse response = authService.registerFace(user.getEmail(), faceEncoding, faceImagePath);
        return ResponseEntity.ok(response);
    }

    /**
     * Disable face login
     * POST /api/auth/face/disable
     */
    @PostMapping("/face/disable")
    public ResponseEntity<AuthResponse> disableFace(Authentication authentication) {
        if (authentication == null) return ResponseEntity.status(401).body(AuthResponse.error("Chưa đăng nhập"));
        User user = (User) authentication.getPrincipal();

        AuthResponse response = authService.disableFaceLogin(user.getEmail());
        return ResponseEntity.ok(response);
    }

    /**
     * Login with face - receives matched email from face recognition
     * POST /api/auth/face/login
     */
    @PostMapping("/face/login")
    public ResponseEntity<AuthResponse> faceLogin(@RequestBody Map<String, String> body) {
        String matchedEmail = body.get("email");
        AuthResponse response = authService.loginWithFace(matchedEmail);
        if (response.isSuccess()) return ResponseEntity.ok(response);
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Get all face-enabled users (for Python face matching)
     * GET /api/auth/face/users
     */
    @GetMapping("/face/users")
    public ResponseEntity<List<Map<String, String>>> getFaceUsers() {
        return ResponseEntity.ok(authService.getAllFaceUsers());
    }

    /**
     * Upload face image for registration
     * POST /api/auth/face/upload
     */
    @PostMapping("/face/upload")
    public ResponseEntity<Map<String, Object>> uploadFaceImage(
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {
        if (authentication == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Chưa đăng nhập"));
        }

        try {
            User user = (User) authentication.getPrincipal();
            String uploadDir = System.getProperty("user.home") + "/agriplanner/faces/";
            java.io.File dir = new java.io.File(uploadDir);
            if (!dir.exists()) dir.mkdirs();

            String fileName = "face_" + user.getId() + "_" + System.currentTimeMillis() + ".jpg";
            String filePath = uploadDir + fileName;
            file.transferTo(new java.io.File(filePath));

            return ResponseEntity.ok(Map.of(
                "success", true,
                "filePath", filePath,
                "fileName", fileName
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    /**
     * Upload face image for login (no auth required)
     * POST /api/auth/face/upload-login
     */
    @PostMapping("/face/upload-login")
    public ResponseEntity<Map<String, Object>> uploadFaceForLogin(@RequestParam("file") MultipartFile file) {
        try {
            String uploadDir = System.getProperty("user.home") + "/agriplanner/faces/temp/";
            java.io.File dir = new java.io.File(uploadDir);
            if (!dir.exists()) dir.mkdirs();

            String fileName = "login_" + System.currentTimeMillis() + ".jpg";
            String filePath = uploadDir + fileName;
            file.transferTo(new java.io.File(filePath));

            return ResponseEntity.ok(Map.of(
                "success", true,
                "filePath", filePath
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    /**
     * Forgot Password endpoint
     */
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        authService.forgotPassword(email);
        return ResponseEntity.ok(Map.of("message", "Mã xác thực đã được gửi tới email của bạn (nếu tồn tại)"));
    }

    /**
     * Reset Password endpoint
     */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String otp = body.get("otp");
        String newPassword = body.get("newPassword");

        if (authService.resetPassword(email, otp, newPassword)) {
            return ResponseEntity.ok(Map.of("message", "Đặt lại mật khẩu thành công"));
        }
        return ResponseEntity.badRequest().body(Map.of("message", "Mã OTP không chính xác hoặc đã hết hạn"));
    }
}
