package com.agriplanner.repository;

import com.agriplanner.model.LandCertificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface LandCertificateRepository extends JpaRepository<LandCertificate, Long> {
    Optional<LandCertificate> findByFieldId(Long fieldId);
}
