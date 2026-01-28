package com.agriplanner.repository;

import com.agriplanner.model.UserAddress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserAddressRepository extends JpaRepository<UserAddress, Long> {
    
    List<UserAddress> findByUserIdOrderByIsDefaultDescCreatedAtDesc(Long userId);
    
    Optional<UserAddress> findByIdAndUserId(Long id, Long userId);
    
    Optional<UserAddress> findByUserIdAndIsDefaultTrue(Long userId);
    
    @Modifying
    @Query("UPDATE UserAddress a SET a.isDefault = false WHERE a.user.id = :userId AND a.id != :addressId")
    void clearDefaultExcept(@Param("userId") Long userId, @Param("addressId") Long addressId);
    
    long countByUserId(Long userId);
}
