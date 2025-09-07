package com.clenzy.repository;

import com.clenzy.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {
    
    /**
     * Trouve un rôle par son nom
     */
    Optional<Role> findByName(String name);
    
    /**
     * Vérifie si un rôle existe par son nom
     */
    boolean existsByName(String name);
}
