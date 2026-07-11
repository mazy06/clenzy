package com.clenzy.repository;

import com.clenzy.model.HousekeeperPayoutConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HousekeeperPayoutConfigRepository extends JpaRepository<HousekeeperPayoutConfig, Long> {

    Optional<HousekeeperPayoutConfig> findByUserIdAndOrganizationId(Long userId, Long organizationId);

    /** Dispatch du webhook Stripe account.updated (compte pro). */
    Optional<HousekeeperPayoutConfig> findByStripeAccountId(String stripeAccountId);
}
