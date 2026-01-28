package com.agriplanner.repository;

import com.agriplanner.model.WeatherLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface WeatherLogRepository extends JpaRepository<WeatherLog, Long> {
    List<WeatherLog> findByFarmIdOrderByDateDesc(Long farmId);

    Optional<WeatherLog> findByFarmIdAndDate(Long farmId, LocalDate date);

    List<WeatherLog> findByFarmIdAndDateBetweenOrderByDateDesc(Long farmId, LocalDate startDate, LocalDate endDate);
}
