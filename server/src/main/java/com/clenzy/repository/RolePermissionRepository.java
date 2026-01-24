package com.clenzy.repository;

import com.clenzy.model.RolePermission;
import com.clenzy.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import jakarta.persistence.QueryHint;
import java.util.List;

@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermission, Long> {
    
    /**
     * Requêtes optimisées avec cache
     */
    @Query("SELECT rp FROM RolePermission rp WHERE rp.role = :role")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<RolePermission> findByRole(@Param("role") Role role);
    
    @Query("SELECT rp.permission.name FROM RolePermission rp WHERE rp.role.name = :roleName AND rp.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<String> findActivePermissionsByRoleName(@Param("roleName") String roleName);
    
    @Query("SELECT rp FROM RolePermission rp WHERE rp.role.name IN :roleNames AND rp.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<RolePermission> findByRoleNames(@Param("roleNames") List<String> roleNames);
    
    /**
     * Requêtes avec pagination optimisée
     */
    @Query("SELECT rp FROM RolePermission rp WHERE rp.role = :role")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<RolePermission> findByRoleWithPagination(@Param("role") Role role, Pageable pageable);
    
    @Query("SELECT rp FROM RolePermission rp WHERE rp.role.name = :roleName AND rp.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<RolePermission> findByRoleNameAndIsActiveTrueWithPagination(@Param("roleName") String roleName, Pageable pageable);
    
    @Query("SELECT rp FROM RolePermission rp WHERE rp.role.name IN :roleNames AND rp.isActive = true")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    Page<RolePermission> findByRoleNamesWithPagination(@Param("roleNames") List<String> roleNames, Pageable pageable);
    
    /**
     * Requêtes de comptage optimisées
     */
    @Query("SELECT COUNT(rp) FROM RolePermission rp WHERE rp.role = :role")
    long countByRole(@Param("role") Role role);
    
    @Query("SELECT COUNT(rp) FROM RolePermission rp WHERE rp.role.name = :roleName AND rp.isActive = true")
    long countByRoleNameAndIsActiveTrue(@Param("roleName") String roleName);
    
    @Query("SELECT COUNT(rp) FROM RolePermission rp WHERE rp.role.name IN :roleNames AND rp.isActive = true")
    long countByRoleNamesAndIsActiveTrue(@Param("roleNames") List<String> roleNames);
    
    @Query("SELECT COUNT(rp) FROM RolePermission rp WHERE rp.isActive = true")
    long countByIsActiveTrue();
    
    /**
     * Vérifications d'existence optimisées
     */
    @Query("SELECT CASE WHEN COUNT(rp) > 0 THEN true ELSE false END FROM RolePermission rp WHERE rp.role.name = :roleName AND rp.permission.name = :permissionName AND rp.isActive = true")
    boolean existsByRoleNameAndPermissionName(@Param("roleName") String roleName, @Param("permissionName") String permissionName);
    
    @Query("SELECT CASE WHEN COUNT(rp) > 0 THEN true ELSE false END FROM RolePermission rp WHERE rp.role = :role AND rp.permission.name = :permissionName AND rp.isActive = true")
    boolean existsByRoleAndPermissionName(@Param("role") Role role, @Param("permissionName") String permissionName);
    
    /**
     * Requêtes pour les IDs seulement
     */
    @Query("SELECT rp.permission.id FROM RolePermission rp WHERE rp.role.name = :roleName AND rp.isActive = true")
    List<Long> findPermissionIdsByRoleNameAndIsActiveTrue(@Param("roleName") String roleName);
    
    @Query("SELECT rp.role.id FROM RolePermission rp WHERE rp.permission.name = :permissionName AND rp.isActive = true")
    List<Long> findRoleIdsByPermissionNameAndIsActiveTrue(@Param("permissionName") String permissionName);
    
    /**
     * Opérations de modification optimisées
     */
    @Modifying
    @Query("DELETE FROM RolePermission rp WHERE rp.role.name = :roleName")
    void deleteByRoleName(@Param("roleName") String roleName);
    
    @Modifying
    @Query("DELETE FROM RolePermission rp WHERE rp.role = :role")
    void deleteByRole(@Param("role") Role role);
    
    @Modifying
    @Query("UPDATE RolePermission rp SET rp.isActive = false WHERE rp.role.name = :roleName")
    void deactivateByRoleName(@Param("roleName") String roleName);
}
