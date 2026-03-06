package com.agriplanner.repository;

import com.agriplanner.model.FieldLoss;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface FieldLossRepository extends JpaRepository<FieldLoss, Long> {

    List<FieldLoss> findByFieldIdOrderByReportDateDesc(Long fieldId);

    List<FieldLoss> findByFieldId(Long fieldId);

    @Query("SELECT fl FROM FieldLoss fl WHERE fl.field.farmId = :farmId ORDER BY fl.reportDate DESC")
    List<FieldLoss> findByFarmId(@Param("farmId") Long farmId);

    @Query("SELECT COALESCE(SUM(fl.lossAreaSqm), 0) FROM FieldLoss fl WHERE fl.fieldId = :fieldId")
    BigDecimal sumLossAreaByFieldId(@Param("fieldId") Long fieldId);

    @Query("SELECT COALESCE(SUM(fl.estimatedLossValue), 0) FROM FieldLoss fl WHERE fl.fieldId = :fieldId")
    BigDecimal sumLossValueByFieldId(@Param("fieldId") Long fieldId);

    @Query("SELECT COALESCE(SUM(fl.estimatedLossValue), 0) FROM FieldLoss fl WHERE fl.field.farmId = :farmId")
    BigDecimal sumLossValueByFarmId(@Param("farmId") Long farmId);

    @Query("SELECT COALESCE(SUM(fl.lossAreaSqm), 0) FROM FieldLoss fl WHERE fl.field.farmId = :farmId")
    BigDecimal sumLossAreaByFarmId(@Param("farmId") Long farmId);
}
