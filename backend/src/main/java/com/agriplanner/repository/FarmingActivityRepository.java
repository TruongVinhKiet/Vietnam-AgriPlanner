package com.agriplanner.repository;

import com.agriplanner.model.FarmingActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FarmingActivityRepository extends JpaRepository<FarmingActivity, Long> {
    List<FarmingActivity> findByFieldIdOrderByPerformedAtDesc(Long fieldId);

    List<FarmingActivity> findByFieldIdAndActivityType(Long fieldId, String activityType);
}
