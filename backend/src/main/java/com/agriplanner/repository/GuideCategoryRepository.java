package com.agriplanner.repository;

import com.agriplanner.model.GuideCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GuideCategoryRepository extends JpaRepository<GuideCategory, Long> {

    Optional<GuideCategory> findBySlug(String slug);

    List<GuideCategory> findByParentIsNullOrderBySortOrderAsc();

    List<GuideCategory> findByParentIdOrderBySortOrderAsc(Long parentId);
}
