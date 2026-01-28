package com.agriplanner.repository;

import com.agriplanner.model.IrrigationSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface IrrigationScheduleRepository extends JpaRepository<IrrigationSchedule, Long> {
    List<IrrigationSchedule> findByFieldId(Long fieldId);

    Optional<IrrigationSchedule> findByFieldIdAndIsActiveTrue(Long fieldId);
}
