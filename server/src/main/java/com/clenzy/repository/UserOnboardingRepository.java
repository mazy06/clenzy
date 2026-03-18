package com.clenzy.repository;

import com.clenzy.model.UserOnboarding;
import com.clenzy.model.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserOnboardingRepository extends JpaRepository<UserOnboarding, Long> {

    List<UserOnboarding> findByUserIdAndRole(Long userId, UserRole role);

    Optional<UserOnboarding> findByUserIdAndRoleAndStepKey(Long userId, UserRole role, String stepKey);

    @Modifying
    @Query("UPDATE UserOnboarding o SET o.dismissed = :dismissed WHERE o.userId = :userId AND o.role = :role")
    void updateDismissedByUserIdAndRole(@Param("userId") Long userId,
                                        @Param("role") UserRole role,
                                        @Param("dismissed") boolean dismissed);

    @Modifying
    @Query("DELETE FROM UserOnboarding o WHERE o.userId = :userId AND o.role = :role")
    void deleteByUserIdAndRole(@Param("userId") Long userId, @Param("role") UserRole role);
}
