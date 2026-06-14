package com.clenzy.service;

import com.clenzy.dto.MarketingContactDto;
import com.clenzy.model.MarketingContact;
import com.clenzy.model.MarketingContactSource;
import com.clenzy.model.MarketingContactStatus;
import com.clenzy.repository.MarketingContactRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Locale;

/**
 * Capture de leads pour le Booking Engine (CLZ Domaine 2 — capture de leads / email marketing).
 * Org-scopé, idempotent par (org, email), <b>consentement RGPD obligatoire</b>. Alimente les
 * campagnes (newsletter, relance) et la récupération de panier abandonné.
 */
@Service
public class LeadCaptureService {

    private final MarketingContactRepository repository;
    private final Clock clock;

    public LeadCaptureService(MarketingContactRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    /**
     * Capture (ou met à jour) un contact. Le consentement est obligatoire. Idempotent : un même
     * (org, email) est ré-abonné/mis à jour plutôt que dupliqué.
     */
    @Transactional
    public MarketingContactDto capture(Long orgId, String email, String name,
                                       MarketingContactSource source, String locale, boolean consent) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("email obligatoire");
        }
        if (!consent) {
            throw new IllegalArgumentException("consentement RGPD requis pour la capture");
        }
        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        MarketingContactSource src = source != null ? source : MarketingContactSource.OTHER;

        MarketingContact contact = repository.findByOrganizationIdAndEmail(orgId, normalizedEmail)
                .orElseGet(MarketingContact::new);
        boolean isNew = contact.getId() == null;
        if (isNew) {
            contact.setOrganizationId(orgId);
            contact.setEmail(normalizedEmail);
            contact.setCreatedAt(clock.instant());
            contact.setSource(src);
        }
        if (name != null && !name.isBlank()) {
            contact.setName(name.trim());
        }
        if (locale != null && !locale.isBlank()) {
            contact.setLocale(locale.trim());
        }
        contact.setStatus(MarketingContactStatus.SUBSCRIBED);
        contact.setConsent(true);
        contact.setConsentAt(clock.instant());
        contact.setUpdatedAt(clock.instant());

        return MarketingContactDto.from(repository.save(contact));
    }

    /** Désabonne un contact (RGPD / opt-out). No-op si inconnu. */
    @Transactional
    public void unsubscribe(Long orgId, String email) {
        if (email == null || email.isBlank()) {
            return;
        }
        repository.findByOrganizationIdAndEmail(orgId, email.trim().toLowerCase(Locale.ROOT))
                .ifPresent(c -> {
                    c.setStatus(MarketingContactStatus.UNSUBSCRIBED);
                    c.setUpdatedAt(clock.instant());
                    repository.save(c);
                });
    }

    @Transactional(readOnly = true)
    public List<MarketingContactDto> list(Long orgId, int limit) {
        return repository.findByOrganizationId(orgId, PageRequest.of(0, Math.min(Math.max(limit, 1), 500)))
                .stream().map(MarketingContactDto::from).toList();
    }
}
