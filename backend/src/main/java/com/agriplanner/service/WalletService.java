package com.agriplanner.service;

import com.agriplanner.model.User;
import com.agriplanner.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class WalletService {

    @Autowired
    private UserRepository userRepository;

    @Transactional
    public void transferFunds(Long senderId, Long receiverId, BigDecimal amount, String description) {
        if (senderId == null || receiverId == null)
            throw new IllegalArgumentException("IDs cannot be null");

        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Sender not found"));
        User receiver = userRepository.findById(receiverId)
                .orElseThrow(() -> new RuntimeException("Receiver not found"));

        if (sender.getBalance().compareTo(amount) < 0) {
            throw new RuntimeException("Insufficient funds");
        }

        sender.setBalance(sender.getBalance().subtract(amount));
        receiver.setBalance(receiver.getBalance().add(amount));

        userRepository.save(sender);
        userRepository.save(receiver);

        // Transaction logging to be implemented in future iterations
        // transactionHistoryRepository.save(new Transaction(...));
    }

    @Transactional
    public void deductFunds(Long userId, BigDecimal amount, String description) {
        if (userId == null)
            throw new IllegalArgumentException("User ID null");
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getBalance().compareTo(amount) < 0) {
            throw new RuntimeException("Insufficient funds");
        }

        user.setBalance(user.getBalance().subtract(amount));
        userRepository.save(user);
    }

    @Transactional
    public void addFunds(Long userId, BigDecimal amount, String description) {
        if (userId == null)
            throw new IllegalArgumentException("User ID null");
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setBalance(user.getBalance().add(amount));
        userRepository.save(user);
    }
}
