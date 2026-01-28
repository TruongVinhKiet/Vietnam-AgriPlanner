package com.agriplanner.repository;

import com.agriplanner.model.ProductReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductReviewRepository extends JpaRepository<ProductReview, Long> {
    
    List<ProductReview> findByShopItemIdOrderByCreatedAtDesc(Long shopItemId);
    
    List<ProductReview> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    Optional<ProductReview> findByPurchaseId(Long purchaseId);
    
    boolean existsByPurchaseId(Long purchaseId);
    
    @Query("SELECT AVG(r.rating) FROM ProductReview r WHERE r.shopItem.id = :shopItemId")
    Double getAverageRatingByShopItemId(@Param("shopItemId") Long shopItemId);
    
    @Query("SELECT COUNT(r) FROM ProductReview r WHERE r.shopItem.id = :shopItemId")
    int countByShopItemId(@Param("shopItemId") Long shopItemId);
    
    @Query("SELECT r.rating, COUNT(r) FROM ProductReview r WHERE r.shopItem.id = :shopItemId GROUP BY r.rating ORDER BY r.rating DESC")
    List<Object[]> getRatingDistributionByShopItemId(@Param("shopItemId") Long shopItemId);
}
