package com.clenzy.repository;

import com.clenzy.model.Organization;
import com.clenzy.model.OrganizationType;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
