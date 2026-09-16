package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.InterventionType;
import com.clenzy.model.Property;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Un devis accepte devient une intervention.
 *
 * <p>Deux points portent tout le reste : le montant accepte doit SURVIVRE, et
 * un devis sans logement ne doit rien inventer.</p>
 */
@ExtendWith(MockitoExtension.class)
class MarketplaceQuoteInterventionServiceTest {
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(ints = {-1, 0, 1})
    void acceptanceIncludesTheValidityDayButRejectsTheFollowingDay(int offset) {
        var request = givenQuotedRequest();
        var limit = LocalDate.ofInstant(NOW, ZoneOffset.UTC).plusDays(offset);
        request.setQuoteValidUntil(limit);
        var canonical = canonicalQuote(); canonical.setValidUntil(limit);
        if (offset < 0) {
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.decide(canonical, 7L, true, null))
                    .hasMessageContaining("expiré");
            verify(requests, never()).decideIfStillQuoted(any(), any(), any(), any(), any());
            verifyNoInteractions(providerRepository, users, exposureRules);
        } else {
            givenActiveAccount();
            when(requests.decideIfStillQuoted(eq(9L), eq(7L), eq(com.clenzy.marketplace.model.QuoteRequestStatus.ACCEPTED), isNull(), any()))
                    .thenReturn(1);
            assertThat(service.decide(canonical, 7L, true, null)).isEmpty();
            verify(requests).decideIfStillQuoted(eq(9L), eq(7L), eq(com.clenzy.marketplace.model.QuoteRequestStatus.ACCEPTED), isNull(), any());
        }
        verifyNoInteractions(interventionRepository, propertyRepository, allocationRequests);
    }

    @Test void expiredProposalCanStillBeRefusedWhileItAwaitsDecision() {
        var request = givenQuotedRequest(); request.setQuoteValidUntil(LocalDate.ofInstant(NOW, ZoneOffset.UTC).minusDays(1));
        when(requests.decideIfStillQuoted(eq(9L), eq(7L), eq(com.clenzy.marketplace.model.QuoteRequestStatus.DECLINED), eq("Périmé"), any()))
                .thenReturn(1);
        assertThat(service.decide(canonicalQuote(), 7L, false, "Périmé")).isEmpty();
        verifyNoInteractions(providerRepository, users, interventionRepository, exposureRules);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = com.clenzy.marketplace.model.QuoteRequestStatus.class,
            names = "QUOTED", mode = org.junit.jupiter.params.provider.EnumSource.Mode.EXCLUDE)
    void onlyAQuotedRequestCanReceiveACommercialDecision(com.clenzy.marketplace.model.QuoteRequestStatus status) {
        var request = givenQuotedRequest(); request.setStatus(status);
        for (boolean approve : new boolean[]{true, false}) {
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.decide(canonicalQuote(), 7L, approve, null))
                    .isInstanceOf(MarketplaceQuoteService.QuoteAlreadySettledException.class);
        }
        verify(requests, never()).decideIfStillQuoted(any(), any(), any(), any(), any());
        verifyNoInteractions(providerRepository, users, interventionRepository, propertyRepository, exposureRules);
    }

    @Test void lostConditionalDecisionCannotCreateOrAttachAMission() {
        givenQuotedRequest(); givenActiveAccount();
        when(requests.decideIfStillQuoted(eq(9L), eq(7L), eq(com.clenzy.marketplace.model.QuoteRequestStatus.ACCEPTED), isNull(), any()))
                .thenReturn(0);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.decide(canonicalQuote(), 7L, true, null))
                .isInstanceOf(MarketplaceQuoteService.QuoteAlreadySettledException.class);
        verify(requests, never()).attachIntervention(any(), any(), any());
        verifyNoInteractions(interventionRepository, propertyRepository, allocationRequests);
    }

    private void givenActiveAccount() {
        when(providerRepository.findById(1L)).thenReturn(Optional.of(provider()));
        var user = new com.clenzy.model.User(); user.setId(11L);
        when(users.findById(11L)).thenReturn(Optional.of(user));
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"removed", "offer", "category", "item"})
    void aServiceWithdrawnAfterPricingCannotBeAccepted(String change) {
        var request = givenQuotedRequest(); request.setServiceItemCode("cleaning-turnover");
        var profile = provider(); var offer = profile.getOffers().getFirst();
        var item = new com.clenzy.marketplace.model.MarketplaceServiceItem();
        item.setCode("cleaning-turnover"); item.setCategory(offer.getCategory()); offer.setServiceItem(item);
        if (change.equals("removed")) profile.getOffers().clear();
        if (change.equals("offer")) offer.setActive(false);
        if (change.equals("category")) offer.getCategory().setActive(false);
        if (change.equals("item")) item.setActive(false);
        when(providerRepository.findById(1L)).thenReturn(Optional.of(profile));
        var user = new com.clenzy.model.User(); user.setId(11L);
        when(users.findById(11L)).thenReturn(Optional.of(user));
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.decide(canonicalQuote(), 7L, true, null))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("plus proposée");
        verify(requests, never()).decideIfStillQuoted(any(), any(), any(), any(), any());
        verify(requests, never()).attachIntervention(any(), any(), any());
        verifyNoInteractions(interventionRepository, allocationRequests);
    }

    @Test void aWithdrawnCatalogServiceCanStillBeRefused() {
        var request = givenQuotedRequest(); request.setServiceItemCode("removed-item");
        when(requests.decideIfStillQuoted(eq(9L), eq(7L), eq(com.clenzy.marketplace.model.QuoteRequestStatus.DECLINED), isNull(), any()))
            .thenReturn(1);
        assertThat(service.decide(canonicalQuote(), 7L, false, null)).isEmpty();
        verifyNoInteractions(providerRepository, users, interventionRepository);
    }

    @Test void oversizedRefusalReasonCannotSettleTheAgreement() {
        givenQuotedRequest();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.decide(canonicalQuote(), 7L, false, "R".repeat(501)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("500");
        verify(requests, never()).decideIfStillQuoted(any(), any(), any(), any(), any());
        verifyNoInteractions(interventionRepository, providerRepository);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"organization", "property", "mission", "author", "team", "currency", "amount", "missing-amount", "validity"})
    void divergentCanonicalQuoteCannotBeAccepted(String difference) {
        givenQuotedRequest();
        when(providerRepository.findById(1L)).thenReturn(Optional.of(provider()));
        var user = new com.clenzy.model.User(); user.setId(11L);
        when(users.findById(11L)).thenReturn(Optional.of(user));
        var canonical = canonicalQuote();
        switch (difference) {
            case "organization" -> canonical.setOrganizationId(99L);
            case "property" -> canonical.setPropertyId(42L);
            case "mission" -> canonical.setInterventionId(55L);
            case "author" -> canonical.setProviderUserId(99L);
            case "team" -> canonical.setProviderTeamId(8L);
            case "currency" -> canonical.setCurrency("EUR");
            case "amount" -> canonical.setAmount(new BigDecimal("121"));
            case "missing-amount" -> canonical.setAmount(null);
            case "validity" -> canonical.setValidUntil(LocalDate.of(2026, 10, 1));
            default -> throw new AssertionError(difference);
        }
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.decide(canonical, 7L, true, null))
                .hasMessageContaining("ne correspondent plus");
        verify(requests, never()).decideIfStillQuoted(any(), any(), any(), any(), any());
        verifyNoInteractions(interventionRepository, propertyRepository, allocationRequests);
    }

    @Test void matchingTeamQuoteKeepsItsAlreadyLinkedMission() {
        var request = givenQuotedRequest(); request.setProviderTeamId(8L); request.setInterventionId(55L);
        var canonical = canonicalQuote(); canonical.setProviderTeamId(8L); canonical.setInterventionId(55L);
        when(providerRepository.findById(1L)).thenReturn(Optional.of(provider()));
        var user = new com.clenzy.model.User(); user.setId(11L);
        when(users.findById(11L)).thenReturn(Optional.of(user));
        when(requests.decideIfStillQuoted(eq(9L), eq(7L), eq(com.clenzy.marketplace.model.QuoteRequestStatus.ACCEPTED), isNull(), any()))
                .thenReturn(1);
        assertThat(service.decide(canonical, 7L, true, null)).contains(55L);
        verifyNoInteractions(interventionRepository, propertyRepository, allocationRequests);
    }

    @Test void teamQuoteReservesTheTeamFromTheFirstAllocationCheck() {
        givenProperty(); givenSavedIntervention(55L);
        var request = quote(); request.setProviderTeamId(8L);
        when(availability.isAvailable(eq(8L), any(), any())).thenReturn(true);
        // L'auteur est occupé individuellement : ce n'est pas l'affectation demandée.
        when(allocationRequests.interventionAssignmentConflicts(any(), any(), any(), any(), any(), any()))
                .thenAnswer(call -> "user".equals(call.getArgument(2)));
        assertThat(service.createFrom(request)).contains(55L);
        var saved = ArgumentCaptor.forClass(Intervention.class);
        verify(interventionRepository).save(saved.capture());
        assertThat(saved.getValue().getTeamId()).isEqualTo(8L);
        assertThat(saved.getValue().getAssignedUser()).isNull();
        assertThat(saved.getValue().getAssignedTechnicianId()).isNull();
        assertThat(saved.getValue().getAssignmentResponse()).isEqualTo(com.clenzy.model.InterventionAssignmentResponse.PENDING);
        verify(allocationRequests).interventionAssignmentConflicts(isNull(), isNull(), eq("team"), eq(8L), any(), any());
        verifyNoMoreInteractions(allocationRequests);
    }

    @Test void absentTeamDoesNotCreateOrLinkAMarketplaceMission() {
        givenProperty();
        var request = quote(); request.setProviderTeamId(8L);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.createFrom(request))
                .isInstanceOf(com.clenzy.exception.AssignmentConflictException.class)
                .hasMessageContaining("indisponible");
        verify(availability).isAvailable(eq(8L), any(), any());
        verify(interventionRepository, never()).save(any());
        verify(requests, never()).attachIntervention(any(), any(), any());
    }

    @Test void teamConflictStopsCreationBeforeSavingOrLinkingMission() {
        givenProperty();
        var request = quote(); request.setProviderTeamId(8L);
        when(allocationRequests.interventionAssignmentConflicts(isNull(), isNull(), eq("team"), eq(8L), any(), any()))
                .thenReturn(true);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.createFrom(request))
                .isInstanceOf(com.clenzy.exception.AssignmentConflictException.class);
        verify(interventionRepository, never()).save(any());
        verify(requests, never()).attachIntervention(any(), any(), any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"named-deny", "global-deny", "exclusive"})
    void changedExposureBlocksGeneralAndLinkedAcceptance(String restriction) {
        var request = givenQuotedRequest();
        var provider = provider();
        when(providerRepository.findById(1L)).thenReturn(Optional.of(provider));
        if (restriction.equals("exclusive")) {
            provider.setEngagementMode(com.clenzy.marketplace.model.EngagementMode.EXCLUSIVE);
            provider.setHomeOrganizationId(99L);
        } else {
            var rule = new com.clenzy.marketplace.model.MarketplaceExposureRule();
            rule.setEffect(com.clenzy.marketplace.model.ExposureEffect.DENY);
            if (restriction.equals("named-deny")) {
                when(exposureRules.findByProviderIdAndOrganizationId(1L, 7L)).thenReturn(Optional.of(rule));
            } else {
                when(exposureRules.findByProviderIdAndOrganizationIdIsNull(1L)).thenReturn(Optional.of(rule));
            }
        }
        for (Long missionId : java.util.Arrays.asList(null, 55L)) {
            request.setInterventionId(missionId);
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.decide(canonicalQuote(), 7L, true, null))
                    .hasMessageContaining("plus disponible pour cette organisation");
        }
        verify(requests, never()).decideIfStillQuoted(any(), any(), any(), any(), any());
        verifyNoInteractions(interventionRepository, propertyRepository, users);
    }

    @Test void namedPermissionRestoresAcceptanceDespiteGlobalRestriction() {
        givenQuotedRequest();
        when(providerRepository.findById(1L)).thenReturn(Optional.of(provider()));
        var rule = new com.clenzy.marketplace.model.MarketplaceExposureRule();
        rule.setEffect(com.clenzy.marketplace.model.ExposureEffect.DENY);
        when(exposureRules.findByProviderIdAndOrganizationIdIsNull(1L)).thenReturn(Optional.of(rule));
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.decide(canonicalQuote(), 7L, true, null))
                .hasMessageContaining("plus disponible");
        var allow = new com.clenzy.marketplace.model.MarketplaceExposureRule();
        allow.setEffect(com.clenzy.marketplace.model.ExposureEffect.ALLOW);
        when(exposureRules.findByProviderIdAndOrganizationId(1L, 7L)).thenReturn(Optional.of(allow));
        var user = new com.clenzy.model.User(); user.setId(11L);
        when(users.findById(11L)).thenReturn(Optional.of(user));
        when(requests.decideIfStillQuoted(eq(9L), eq(7L), eq(com.clenzy.marketplace.model.QuoteRequestStatus.ACCEPTED), isNull(), any()))
                .thenReturn(1);
        assertThat(service.decide(canonicalQuote(), 7L, true, null)).isEmpty();
        verify(requests, times(1)).decideIfStillQuoted(any(), any(), any(), any(), any());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.EnumSource(value = com.clenzy.marketplace.model.ProviderStatus.class,
            names = "ACTIVE", mode = org.junit.jupiter.params.provider.EnumSource.Mode.EXCLUDE)
    void inactiveProviderCannotAcceptGeneralOrAlreadyLinkedAgreement(com.clenzy.marketplace.model.ProviderStatus status) {
        var request = givenQuotedRequest();
        var inactive = provider(); inactive.setStatus(status);
        when(providerRepository.findById(1L)).thenReturn(Optional.of(inactive));
        for (Long missionId : java.util.Arrays.asList(null, 55L)) {
            request.setInterventionId(missionId);
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.decide(canonicalQuote(), 7L, true, null))
                    .hasMessageContaining("plus actif");
        }
        verify(requests, never()).decideIfStillQuoted(any(), any(), any(), any(), any());
        verifyNoInteractions(interventionRepository, propertyRepository, users);
    }

    @Test void activeProviderNeedsAnExistingAccountEvenForGeneralAgreement() {
        givenQuotedRequest();
        var active = provider(); active.setUserId(null);
        when(providerRepository.findById(1L)).thenReturn(Optional.of(active));
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.decide(canonicalQuote(), 7L, true, null))
                .hasMessageContaining("activer son compte");
        active.setUserId(11L);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.decide(canonicalQuote(), 7L, true, null))
                .hasMessageContaining("Compte prestataire introuvable");
        verify(requests, never()).decideIfStillQuoted(any(), any(), any(), any(), any());
    }

    @Test void generalAgreementWithActiveAccountIsAcceptedWithoutCreatingMission() {
        givenQuotedRequest();
        when(providerRepository.findById(1L)).thenReturn(Optional.of(provider()));
        var user = new com.clenzy.model.User(); user.setId(11L);
        when(users.findById(11L)).thenReturn(Optional.of(user));
        when(requests.decideIfStillQuoted(eq(9L), eq(7L), eq(com.clenzy.marketplace.model.QuoteRequestStatus.ACCEPTED), isNull(), any()))
                .thenReturn(1);
        assertThat(service.decide(canonicalQuote(), 7L, true, null)).isEmpty();
        verifyNoInteractions(interventionRepository, propertyRepository);
    }

    @Test void refusalDoesNotRequireAnActiveProvider() {
        givenQuotedRequest();
        when(requests.decideIfStillQuoted(eq(9L), eq(7L), eq(com.clenzy.marketplace.model.QuoteRequestStatus.DECLINED), eq("Refus"), any()))
                .thenReturn(1);
        assertThat(service.decide(canonicalQuote(), 7L, false, "Refus")).isEmpty();
        verifyNoInteractions(providerRepository, users, interventionRepository, propertyRepository, exposureRules);
    }

    private MarketplaceQuoteRequest givenQuotedRequest() {
        var request = quote(); request.setPropertyId(null);
        request.setStatus(com.clenzy.marketplace.model.QuoteRequestStatus.QUOTED);
        when(requests.findForDiscussion(9L)).thenReturn(Optional.of(request));
        return request;
    }

    private com.clenzy.model.ServiceQuote canonicalQuote() {
        var quote = new com.clenzy.model.ServiceQuote(); quote.setMarketplaceRequestId(9L);
        quote.setOrganizationId(7L); quote.setProviderUserId(11L);
        quote.setAmount(new BigDecimal("120")); quote.setCurrency("MAD");
        return quote;
    }

    @Mock private InterventionRepository interventionRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private MarketplaceProviderRepository providerRepository;
    @Mock private com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository requests;
    @Mock private com.clenzy.repository.UserRepository users;
    @Mock private com.clenzy.service.ServiceQuoteService serviceQuotes;
    @Mock private com.clenzy.marketplace.repository.MarketplaceExposureRuleRepository exposureRules;
    @Mock private com.clenzy.repository.ServiceRequestRepository allocationRequests;
    @Mock private com.clenzy.service.ProviderAvailabilityService availability;

    private MarketplaceQuoteMissionFactory service;

    private static final Instant NOW = Instant.parse("2026-09-13T10:00:00Z");

    @BeforeEach
    void setUp() {
        lenient().when(availability.isUserAvailable(any(), any(), any())).thenReturn(true);
        service = new MarketplaceQuoteMissionFactory(
            interventionRepository, propertyRepository, providerRepository, users, requests,
            Clock.fixed(NOW, ZoneOffset.UTC), new com.clenzy.service.InterventionAllocationGuard(allocationRequests, availability, org.mockito.Mockito.mock(com.clenzy.service.ProviderPropertyEligibility.class), org.mockito.Mockito.mock(com.clenzy.marketplace.service.ProviderDocumentaryService.class)),
            new MarketplaceExposureService(exposureRules, Clock.fixed(NOW, ZoneOffset.UTC), org.mockito.Mockito.mock(com.clenzy.marketplace.service.MarketplaceDecisionJournal.class), documentary()), mock(MarketplaceGeographicEligibility.class));
    }

    @Test
    void theAgreedAmountSurvivesIntoTheIntervention() {
        // InterventionService EFFACE le cout estime quand un HOST cree une
        // intervention — parce qu'un client ne fixe pas son propre prix. Ici
        // c'est l'inverse : le montant vient du prestataire et a ete accepte.
        givenProperty();
        givenSavedIntervention(55L);

        var quote = quote();
        quote.setQuotedAmount(new BigDecimal("340.00"));

        assertThat(service.createFrom(quote)).contains(55L);

        var saved = ArgumentCaptor.forClass(Intervention.class);
        verify(interventionRepository).save(saved.capture());
        assertThat(saved.getValue().getEstimatedCost()).isEqualByComparingTo("340.00");
        assertThat(saved.getValue().getCurrency()).isEqualTo("MAD");
        assertThat(saved.getValue().getRequestor().getId()).isEqualTo(22L);
        assertThat(saved.getValue().getAssignedUser().getId()).isEqualTo(11L);
        assertThat(saved.getValue().getTeamId()).isNull();
        verify(allocationRequests).interventionAssignmentConflicts(isNull(), isNull(), eq("user"), eq(11L), any(), any());
        assertThat(saved.getValue().getScheduledDate()).isNotNull();
        // PENDING et non AWAITING_VALIDATION : la validation vient d'avoir lieu.
        assertThat(saved.getValue().getStatus()).isEqualTo(InterventionStatus.PENDING);
    }

    @Test
    void aQuoteWithoutAPropertyCreatesNothing() {
        // `Intervention.property` est NON NUL. Inventer un logement pour
        // satisfaire une contrainte de schema serait pire que ne rien creer :
        // l'acceptation vaut alors accord commercial, sans intervention.
        var quote = quote();
        quote.setPropertyId(null);

        assertThat(service.createFrom(quote)).isEmpty();

        verifyNoInteractions(interventionRepository, propertyRepository);
    }

    @Test
    void aPropertyThatLeftTheOrganisationCreatesNothing() {
        // Relu avec la borne d'organisation : un logement peut avoir change de
        // main entre la demande et l'acceptation.
        when(propertyRepository.findByIdWithOwner(42L, 7L)).thenReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.createFrom(quote()))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);

        verify(interventionRepository, never()).save(any());
    }

    @Test
    void theDescriptionRecallsWhereTheAmountComesFrom() {
        // Six mois plus tard, une ligne a 340 € sans origine est impossible a
        // justifier.
        givenProperty();
        givenSavedIntervention(55L);
        when(providerRepository.findById(1L)).thenReturn(Optional.of(provider()));

        var quote = quote();
        quote.setMessage("Deux fois par semaine");
        quote.setQuoteMessage("Tarif dégressif à partir du 3e passage");
        service.createFrom(quote);

        var saved = ArgumentCaptor.forClass(Intervention.class);
        verify(interventionRepository).save(saved.capture());
        assertThat(saved.getValue().getDescription())
            .contains("Atelier Ourika")
            .contains("Deux fois par semaine")
            .contains("Tarif dégressif");
    }

    @Test
    void theTradeDeterminesTheInterventionType() {
        givenProperty();
        givenSavedIntervention(55L);

        var quote = quote();
        quote.setCategoryCode("EXTERIOR");
        service.createFrom(quote);

        var saved = ArgumentCaptor.forClass(Intervention.class);
        verify(interventionRepository).save(saved.capture());
        assertThat(saved.getValue().getType()).isEqualTo(InterventionType.GARDENING.name());
    }

    @Test
    void anUnmappedTradeFallsBackToOtherRatherThanGuessing() {
        // Un type faux fausse le planning et les statistiques ; « autre » se
        // corrige en un clic.
        givenProperty();
        givenSavedIntervention(55L);

        var quote = quote();
        quote.setCategoryCode("PHOTOGRAPHY");
        service.createFrom(quote);

        var saved = ArgumentCaptor.forClass(Intervention.class);
        verify(interventionRepository).save(saved.capture());
        assertThat(saved.getValue().getType()).isEqualTo(InterventionType.OTHER.name());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({
        "CLEANING,cleaning-turnover,CLEANING",
        "CLEANING,cleaning-deep,DEEP_CLEANING",
        "CLEANING,cleaning-windows,WINDOW_CLEANING",
        "CLEANING,cleaning-disinfection,DISINFECTION",
        "MAINTENANCE,maintenance-plumbing,PLUMBING_REPAIR",
        "MAINTENANCE,maintenance-electrical,ELECTRICAL_REPAIR",
        "MAINTENANCE,maintenance-hvac,HVAC_REPAIR",
        "MAINTENANCE,maintenance-appliance,APPLIANCE_REPAIR",
        "MAINTENANCE,maintenance-preventive,PREVENTIVE_MAINTENANCE",
        "MAINTENANCE,maintenance-emergency,EMERGENCY_REPAIR",
        "EXTERIOR,exterior-garden,GARDENING",
        "EXTERIOR,exterior-terrace,EXTERIOR_CLEANING",
        "PEST,pest-insects,PEST_CONTROL",
        "RENOVATION,renovation-painting,RESTORATION"
    })
    void theSpecificServiceReachesTheCreatedMission(String category, String item, String expected) {
        givenProperty();
        givenSavedIntervention(55L);
        var request = quote();
        request.setCategoryCode(category);
        request.setServiceItemCode(item);
        service.createFrom(request);
        var saved = ArgumentCaptor.forClass(Intervention.class);
        verify(interventionRepository).save(saved.capture());
        assertThat(saved.getValue().getType()).isEqualTo(expected);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({
        "POOL,pool-repair", "REGULATORY,regulatory-unknown", "MAINTENANCE,unknown-service"
    })
    void anExplicitUnmappedServiceDoesNotInventAnOperationalType(String category, String item) {
        givenProperty();
        givenSavedIntervention(55L);
        var request = quote();
        request.setCategoryCode(category);
        request.setServiceItemCode(item);
        service.createFrom(request);
        var saved = ArgumentCaptor.forClass(Intervention.class);
        verify(interventionRepository).save(saved.capture());
        assertThat(saved.getValue().getType()).isEqualTo(InterventionType.OTHER.name());
    }

    @Test
    void theDesiredDateBecomesTheStart_otherwiseTheMomentOfAgreement() {
        givenProperty();
        givenSavedIntervention(55L);

        var dated = quote();
        dated.setDesiredDate(LocalDate.of(2026, 10, 1));
        service.createFrom(dated);

        var saved = ArgumentCaptor.forClass(Intervention.class);
        verify(interventionRepository).save(saved.capture());
        assertThat(saved.getValue().getStartTime()).isEqualTo("2026-10-01T09:00");
    }

    @Test
    void theQuoteIsLinkedToTheInterventionItProduced() {
        givenProperty();
        givenSavedIntervention(55L);

        service.createFrom(quote());

        verify(requests).attachIntervention(eq(9L), eq(55L), any());
    }

    @Test void replacementSlotIsCheckedAndUsedForTheNewMission() {
        givenProperty(); givenSavedIntervention(55L);
        var request = quote(); request.setDesiredDate(LocalDate.of(2026, 10, 1));
        request.setRequestedStartTime(java.time.LocalTime.of(14, 30)); request.setRequestedDurationMinutes(90);
        service.createFrom(request);
        var saved = ArgumentCaptor.forClass(Intervention.class);
        verify(interventionRepository).save(saved.capture());
        assertThat(saved.getValue().getStartTime()).isEqualTo("2026-10-01T14:30");
        assertThat(saved.getValue().getEndTime()).isEqualTo("2026-10-01T16:00");
        assertThat(saved.getValue().getEstimatedDurationHours()).isEqualTo(2);
        verify(availability).isUserAvailable(eq(11L), eq(java.time.LocalDateTime.of(2026,10,1,14,30)),
            eq(java.time.LocalDateTime.of(2026,10,1,16,30)));
    }

    private void givenProperty() {
        var property = new Property();
        property.setId(42L);
        when(propertyRepository.findByIdWithOwner(42L, 7L)).thenReturn(Optional.of(property));
        when(providerRepository.findById(1L)).thenReturn(Optional.of(provider()));
        var author = new com.clenzy.model.User(); author.setId(11L);
        var requester = new com.clenzy.model.User(); requester.setId(22L);
        when(users.findById(11L)).thenReturn(Optional.of(author));
        when(users.findById(22L)).thenReturn(Optional.of(requester));
    }

    private void givenSavedIntervention(Long id) {
        when(requests.attachIntervention(any(), any(), any())).thenReturn(1);
        when(interventionRepository.save(any())).thenAnswer(invocation -> {
            Intervention intervention = invocation.getArgument(0);
            intervention.setId(id);
            return intervention;
        });
    }

    private static MarketplaceProvider provider() {
        var provider = new MarketplaceProvider();
        provider.setId(1L);
        provider.setUserId(11L);
        provider.setStatus(com.clenzy.marketplace.model.ProviderStatus.ACTIVE);
        provider.setDisplayName("Atelier Ourika");
        var category = new com.clenzy.marketplace.model.MarketplaceServiceCategory(); category.setCode("CLEANING");
        var offer = new com.clenzy.marketplace.model.MarketplaceProviderOffer(); offer.setCategory(category);
        provider.getOffers().add(offer);
        return provider;
    }

    private static MarketplaceQuoteRequest quote() {
        var quote = new MarketplaceQuoteRequest();
        quote.setId(9L);
        quote.setRequestedByUserId(22L);
        quote.setQuotedCurrency("MAD");
        quote.setProviderId(1L);
        quote.setRequesterOrganizationId(7L);
        quote.setPropertyId(42L);
        quote.setTitle("Ménage de départ");
        quote.setCategoryCode("CLEANING");
        quote.setQuotedAmount(new BigDecimal("120.00"));
        return quote;
    }
    private static com.clenzy.marketplace.service.ProviderDocumentaryService documentary() {
        var service=org.mockito.Mockito.mock(com.clenzy.marketplace.service.ProviderDocumentaryService.class);
        org.mockito.Mockito.lenient().when(service.eligible(org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any(),org.mockito.ArgumentMatchers.any())).thenReturn(true);
        return service;
    }
}
