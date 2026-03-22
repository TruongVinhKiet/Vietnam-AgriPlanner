package com.agriplanner.repository;

import com.agriplanner.model.Epic;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EpicRepository extends JpaRepository<Epic, Long> {
    List<Epic> findByFarm_IdOrderByCreatedAtDesc(Long farmId);

    List<Epic> findByFarm_IdAndStatusOrderByCreatedAtDesc(Long farmId, String status);
}
