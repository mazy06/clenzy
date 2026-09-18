package com.clenzy.marketplace.service;

import com.clenzy.marketplace.dto.ProviderStatusUpdateRequest;
import com.clenzy.marketplace.model.EngagementMode;
import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.ProviderStatus;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.repository.OrganizationRepository;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Transitions d'etat et rattachement d'une fiche par l'equipe plateforme. */
@ExtendWith(MockitoExtension.class)
class MarketplaceModerationServiceTest {

    @Mock private MarketplaceProviderRepository providerRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private MarketplaceNotificationOutbox notificationService;
    @Mock private MarketplaceOnboardingService onboardingService;
    @Mock private org.springframework.transaction.PlatformTransactionManager transactionManager;

    private MarketplaceModerationService service;

    private static final Instant NOW = Instant.parse("2026-09-12T10:00:00Z");
    private static final LocalDateTime NOW_LOCAL = NOW.atZone(ZoneOffset.UTC).toLocalDateTime();
    private static final String ACTOR = "keycloak-abc";

    @BeforeEach
    void setUp() {
        lenient().when(transactionManager.getTransaction(any()))
            .thenReturn(new org.springframework.transaction.support.SimpleTransactionStatus());
        service = new MarketplaceModerationService(
            providerRepository, organizationRepository, notificationService,
            onboardingService, transactionManager, Clock.fixed(NOW, ZoneOffset.UTC), org.mockito.Mockito.mock(com.clenzy.marketplace.service.MarketplaceDecisionJournal.class), documentary());
    }

    // ─── Statut ──────────────────────────────────────────────────────────────

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void decisionIntentIsDurableBeforeAfterCommit(boolean messageChanged) {
        var provider = pending();
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            service.updateStatus(1L, new ProviderStatusUpdateRequest(ProviderStatus.ACTIVE, null, "Bienvenue"), ACTOR);
            if (messageChanged) provider.setDecisionMessage("Nouvelle décision");
            else provider.setStatus(ProviderStatus.SUSPENDED);
            org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()
                    .forEach(org.springframework.transaction.support.TransactionSynchronization::afterCommit);
            verify(notificationService).enqueue(1L, "DECISION", "Bienvenue", "ACTIVE", ACTOR);
            assertThat(provider.getDecisionSentAt()).isNull();
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void whenRejectingWithoutNote_thenItIsRefused() {
        var provider = pending();
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        var request = new ProviderStatusUpdateRequest(ProviderStatus.REJECTED, "  ", null);

        assertThatThrownBy(() -> service.updateStatus(1L, request, ACTOR))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("motif");

        verify(providerRepository, never()).save(any());
    }

    @Test
    void whenActivating_thenVerificationIsStampedAndSigned() {
        var provider = pending();
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        service.updateStatus(1L, new ProviderStatusUpdateRequest(ProviderStatus.ACTIVE, null, null), ACTOR);

        assertThat(provider.getStatus()).isEqualTo(ProviderStatus.ACTIVE);
        assertThat(provider.getActivatedAt()).isEqualTo(NOW_LOCAL);
        assertThat(provider.getVerifiedAt()).isEqualTo(NOW_LOCAL);
        assertThat(provider.getVerifiedByKeycloakId()).isEqualTo(ACTOR);
        verify(providerRepository).save(provider);
    }

    @Test
    void whenReactivatingAfterSuspension_thenOriginalPublicationDateIsKept() {
        var provider = pending();
        LocalDateTime firstPublication = LocalDateTime.of(2026, 1, 5, 9, 0);
        provider.setStatus(ProviderStatus.SUSPENDED);
        provider.setActivatedAt(firstPublication);
        provider.setSuspendedAt(LocalDateTime.of(2026, 8, 1, 9, 0));
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        service.updateStatus(1L, new ProviderStatusUpdateRequest(ProviderStatus.ACTIVE, null, null), ACTOR);

        // Reactiver n'est pas republier : la date de mise en ligne d'origine
        // reste celle de la premiere publication.
        assertThat(provider.getActivatedAt()).isEqualTo(firstPublication);
        assertThat(provider.getSuspendedAt()).isNull();
    }

    @Test
    void whenSuspending_thenVerificationSurvivesButDateIsStamped() {
        var provider = pending();
        provider.setStatus(ProviderStatus.ACTIVE);
        provider.setVerifiedAt(LocalDateTime.of(2026, 2, 2, 9, 0));
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        service.updateStatus(1L, new ProviderStatusUpdateRequest(ProviderStatus.SUSPENDED, "Assurance expirée", null), ACTOR);

        assertThat(provider.getStatus()).isEqualTo(ProviderStatus.SUSPENDED);
        assertThat(provider.getSuspendedAt()).isEqualTo(NOW_LOCAL);
        assertThat(provider.getVerifiedAt()).isNotNull();
        assertThat(provider.getReviewNote()).isEqualTo("Assurance expirée");
    }

    @Test
    void whenRejecting_thenVerificationIsCleared() {
        var provider = pending();
        provider.setVerifiedAt(LocalDateTime.of(2026, 2, 2, 9, 0));
        provider.setVerifiedByKeycloakId("someone");
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        service.updateStatus(1L,
            new ProviderStatusUpdateRequest(ProviderStatus.REJECTED, "Documents non conformes",
                "Votre Kbis date de plus de trois mois."), ACTOR);

        assertThat(provider.getVerifiedAt()).isNull();
        assertThat(provider.getVerifiedByKeycloakId()).isNull();
        assertThat(provider.getReviewNote()).isEqualTo("Documents non conformes");
    }

    // ─── Reponse au candidat ─────────────────────────────────────────────────

    @Test
    void whenRejectingWithoutAMessageForTheCandidate_thenItIsRefused() {
        // La note interne ne suffit pas : elle n'est pas ecrite pour lui, et un
        // refus muet le condamne a redeposer le meme dossier.
        var provider = pending();
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        var request = new ProviderStatusUpdateRequest(
            ProviderStatus.REJECTED, "Kbis périmé", "   ");

        assertThatThrownBy(() -> service.updateStatus(1L, request, ACTOR))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("candidat");

        verify(providerRepository, never()).save(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void whenActivating_thenDeliveryIsQueuedWithoutClaimingItWasSent() {
        var provider = pending();
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));
        

        service.updateStatus(1L, new ProviderStatusUpdateRequest(
            ProviderStatus.ACTIVE, null, "Bienvenue, votre fiche est en ligne."), ACTOR);

        verify(notificationService).enqueue(1L, "DECISION", "Bienvenue, votre fiche est en ligne.", "ACTIVE", ACTOR);
        assertThat(provider.getDecisionMessage()).isEqualTo("Bienvenue, votre fiche est en ligne.");
        assertThat(provider.getDecisionSentAt()).isNull();
    }

    @Test
    void whenTheEmailFails_thenTheSendStaysUndatedSoItCanBeRetried() {
        var provider = pending();
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));
        

