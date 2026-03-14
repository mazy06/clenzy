package com.clenzy.repository;

import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.PayoutMethod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OwnerPayoutConfigRepository extends JpaRepository<OwnerPayoutConfig, Long> {

    @Query("SELECT c FROM OwnerPayoutConfig c WHERE c.ownerId = :ownerId AND c.organizationId = :orgId")
    Optional<OwnerPayoutConfig> findByOwnerIdAndOrgId(@Param("ownerId") Long ownerId,
                                                       @Param("orgId") Long orgId);

    @Query("SELECT c FROM OwnerPayoutConfig c WHERE c.payoutMethod = :method AND c.verified = :verified AND c.organizationId = :orgId")
    List<OwnerPayoutConfig> findByPayoutMethodAndVerified(@Param("method") PayoutMethod method,
                                                          @Param("verified") boolean verified,
                                                          @Param("orgId") Long orgId);

    @Query("SELECT c FROM OwnerPayoutConfig c WHERE c.organizationId = :orgId")
    List<OwnerPayoutConfig> findAllByOrgId(@Param("orgId") Long orgId);

    @Query("SELECT c FROM OwnerPayoutConfig c WHERE c.stripeConnectedAccountId = :accountId")
    Optional<OwnerPayoutConfig> findByStripeConnectedAccountId(@Param("accountId") String accountId);
}
