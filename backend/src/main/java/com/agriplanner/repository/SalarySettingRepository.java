package com.agriplanner.repository;

import com.agriplanner.model.SalarySetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SalarySettingRepository extends JpaRepository<SalarySetting, Long> {
    List<SalarySetting> findByOwner_Id(Long ownerId);

    List<SalarySetting> findByWorker_Id(Long workerId);

    List<SalarySetting> findByFarm_Id(Long farmId);

    Optional<SalarySetting> findByFarm_IdAndWorker_Id(Long farmId, Long workerId);

    List<SalarySetting> findByIsActiveTrue();
}
