package com.agriplanner.controller;

import com.agriplanner.model.AssetTransaction;
import com.agriplanner.model.User;
import com.agriplanner.repository.AssetTransactionRepository;
import com.agriplanner.repository.UserRepository;
import com.agriplanner.service.DiscordOtpService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * REST Controller for Asset Management
 * Handles balance tracking, transaction history, and withdrawals with OTP verification
 */
@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
@Slf4j
public class AssetController {

    private final UserRepository userRepository;
    private final AssetTransactionRepository assetTransactionRepository;
    private final DiscordOtpService discordOtpService;

    // Pattern to validate numeric-only image names (without extension)
    private static final Pattern NUMERIC_PATTERN = Pattern.compile("^\\d+$");

    /**
     * Get current balance for user
     */
    @GetMapping("/balance")
    public ResponseEntity<?> getBalance(@RequestParam String email) {
        return userRepository.findByEmail(email)
                .map(user -> ResponseEntity.ok(Map.of(
                        "balance", user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO,
                        "email", email)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Get transaction history for user
     */
    @GetMapping("/transactions")
    public ResponseEntity<List<AssetTransaction>> getTransactions(@RequestParam String email) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(assetTransactionRepository.findTop50ByUserIdOrderByCreatedAtDesc(user.getId()));
    }

    /**
     * Top-up balance by uploading image with numeric filename
     * Image name (without extension) must be numeric, representing amount in VND
     */
    @PostMapping("/topup")
    public ResponseEntity<?> topUp(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String imageName = request.get("imageName"); // e.g., "1500000.jpg"

        if (email == null || imageName == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing email or imageName"));
        }

        // Extract filename without extension
        String nameWithoutExt = imageName;
        int dotIndex = imageName.lastIndexOf('.');
        if (dotIndex > 0) {
            nameWithoutExt = imageName.substring(0, dotIndex);
        }

        // Validate: must be numeric only
        if (!NUMERIC_PATTERN.matcher(nameWithoutExt).matches()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Tên hình ảnh phải là số thuần túy (ví dụ: 1500000.jpg)",
                    "invalidName", imageName));
        }

        // Parse amount
        BigDecimal amount;
        try {
            amount = new BigDecimal(nameWithoutExt);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Không thể chuyển đổi tên file thành số tiền"));
        }

        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Số tiền phải lớn hơn 0"));
        }

        // Find user and update balance
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;
        user.setBalance(currentBalance.add(amount));
        userRepository.save(user);

        // Log transaction
        AssetTransaction transaction = AssetTransaction.builder()
                .userId(user.getId())
                .amount(amount)
                .transactionType("INCOME")
                .category("TOPUP")
                .description("Nạp tiền từ hình ảnh: " + imageName)
                .imageName(imageName)
                .build();
        assetTransactionRepository.save(transaction);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Nạp tiền thành công",
                "amount", amount,
                "newBalance", user.getBalance()));
    }

    /**
     * Manual balance adjustment (for admin use)
     */
    @PostMapping("/adjust")
    public ResponseEntity<?> adjustBalance(@RequestBody Map<String, Object> request) {
        String email = (String) request.get("email");
        BigDecimal amount = new BigDecimal(request.get("amount").toString());
        String type = (String) request.get("type"); // INCOME or EXPENSE
        String category = (String) request.get("category");
        String description = (String) request.get("description");

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;

        if ("INCOME".equals(type)) {
            user.setBalance(currentBalance.add(amount));
        } else {
            user.setBalance(currentBalance.subtract(amount));
        }
        userRepository.save(user);

        // Log transaction
        AssetTransaction transaction = AssetTransaction.builder()
                .userId(user.getId())
                .amount(amount)
                .transactionType(type)
                .category(category != null ? category : "ADJUSTMENT")
                .description(description)
                .build();
        assetTransactionRepository.save(transaction);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "newBalance", user.getBalance()));
    }

    // ==================== WITHDRAWAL WITH DISCORD OTP ====================

    /**
     * Step 1: Request OTP for withdrawal - sends OTP to Discord channel
     */
    @PostMapping("/withdraw/request-otp")
    public ResponseEntity<?> requestWithdrawOtp(@RequestBody Map<String, Object> request) {
        try {
            String email = (String) request.get("email");
            BigDecimal amount = new BigDecimal(request.get("amount").toString());

            if (email == null || email.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Thiếu thông tin email"));
            }

            if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Số tiền phải lớn hơn 0"));
            }

            // Find user
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                return ResponseEntity.notFound().build();
            }

            // Check balance
            BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;
            if (currentBalance.compareTo(amount) < 0) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Số dư không đủ",
                        "currentBalance", currentBalance,
                        "requestedAmount", amount));
            }

            // Generate and send OTP via Discord
            discordOtpService.generateAndSendOtp(email, user.getFullName(), amount.doubleValue());

            log.info("[WITHDRAW] OTP requested for {} - amount: {}", email, amount);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Mã OTP đã được gửi qua Discord. Vui lòng kiểm tra và nhập mã xác thực.",
                    "expiresInMinutes", 5));
        } catch (Exception e) {
            log.error("[WITHDRAW] Error requesting OTP: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi: " + e.getMessage()));
        }
    }

    /**
     * Step 2: Confirm withdrawal with OTP verification
     */
    @PostMapping("/withdraw/confirm")
    public ResponseEntity<?> confirmWithdraw(@RequestBody Map<String, Object> request) {
        try {
            String email = (String) request.get("email");
            String otpCode = (String) request.get("otpCode");
            BigDecimal amount = new BigDecimal(request.get("amount").toString());
            String reason = (String) request.getOrDefault("reason", "Rút tiền");

            if (email == null || otpCode == null || otpCode.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Thiếu thông tin email hoặc mã OTP"));
            }

            // Verify OTP
            boolean otpValid = discordOtpService.verifyOtp(email, otpCode);
            if (!otpValid) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng thử lại."));
            }

            // Find user
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                return ResponseEntity.notFound().build();
            }

            // Check balance again (double-check)
            BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;
            if (currentBalance.compareTo(amount) < 0) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Số dư không đủ để rút tiền",
                        "currentBalance", currentBalance));
            }

            // Deduct balance
            user.setBalance(currentBalance.subtract(amount));
            userRepository.save(user);

            // Log transaction
            AssetTransaction transaction = AssetTransaction.builder()
                    .userId(user.getId())
                    .amount(amount)
                    .transactionType("EXPENSE")
                    .category("WITHDRAWAL")
                    .description("Rút tiền: " + reason + " (Xác thực OTP Discord)")
                    .build();
            assetTransactionRepository.save(transaction);

            log.info("[WITHDRAW] Withdrawal successful for {} - amount: {} - new balance: {}",
                    email, amount, user.getBalance());

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Rút tiền thành công!",
                    "withdrawnAmount", amount,
                    "newBalance", user.getBalance(),
                    "transactionId", transaction.getId()));
        } catch (Exception e) {
            log.error("[WITHDRAW] Error confirming withdrawal: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi: " + e.getMessage()));
        }
    }
}
