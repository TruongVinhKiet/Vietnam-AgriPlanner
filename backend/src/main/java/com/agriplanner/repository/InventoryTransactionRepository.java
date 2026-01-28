package com.agriplanner.repository;

import com.agriplanner.model.InventoryTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface InventoryTransactionRepository extends JpaRepository<InventoryTransaction, Long> {
    
    List<InventoryTransaction> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    List<InventoryTransaction> findByInventoryIdOrderByCreatedAtDesc(Long inventoryId);
    
    @Query("SELECT it FROM InventoryTransaction it WHERE it.userId = :userId AND it.transactionType = :type ORDER BY it.createdAt DESC")
    List<InventoryTransaction> findByUserIdAndType(@Param("userId") Long userId, @Param("type") String type);
    
    @Query("SELECT it FROM InventoryTransaction it WHERE it.userId = :userId AND it.createdAt >= :since ORDER BY it.createdAt DESC")
    List<InventoryTransaction> findRecentByUserId(@Param("userId") Long userId, @Param("since") LocalDateTime since);
    
    @Query("SELECT it FROM InventoryTransaction it WHERE it.referenceType = :refType AND it.referenceId = :refId")
    List<InventoryTransaction> findByReference(@Param("refType") String refType, @Param("refId") Long refId);
}
