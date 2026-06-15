package com.clenzy.service;

import com.clenzy.dto.MarketingContactDto;
import com.clenzy.exception.LeadCaptureDisabledException;
import com.clenzy.model.MarketingContact;
import com.clenzy.model.MarketingContactSource;
import com.clenzy.model.MarketingContactStatus;
import com.clenzy.repository.MarketingContactRepository;
import com.clenzy.repository.OrganizationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Capture de leads (CLZ Domaine 2) : consentement RGPD obligatoire, upsert idempotent par (org,email),
 * normalisation email, désabonnement.
 */
@ExtendWith(MockitoExtension.class)
class LeadCaptureServiceTest {

    @Mock private MarketingContactRepository repository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private BrevoContactService brevoContactService;

    private LeadCaptureService service;

    private static final Long ORG = 1L;
    private static final Instant NOW = Instant.parse("2026-06-14T10:00:00Z");

    @BeforeEach
    void setUp() {
        service = new LeadCaptureService(repository, organizationRepository, brevoContactService, Clock.fixed(NOW, ZoneOffset.UTC));
        // Capture activée par défaut (réglage org-level) ; lenient car les tests d'erreur amont ne l'atteignent pas.
        lenient().when(organizationRepository.findLeadCaptureEnabledById(ORG)).thenReturn(Optional.of(true));
    }

    @Test
    void capture_whenLeadCaptureDisabledForOrg_throwsAndDoesNotSave() {
        when(organizationRepository.findLeadCaptureEnabledById(ORG)).thenReturn(Optional.of(false));

        assertThatThrownBy(() -> service.capture(ORG, "alice@example.com", "Alice",
                MarketingContactSource.NEWSLETTER, "fr", true))
            .isInstanceOf(LeadCaptureDisabledException.class);

        verify(repository, never()).save(any());
    }

    @Test
    void capture_new_createsSubscribedConsentedContact() {
        when(repository.findByOrganizationIdAndEmail(ORG, "alice@example.com")).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(inv -> {
            MarketingContact c = inv.getArgument(0);
            c.setId(10L);
            return c;
        });

        MarketingContactDto dto = service.capture(ORG, "Alice@Example.com", "Alice",
            MarketingContactSource.NEWSLETTER, "fr", true);

        assertThat(dto.email()).isEqualTo("alice@example.com"); // normalisé
        assertThat(dto.status()).isEqualTo(MarketingContactStatus.SUBSCRIBED);
        assertThat(dto.source()).isEqualTo(MarketingContactSource.NEWSLETTER);
        assertThat(dto.consent()).isTrue();
        assertThat(dto.createdAt()).isEqualTo(NOW);
    }

    @Test
    void capture_existing_updatesIdempotently_noDuplicate() {
        MarketingContact existing = new MarketingContact();
        existing.setId(7L);
        existing.setOrganizationId(ORG);
        existing.setEmail("bob@example.com");
        existing.setStatus(MarketingContactStatus.UNSUBSCRIBED);
        existing.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        when(repository.findByOrganizationIdAndEmail(ORG, "bob@example.com")).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        MarketingContactDto dto = service.capture(ORG, "bob@example.com", "Bob",
            MarketingContactSource.WAITLIST, "en", true);

        assertThat(dto.id()).isEqualTo(7L); // même contact, pas de doublon
        assertThat(dto.status()).isEqualTo(MarketingContactStatus.SUBSCRIBED); // ré-abonné
        assertThat(dto.createdAt()).isEqualTo(Instant.parse("2026-01-01T00:00:00Z")); // createdAt conservé
    }

    @Test
    void capture_withoutConsent_throws() {
        assertThatThrownBy(() -> service.capture(ORG, "x@example.com", null, null, "fr", false))
            .isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void unsubscribe_setsUnsubscribed() {
        MarketingContact existing = new MarketingContact();
        existing.setId(7L);
        existing.setStatus(MarketingContactStatus.SUBSCRIBED);
        when(repository.findByOrganizationIdAndEmail(ORG, "bob@example.com")).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.unsubscribe(ORG, "Bob@example.com");

        assertThat(existing.getStatus()).isEqualTo(MarketingContactStatus.UNSUBSCRIBED);
    }
}
