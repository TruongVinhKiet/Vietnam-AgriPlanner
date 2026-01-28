package com.agriplanner.controller;

import com.agriplanner.model.*;
import com.agriplanner.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/money")
@RequiredArgsConstructor
@SuppressWarnings("null")
public class MoneyTransferController {

    private final MoneyTransferRepository transferRepository;
    private final UserRepository userRepository;
    private final AssetTransactionRepository transactionRepository;
    private final PasswordEncoder passwordEncoder;

    // ==================== TRANSFER APIs ====================

    /**
     * Chuyển tiền trực tiếp (không qua admin)
     */
    @PostMapping("/transfer")
    public ResponseEntity<?> transferDirect(@RequestBody Map<String, Object> request) {
        try {
            Long senderId = Long.parseLong(request.get("senderId").toString());
            Long receiverId = Long.parseLong(request.get("receiverId").toString());
            BigDecimal amount = new BigDecimal(request.get("amount").toString());
            String password = (String) request.get("password");
            Long chatMessageId = request.containsKey("chatMessageId")
                    ? Long.parseLong(request.get("chatMessageId").toString())
                    : null;

            User sender = userRepository.findById(senderId)
                    .orElseThrow(() -> new RuntimeException("Sender not found"));
            User receiver = userRepository.findById(receiverId)
                    .orElseThrow(() -> new RuntimeException("Receiver not found"));

            // Verify password
            if (!passwordEncoder.matches(password, sender.getPasswordHash())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Mật khẩu không đúng"));
            }

            // Check balance
            if (sender.getBalance().compareTo(amount) < 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Số dư không đủ"));
            }

            // Perform transfer
            sender.setBalance(sender.getBalance().subtract(amount));
            receiver.setBalance(receiver.getBalance().add(amount));
            userRepository.save(sender);
            userRepository.save(receiver);

            // Log transactions
            AssetTransaction senderTx = AssetTransaction.builder()
                    .userId(senderId)
                    .amount(amount)
                    .transactionType("EXPENSE")
                    .category("TRANSFER_OUT")
                    .description("Chuyển tiền cho " + receiver.getFullName())
                    .build();
            transactionRepository.save(senderTx);

            AssetTransaction receiverTx = AssetTransaction.builder()
                    .userId(receiverId)
                    .amount(amount)
                    .transactionType("INCOME")
                    .category("TRANSFER_IN")
                    .description("Nhận tiền từ " + sender.getFullName())
                    .build();
            transactionRepository.save(receiverTx);

            // Create transfer record
            MoneyTransferRequest transfer = MoneyTransferRequest.builder()
                    .sender(sender)
                    .receiver(receiver)
                    .amount(amount)
                    .status(MoneyTransferRequest.TransferStatus.COMPLETED)
                    .chatMessageId(chatMessageId)
                    .processedAt(LocalDateTime.now())
                    .build();
            transferRepository.save(transfer);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Chuyển tiền thành công",
                    "newBalance", sender.getBalance()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Gửi yêu cầu admin xác minh trước khi chuyển
     */
    @PostMapping("/request-verification")
    public ResponseEntity<?> requestAdminVerification(@RequestBody Map<String, Object> request) {
        try {
            Long senderId = Long.parseLong(request.get("senderId").toString());
            Long receiverId = Long.parseLong(request.get("receiverId").toString());
            BigDecimal amount = new BigDecimal(request.get("amount").toString());
            String password = (String) request.get("password");
            Long chatMessageId = request.containsKey("chatMessageId")
                    ? Long.parseLong(request.get("chatMessageId").toString())
                    : null;
            Long chatRoomId = request.containsKey("chatRoomId")
                    ? Long.parseLong(request.get("chatRoomId").toString())
                    : null;

            User sender = userRepository.findById(senderId)
                    .orElseThrow(() -> new RuntimeException("Sender not found"));
            User receiver = userRepository.findById(receiverId)
                    .orElseThrow(() -> new RuntimeException("Receiver not found"));

            // Verify password
            if (!passwordEncoder.matches(password, sender.getPasswordHash())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Mật khẩu không đúng"));
            }

            // Check balance
            if (sender.getBalance().compareTo(amount) < 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Số dư không đủ"));
            }

            // Create pending request
            MoneyTransferRequest transfer = MoneyTransferRequest.builder()
                    .sender(sender)
                    .receiver(receiver)
                    .amount(amount)
                    .status(MoneyTransferRequest.TransferStatus.AWAITING_ADMIN)
                    .requiresAdminVerification(true)
                    .chatMessageId(chatMessageId)
                    .chatRoomId(chatRoomId)
                    .build();
            transferRepository.save(transfer);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã gửi yêu cầu xác minh cho admin",
                    "requestId", transfer.getId()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== ADMIN APIs ====================

    /**
     * Lấy danh sách yêu cầu chờ admin duyệt
     */
    @GetMapping("/pending")
    public ResponseEntity<List<MoneyTransferRequest>> getPendingRequests() {
        return ResponseEntity.ok(
                transferRepository.findByRequiresAdminVerificationTrueAndStatusOrderByCreatedAtDesc(
                        MoneyTransferRequest.TransferStatus.AWAITING_ADMIN));
    }

    /**
     * Đếm số yêu cầu pending
     */
    @GetMapping("/pending/count")
    public ResponseEntity<Long> getPendingCount() {
        return ResponseEntity.ok(transferRepository.countPendingAdminVerifications());
    }

    /**
     * Admin duyệt yêu cầu
     */
    @PostMapping("/approve/{requestId}")
    public ResponseEntity<?> approveRequest(
            @PathVariable Long requestId,
            @RequestParam Long adminId) {
        try {
            MoneyTransferRequest request = transferRepository.findById(requestId)
                    .orElseThrow(() -> new RuntimeException("Request not found"));

            if (request.getStatus() != MoneyTransferRequest.TransferStatus.AWAITING_ADMIN) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request đã được xử lý"));
            }

            User sender = request.getSender();
            User receiver = request.getReceiver();
            BigDecimal amount = request.getAmount();
            User admin = userRepository.findById(adminId).orElse(null);

            // Check balance again
            if (sender.getBalance().compareTo(amount) < 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Người gửi không đủ số dư"));
            }

            // Perform transfer
            sender.setBalance(sender.getBalance().subtract(amount));
            receiver.setBalance(receiver.getBalance().add(amount));
            userRepository.save(sender);
            userRepository.save(receiver);

            // Log transactions
            transactionRepository.save(AssetTransaction.builder()
                    .userId(sender.getId())
                    .amount(amount)
                    .transactionType("EXPENSE")
                    .category("TRANSFER_OUT")
                    .description("Chuyển tiền cho " + receiver.getFullName() + " (Admin duyệt)")
                    .build());

            transactionRepository.save(AssetTransaction.builder()
                    .userId(receiver.getId())
                    .amount(amount)
                    .transactionType("INCOME")
                    .category("TRANSFER_IN")
                    .description("Nhận tiền từ " + sender.getFullName() + " (Admin duyệt)")
                    .build());

            // Update request
            request.setStatus(MoneyTransferRequest.TransferStatus.APPROVED);
            request.setProcessedAt(LocalDateTime.now());
            request.setProcessedBy(admin);
            transferRepository.save(request);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã duyệt và chuyển tiền thành công"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Admin từ chối yêu cầu
     */
    @PostMapping("/reject/{requestId}")
    public ResponseEntity<?> rejectRequest(
            @PathVariable Long requestId,
            @RequestParam Long adminId,
            @RequestBody Map<String, String> body) {
        try {
            String reason = body.get("reason");

            MoneyTransferRequest request = transferRepository.findById(requestId)
                    .orElseThrow(() -> new RuntimeException("Request not found"));

            if (request.getStatus() != MoneyTransferRequest.TransferStatus.AWAITING_ADMIN) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request đã được xử lý"));
            }

            User admin = userRepository.findById(adminId).orElse(null);

            // Update request
            request.setStatus(MoneyTransferRequest.TransferStatus.REJECTED);
            request.setRejectionReason(reason);
            request.setProcessedAt(LocalDateTime.now());
            request.setProcessedBy(admin);
            transferRepository.save(request);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Đã từ chối yêu cầu",
                    "reason", reason));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==================== USER APIs ====================

    /**
     * Lấy số dư hiện tại
     */
    @GetMapping("/balance/{userId}")
    public ResponseEntity<?> getBalance(@PathVariable Long userId) {
        return userRepository.findById(userId)
                .map(user -> ResponseEntity.ok(Map.of("balance", user.getBalance())))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Lịch sử chuyển tiền của user
     */
    @GetMapping("/history/{userId}")
    public ResponseEntity<List<MoneyTransferRequest>> getTransferHistory(@PathVariable Long userId) {
        List<MoneyTransferRequest> sent = transferRepository.findBySenderIdOrderByCreatedAtDesc(userId);
        List<MoneyTransferRequest> received = transferRepository.findByReceiverIdOrderByCreatedAtDesc(userId);
        sent.addAll(received);
        sent.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        return ResponseEntity.ok(sent);
    }
}
