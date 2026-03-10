package com.clenzy.repository;

import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, Long> {

    Optional<Organization> findBySlug(String slug);

    Optional<Organization> findByStripeCustomerId(String stripeCustomerId);

    Optional<Organization> findByStripeSubscriptionId(String stripeSubscriptionId);

    boolean existsBySlug(String slug);

    List<Organization> findByType(OrganizationType type);

    /**
     * Recuperer les IDs des organisations d'un type donne.
     * Utilise pour trouver les organisations SYSTEM lors de l'auto-assignation.
     */
    @Query("SELECT o.id FROM Organization o WHERE o.type = :type")
    List<Long> findIdsByType(@Param("type") OrganizationType type);
}
