package com.agriplanner.repository;

import com.agriplanner.model.User;
import com.agriplanner.model.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for User entity operations
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    List<User> findByRole(UserRole role);

    List<User> findByRoleAndFarmIdAndApprovalStatus(UserRole role, Long farmId, User.ApprovalStatus approvalStatus);
}
