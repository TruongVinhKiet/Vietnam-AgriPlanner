package com.agriplanner.repository;

import com.agriplanner.model.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface InventoryRepository extends JpaRepository<InventoryItem, Long> {
    List<InventoryItem> findByType(String type);
}
