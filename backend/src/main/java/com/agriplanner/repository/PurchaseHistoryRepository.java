package com.agriplanner.repository;

import com.agriplanner.model.PurchaseHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseHistoryRepository extends JpaRepository<PurchaseHistory, Long> {
    
    List<PurchaseHistory> findByUserIdOrderByPurchasedAtDesc(Long userId);
    
    List<PurchaseHistory> findByUserIdAndShopItemIdOrderByPurchasedAtDesc(Long userId, Long shopItemId);
    
    @Query("SELECT p FROM PurchaseHistory p LEFT JOIN p.review r WHERE p.user.id = :userId AND r IS NULL ORDER BY p.purchasedAt DESC")
    List<PurchaseHistory> findUnreviewedPurchasesByUserId(@Param("userId") Long userId);
    
    @Query("SELECT p FROM PurchaseHistory p LEFT JOIN p.review r WHERE p.user.id = :userId AND p.shopItem.id = :shopItemId AND r IS NULL")
    List<PurchaseHistory> findUnreviewedPurchasesByUserAndItem(@Param("userId") Long userId, @Param("shopItemId") Long shopItemId);
    
    @Query("SELECT COUNT(p) FROM PurchaseHistory p WHERE p.user.id = :userId AND p.shopItem.id = :shopItemId")
    int countByUserIdAndShopItemId(@Param("userId") Long userId, @Param("shopItemId") Long shopItemId);
}
