package com.clenzy.repository;

import com.clenzy.model.PaymentMethodConfig;
import com.clenzy.model.PaymentProviderType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentMethodConfigRepository extends JpaRepository<PaymentMethodConfig, Long> {

    List<PaymentMethodConfig> findByOrganizationId(Long organizationId);

    Optional<PaymentMethodConfig> findByOrganizationIdAndProviderType(
        Long organizationId, PaymentProviderType providerType);

    List<PaymentMethodConfig> findByOrganizationIdAndEnabledTrue(Long organizationId);
}
