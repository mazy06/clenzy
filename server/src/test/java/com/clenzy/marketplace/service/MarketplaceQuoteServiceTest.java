package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.model.MarketplaceQuoteRequest;
import com.clenzy.marketplace.model.ProviderStatus;
import com.clenzy.marketplace.model.QuoteRequestStatus;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.marketplace.repository.MarketplaceQuoteRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Demandes de devis.
 *
 * <p>La table relie DEUX organisations et ne porte aucun filtre tenant : les
 * cas qui comptent sont donc ceux ou l'appelant n'est ni l'un ni l'autre — et
 * ceux ou deux actions se croisent.</p>
 */
@ExtendWith(MockitoExtension.class)
class MarketplaceQuoteServiceTest {
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"title", "message", "category", "item"})
    void oversizedRequestTextFailsBeforeCreatingAnything(String field) {
        assertThatThrownBy(() -> service.request(PROVIDER, ORG, 3L,
                field.equals("title") ? "T".repeat(151) : "Ménage",
                field.equals("message") ? "M".repeat(4001) : null, null,
                field.equals("category") ? "C".repeat(41) : null,
                field.equals("item") ? "I".repeat(61) : null, null))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("caractères maximum");
        verifyNoInteractions(quoteRepository, providerRepository, teams, commercialQuotes);
    }

    @Test void oversizedQuoteMessageCannotSelectATeam() {
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(quote(QuoteRequestStatus.SENT)));
        assertThatThrownBy(() -> service.quote(9L, PROVIDER, BigDecimal.TEN, "EUR", "M".repeat(4001), null, 77L))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("4000");
        verify(quoteRepository, never()).selectTeam(any(), any(), any());
        verify(quoteRepository, never()).quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any());
        verifyNoInteractions(teams, commercialQuotes);
    }

    @Test void oversizedTurnDownReasonDoesNotCloseTheRequest() {
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(quote(QuoteRequestStatus.SENT)));
        assertThatThrownBy(() -> service.turnDown(9L, PROVIDER, "R".repeat(501)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("500");
        verify(quoteRepository, never()).closeIfStillSent(any(), any(), any(), any());
    }


    @Mock private MarketplaceQuoteRequestRepository quoteRepository;
    @Mock private MarketplaceProviderRepository providerRepository;
    @Mock private MarketplaceExposureService exposureService;
    @Mock private com.clenzy.repository.PropertyRepository propertyRepository;

    @Mock private com.clenzy.repository.TeamRepository teams;
    @Mock private com.clenzy.service.ServiceQuoteService commercialQuotes;
    private MarketplaceQuoteService service;

    private static final Instant NOW = Instant.parse("2026-09-13T10:00:00Z");
    private static final LocalDate TODAY = LocalDate.of(2026, 9, 13);
    private static final Long ORG = 7L;
    private static final Long PROVIDER = 1L;

    @Mock MarketplaceGeographicEligibility geography;

    @BeforeEach
    void setUp() {
        service = new MarketplaceQuoteService(
            quoteRepository, providerRepository, exposureService, propertyRepository,
            Clock.fixed(NOW, ZoneOffset.UTC), teams, commercialQuotes, mock(MarketplaceQuoteMissionFactory.class), geography);
    }

    // ─── Creation ────────────────────────────────────────────────────────────

    @Test
    void outOfZoneRequestIsNotSaved() {
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider()));
        when(exposureService.isVisibleTo(any(), eq(ORG))).thenReturn(true);
        when(propertyRepository.findByIdWithOwner(42L, ORG)).thenReturn(Optional.of(new com.clenzy.model.Property()));
        doThrow(new IllegalStateException("hors zone")).when(geography).requireCoverage(PROVIDER, 42L, ORG);
        assertThatThrownBy(() -> service.request(PROVIDER, ORG, 3L, "Ménage", null, 42L, null, null, null))
            .isInstanceOf(IllegalStateException.class).hasMessage("hors zone");
        verify(quoteRepository, never()).save(any());
    }

    @Test
    void aHiddenProviderCannotBeSolicited() {
        // La visibilite est re-verifiee ici, pas seulement a l'affichage :
        // l'identifiant d'une fiche gardee d'une page ouverte avant fermeture ne
        // doit pas suffire a la joindre.
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider()));
        when(exposureService.isVisibleTo(any(), eq(ORG))).thenReturn(false);

        assertThatThrownBy(() -> service.request(PROVIDER, ORG, 3L, "Ménage", null, null, null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("introuvable");

        verify(quoteRepository, never()).save(any());
    }

    @Test
    void anOrganisationCannotSolicitItsOwnProvider() {
        var own = provider();
        own.setHomeOrganizationId(ORG);
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(own));
        when(exposureService.isVisibleTo(any(), eq(ORG))).thenReturn(true);

        assertThatThrownBy(() -> service.request(PROVIDER, ORG, 3L, "Ménage", null, null, null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("intervention");
    }

    @Test
    void aRequestWithoutATitleIsRefused() {
        assertThatThrownBy(() -> service.request(PROVIDER, ORG, 3L, "  ", null, null, null, null, null))
            .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(providerRepository, quoteRepository);
    }

    @Test
    void aValidRequestStartsAsSentAndCarriesNoPrice() {
        var provider = provider();
        provider.getOffers().add(offer("CLEANING", "cleaning-turnover"));
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        when(exposureService.isVisibleTo(any(), eq(ORG))).thenReturn(true);
        when(quoteRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(propertyRepository.findByIdWithOwner(42L, ORG))
            .thenReturn(Optional.of(new com.clenzy.model.Property()));

        service.request(PROVIDER, ORG, 3L, "Ménage de départ", "Deux fois par semaine",
            42L, "CLEANING", "cleaning-turnover", TODAY.plusDays(5));

        var saved = ArgumentCaptor.forClass(MarketplaceQuoteRequest.class);
        verify(quoteRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(QuoteRequestStatus.SENT);
        // Le montant appartient au prestataire : rien de ce que le demandeur
        // envoie ne peut le fixer.
        assertThat(saved.getValue().getQuotedAmount()).isNull();
        assertThat(saved.getValue().getPropertyId()).isEqualTo(42L);
    }

    @Test
    void aPropertyFromAnotherOrganisationCannotBeAttached() {
        // Sans ce controle, un identifiant devine rattacherait la demande — puis
        // l'intervention — au logement d'une autre organisation.
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider()));
        when(exposureService.isVisibleTo(any(), eq(ORG))).thenReturn(true);
        when(propertyRepository.findByIdWithOwner(999L, ORG)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.request(PROVIDER, ORG, 3L, "Ménage", null, 999L, null, null, null))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Logement introuvable");

        verify(quoteRepository, never()).save(any());
    }

    // ─── Chiffrage ───────────────────────────────────────────────────────────

    @Test
    void anotherProviderCannotQuoteThisRequest() {
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(quote(QuoteRequestStatus.SENT)));

        assertThatThrownBy(() -> service.quote(9L, 99L, BigDecimal.TEN, "EUR", null, null))
            .isInstanceOf(AccessDeniedException.class);

        verify(quoteRepository, never()).quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void aQuoteMustCarryAPositiveAmount() {
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(quote(QuoteRequestStatus.SENT)));

        assertThatThrownBy(() -> service.quote(9L, PROVIDER, BigDecimal.ZERO, "EUR", null, null))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.quote(9L, PROVIDER, null, "EUR", null, null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"ZZZ", "12", "€", "EURO", "XXX", "XAU"})
    void invalidCurrencyCannotSelectATeamOrCreateAnAgreement(String currency) {
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(quote(QuoteRequestStatus.SENT)));
        assertThatThrownBy(() -> service.quote(9L, PROVIDER, BigDecimal.TEN, currency, null, null, 77L))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("devise monétaire valide");
        verify(quoteRepository, never()).selectTeam(any(), any(), any());
        verify(quoteRepository, never()).quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any());
        verifyNoInteractions(commercialQuotes, teams);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"eur,EUR", "mad,MAD", "USD,USD", "jpy,JPY"})
    void currencyCodeIsNormalizedWithoutChangingTheAmount(String input, String expected) {
        verifyQuotedCurrency(input, expected);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.NullAndEmptySource
    @org.junit.jupiter.params.provider.ValueSource(strings = "   ")
    void missingCurrencyKeepsTheEuroDefault(String input) {
        verifyQuotedCurrency(input, "EUR");
    }

    private void verifyQuotedCurrency(String input, String expected) {
        var sent = quote(QuoteRequestStatus.SENT);
        var quoted = quote(QuoteRequestStatus.QUOTED);
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(sent), Optional.of(quoted));
        when(quoteRepository.quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        service.quote(9L, PROVIDER, BigDecimal.TEN, input, null, null);
        verify(quoteRepository).quoteIfStillOpen(eq(9L), eq(PROVIDER), eq(new BigDecimal("10.00")), eq(expected), isNull(), isNull(), any());
        verify(commercialQuotes).ensureMarketplaceQuote(quoted);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"0.001", "120.125", "9999999999.991", "10000000000", "1E+100", "1E-100", "-1"})
    void invalidPrecisionOrRangeCannotSelectATeamOrPublishAQuote(String amount) {
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(quote(QuoteRequestStatus.SENT)));
        assertThatThrownBy(() -> service.quote(9L, PROVIDER, new BigDecimal(amount), "MAD", "Travaux", null, 77L))
                .isInstanceOf(IllegalArgumentException.class);
        verify(quoteRepository, never()).selectTeam(any(), any(), any());
        verify(quoteRepository, never()).quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any());
        verifyNoInteractions(commercialQuotes, teams);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"0.01", "120.000", "9999999999.99", "1E+3"})
    void validAmountIsStoredExactlyWithTwoDecimals(String amount) {
        var sent = quote(QuoteRequestStatus.SENT);
        var quoted = quote(QuoteRequestStatus.QUOTED);
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(sent), Optional.of(quoted));
        when(quoteRepository.quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        service.quote(9L, PROVIDER, new BigDecimal(amount), "MAD", null, null);
        var storedAmount = org.mockito.ArgumentCaptor.forClass(BigDecimal.class);
        verify(quoteRepository).quoteIfStillOpen(eq(9L), eq(PROVIDER), storedAmount.capture(), eq("MAD"), isNull(), isNull(), any());
        assertThat(storedAmount.getValue()).isEqualByComparingTo(amount);
        assertThat(storedAmount.getValue().scale()).isEqualTo(2);
        verify(commercialQuotes).ensureMarketplaceQuote(quoted);
    }

    @Test
    void aQuoteAlreadyExpiredAtSendTimeIsRefused() {
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(quote(QuoteRequestStatus.SENT)));

        assertThatThrownBy(() -> service.quote(9L, PROVIDER, BigDecimal.TEN, "EUR", null,
            TODAY.minusDays(1)))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("validité");
    }

    @Test
    void whenTheRequestWasSettledMeanwhile_thenQuotingFails() {
        // Transition CONDITIONNELLE : deux envois concurrents se serialisent,
        // un seul passe. Un vérifier-puis-agir laisserait le second écraser le
        // devis du premier.
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(quote(QuoteRequestStatus.SENT)));
        when(quoteRepository.quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(0);

        assertThatThrownBy(() -> service.quote(9L, PROVIDER, BigDecimal.TEN, "EUR", null, null))
            .isInstanceOf(MarketplaceQuoteService.QuoteAlreadySettledException.class);
    }

    // ─── Lecture croisee ─────────────────────────────────────────────────────

    @Test
    void pricingCreatesTheCanonicalQuoteBeforeAnyDecision() {
        var sent = quote(QuoteRequestStatus.SENT);
        var quoted = quote(QuoteRequestStatus.QUOTED);
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(sent), Optional.of(quoted));
        when(quoteRepository.quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any())).thenReturn(1);

        assertThat(service.quote(9L, PROVIDER, BigDecimal.TEN, "MAD", null, null)).isSameAs(quoted);
        verify(commercialQuotes).ensureMarketplaceQuote(quoted);
    }

    @Test
    void aProviderCannotChooseAnotherProvidersTeam() {
        var provider = provider();
        provider.setUserId(42L);
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(quote(QuoteRequestStatus.SENT)));
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        when(teams.findRealTeamsForMember(42L)).thenReturn(java.util.List.of());

        assertThatThrownBy(() -> service.quote(9L, PROVIDER, BigDecimal.TEN, "EUR", null, null, 77L))
                .isInstanceOf(AccessDeniedException.class);
        verify(quoteRepository, never()).selectTeam(any(), any(), any());
        verifyNoInteractions(commercialQuotes);
    }

    @Test
    void aNegotiationCannotMoveToAnotherTeamEvenWhenProviderBelongsToBoth() {
        var request = quote(QuoteRequestStatus.SENT);
        request.setProviderTeamId(76L);
        var provider = provider();
        provider.setUserId(42L);
        var team = new com.clenzy.model.Team();
        team.setId(77L);
        var originalTeam = new com.clenzy.model.Team();
        originalTeam.setId(76L);
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(request));
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        when(teams.findRealTeamsForMember(42L)).thenReturn(java.util.List.of(team, originalTeam));

        assertThatThrownBy(() -> service.quote(9L, PROVIDER, BigDecimal.TEN, "EUR", null, null, 77L))
                .isInstanceOf(IllegalStateException.class);
        verify(quoteRepository, never()).selectTeam(any(), any(), any());
        verifyNoInteractions(commercialQuotes);
    }

    @Test
    void leavingTheChosenTeamPreventsQuotingOnItsBehalf() {
        var request = quote(QuoteRequestStatus.SENT);
        request.setProviderTeamId(77L);
        var provider = provider();
        provider.setUserId(42L);
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(request));
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        when(teams.findRealTeamsForMember(42L)).thenReturn(java.util.List.of());

        assertThatThrownBy(() -> service.quote(9L, PROVIDER, BigDecimal.TEN, "EUR", null, null))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(commercialQuotes);
    }

    @Test
    void aMemberCanChooseTheirTeamBeforePricing() {
        var sent = quote(QuoteRequestStatus.SENT);
        var quoted = quote(QuoteRequestStatus.QUOTED);
        quoted.setProviderTeamId(77L);
        var provider = provider();
        provider.setUserId(42L);
        var team = new com.clenzy.model.Team();
        team.setId(77L);
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(sent), Optional.of(sent), Optional.of(quoted));
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        when(teams.findRealTeamsForMember(42L)).thenReturn(java.util.List.of(team));
        when(quoteRepository.selectTeam(9L, PROVIDER, 77L)).thenReturn(1);
        when(quoteRepository.quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any())).thenReturn(1);

        service.quote(9L, PROVIDER, BigDecimal.TEN, "EUR", null, null, 77L);

        var order = inOrder(quoteRepository, commercialQuotes);
        order.verify(quoteRepository).selectTeam(9L, PROVIDER, 77L);
        order.verify(quoteRepository).quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any());
        order.verify(commercialQuotes).ensureMarketplaceQuote(quoted);
    }

    @Test
    void aThirdPartySeesNothing() {
        // `findById` ne passe par aucun filtre : sans ce controle, un
        // identifiant devine donnerait la demande d'une organisation tierce.
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(quote(QuoteRequestStatus.QUOTED)));

        assertThatThrownBy(() -> service.getFor(9L, 99L, 99L))
            .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void bothSidesCanRead() {
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(quote(QuoteRequestStatus.QUOTED)));

        assertThat(service.getFor(9L, ORG, null)).isNotNull();
        assertThat(service.getFor(9L, null, PROVIDER)).isNotNull();
    }

    @Test void leavingATeamRemovesDetailAccessEvenForTheOriginalProvider() {
        var request = quote(QuoteRequestStatus.QUOTED);
        request.setProviderTeamId(77L);
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(request));
        var provider = provider(); provider.setUserId(42L);
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        var otherTeam = new com.clenzy.model.Team(); otherTeam.setId(78L);
        when(teams.findRealTeamsForMember(42L)).thenReturn(java.util.List.of(otherTeam));

        assertThatThrownBy(() -> service.getFor(9L, 99L, PROVIDER, 42L))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.getFor(9L, null, PROVIDER))
            .isInstanceOf(AccessDeniedException.class);
        assertThat(service.getFor(9L, ORG, null)).isSameAs(request);
    }

    @Test void aCurrentMemberCanReadWithoutOwningTheProviderProfile() {
        var request = quote(QuoteRequestStatus.QUOTED); request.setProviderTeamId(77L);
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(request));
        var team = new com.clenzy.model.Team(); team.setId(77L);
        when(teams.findRealTeamsForMember(43L)).thenReturn(java.util.List.of(team));
        assertThat(service.getFor(9L, 99L, null, 43L)).isSameAs(request);
    }

    @Test void leavingATeamPreventsTurningDownItsRequest() {
        var request = quote(QuoteRequestStatus.SENT); request.setProviderTeamId(77L);
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(request));
        var provider = provider(); provider.setUserId(42L);
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        assertThatThrownBy(() -> service.turnDown(9L, PROVIDER, "Indisponible"))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.teamOptions(9L, PROVIDER))
            .isInstanceOf(AccessDeniedException.class);
        verify(quoteRepository, never()).closeIfStillSent(any(), any(), any(), any());
    }

    @Test void aCurrentMemberCanStillTurnDownItsRequest() {
        var request = quote(QuoteRequestStatus.SENT); request.setProviderTeamId(77L);
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(request));
        var provider = provider(); provider.setUserId(42L);
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        var team = new com.clenzy.model.Team(); team.setId(77L);
        when(teams.findRealTeamsForMember(42L)).thenReturn(java.util.List.of(team));
        when(quoteRepository.closeIfStillSent(any(), any(), any(), any())).thenReturn(1);
        service.turnDown(9L, PROVIDER, "Indisponible");
        verify(quoteRepository).closeIfStillSent(eq(9L), eq(QuoteRequestStatus.TURNED_DOWN), eq("Indisponible"), any());
    }

    @Test void inboxAndBadgeUseOnlyCurrentTeamMemberships() {
        var provider = provider(); provider.setUserId(42L);
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        var team = new com.clenzy.model.Team(); team.setId(77L);
        when(teams.findRealTeamsForMember(42L)).thenReturn(java.util.List.of(team), java.util.List.of());
        service.listForProvider(PROVIDER, null, -1, 1000);
        service.countPendingForProvider(PROVIDER);
        verify(quoteRepository).findAccessibleForProvider(PROVIDER, java.util.List.of(77L),
            java.util.List.of(QuoteRequestStatus.values()), org.springframework.data.domain.PageRequest.of(0, 100));
        verify(quoteRepository).countAccessibleForProvider(PROVIDER, java.util.List.of(), QuoteRequestStatus.SENT);
    }

    private static MarketplaceProvider provider() {
        var provider = new MarketplaceProvider();
        provider.setId(PROVIDER);
        provider.setDisplayName("Atelier Ourika");
        provider.setStatus(ProviderStatus.ACTIVE);
        return provider;
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {
        "missing", "inactive-offer", "inactive-category", "inactive-item", "wrong-item",
        "wrong-category", "inconsistent-item-category", "free-label-only"
    })
    void aSelectedServiceMustBelongToAnActiveConsistentOffer(String scenario) {
        var provider = provider();
        var offer = offer("CLEANING", "cleaning-turnover");
        switch (scenario) {
            case "inactive-offer" -> offer.setActive(false);
            case "inactive-category" -> offer.getCategory().setActive(false);
            case "inactive-item" -> offer.getServiceItem().setActive(false);
            case "wrong-item" -> offer.getServiceItem().setCode("cleaning-deep");
            case "wrong-category" -> offer.getCategory().setCode("MAINTENANCE");
            case "inconsistent-item-category" -> {
                var other = new com.clenzy.marketplace.model.MarketplaceServiceCategory();
                other.setCode("MAINTENANCE"); offer.getServiceItem().setCategory(other);
            }
            case "free-label-only" -> offer.setServiceItem(null);
        }
        if (!scenario.equals("missing")) provider.getOffers().add(offer);
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        when(exposureService.isVisibleTo(provider, ORG)).thenReturn(true);
        assertThatThrownBy(() -> service.request(PROVIDER, ORG, 3L, "Ménage", null, null,
            "CLEANING", "cleaning-turnover", null))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("plus proposée");
        verify(quoteRepository, never()).save(any());
        verifyNoInteractions(teams, commercialQuotes);
    }

    @Test void anItemWithoutACategoryUsesTheCategoryOfTheOfferedService() {
        var provider = provider();
        provider.getOffers().add(offer("MAINTENANCE", "maintenance-plumbing"));
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        when(exposureService.isVisibleTo(provider, ORG)).thenReturn(true);
        when(quoteRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        var result = service.request(PROVIDER, ORG, 3L, "Fuite", null, null, null, "maintenance-plumbing", null);
        assertThat(result.getCategoryCode()).isEqualTo("MAINTENANCE");
        assertThat(result.getServiceItemCode()).isEqualTo("maintenance-plumbing");
    }

    @Test void anActiveFreeLabelOfferSupportsACategoryOnlyRequest() {
        var provider = provider();
        provider.getOffers().add(offer("MAINTENANCE", null));
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        when(exposureService.isVisibleTo(provider, ORG)).thenReturn(true);
        when(quoteRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        var result = service.request(PROVIDER, ORG, 3L, "Petits travaux", null, null, "MAINTENANCE", null, null);
        assertThat(result.getCategoryCode()).isEqualTo("MAINTENANCE");
        assertThat(result.getServiceItemCode()).isNull();
    }

    @Test void aGeneralRequestDoesNotRequireACatalogOffer() {
        var provider = provider();
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        when(exposureService.isVisibleTo(provider, ORG)).thenReturn(true);
        when(quoteRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        var result = service.request(PROVIDER, ORG, 3L, "Renseignements", null, null, null, null, null);
        assertThat(result.getCategoryCode()).isNull();
        assertThat(result.getServiceItemCode()).isNull();
    }

    private static com.clenzy.marketplace.model.MarketplaceProviderOffer offer(String categoryCode, String itemCode) {
        var category = new com.clenzy.marketplace.model.MarketplaceServiceCategory(); category.setCode(categoryCode);
        var offer = new com.clenzy.marketplace.model.MarketplaceProviderOffer(); offer.setCategory(category);
        if (itemCode != null) {
            var item = new com.clenzy.marketplace.model.MarketplaceServiceItem();
            item.setCode(itemCode); item.setCategory(category); offer.setServiceItem(item);
        }
        return offer;
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"removed", "offer", "category", "item"})
    void aServiceWithdrawnAfterTheRequestCannotBeQuotedOrSelectATeam(String change) {
        var request = quote(QuoteRequestStatus.SENT);
        request.setCategoryCode("CLEANING"); request.setServiceItemCode("cleaning-turnover");
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(request));
        var provider = provider();
        var offer = offer("CLEANING", "cleaning-turnover");
        if (change.equals("offer")) offer.setActive(false);
        if (change.equals("category")) offer.getCategory().setActive(false);
        if (change.equals("item")) offer.getServiceItem().setActive(false);
        if (!change.equals("removed")) provider.getOffers().add(offer);
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        assertThatThrownBy(() -> service.quote(9L, PROVIDER, BigDecimal.TEN, "EUR", null, null, 77L))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("plus proposée");
        verify(quoteRepository, never()).selectTeam(any(), any(), any());
        verify(quoteRepository, never()).quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any());
        verifyNoInteractions(teams, commercialQuotes);
    }

    @Test void aStillOfferedServiceCanBeQuotedAtANegotiatedPrice() {
        var request = quote(QuoteRequestStatus.SENT);
        request.setCategoryCode("CLEANING"); request.setServiceItemCode("cleaning-turnover");
        when(quoteRepository.findById(9L)).thenReturn(Optional.of(request));
        var provider = provider(); var offer = offer("CLEANING", "cleaning-turnover");
        offer.setAmount(new BigDecimal("99")); provider.getOffers().add(offer);
        when(providerRepository.findById(PROVIDER)).thenReturn(Optional.of(provider));
        when(quoteRepository.quoteIfStillOpen(any(), any(), any(), any(), any(), any(), any())).thenReturn(1);
        service.quote(9L, PROVIDER, BigDecimal.TEN, "EUR", null, null);
        verify(quoteRepository).quoteIfStillOpen(eq(9L), eq(PROVIDER), eq(new BigDecimal("10.00")), eq("EUR"), isNull(), isNull(), any());
        verify(commercialQuotes).ensureMarketplaceQuote(request);
    }

    private static MarketplaceQuoteRequest quote(QuoteRequestStatus status) {
        var quote = new MarketplaceQuoteRequest();
        quote.setId(9L);
        quote.setProviderId(PROVIDER);
        quote.setRequesterOrganizationId(ORG);
        quote.setTitle("Ménage de départ");
        quote.setStatus(status);
        return quote;
    }
}
