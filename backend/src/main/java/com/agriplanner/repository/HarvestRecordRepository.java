package com.agriplanner.repository;

import com.agriplanner.model.HarvestRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface HarvestRecordRepository extends JpaRepository<HarvestRecord, Long> {
    List<HarvestRecord> findByFieldIdOrderByHarvestDateDesc(Long fieldId);

    List<HarvestRecord> findTop10ByOrderByHarvestDateDesc();
}
