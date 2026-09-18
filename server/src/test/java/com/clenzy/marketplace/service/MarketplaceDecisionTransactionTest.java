package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.ServiceQuote;
import com.clenzy.model.User;
import com.clenzy.repository.*;
import com.clenzy.service.InterventionAllocationGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vérifie la transaction Spring réellement jointe, avec un état commercial JDBC réduit. */
class MarketplaceDecisionTransactionTest {
    final MarketplaceQuoteRequestRepository requests = mock(MarketplaceQuoteRequestRepository.class);
    final MarketplaceProviderRepository providers = mock(MarketplaceProviderRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final PropertyRepository properties = mock(PropertyRepository.class);
    final InterventionRepository missions = mock(InterventionRepository.class);
    final MarketplaceExposureService exposure = mock(MarketplaceExposureService.class);
    final ServiceRequestRepository allocations = mock(ServiceRequestRepository.class);
    final com.clenzy.service.ProviderAvailabilityService availability = mock(com.clenzy.service.ProviderAvailabilityService.class);
    MarketplaceQuoteMissionFactory service;
    JdbcTemplate jdbc;
    TransactionTemplate transaction;

    @BeforeEach void setup() {
        org.mockito.Mockito.lenient().when(allocations.save(any())).thenAnswer(inv -> inv.getArgument(0));
        var source = new DriverManagerDataSource("jdbc:h2:mem:" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(source);
        jdbc.execute("CREATE TABLE decision_state (status varchar(20))");
        jdbc.execute("INSERT INTO decision_state VALUES ('QUOTED')");
        var manager = new DataSourceTransactionManager(source);
        transaction = new TransactionTemplate(manager);
        var target = new MarketplaceQuoteMissionFactory(missions, properties, providers, users, requests,
                Clock.systemUTC(), new InterventionAllocationGuard(allocations, availability, org.mockito.Mockito.mock(com.clenzy.service.ProviderPropertyEligibility.class), org.mockito.Mockito.mock(com.clenzy.marketplace.service.ProviderDocumentaryService.class), org.mockito.Mockito.mock(com.clenzy.service.catalog.ServiceCapabilityPolicy.class), org.mockito.Mockito.mock(com.clenzy.service.catalog.ServiceCatalogReference.class)), exposure, mock(MarketplaceGeographicEligibility.class), com.clenzy.service.CatalogTestFixture.reference(),org.mockito.Mockito.mock(com.clenzy.service.assignment.ServiceAssignmentService.class), mock(com.clenzy.service.assignment.AcceptedServiceRequestConverter.class));
        var proxy = new ProxyFactory(target);
        proxy.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        service = (MarketplaceQuoteMissionFactory) proxy.getProxy();
    }

    @ParameterizedTest @ValueSource(strings = {"lock", "decide", "create"})
    void requiresTheCallersTransactionBeforeAnyRepositoryAccess(String operation) {
        assertThatThrownBy(() -> {
            switch (operation) {
                case "lock" -> service.lock(9L, 7L);
                case "decide" -> service.decide(new ServiceQuote(), 7L, true, null);
                case "create" -> service.createFrom(new MarketplaceQuoteRequest());
                default -> throw new AssertionError(operation);
            }
        }).isInstanceOf(IllegalTransactionStateException.class);
        verifyNoInteractions(requests, providers, users, properties, missions, exposure);
    }

    @ParameterizedTest @ValueSource(strings = {"general", "missing-property", "absent-team"})
    void decisionCommitsWithCallerAndRollsBackWhenMissionCreationFails(String scenario) {
        boolean missingProperty = "missing-property".equals(scenario);
        boolean absentTeam = "absent-team".equals(scenario);
        var request = new MarketplaceQuoteRequest(); request.setId(9L); request.setProviderId(1L);
        request.setRequesterOrganizationId(7L); request.setStatus(QuoteRequestStatus.QUOTED);
        request.setQuotedAmount(BigDecimal.TEN); request.setQuotedCurrency("MAD");
        if (missingProperty || absentTeam) request.setPropertyId(42L);
        if (absentTeam) {
            request.setProviderTeamId(8L); request.setRequestedByUserId(11L);
            var property = new com.clenzy.model.Property(); property.setId(42L);
            when(properties.findByIdWithOwner(42L, 7L)).thenReturn(Optional.of(property));
        }
        var quote = new ServiceQuote(); quote.setMarketplaceRequestId(9L); quote.setOrganizationId(7L);
        quote.setProviderUserId(11L); quote.setAmount(BigDecimal.TEN); quote.setCurrency("MAD");
        quote.setPropertyId(request.getPropertyId());
        quote.setProviderTeamId(request.getProviderTeamId());
        var provider = new MarketplaceProvider(); provider.setId(1L); provider.setUserId(11L); provider.setStatus(ProviderStatus.ACTIVE);
        var user = new User(); user.setId(11L);
        when(requests.findById(9L)).thenReturn(Optional.of(request));
        when(requests.findForDiscussion(9L)).thenReturn(Optional.of(request));
        when(providers.findById(1L)).thenReturn(Optional.of(provider));
        when(exposure.isVisibleTo(provider, 7L)).thenReturn(true);
        when(users.findById(11L)).thenReturn(Optional.of(user));
        when(requests.decideIfStillQuoted(eq(9L), eq(7L), eq(QuoteRequestStatus.ACCEPTED), isNull(), any()))
                .thenAnswer(call -> jdbc.update("UPDATE decision_state SET status='ACCEPTED' WHERE status='QUOTED'"));
        if (missingProperty || absentTeam) {
            assertThatThrownBy(() -> transaction.executeWithoutResult(status -> {
                // Même si l'appelant intercepte l'erreur, la décision ne peut pas être commitée.
                assertThatThrownBy(() -> service.decide(quote, 7L, true, null))
                        .isInstanceOf(missingProperty ? org.springframework.security.access.AccessDeniedException.class
                                : com.clenzy.exception.AssignmentConflictException.class);
            })).isInstanceOf(org.springframework.transaction.UnexpectedRollbackException.class);
            assertThat(jdbc.queryForObject("SELECT status FROM decision_state", String.class)).isEqualTo("QUOTED");
        } else {
            transaction.executeWithoutResult(status -> {
                assertThat(service.decide(quote, 7L, true, null)).isEmpty();
                assertThat(jdbc.queryForObject("SELECT status FROM decision_state", String.class)).isEqualTo("ACCEPTED");
            });
            assertThat(jdbc.queryForObject("SELECT status FROM decision_state", String.class)).isEqualTo("ACCEPTED");
        }
        verify(requests).decideIfStillQuoted(eq(9L), eq(7L), eq(QuoteRequestStatus.ACCEPTED), isNull(), any());
        verifyNoInteractions(missions);
        if (absentTeam) verify(availability).isAvailable(eq(8L), any(), any());
    }
}
