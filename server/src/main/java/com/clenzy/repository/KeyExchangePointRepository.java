package com.clenzy.repository;

import com.clenzy.model.KeyExchangePoint;
import com.clenzy.model.KeyExchangePoint.PointStatus;
import com.clenzy.model.KeyExchangePoint.Provider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KeyExchangePointRepository extends JpaRepository<KeyExchangePoint, Long> {

    List<KeyExchangePoint> findByStatus(PointStatus status);

    /**
     * Listing des points de l'organisation courante.
     * {@code findByStatus} seul retournait les points de TOUTES les organisations
     * (audit securite 2026-07-26, constat P1-02).
     */
    List<KeyExchangePoint> findByOrganizationIdAndStatus(Long organizationId, PointStatus status);

    List<KeyExchangePoint> findByPropertyId(Long propertyId);

    List<KeyExchangePoint> findByPropertyIdAndStatus(Long propertyId, PointStatus status);

    List<KeyExchangePoint> findByPropertyIdAndProvider(Long propertyId, Provider provider);

    Optional<KeyExchangePoint> findByIdAndUserId(Long id, String userId);

    Optional<KeyExchangePoint> findByVerificationToken(String token);

    Optional<KeyExchangePoint> findByProviderStoreId(String providerStoreId);

    long countByPropertyId(Long propertyId);
}
