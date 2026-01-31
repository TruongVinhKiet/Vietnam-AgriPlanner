package com.agriplanner.repository;

import com.agriplanner.model.SoilType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for SoilType entities
 */
@Repository
public interface SoilTypeRepository extends JpaRepository<SoilType, Long> {

    Optional<SoilType> findByCode(String code);

    List<SoilType> findByCategory(String category);

    List<SoilType> findByCategoryOrderByName(String category);

    List<SoilType> findAllByOrderByCategoryAscNameAsc();

    List<SoilType> findBySuitableCropsContainingIgnoreCase(String cropName);

    List<SoilType> findByFertility(String fertility);
}
