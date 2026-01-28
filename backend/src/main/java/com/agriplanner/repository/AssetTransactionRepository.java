package com.agriplanner.repository;

import com.agriplanner.model.AssetTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for AssetTransaction entity
 */
@Repository
public interface AssetTransactionRepository extends JpaRepository<AssetTransaction, Long> {

    /**
     * Find all transactions for a user, ordered by date descending
     */
    List<AssetTransaction> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Find transactions by type (INCOME or EXPENSE)
     */
    List<AssetTransaction> findByUserIdAndTransactionTypeOrderByCreatedAtDesc(Long userId, String transactionType);

    /**
     * Find transactions by type and category
     */
    List<AssetTransaction> findByUserIdAndTransactionTypeAndCategoryOrderByCreatedAtDesc(
            Long userId, String transactionType, String category);

    /**
     * Find recent transactions (limit 50)
     */
    List<AssetTransaction> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);
}
