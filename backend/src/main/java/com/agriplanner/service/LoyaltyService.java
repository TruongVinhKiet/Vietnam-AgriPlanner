package com.agriplanner.service;

import com.agriplanner.model.LoyaltyTransaction;
import com.agriplanner.model.User;
import com.agriplanner.repository.LoyaltyTransactionRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Objects;

/**
 * Loyalty Points Service
 * 1 điểm / 1000 VNĐ subtotal (không tính phí ship)
 * 1 điểm tích lũy = 1 VNĐ khi sử dụng
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LoyaltyService {

    private final UserRepository userRepository;
    private final LoyaltyTransactionRepository loyaltyTransactionRepository;

    private static final int POINTS_PER_AMOUNT = 1000; // 1 point per 1000 VND

    /**
     * Tính số điểm sẽ nhận được từ một đơn hàng
     * @param subtotal tổng tiền hàng (không tính phí ship)
     * @return số điểm
     */
    public int calculateEarnedPoints(BigDecimal subtotal) {
        if (subtotal == null || subtotal.compareTo(BigDecimal.ZERO) <= 0) {
            return 0;
        }
        return subtotal.divide(BigDecimal.valueOf(POINTS_PER_AMOUNT), 0, RoundingMode.FLOOR).intValue();
    }

    /**
     * Cộng điểm tích lũy cho user (khi giao hàng thành công)
     */
    @Transactional
    public void earnPoints(Long userId, int points, Long orderId, String description) {
        if (points <= 0) return;

        Long safeUserId = Objects.requireNonNull(userId, "User ID cannot be null");

        User user = userRepository.findById(safeUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        int currentPoints = user.getLoyaltyPoints() != null ? user.getLoyaltyPoints() : 0;
        int newBalance = currentPoints + points;
        user.setLoyaltyPoints(newBalance);
        userRepository.save(user);

        LoyaltyTransaction tx = LoyaltyTransaction.builder()
            .userId(safeUserId)
                .orderId(orderId)
                .points(points)
                .type("EARN")
                .description(description)
                .balanceAfter(newBalance)
                .build();
        loyaltyTransactionRepository.save(Objects.requireNonNull(tx, "Loyalty transaction cannot be null"));

        log.info("[LOYALTY] User {} earned {} points. New balance: {}", safeUserId, points, newBalance);
    }

    /**
     * Sử dụng điểm tích lũy (khi đặt hàng)
     */
    @Transactional
    public void spendPoints(Long userId, int points, Long orderId, String description) {
        if (points <= 0) return;

        Long safeUserId = Objects.requireNonNull(userId, "User ID cannot be null");

        User user = userRepository.findById(safeUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        int currentPoints = user.getLoyaltyPoints() != null ? user.getLoyaltyPoints() : 0;
        if (currentPoints < points) {
            throw new RuntimeException("Insufficient loyalty points. Available: " + currentPoints + ", Requested: " + points);
        }

        int newBalance = currentPoints - points;
        user.setLoyaltyPoints(newBalance);
        userRepository.save(user);

        LoyaltyTransaction tx = LoyaltyTransaction.builder()
            .userId(safeUserId)
                .orderId(orderId)
                .points(-points)
                .type("SPEND")
                .description(description)
                .balanceAfter(newBalance)
                .build();
        loyaltyTransactionRepository.save(Objects.requireNonNull(tx, "Loyalty transaction cannot be null"));

        log.info("[LOYALTY] User {} spent {} points. New balance: {}", safeUserId, points, newBalance);
    }

    /**
     * Hoàn trả điểm (khi hủy đơn)
     */
    @Transactional
    public void refundPoints(Long userId, int points, Long orderId) {
        if (points <= 0) return;

        Long safeUserId = Objects.requireNonNull(userId, "User ID cannot be null");

        User user = userRepository.findById(safeUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        int currentPoints = user.getLoyaltyPoints() != null ? user.getLoyaltyPoints() : 0;
        int newBalance = currentPoints + points;
        user.setLoyaltyPoints(newBalance);
        userRepository.save(user);

        LoyaltyTransaction tx = LoyaltyTransaction.builder()
            .userId(safeUserId)
                .orderId(orderId)
                .points(points)
                .type("REFUND")
                .description("Hoàn điểm do hủy đơn hàng")
                .balanceAfter(newBalance)
                .build();
        loyaltyTransactionRepository.save(Objects.requireNonNull(tx, "Loyalty transaction cannot be null"));

        log.info("[LOYALTY] User {} refunded {} points. New balance: {}", safeUserId, points, newBalance);
    }

    /**
     * Lấy số điểm hiện tại của user
     */
    public int getUserPoints(Long userId) {
        Long safeUserId = Objects.requireNonNull(userId, "User ID cannot be null");
        User user = userRepository.findById(safeUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getLoyaltyPoints() != null ? user.getLoyaltyPoints() : 0;
    }

    /**
     * Lấy lịch sử giao dịch điểm
     */
    public List<LoyaltyTransaction> getPointsHistory(Long userId) {
        Long safeUserId = Objects.requireNonNull(userId, "User ID cannot be null");
        return loyaltyTransactionRepository.findByUserIdOrderByCreatedAtDesc(safeUserId);
    }
}
