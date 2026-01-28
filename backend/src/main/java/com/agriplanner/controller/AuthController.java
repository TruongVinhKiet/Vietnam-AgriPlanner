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
import java.util.Map;

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
    public ResponseEntity<AuthResponse> getCurrentUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(AuthResponse.error("Chưa đăng nhập"));
        }

        User user = (User) authentication.getPrincipal();
        return ResponseEntity.ok(AuthResponse.builder()
                .success(true)
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .message("Authenticated")
                .build());
    }

    /**
     * Health check endpoint
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }

    /**
     * Google Login endpoint
     * POST /api/auth/google
     */
    @PostMapping("/google")
    public ResponseEntity<AuthResponse> googleLogin(@RequestBody Map<String, String> body) {
        String googleId = body.get("googleId");
        String email = body.get("email");
        String fullName = body.get("fullName");
        String avatarUrl = body.get("avatarUrl");

        AuthResponse response = authService.loginWithGoogle(googleId, email, fullName, avatarUrl);
        return ResponseEntity.ok(response);
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
