package com.agriplanner.repository;

import com.agriplanner.model.Order;
import com.agriplanner.model.ShippingRate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShippingRateRepository extends JpaRepository<ShippingRate, Long> {
    
    Optional<ShippingRate> findByShippingType(Order.ShippingType shippingType);
    
    List<ShippingRate> findByIsActiveTrueOrderByBaseFeeAsc();
}
