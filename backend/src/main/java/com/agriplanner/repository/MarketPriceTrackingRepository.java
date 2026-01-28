package com.agriplanner.repository;

import com.agriplanner.model.MarketPriceTracking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface MarketPriceTrackingRepository extends JpaRepository<MarketPriceTracking, Long> {

    List<MarketPriceTracking> findByShopItemIdOrderByPurchaseDateDesc(Long shopItemId);

    List<MarketPriceTracking> findByUserIdOrderByPurchaseDateDesc(Long userId);

    @Query("SELECT AVG(m.reportedPrice) FROM MarketPriceTracking m WHERE m.shopItem.id = :itemId AND m.purchaseDate >= :fromDate")
    BigDecimal getAveragePriceForItem(@Param("itemId") Long itemId, @Param("fromDate") LocalDate fromDate);

    @Query("SELECT m FROM MarketPriceTracking m WHERE m.shopItem.id = :itemId ORDER BY m.purchaseDate DESC LIMIT 10")
    List<MarketPriceTracking> getRecentPricesForItem(@Param("itemId") Long itemId);
}
