package com.agriplanner.repository;

import com.agriplanner.model.KmzUpload;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for KMZ upload history
 */
@Repository
public interface KmzUploadRepository extends JpaRepository<KmzUpload, Long> {

    List<KmzUpload> findByStatusOrderByUploadedAtDesc(String status);

    List<KmzUpload> findByProvinceOrderByUploadedAtDesc(String province);

    List<KmzUpload> findByProvinceAndDistrictOrderByUploadedAtDesc(String province, String district);

    List<KmzUpload> findAllByOrderByUploadedAtDesc();

    List<KmzUpload> findByUploadedByOrderByUploadedAtDesc(Long userId);

    // Map type filters
    List<KmzUpload> findByMapTypeOrderByUploadedAtDesc(String mapType);

    List<KmzUpload> findByMapTypeAndStatusOrderByUploadedAtDesc(String mapType, String status);

    List<KmzUpload> findByMapTypeAndProvinceOrderByUploadedAtDesc(String mapType, String province);
}
