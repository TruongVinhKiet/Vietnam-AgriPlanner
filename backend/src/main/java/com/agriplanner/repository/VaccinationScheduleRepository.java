package com.agriplanner.repository;

import com.agriplanner.model.VaccinationSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface VaccinationScheduleRepository extends JpaRepository<VaccinationSchedule, Long> {
    List<VaccinationSchedule> findByAnimalDefinitionId(Long animalDefinitionId);
}
