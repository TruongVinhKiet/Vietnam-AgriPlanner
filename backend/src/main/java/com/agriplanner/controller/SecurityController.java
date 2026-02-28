package com.agriplanner.controller;

import com.agriplanner.dto.AuthResponse;
import com.agriplanner.model.UnlockRequest;
import com.agriplanner.model.User;
import com.agriplanner.repository.UnlockRequestRepository;
import com.agriplanner.repository.UserRepository;
import com.agriplanner.service.AuthService;
import com.agriplanner.service.TwoFactorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/security")
@RequiredArgsConstructor
@SuppressWarnings("null")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:8000" })
public class SecurityController {

    private final AuthService authService;
    private final TwoFactorService twoFactorService;
    private final UserRepository userRepository;
    private final UnlockRequestRepository unlockRequestRepository;

    // --- Authenticated User Operations ---

    @PostMapping("/otp/request")
    public ResponseEntity<?> requestOtp(@AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String type = body.get("type"); // PASSWORD_CHANGE, EMAIL_CHANGE
        authService.generateOtp(userDetails.getUsername(), type);
        return ResponseEntity.ok(Map.of("message", "Mã OTP đã được gửi tới email của bạn"));
    }

    @PostMapping("/password/change")
    public ResponseEntity<?> changePassword(@AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String otp = body.get("otp");
        String newPassword = body.get("newPassword");

        if (authService.changePassword(userDetails.getUsername(), otp, newPassword)) {
            return ResponseEntity.ok(Map.of("message", "Đổi mật khẩu thành công"));
        }
        return ResponseEntity.badRequest().body(Map.of("message", "Mã OTP không chính xác hoặc đã hết hạn"));
    }

    @PostMapping("/email/change")
    public ResponseEntity<?> changeEmail(@AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String otp = body.get("otp");
        String newEmail = body.get("newEmail");

        AuthResponse response = authService.changeEmail(userDetails.getUsername(), otp, newEmail);
        return response.isSuccess() ? ResponseEntity.ok(response) : ResponseEntity.badRequest().body(response);
    }

    @GetMapping("/2fa/init")
    public ResponseEntity<?> initTwoFactor(@AuthenticationPrincipal UserDetails userDetails) {
        String secret = authService.initiateTwoFactorSetup(userDetails.getUsername());
        String otpAuthUri = twoFactorService.getOtpAuthUri(secret, userDetails.getUsername());
        return ResponseEntity.ok(Map.of("secret", secret, "otpAuthUri", otpAuthUri));
    }

    @PostMapping("/2fa/enable")
    public ResponseEntity<?> enableTwoFactor(@AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String code = body.get("code");
        if (authService.verifyAndEnableTwoFactor(userDetails.getUsername(), code)) {
            return ResponseEntity.ok(Map.of("message", "Đã bật xác thực 2 lớp"));
        }
        return ResponseEntity.badRequest().body(Map.of("message", "Mã xác thực không chính xác"));
    }

    @PostMapping("/2fa/disable")
    public ResponseEntity<?> disableTwoFactor(@AuthenticationPrincipal UserDetails userDetails) {
        authService.disableTwoFactor(userDetails.getUsername());
        return ResponseEntity.ok(Map.of("message", "Đã tắt xác thực 2 lớp"));
    }

    // --- Public Operations (Account Unlock) ---

    @PostMapping("/unlock/request")
    public ResponseEntity<?> requestUnlockOtp(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        authService.generateOtp(email, "UNLOCK_ACCOUNT");
        return ResponseEntity.ok(Map.of("message", "Mã mở khóa đã được gửi tới email (nếu tồn tại)"));
    }

    @PostMapping("/unlock/confirm")
    public ResponseEntity<?> unlockAccount(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String otp = body.get("otp");

        if (authService.unlockAccount(email, otp)) {
            return ResponseEntity.ok(Map.of("message", "Mở khóa tài khoản thành công. Vui lòng đăng nhập lại."));
        }
        return ResponseEntity.badRequest().body(Map.of("message", "Mã OTP không chính xác hoặc đã hết hạn"));
    }

    @PostMapping("/unlock/submit-request")
    public ResponseEntity<?> submitUnlockRequest(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String reason = body.get("reason");

        if (email == null || email.isBlank() || reason == null || reason.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email và lý do không được để trống"));
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.ok(Map.of("message", "Đơn mở khóa đã được gửi (nếu tài khoản tồn tại)"));
        }

        if (user.getIsActive()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Tài khoản không bị khóa"));
        }

        if (unlockRequestRepository.existsByUserIdAndStatus(user.getId(), "PENDING")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Bạn đã có đơn mở khóa đang chờ xử lý"));
        }

        UnlockRequest request = UnlockRequest.builder()
                .userId(user.getId())
                .reason(reason)
                .status("PENDING")
                .build();
        unlockRequestRepository.save(request);

        return ResponseEntity.ok(Map.of("message", "Đơn mở khóa đã được gửi thành công. Vui lòng chờ quản trị viên xử lý."));
    }
}
