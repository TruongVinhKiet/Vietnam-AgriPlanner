package com.agriplanner.repository;

import com.agriplanner.model.ByproductLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ByproductLogRepository extends JpaRepository<ByproductLog, Long> {

    List<ByproductLog> findByPenIdOrderByRecordedDateAsc(Long penId);

    List<ByproductLog> findByPenIdAndProductTypeOrderByRecordedDateAsc(Long penId, String productType);

    List<ByproductLog> findByPenIdAndRecordedDateBetweenOrderByRecordedDateAsc(
            Long penId, LocalDate startDate, LocalDate endDate);

    @Query("SELECT SUM(b.quantity) FROM ByproductLog b WHERE b.penId = :penId")
    java.math.BigDecimal getTotalQuantityByPenId(Long penId);

    @Query("SELECT SUM(b.quantity) FROM ByproductLog b WHERE b.penId = :penId AND b.productType = :productType")
    java.math.BigDecimal getTotalQuantityByPenIdAndProductType(Long penId, String productType);
}
