package com.clenzy.repository;

import com.clenzy.model.Permission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PermissionRepository extends JpaRepository<Permission, Long> {
    
    /**
     * Trouve une permission par son nom
     */
    Optional<Permission> findByName(String name);
    
    /**
     * Trouve toutes les permissions d'un module
     */
    List<Permission> findByModule(String module);
    
    /**
     * Vérifie si une permission existe par son nom
     */
    boolean existsByName(String name);
    
    /**
     * Trouve toutes les permissions par noms
     */
    List<Permission> findByNameIn(List<String> names);
}
