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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmailHash(String emailHash);
    boolean existsByEmailHash(String emailHash);
    Optional<User> findByKeycloakId(String keycloakId);
    /** Payeur d'un abonnement Stripe (dotation credits IA a invoice.paid — T-07). */
    Optional<User> findByStripeSubscriptionId(String stripeSubscriptionId);
    /**
     * Abonnés PMS prépayés (billingPeriod ANNUAL/BIENNIAL) ayant un abonnement
     * Stripe : Stripe ne déclenche invoice.paid qu'une fois par période, ce job
     * leur recharge les crédits IA mensuellement (T-07).
     */
    List<User> findByStripeSubscriptionIdIsNotNullAndBillingPeriodIn(
            java.util.Collection<String> billingPeriods);
    /**
     * Batch lookup by keycloakId — used to avoid N+1 queries when a DTO list needs
     * profile info (avatar, updatedAt) for many counterparts at once.
     */
    List<User> findByKeycloakIdIn(java.util.Collection<String> keycloakIds);
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

    List<User> findByOrganizationId(Long organizationId);

    @Query("SELECT u FROM User u WHERE u.keycloakId IS NOT NULL AND u.status = 'ACTIVE' " +
           "AND (LOWER(u.firstName) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(u.lastName) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(u.email) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "ORDER BY u.firstName, u.lastName")
    List<User> searchByNameOrEmail(@Param("q") String query);

    long countByStatus(UserStatus status);

    long countByCreatedAtAfter(LocalDateTime date);
}

