package com.agriplanner.repository;

import com.agriplanner.model.Field;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FieldRepository extends JpaRepository<Field, Long> {
    List<Field> findByFarmId(Long farmId);

    List<Field> findByFarmIdAndStatus(Long farmId, String status);

    @org.springframework.data.jpa.repository.Query("SELECT SUM(f.areaSqm) FROM Field f WHERE f.farmId = :farmId")
    java.math.BigDecimal sumAreaByFarmId(@org.springframework.web.bind.annotation.PathVariable("farmId") Long farmId);

    Field findFirstByFarmIdOrderByCreatedAtAsc(Long farmId);
}
