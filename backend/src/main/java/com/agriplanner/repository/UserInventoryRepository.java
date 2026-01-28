package com.agriplanner.repository;

import com.agriplanner.model.UserInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserInventoryRepository extends JpaRepository<UserInventory, Long> {
    
    List<UserInventory> findByUserIdAndQuantityGreaterThan(Long userId, BigDecimal minQuantity);
    
    default List<UserInventory> findByUserIdWithStock(Long userId) {
        return findByUserIdAndQuantityGreaterThan(userId, BigDecimal.ZERO);
    }
    
    Optional<UserInventory> findByUserIdAndShopItemId(Long userId, Long shopItemId);
    
    @Query("SELECT ui FROM UserInventory ui WHERE ui.userId = :userId AND ui.quantity > 0 AND " +
           "(ui.shopItem.category = :category OR ui.itemCategory = :category)")
    List<UserInventory> findByUserIdAndCategory(@Param("userId") Long userId, @Param("category") String category);
    
    @Query("SELECT ui FROM UserInventory ui WHERE ui.userId = :userId AND ui.quantity > 0 " +
           "ORDER BY ui.shopItem.category, ui.itemCategory, ui.updatedAt DESC")
    List<UserInventory> findByUserIdGroupedByCategory(@Param("userId") Long userId);
    
    @Query("SELECT SUM(ui.quantity * COALESCE(ui.shopItem.price, ui.purchasePrice)) FROM UserInventory ui WHERE ui.userId = :userId AND ui.quantity > 0")
    BigDecimal calculateTotalInventoryValue(@Param("userId") Long userId);
    
    @Query("SELECT ui FROM UserInventory ui WHERE ui.userId = :userId AND ui.shopItem.feedDefinitionId = :feedId AND ui.quantity > 0")
    Optional<UserInventory> findByUserIdAndFeedDefinitionId(@Param("userId") Long userId, @Param("feedId") Long feedId);
    
    @Query("SELECT ui FROM UserInventory ui WHERE ui.userId = :userId AND ui.shopItem.cropDefinitionId = :cropId AND ui.quantity > 0")
    Optional<UserInventory> findByUserIdAndCropDefinitionId(@Param("userId") Long userId, @Param("cropId") Long cropId);
    
    @Query("SELECT COUNT(DISTINCT COALESCE(ui.shopItem.category, ui.itemCategory)) FROM UserInventory ui WHERE ui.userId = :userId AND ui.quantity > 0")
    int countCategoriesByUserId(@Param("userId") Long userId);
    
    @Query("SELECT COUNT(ui) FROM UserInventory ui WHERE ui.userId = :userId AND ui.quantity > 0")
    int countItemsByUserId(@Param("userId") Long userId);
}
