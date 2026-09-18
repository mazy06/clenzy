package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.model.QuoteRequestStatus;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.InterventionAllocationGuard;
import com.clenzy.service.ServiceQuoteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Exerce le retrait avec la véritable politique commune aux décisions commerciales. */
@ExtendWith(MockitoExtension.class)
class MarketplaceQuoteWithdrawalTest {
    @Mock MarketplaceQuoteRequestRepository requests;
    @Mock MarketplaceProviderRepository providers;
    @Mock PropertyRepository properties;
    @Mock UserRepository users;
    MarketplaceQuoteService service;
    MarketplaceQuoteRequest request;

    @BeforeEach void setUp() {
        var clock = Clock.fixed(Instant.parse("2026-09-15T12:00:00Z"), ZoneOffset.UTC);
        var exposure = mock(MarketplaceExposureService.class);
        var missions = new MarketplaceQuoteMissionFactory(mock(InterventionRepository.class), properties,
            providers, users, requests, clock, mock(InterventionAllocationGuard.class), exposure, mock(MarketplaceGeographicEligibility.class), com.clenzy.service.CatalogTestFixture.reference(),org.mockito.Mockito.mock(com.clenzy.service.assignment.ServiceAssignmentService.class), mock(com.clenzy.service.assignment.AcceptedServiceRequestConverter.class));
        service = new MarketplaceQuoteService(requests, providers, exposure, properties, clock,
            mock(TeamRepository.class), mock(ServiceQuoteService.class), missions, mock(MarketplaceGeographicEligibility.class));
        request = new MarketplaceQuoteRequest();
        request.setId(9L); request.setRequesterOrganizationId(7L); request.setRequestedByUserId(22L);
        request.setStatus(QuoteRequestStatus.SENT);
        when(requests.findForDiscussion(9L)).thenReturn(Optional.of(request));
        lenient().when(requests.findById(9L)).thenReturn(Optional.of(request));
    }

    @Test void anotherOwnerInTheSameOrganizationCannotWithdraw() {
        propertyOwnedBy("owner");
        assertThatThrownBy(() -> service.withdraw(9L, 7L, null, jwt("other-owner", "HOST")))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoClose();
    }

    @Test void thePropertyOwnerCanWithdrawWithANormalizedReason() {
        propertyOwnedBy("owner");
        allowClose();
        assertThat(service.withdraw(9L, 7L, "  Besoin annulé  ", jwt("owner", "HOST"))).isSameAs(request);
        var order = inOrder(requests, properties);
        order.verify(requests).findForDiscussion(9L);
        order.verify(properties).findByIdWithOwner(42L, 7L);
        order.verify(requests).closeIfStillSent(eq(9L), eq(QuoteRequestStatus.WITHDRAWN), eq("Besoin annulé"), any());
    }

    @ParameterizedTest @ValueSource(strings = {"SUPER_ADMIN", "SUPER_MANAGER"})
    void platformStaffCanWithdrawWithinTheRequestOrganization(String role) {
        allowClose();
        service.withdraw(9L, 7L, null, jwt("staff", role));
        verify(requests).closeIfStillSent(eq(9L), eq(QuoteRequestStatus.WITHDRAWN), isNull(), any());
    }

    @Test void evenStaffCannotWithdrawThroughAnotherOrganization() {
        assertThatThrownBy(() -> service.withdraw(9L, 8L, null, jwt("staff", "SUPER_ADMIN")))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoClose();
    }

    @Test void aGeneralRequestCanBeWithdrawnByItsCreator() {
        var creator = new User(); creator.setId(22L);
        when(users.findByKeycloakId("creator")).thenReturn(Optional.of(creator));
        allowClose();
        service.withdraw(9L, 7L, null, jwt("creator", "HOST"));
        verify(requests).closeIfStillSent(eq(9L), eq(QuoteRequestStatus.WITHDRAWN), isNull(), any());
    }

    @Test void anotherAccountCannotWithdrawAGeneralRequest() {
        var other = new User(); other.setId(23L);
        when(users.findByKeycloakId("other")).thenReturn(Optional.of(other));
        assertThatThrownBy(() -> service.withdraw(9L, 7L, null, jwt("other", "HOST")))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoClose();
    }

    @Test void aMissingPropertyCannotGrantOwnership() {
        request.setPropertyId(42L);
        assertThatThrownBy(() -> service.withdraw(9L, 7L, null, jwt("owner", "HOST")))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoClose();
    }

    @Test void aMissingIdentityIsDeniedBeforeMutation() {
        assertThatThrownBy(() -> service.withdraw(9L, 7L, null, null))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoClose();
    }

    @Test void anOversizedReasonCannotReachTheDatabaseUpdate() {
        assertThatThrownBy(() -> service.withdraw(9L, 7L, "R".repeat(501), jwt("staff", "SUPER_ADMIN")))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("500");
        verifyNoClose();
    }

    @Test void aRequestAlreadyPricedCannotBeWithdrawn() {
        request.setStatus(QuoteRequestStatus.QUOTED);
        // La transition SQL refuse tout état autre que SENT.
        assertThatThrownBy(() -> service.withdraw(9L, 7L, null, jwt("staff", "SUPER_ADMIN")))
            .isInstanceOf(MarketplaceQuoteService.QuoteAlreadySettledException.class);
        verify(requests, never()).attachIntervention(any(), any(), any());
    }

    private void propertyOwnedBy(String subject) {
        request.setPropertyId(42L);
        var owner = new User(); owner.setKeycloakId(subject);
        var property = new Property(); property.setOwner(owner);
        when(properties.findByIdWithOwner(42L, 7L)).thenReturn(Optional.of(property));
    }

    private void allowClose() {
        when(requests.closeIfStillSent(any(), any(), any(), any())).thenReturn(1);
        when(requests.findById(9L)).thenReturn(Optional.of(request));
    }

    private void verifyNoClose() {
        verify(requests, never()).closeIfStillSent(any(), any(), any(), any());
    }

    private Jwt jwt(String subject, String role) {
        return Jwt.withTokenValue("test").header("alg", "none").subject(subject).claim("role", role).build();
    }
}
