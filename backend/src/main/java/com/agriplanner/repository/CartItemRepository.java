package com.agriplanner.repository;

import com.agriplanner.model.CartItem;
import com.agriplanner.model.ShopItem;
import com.agriplanner.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    
    List<CartItem> findByUserOrderByAddedAtDesc(User user);
    
    List<CartItem> findByUserIdOrderByAddedAtDesc(Long userId);
    
    Optional<CartItem> findByUserAndShopItem(User user, ShopItem shopItem);
    
    Optional<CartItem> findByUserIdAndShopItemId(Long userId, Long shopItemId);
    
    void deleteByUserAndShopItem(User user, ShopItem shopItem);
    
    void deleteByUserId(Long userId);
    
    @Query("SELECT COUNT(c) FROM CartItem c WHERE c.user.id = :userId")
    int countByUserId(@Param("userId") Long userId);
    
    @Query("SELECT SUM(c.quantity * c.shopItem.price) FROM CartItem c WHERE c.user.id = :userId")
    java.math.BigDecimal getTotalValueByUserId(@Param("userId") Long userId);
    
    boolean existsByUserIdAndShopItemId(Long userId, Long shopItemId);
}
