package com.clenzy.repository;

import com.clenzy.model.PaymentConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface PaymentConnectionRepository extends JpaRepository<PaymentConnection, UUID> {
    Optional<PaymentConnection> findByOrganizationIdAndBeneficiaryKey(Long orgId, String beneficiaryKey);
    Optional<PaymentConnection> findByProviderAndProviderAccountId(String provider, String accountId);
}
