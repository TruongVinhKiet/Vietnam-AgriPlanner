package com.agriplanner.repository;

import com.agriplanner.model.MarketPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MarketPriceRepository extends JpaRepository<MarketPrice, Long> {
    List<MarketPrice> findByCropIdOrderByPriceDateDesc(Long cropId);

    List<MarketPrice> findTop20ByOrderByPriceDateDesc();
}
