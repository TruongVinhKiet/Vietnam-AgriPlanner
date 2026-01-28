package com.agriplanner.repository;

import com.agriplanner.model.FieldZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface FieldZoneRepository extends JpaRepository<FieldZone, Long> {
    List<FieldZone> findByFieldId(Long fieldId);
}
