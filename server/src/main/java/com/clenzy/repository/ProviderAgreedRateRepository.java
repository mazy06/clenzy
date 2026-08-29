package com.clenzy.repository;

import com.clenzy.model.ProviderAgreedRate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProviderAgreedRateRepository extends JpaRepository<ProviderAgreedRate, Long> {

    Optional<ProviderAgreedRate> findByOrganizationIdAndProviderUserIdAndPropertyId(
            Long organizationId, Long providerUserId, Long propertyId);

    /** « Mes tarifs convenus » — ce que l'ecran du terrain compare a ses propres tarifs. */
    List<ProviderAgreedRate> findByOrganizationIdAndProviderUserId(Long organizationId, Long providerUserId);
}
