package com.clenzy.repository;

import com.clenzy.model.RolePermission;
import com.clenzy.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RolePermissionRepository extends JpaRepository<RolePermission, Long> {
    
    /**
     * Trouve toutes les permissions d'un rôle
     */
    List<RolePermission> findByRole(Role role);
    
    /**
     * Trouve toutes les permissions d'un rôle par son nom
     */
    @Query("SELECT rp.permission.name FROM RolePermission rp WHERE rp.role.name = :roleName AND rp.isActive = true")
    List<String> findActivePermissionsByRoleName(@Param("roleName") String roleName);
    
    /**
     * Vérifie si une permission existe pour un rôle
     */
    @Query("SELECT COUNT(rp) > 0 FROM RolePermission rp WHERE rp.role.name = :roleName AND rp.permission.name = :permissionName AND rp.isActive = true")
    boolean existsByRoleNameAndPermissionName(@Param("roleName") String roleName, @Param("permissionName") String permissionName);
    
    /**
     * Supprime toutes les permissions d'un rôle
     */
    @Modifying
    @Query("DELETE FROM RolePermission rp WHERE rp.role.name = :roleName")
    void deleteByRoleName(@Param("roleName") String roleName);
    
    /**
     * Trouve les permissions par noms de rôles
     */
    @Query("SELECT rp FROM RolePermission rp WHERE rp.role.name IN :roleNames AND rp.isActive = true")
    List<RolePermission> findByRoleNames(@Param("roleNames") List<String> roleNames);
}
