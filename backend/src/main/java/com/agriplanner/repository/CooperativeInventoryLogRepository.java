package com.agriplanner.repository;

import com.agriplanner.model.CooperativeInventoryLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CooperativeInventoryLogRepository extends JpaRepository<CooperativeInventoryLog, Long> {

    List<CooperativeInventoryLog> findByCooperative_IdOrderByCreatedAtDesc(Long cooperativeId);

    List<CooperativeInventoryLog> findByInventory_IdOrderByCreatedAtDesc(Long inventoryId);
}
