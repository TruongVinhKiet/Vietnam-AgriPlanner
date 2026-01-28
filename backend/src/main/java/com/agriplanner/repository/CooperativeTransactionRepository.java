package com.agriplanner.repository;

import com.agriplanner.model.CooperativeTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CooperativeTransactionRepository extends JpaRepository<CooperativeTransaction, Long> {

    List<CooperativeTransaction> findByCooperative_IdOrderByCreatedAtDesc(Long cooperativeId);

    List<CooperativeTransaction> findByMember_IdOrderByCreatedAtDesc(Long memberId);

    List<CooperativeTransaction> findByCooperative_IdAndType(Long cooperativeId,
            CooperativeTransaction.TransactionType type);
}
