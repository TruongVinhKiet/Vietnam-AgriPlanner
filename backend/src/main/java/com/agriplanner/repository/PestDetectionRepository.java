package com.agriplanner.repository;

import com.agriplanner.model.PestDetection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PestDetectionRepository extends JpaRepository<PestDetection, Long> {
    List<PestDetection> findByFieldIdOrderByDetectedAtDesc(Long fieldId);

    List<PestDetection> findByFieldIdAndResolvedAtIsNull(Long fieldId);
}
