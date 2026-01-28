package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "weather_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeatherLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "farm_id", nullable = false)
    private Long farmId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "temp_min")
    private BigDecimal tempMin;

    @Column(name = "temp_max")
    private BigDecimal tempMax;

    private BigDecimal humidity;

    @Column(name = "wind_speed")
    private BigDecimal windSpeed; // km/h

    private BigDecimal rainfall; // mm

    @Column(name = "weather_condition")
    private String condition; // SUNNY, CLOUDY, RAINY, STORMY
}
