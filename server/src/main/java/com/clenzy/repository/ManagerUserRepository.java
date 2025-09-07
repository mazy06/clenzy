package com.clenzy.repository;

import com.clenzy.model.ManagerUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ManagerUserRepository extends JpaRepository<ManagerUser, Long> {
    
    @Query("SELECT mu FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.isActive = true")
    List<ManagerUser> findByManagerIdAndIsActiveTrue(@Param("managerId") Long managerId);
    
    @Query("SELECT mu FROM ManagerUser mu WHERE mu.userId = :userId AND mu.isActive = true")
    List<ManagerUser> findByUserIdAndIsActiveTrue(@Param("userId") Long userId);
    
    @Query("SELECT CASE WHEN COUNT(mu) > 0 THEN true ELSE false END FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.userId = :userId AND mu.isActive = true")
    boolean existsByManagerIdAndUserIdAndIsActiveTrue(@Param("managerId") Long managerId, @Param("userId") Long userId);
    
    @Query("SELECT mu FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.userId = :userId")
    ManagerUser findByManagerIdAndUserId(@Param("managerId") Long managerId, @Param("userId") Long userId);
    
    @Query("SELECT mu FROM ManagerUser mu WHERE mu.managerId = :managerId AND mu.userId = :userId")
    List<ManagerUser> findAllByManagerIdAndUserId(@Param("managerId") Long managerId, @Param("userId") Long userId);
}
