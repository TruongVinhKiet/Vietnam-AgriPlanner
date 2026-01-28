package com.agriplanner.repository;

import com.agriplanner.model.CropDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CropDefinitionRepository extends JpaRepository<CropDefinition, Long> {
    List<CropDefinition> findByCategory(String category);

    List<CropDefinition> findByMinTempLessThanEqualAndMaxTempGreaterThanEqual(Integer currentTemp,
            Integer currentTemp2);

    boolean existsByName(String name);
}
