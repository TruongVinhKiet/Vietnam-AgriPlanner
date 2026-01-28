package com.agriplanner.service;

import com.agriplanner.model.AssetTransaction;
import com.agriplanner.model.User;
import com.agriplanner.repository.AssetTransactionRepository;
import com.agriplanner.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Service for Asset/Balance management
 * Handles all balance updates and transaction logging
 */
@Service
@RequiredArgsConstructor
@SuppressWarnings("null")
public class AssetService {

    private final UserRepository userRepository;
    private final AssetTransactionRepository assetTransactionRepository;

    /**
     * Deduct expense from user balance
     * 
     * @return true if successful, false if insufficient balance
     */
    @Transactional
    public boolean deductExpense(Long userId, BigDecimal amount, String category, String description, Long fieldId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return false;
        }

        BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;

        // Allow negative balance for now (can be changed later)
        user.setBalance(currentBalance.subtract(amount));
        userRepository.save(user);

        // Log transaction
        AssetTransaction transaction = AssetTransaction.builder()
                .userId(userId)
                .amount(amount)
                .transactionType("EXPENSE")
                .category(category)
                .description(description)
                .fieldId(fieldId)
                .build();
        assetTransactionRepository.save(transaction);

        return true;
    }

    /**
     * Add income to user balance
     */
    @Transactional
    public void addIncome(Long userId, BigDecimal amount, String category, String description, Long fieldId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return;
        }

        BigDecimal currentBalance = user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO;
        user.setBalance(currentBalance.add(amount));
        userRepository.save(user);

        // Log transaction
        AssetTransaction transaction = AssetTransaction.builder()
                .userId(userId)
                .amount(amount)
                .transactionType("INCOME")
                .category(category)
                .description(description)
                .fieldId(fieldId)
                .build();
        assetTransactionRepository.save(transaction);
    }

    /**
     * Get user balance
     */
    public BigDecimal getBalance(Long userId) {
        return userRepository.findById(userId)
                .map(user -> user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO)
                .orElse(BigDecimal.ZERO);
    }

    /**
     * Get user balance by email
     */
    public BigDecimal getBalanceByEmail(String email) {
        return userRepository.findByEmail(email)
                .map(user -> user.getBalance() != null ? user.getBalance() : BigDecimal.ZERO)
                .orElse(BigDecimal.ZERO);
    }
}
