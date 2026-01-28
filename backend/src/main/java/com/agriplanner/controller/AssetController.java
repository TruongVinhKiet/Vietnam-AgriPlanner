package com.agriplanner.controller;

import com.agriplanner.model.AssetTransaction;
import com.agriplanner.model.User;
import com.agriplanner.repository.AssetTransactionRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * REST Controller for Asset Management
 * Handles balance tracking and transaction history
 */
@RestController
@RequestMapping("/api/assets")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@SuppressWarnings("null")
public class AssetController {

    private final UserRepository userRepository;
    private final AssetTransactionRepository assetTransactionRepository;

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
}
