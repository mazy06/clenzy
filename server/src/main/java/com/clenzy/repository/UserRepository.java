package com.clenzy.repository;

import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.QueryHint;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    Optional<User> findByKeycloakId(String keycloakId);
    boolean existsByKeycloakId(String keycloakId);
    List<User> findByKeycloakIdIsNotNull();
    
    @Query("SELECT u FROM User u WHERE u.role IN :roles")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<User> findByRoleIn(@Param("roles") List<UserRole> roles);
    
    @Query("SELECT u.id, u.firstName, u.lastName, u.email, u.role FROM User u WHERE u.role IN :roles")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Object[]> findManagersAndAdminsData(@Param("roles") List<UserRole> roles);
    
    /**
     * Requête optimisée pour récupérer les utilisateurs avec leurs équipes
     */
    @Query("SELECT u FROM User u WHERE u.role IN :roles")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<User> findByRoleInWithTeams(@Param("roles") List<UserRole> roles);
}


