package com.agriplanner.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "vaccination_schedules")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VaccinationSchedule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "animal_definition_id")
    private Long animalDefinitionId;

    @Column(nullable = false)
    private String name;

    @Column(name = "age_days", nullable = false)
    private Integer ageDays;

    @Column(name = "is_mandatory")
    private Boolean isMandatory;

    @Column(columnDefinition = "TEXT")
    private String description;
}
