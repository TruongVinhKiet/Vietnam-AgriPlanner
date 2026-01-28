package com.agriplanner.repository;

import com.agriplanner.model.Pen;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PenRepository extends JpaRepository<Pen, Long> {

    List<Pen> findByFarmId(Long farmId);

    List<Pen> findByFacilityId(Long facilityId);

    List<Pen> findByFarmIdAndStatus(Long farmId, String status);

    List<Pen> findByFarmingType(String farmingType);

    boolean existsByFarmIdAndCode(Long farmId, String code);
}
