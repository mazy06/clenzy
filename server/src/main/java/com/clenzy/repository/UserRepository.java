package com.clenzy.repository;

import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.QueryHint;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmailHash(String emailHash);
    boolean existsByEmailHash(String emailHash);
    Optional<User> findByKeycloakId(String keycloakId);
    boolean existsByKeycloakId(String keycloakId);
    List<User> findByKeycloakIdIsNotNull();
    List<User> findByStatusAndKeycloakIdIsNotNullOrderByFirstNameAscLastNameAsc(UserStatus status);
    List<User> findByStatusAndRoleInAndKeycloakIdIsNotNullOrderByFirstNameAscLastNameAsc(UserStatus status, List<UserRole> roles);
    
    @Query("SELECT u FROM User u WHERE u.role IN :roles AND u.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<User> findByRoleIn(@Param("roles") List<UserRole> roles, @Param("orgId") Long orgId);
    
    @Query("SELECT u.id, u.firstName, u.lastName, u.email, u.role FROM User u WHERE u.role IN :roles AND u.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<Object[]> findManagersAndAdminsData(@Param("roles") List<UserRole> roles, @Param("orgId") Long orgId);
    
    /**
     * Requête optimisée pour récupérer les utilisateurs avec leurs équipes
     */
    @Query("SELECT u FROM User u WHERE u.role IN :roles AND u.organizationId = :orgId")
    @QueryHints({
        @QueryHint(name = "org.hibernate.cacheable", value = "true")
    })
    List<User> findByRoleInWithTeams(@Param("roles") List<UserRole> roles, @Param("orgId") Long orgId);
}

