package com.agriplanner.repository;

import com.agriplanner.model.MoneyTransferRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MoneyTransferRepository extends JpaRepository<MoneyTransferRequest, Long> {

    // Find pending requests for admin
    List<MoneyTransferRequest> findByStatusOrderByCreatedAtDesc(MoneyTransferRequest.TransferStatus status);

    // Find requests awaiting admin verification
    List<MoneyTransferRequest> findByRequiresAdminVerificationTrueAndStatusOrderByCreatedAtDesc(
            MoneyTransferRequest.TransferStatus status);

    // Find by sender
    List<MoneyTransferRequest> findBySenderIdOrderByCreatedAtDesc(Long senderId);

    // Find by receiver
    List<MoneyTransferRequest> findByReceiverIdOrderByCreatedAtDesc(Long receiverId);

    // Find by chat message id
    MoneyTransferRequest findByChatMessageId(Long chatMessageId);

    // Count pending admin verifications
    @Query("SELECT COUNT(m) FROM MoneyTransferRequest m WHERE m.status = 'AWAITING_ADMIN' AND m.requiresAdminVerification = true")
    long countPendingAdminVerifications();
}
