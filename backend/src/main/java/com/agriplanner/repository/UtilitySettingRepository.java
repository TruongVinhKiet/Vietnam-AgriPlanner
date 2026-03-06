package com.agriplanner.repository;

import com.agriplanner.model.UtilitySetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UtilitySettingRepository extends JpaRepository<UtilitySetting, Long> {

    Optional<UtilitySetting> findByPenId(Long penId);

    Optional<UtilitySetting> findByFieldId(Long fieldId);

    List<UtilitySetting> findByFarmId(Long farmId);

    List<UtilitySetting> findByFarmIdAndPenIdIsNotNull(Long farmId);

    List<UtilitySetting> findByFarmIdAndFieldIdIsNotNull(Long farmId);

    void deleteByPenId(Long penId);

    void deleteByFieldId(Long fieldId);
}
