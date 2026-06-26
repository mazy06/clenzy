package com.clenzy.integration.compliance.submission;

import com.clenzy.integration.compliance.model.ComplianceConnection;
import com.clenzy.integration.compliance.model.ComplianceProviderType;
import com.clenzy.integration.compliance.service.ComplianceConnectionService;
import com.clenzy.model.DeclarationStatus;
import com.clenzy.model.GuestDeclaration;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.repository.GuestDeclarationRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ComplianceSubmissionServiceTest {

    private static final Long ORG_ID = 1L;
    private static final Long DECLARATION_ID = 42L;
    private static final Long RESERVATION_ID = 500L;

    @Mock private GuestDeclarationRepository declarationRepository;
    @Mock private ComplianceConnectionService connectionService;
    @Mock private ComplianceSubmissionStrategyRegistry strategyRegistry;
    @Mock private OrganizationAccessGuard accessGuard;
    @Mock private ComplianceSubmissionStrategy chekinStrategy;
    @Mock private ObjectProvider<ComplianceSubmissionService> selfProvider;

    private ComplianceSubmissionService service;

    @BeforeEach
    void setUp() {
        service = new ComplianceSubmissionService(
                declarationRepository, connectionService, strategyRegistry, accessGuard, selfProvider);
        // self.getObject() renvoie l'instance réelle pour que applySubmissionResult s'exécute.
        lenient().when(selfProvider.getObject()).thenReturn(service);
    }

    private GuestDeclaration declaration(String country, DeclarationStatus status) {
        Property property = new Property();
        property.setCountryCode(country);
        Reservation reservation = new Reservation();
        reservation.setId(RESERVATION_ID);
        reservation.setProperty(property);
        GuestDeclaration d = new GuestDeclaration();
        d.setId(DECLARATION_ID);
        d.setOrganizationId(ORG_ID);
        d.setReservation(reservation);
        d.setPrimary(true);
        d.setStatus(status);
        d.setFirstName("Jean");
        d.setLastName("Dupont");
        return d;
    }

    private ComplianceConnection activeChekin() {
        ComplianceConnection c = new ComplianceConnection();
        c.setOrganizationId(ORG_ID);
        c.setProviderType(ComplianceProviderType.CHEKIN);
        c.setServerUrl("https://a.chekin.io/public/api/v1");
        c.setAccountIdentifier("housing-123");
        c.setApiKeyEncrypted("ENC");
        c.setStatus(ComplianceConnection.Status.ACTIVE);
        return c;
    }

    @Test
    void retrySubmission_noActiveConnection_skipsNoOp() {
        GuestDeclaration d = declaration("FR", DeclarationStatus.COMPLETED);
        when(declarationRepository.findById(DECLARATION_ID)).thenReturn(Optional.of(d));
        when(connectionService.getConnection(ORG_ID, ComplianceProviderType.CHEKIN))
                .thenReturn(Optional.empty());

        Optional<SubmissionResult> result = service.retrySubmission(DECLARATION_ID);

        assertThat(result).isEmpty();
        verify(accessGuard).requireSameOrganization(eq(ORG_ID), anyString());
        // Aucune stratégie appelée, statut inchangé (pas de save).
        verify(declarationRepository, never()).save(any());
    }

    @Test
    void retrySubmission_completedWithActiveChekin_strategyCalled_statusSubmitted() {
        GuestDeclaration d = declaration("FR", DeclarationStatus.COMPLETED);
        ComplianceConnection conn = activeChekin();
        when(declarationRepository.findById(DECLARATION_ID)).thenReturn(Optional.of(d));
        when(connectionService.getConnection(ORG_ID, ComplianceProviderType.CHEKIN))
                .thenReturn(Optional.of(conn));
        when(connectionService.decryptApiKey(conn)).thenReturn("plain-key");
        when(strategyRegistry.findFor(ComplianceProviderType.CHEKIN)).thenReturn(Optional.of(chekinStrategy));
        when(chekinStrategy.submit(eq(d), eq(conn), eq("plain-key")))
                .thenReturn(SubmissionResult.accepted("ext-ref-9", "ok"));

        Optional<SubmissionResult> result = service.retrySubmission(DECLARATION_ID);

        assertThat(result).isPresent();
        assertThat(result.get().accepted()).isTrue();
        verify(chekinStrategy).submit(eq(d), eq(conn), eq("plain-key"));
        // applySubmissionResult a marqué SUBMITTED + traçabilité.
        assertThat(d.getStatus()).isEqualTo(DeclarationStatus.SUBMITTED);
        assertThat(d.isSubmittedToProvider()).isTrue();
        assertThat(d.getProviderType()).isEqualTo("CHEKIN");
        assertThat(d.getSubmittedAt()).isNotNull();
        verify(declarationRepository).save(d);
    }

    @Test
    void retrySubmission_strategyRejects_statusUnchanged_errorTraced() {
        GuestDeclaration d = declaration("FR", DeclarationStatus.COMPLETED);
        ComplianceConnection conn = activeChekin();
        when(declarationRepository.findById(DECLARATION_ID)).thenReturn(Optional.of(d));
        when(connectionService.getConnection(ORG_ID, ComplianceProviderType.CHEKIN))
                .thenReturn(Optional.of(conn));
        when(connectionService.decryptApiKey(conn)).thenReturn("plain-key");
        when(strategyRegistry.findFor(ComplianceProviderType.CHEKIN)).thenReturn(Optional.of(chekinStrategy));
        when(chekinStrategy.submit(eq(d), eq(conn), eq("plain-key")))
                .thenReturn(SubmissionResult.rejected("Chekin a rejeté la déclaration (HTTP 422)"));

        Optional<SubmissionResult> result = service.retrySubmission(DECLARATION_ID);

        assertThat(result).isPresent();
        assertThat(result.get().accepted()).isFalse();
        // Statut NON SUBMITTED ; pas de save (échec non avalé : tracé + résultat retourné).
        assertThat(d.getStatus()).isEqualTo(DeclarationStatus.COMPLETED);
        assertThat(d.isSubmittedToProvider()).isFalse();
        verify(declarationRepository, never()).save(any());
    }

    @Test
    void retrySubmission_alreadySubmitted_idempotentNoOp() {
        GuestDeclaration d = declaration("FR", DeclarationStatus.SUBMITTED);
        when(declarationRepository.findById(DECLARATION_ID)).thenReturn(Optional.of(d));

        Optional<SubmissionResult> result = service.retrySubmission(DECLARATION_ID);

        assertThat(result).isEmpty();
        // Aucune résolution de connexion ni d'appel stratégie.
        verify(connectionService, never()).getConnection(any(), any());
        verify(strategyRegistry, never()).findFor(any());
        verify(declarationRepository, never()).save(any());
    }

    @Test
    void retrySubmission_morocco_pendingPropagated() {
        GuestDeclaration d = declaration("MA", DeclarationStatus.COMPLETED);
        ComplianceConnection conn = new ComplianceConnection();
        conn.setProviderType(ComplianceProviderType.POLICE_MA);
        conn.setStatus(ComplianceConnection.Status.ACTIVE);
        ComplianceSubmissionStrategy pending = mockPending(ComplianceProviderType.POLICE_MA);

        when(declarationRepository.findById(DECLARATION_ID)).thenReturn(Optional.of(d));
        when(connectionService.getConnection(ORG_ID, ComplianceProviderType.POLICE_MA))
                .thenReturn(Optional.of(conn));
        when(connectionService.decryptApiKey(conn)).thenReturn("plain-key");
        when(strategyRegistry.findFor(ComplianceProviderType.POLICE_MA)).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> service.retrySubmission(DECLARATION_ID))
                .isInstanceOf(ComplianceProviderPendingException.class);
        // Échec explicite : pas de SUBMITTED.
        assertThat(d.getStatus()).isEqualTo(DeclarationStatus.COMPLETED);
        verify(declarationRepository, never()).save(any());
    }

    @Test
    void retrySubmission_saudi_pendingPropagated() {
        GuestDeclaration d = declaration("SA", DeclarationStatus.COMPLETED);
        ComplianceConnection conn = new ComplianceConnection();
        conn.setProviderType(ComplianceProviderType.ABSHER_KSA);
        conn.setStatus(ComplianceConnection.Status.ACTIVE);
        ComplianceSubmissionStrategy pending = mockPending(ComplianceProviderType.ABSHER_KSA);

        when(declarationRepository.findById(DECLARATION_ID)).thenReturn(Optional.of(d));
        when(connectionService.getConnection(ORG_ID, ComplianceProviderType.ABSHER_KSA))
                .thenReturn(Optional.of(conn));
        when(connectionService.decryptApiKey(conn)).thenReturn("plain-key");
        when(strategyRegistry.findFor(ComplianceProviderType.ABSHER_KSA)).thenReturn(Optional.of(pending));

        assertThatThrownBy(() -> service.retrySubmission(DECLARATION_ID))
                .isInstanceOf(ComplianceProviderPendingException.class);
        assertThat(d.getStatus()).isEqualTo(DeclarationStatus.COMPLETED);
    }

    @Test
    void retrySubmission_unknownCountry_noProviderSkip() {
        GuestDeclaration d = declaration("US", DeclarationStatus.COMPLETED);
        when(declarationRepository.findById(DECLARATION_ID)).thenReturn(Optional.of(d));

        Optional<SubmissionResult> result = service.retrySubmission(DECLARATION_ID);

        assertThat(result).isEmpty();
        verify(connectionService, never()).getConnection(any(), any());
    }

    @Test
    void submitForReservation_completedDeclaration_submitted() {
        GuestDeclaration d = declaration("FR", DeclarationStatus.COMPLETED);
        ComplianceConnection conn = activeChekin();
        when(declarationRepository.findByReservationIdOrderByIdAsc(RESERVATION_ID)).thenReturn(List.of(d));
        // applySubmissionResult (REQUIRES_NEW) recharge la declaration par id dans sa nouvelle tx.
        when(declarationRepository.findById(DECLARATION_ID)).thenReturn(Optional.of(d));
        when(connectionService.getConnection(ORG_ID, ComplianceProviderType.CHEKIN))
                .thenReturn(Optional.of(conn));
        when(connectionService.decryptApiKey(conn)).thenReturn("plain-key");
        when(strategyRegistry.findFor(ComplianceProviderType.CHEKIN)).thenReturn(Optional.of(chekinStrategy));
        when(chekinStrategy.submit(eq(d), eq(conn), eq("plain-key")))
                .thenReturn(SubmissionResult.accepted("ref", "ok"));

        service.submitForReservation(RESERVATION_ID, ORG_ID);

        assertThat(d.getStatus()).isEqualTo(DeclarationStatus.SUBMITTED);
        verify(declarationRepository).save(d);
    }

    @Test
    void submitForReservation_pendingProvider_caughtAndOtherDeclarationsContinue() {
        GuestDeclaration ma = declaration("MA", DeclarationStatus.COMPLETED);
        ComplianceConnection conn = new ComplianceConnection();
        conn.setProviderType(ComplianceProviderType.POLICE_MA);
        conn.setStatus(ComplianceConnection.Status.ACTIVE);
        ComplianceSubmissionStrategy pending = mockPending(ComplianceProviderType.POLICE_MA);

        when(declarationRepository.findByReservationIdOrderByIdAsc(RESERVATION_ID)).thenReturn(List.of(ma));
        when(connectionService.getConnection(ORG_ID, ComplianceProviderType.POLICE_MA))
                .thenReturn(Optional.of(conn));
        when(connectionService.decryptApiKey(conn)).thenReturn("plain-key");
        when(strategyRegistry.findFor(ComplianceProviderType.POLICE_MA)).thenReturn(Optional.of(pending));

        // Ne propage PAS (l'exception pending est attrapée dans la boucle).
        service.submitForReservation(RESERVATION_ID, ORG_ID);

        assertThat(ma.getStatus()).isEqualTo(DeclarationStatus.COMPLETED);
        verify(declarationRepository, never()).save(any());
    }

    private ComplianceSubmissionStrategy mockPending(ComplianceProviderType type) {
        ComplianceSubmissionStrategy s = org.mockito.Mockito.mock(ComplianceSubmissionStrategy.class);
        when(s.submit(any(), any(), anyString()))
                .thenThrow(new ComplianceProviderPendingException(type, "pending"));
        return s;
    }
}