        service.updateStatus(1L, new ProviderStatusUpdateRequest(
            ProviderStatus.ACTIVE, null, "Bienvenue."), ACTOR);

        // La decision est prise et enregistree ; seule l'annonce a echoue.
        assertThat(provider.getStatus()).isEqualTo(ProviderStatus.ACTIVE);
        assertThat(provider.getDecisionSentAt()).isNull();
    }

    @Test
    void whenSuspending_thenNothingIsAnnounced() {
        // Une suspension est un acte interne : elle n'a pas a partir en courriel.
        var provider = pending();
        provider.setStatus(ProviderStatus.ACTIVE);
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        service.updateStatus(1L, new ProviderStatusUpdateRequest(
            ProviderStatus.SUSPENDED, "Assurance expirée", null), ACTOR);

        verifyNoInteractions(notificationService);
    }

    @Test
    void whenADecisionWasAlreadySent_thenItIsNotAnnouncedTwice() {
        var provider = pending();
        provider.setStatus(ProviderStatus.ACTIVE);
        provider.setDecisionMessage("Deuxième essai");
        provider.setDecisionSentAt(LocalDateTime.of(2026, 3, 1, 9, 0));
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        service.updateStatus(1L, new ProviderStatusUpdateRequest(
            ProviderStatus.ACTIVE, null, "Deuxième essai"), ACTOR);

        verifyNoInteractions(notificationService);
    }

    @Test
    void whenActivating_thenTheProviderGetsAnAccount() {
        var provider = pending();
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        service.updateStatus(1L, new ProviderStatusUpdateRequest(
            ProviderStatus.ACTIVE, null, "Bienvenue."), ACTOR);

        verify(onboardingService).onboard(1L);
    }

    @Test
    void whenTheProviderAlreadyHasAnAccount_thenNoSecondOneIsOpened() {
        var provider = pending();
        provider.setUserId(42L);
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        service.updateStatus(1L, new ProviderStatusUpdateRequest(
            ProviderStatus.ACTIVE, null, "Bienvenue."), ACTOR);

        verifyNoInteractions(onboardingService);
    }

    @Test
    void whenRejecting_thenNoAccountIsOpened() {
        var provider = pending();
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        service.updateStatus(1L, new ProviderStatusUpdateRequest(
            ProviderStatus.REJECTED, "Kbis périmé", "Votre Kbis date de plus de trois mois."), ACTOR);

        verifyNoInteractions(onboardingService);
    }

    @Test
    void whenTheAddressWasNeverConfirmed_thenThePageCannotBePublished() {
        // Accepter, c'est creer un compte Keycloak sur cette adresse et lui
        // envoyer une invitation : sans preuve, l'usurpation serait triviale.
        var provider = pending();
        provider.setEmailConfirmedAt(null);
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        var request = new ProviderStatusUpdateRequest(ProviderStatus.ACTIVE, null, "Bienvenue.");

        assertThatThrownBy(() -> service.updateStatus(1L, request, ACTOR))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("confirmée");

        verify(providerRepository, never()).save(any());
        verifyNoInteractions(onboardingService, notificationService);
    }

    @Test
    void whenTheAddressIsUnconfirmed_thenRejectionMustWaitForConfirmation() {
        // Refuser n'ouvre aucun compte : exiger la preuve la aussi bloquerait
        // le classement des dossiers manifestement hors sujet.
        var provider = pending();
        provider.setEmailConfirmedAt(null);
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        assertThatThrownBy(() -> service.updateStatus(1L, new ProviderStatusUpdateRequest(
            ProviderStatus.REJECTED, "Dossier incomplet", "Veuillez compléter votre dossier."), ACTOR))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("confirmée");
        assertThat(provider.getStatus()).isEqualTo(ProviderStatus.PENDING_REVIEW);
        verify(providerRepository, never()).save(any());
        verifyNoInteractions(onboardingService, notificationService);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = ProviderStatus.class, names = {"ARCHIVED", "SUSPENDED"})
    void unconfirmedProfilesCanStillBeRemovedFromCirculation(ProviderStatus target) {
        var provider = pending();
        provider.setEmailConfirmedAt(null);
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));
        service.updateStatus(1L, new ProviderStatusUpdateRequest(target, "Retrait conservatoire", null), ACTOR);
        assertThat(provider.getStatus()).isEqualTo(target);
        verifyNoInteractions(onboardingService, notificationService);
    }

    @Test
    void whenProviderIsUnknown_thenNotFoundIsRaised() {
        when(providerRepository.findForErasure(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateStatus(
                99L, new ProviderStatusUpdateRequest(ProviderStatus.ACTIVE, null, null), ACTOR))
            .isInstanceOf(EntityNotFoundException.class);
    }

    // ─── Rattachement ────────────────────────────────────────────────────────

    @Test
    void whenAffiliatingWithoutOrganization_thenItIsRefused() {
        var provider = pending();
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        assertThatThrownBy(() -> service.updateEngagement(1L, EngagementMode.AFFILIATED, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("organisation");

        verify(providerRepository, never()).save(any());
    }

    @Test
    void whenOrganizationIsUnknown_thenItIsRefused() {
        var provider = pending();
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));
        when(organizationRepository.existsById(7L)).thenReturn(false);

        assertThatThrownBy(() -> service.updateEngagement(1L, EngagementMode.AFFILIATED, 7L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Organisation introuvable");
    }

    @Test
    void whenAffiliatingToAnExistingOrganization_thenLinkIsStored() {
        var provider = pending();
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));
        when(organizationRepository.existsById(7L)).thenReturn(true);

        service.updateEngagement(1L, EngagementMode.AFFILIATED, 7L);

        assertThat(provider.getEngagementMode()).isEqualTo(EngagementMode.AFFILIATED);
        assertThat(provider.getHomeOrganizationId()).isEqualTo(7L);
        verify(providerRepository).save(provider);
    }

    @Test
    void whenBecomingIndependent_thenOrganizationIsDetached() {
        var provider = pending();
        provider.setEngagementMode(EngagementMode.EXCLUSIVE);
        provider.setHomeOrganizationId(7L);
        when(providerRepository.findForErasure(1L)).thenReturn(Optional.of(provider));

        service.updateEngagement(1L, EngagementMode.INDEPENDENT, null);

        assertThat(provider.getEngagementMode()).isEqualTo(EngagementMode.INDEPENDENT);
        assertThat(provider.getHomeOrganizationId()).isNull();
    }

    @Test
    void whenExclusive_thenProviderLeavesTheCatalog() {
        var provider = pending();
        provider.setStatus(ProviderStatus.ACTIVE);
        provider.setEngagementMode(EngagementMode.EXCLUSIVE);

        // Publiee mais exclusive : elle ne part pas au catalogue des autres
        // organisations. Les deux conditions sont necessaires.
        assertThat(provider.isExposable()).isFalse();

        provider.setEngagementMode(EngagementMode.AFFILIATED);
        assertThat(provider.isExposable()).isTrue();
    }

    /** Candidature dont l'adresse a ete prouvee — cas nominal depuis la 0428. */
    private static MarketplaceProvider pending() {
        var provider = new MarketplaceProvider();
        provider.setId(1L);
        provider.setDisplayName("Atelier Ourika");
        provider.setEmail("pro@exemple.fr");
        provider.setStatus(ProviderStatus.PENDING_REVIEW);
        provider.setEmailConfirmedAt(LocalDateTime.of(2026, 9, 1, 9, 0));
        return provider;
    }
    private static com.clenzy.marketplace.service.ProviderDocumentaryService documentary() {
        var service=org.mockito.Mockito.mock(com.clenzy.marketplace.service.ProviderDocumentaryService.class);
        org.mockito.Mockito.lenient().when(service.eligible(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any())).thenReturn(true);
        return service;
    }
}
