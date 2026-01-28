package com.agriplanner.repository;

import com.agriplanner.model.ShopItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShopItemRepository extends JpaRepository<ShopItem, Long> {
    
    List<ShopItem> findByIsActiveTrue();
    
    List<ShopItem> findByIsActiveTrueOrderByIsFeaturedDescSoldCountDesc();
    
    List<ShopItem> findByCategoryAndIsActiveTrue(String category);
    
    List<ShopItem> findByIsFeaturedTrueAndIsActiveTrue();
    
    @Query("SELECT s FROM ShopItem s WHERE s.isActive = true AND " +
           "(LOWER(s.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(s.description) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    List<ShopItem> searchByKeyword(@Param("keyword") String keyword);
    
    @Query("SELECT DISTINCT s.category FROM ShopItem s WHERE s.isActive = true ORDER BY s.category")
    List<String> findAllActiveCategories();
    
    Optional<ShopItem> findByFeedDefinitionId(Long feedDefinitionId);
    
    Optional<ShopItem> findByCropDefinitionId(Long cropDefinitionId);
    
    @Query("SELECT s FROM ShopItem s WHERE s.isActive = true AND s.category = :category ORDER BY s.isFeatured DESC, s.soldCount DESC")
    List<ShopItem> findByCategoryOrderByPopularity(@Param("category") String category);
}
