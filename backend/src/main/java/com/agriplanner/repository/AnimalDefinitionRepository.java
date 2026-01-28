package com.agriplanner.repository;

import com.agriplanner.model.AnimalDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AnimalDefinitionRepository extends JpaRepository<AnimalDefinition, Long> {

    List<AnimalDefinition> findByCategory(String category);

    List<AnimalDefinition> findByWaterType(String waterType);

    @Query("SELECT a FROM AnimalDefinition a WHERE a.farmingTypes LIKE %?1%")
    List<AnimalDefinition> findByFarmingTypesContaining(String farmingType);

    @Query("SELECT a FROM AnimalDefinition a WHERE a.farmingTypes LIKE %?1% AND a.waterType = ?2")
    List<AnimalDefinition> findByFarmingTypeAndWaterType(String farmingType, String waterType);

    @Query("SELECT a FROM AnimalDefinition a WHERE a.farmingTypes LIKE %?1% AND a.category = ?2")
    List<AnimalDefinition> findByFarmingTypeAndCategory(String farmingType, String category);
}
