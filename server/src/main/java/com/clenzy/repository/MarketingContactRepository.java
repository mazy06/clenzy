package com.clenzy.repository;

import com.clenzy.model.MarketingContact;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MarketingContactRepository extends JpaRepository<MarketingContact, Long> {

    Optional<MarketingContact> findByOrganizationIdAndEmail(Long organizationId, String email);

    /**
     * Emails consentis et toujours abonnés pour une org, parmi un ensemble candidat (gate RGPD de la
     * relance de panier abandonné). Un email absent du résultat = pas de consentement OU opt-out
     * (UNSUBSCRIBED) → on ne le relance pas. La comparaison se fait sur l'email normalisé (minuscules).
     */
    @Query("SELECT c.email FROM MarketingContact c "
         + "WHERE c.organizationId = :orgId AND c.consent = true "
         + "AND c.status = com.clenzy.model.MarketingContactStatus.SUBSCRIBED "
         + "AND LOWER(c.email) IN :emails")
    List<String> findConsentedSubscribedEmails(@Param("orgId") Long orgId,
                                               @Param("emails") Collection<String> emails);

    @Query("SELECT c FROM MarketingContact c WHERE c.organizationId = :orgId ORDER BY c.createdAt DESC")
    List<MarketingContact> findByOrganizationId(@Param("orgId") Long orgId, Pageable pageable);

    long countByOrganizationId(Long organizationId);
}
