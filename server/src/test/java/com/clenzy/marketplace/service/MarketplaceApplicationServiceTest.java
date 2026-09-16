package com.clenzy.marketplace.service;

import com.clenzy.marketplace.dto.ProviderApplicationRequest;
import com.clenzy.marketplace.dto.ProviderDetailDto;
import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.marketplace.repository.MarketplaceServiceCategoryRepository;
import com.clenzy.service.UserService;
import com.clenzy.util.StringUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/**
 * Depot de candidature depuis le site public.
 *
 * <p>Surface non authentifiee : ces tests verifient surtout ce que le client
 * n'a PAS le droit de décider, et le refus des données invalides sans perte silencieuse.</p>
 */
@ExtendWith(MockitoExtension.class)
class MarketplaceApplicationServiceTest {

    @Mock private MarketplaceProviderRepository providerRepository;
    @Mock private MarketplaceServiceCategoryRepository categoryRepository;
    @Mock private com.clenzy.marketplace.repository.MarketplaceServiceItemRepository serviceItemRepository;
    @Mock private MarketplaceNotificationOutbox notificationService;

    private MarketplaceApplicationService service;

    private static final Instant NOW = Instant.parse("2026-09-12T10:00:00Z");
    private static final String CLIENT_IP = "203.0.113.7";

    @BeforeEach
    void setUp() {
        service = new MarketplaceApplicationService(
            providerRepository, categoryRepository, serviceItemRepository,
            notificationService, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    // ─── Garde-fous ──────────────────────────────────────────────────────────

    @Test
    void whenTermsNotAccepted_thenApplicationIsRefused() {
        var request = requestBuilder().acceptedTerms(false).build();

        assertThatThrownBy(() -> service.apply(request, CLIENT_IP))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("conditions");

        verify(providerRepository, never()).saveAndFlush(any());
    }

    @Test
    void whenEmailAlreadyApplied_thenDuplicateIsRefused() {
        when(providerRepository.existsByEmailHash(StringUtils.computeEmailHash("pro@exemple.fr")))
            .thenReturn(true);

        assertThatThrownBy(() -> service.apply(requestBuilder().build(), CLIENT_IP))
            .isInstanceOf(MarketplaceApplicationService.DuplicateApplicationException.class);

        verify(providerRepository, never()).saveAndFlush(any());
    }

    // ─── Ce que le serveur decide ────────────────────────────────────────────

    @Test
    void whenApplicationSubmitted_thenServerSetsStatusSourceAndMode() {
        var saved = captureSaved(requestBuilder().build());

        assertThat(saved.getStatus()).isEqualTo(ProviderStatus.PENDING_REVIEW);
        assertThat(saved.getSource()).isEqualTo(ProviderSource.LANDING);
        assertThat(saved.getEngagementMode()).isEqualTo(EngagementMode.INDEPENDENT);
        assertThat(saved.getSubmittedAt()).isEqualTo(NOW.atZone(ZoneOffset.UTC).toLocalDateTime());
        // Une candidature n'arrive jamais verifiee ni notee.
        assertThat(saved.getVerifiedAt()).isNull();
        assertThat(saved.getRatingAvg()).isNull();
        assertThat(saved.getRatingCount()).isZero();
        assertThat(saved.getHomeOrganizationId()).isNull();
    }

    @Test
    void whenEmailHasUppercase_thenItIsStoredLowercase() {
        var saved = captureSaved(requestBuilder().email("  PRO@Exemple.FR ").build());

        assertThat(saved.getEmail()).isEqualTo("pro@exemple.fr");
    }

    // ─── Normalisation ───────────────────────────────────────────────────────

    @Test
    void whenEmailIsStored_thenItsHashIsStoredWithIt() {
        var saved = captureSaved(requestBuilder().email("Pro@Exemple.fr").build());

        // Le courriel est chiffre au repos : sans cette empreinte, ni l'unicite
        // ni la recherche exacte ne seraient possibles.
        assertThat(saved.getEmailHash()).isEqualTo(StringUtils.computeEmailHash("pro@exemple.fr"));
    }

    @Test
    void whenLanguagesContainNoise_thenOnlyTwoLetterCodesSurvive() {
        var saved = captureSaved(requestBuilder()
            .languages(List.of("FR", "en", "francais", "", "ar"))
            .build());

        assertThat(saved.getLanguages()).isEqualTo("fr,en,ar");
    }

    @Test
    void whenCountryAndCurrencyAreMissing_thenDefaultsApply() {
        var saved = captureSaved(requestBuilder().baseCountryCode(null).build());

        assertThat(saved.getBaseCountryCode()).isEqualTo("FR");
        assertThat(saved.getCurrency()).isEqualTo("EUR");
    }

    // ─── Tolerance aux lignes invalides ──────────────────────────────────────

    @Test
    void whenCategoryCodeIsUnknown_thenApplicationIsRejected() {
        var cleaning = category(1L, "CLEANING");
        when(categoryRepository.findByCodeIn(anyList())).thenReturn(List.of(cleaning));

        var invalid = requestBuilder()
            .offers(List.of(
                offer("CLEANING", "Ménage complet", "FLAT", new BigDecimal("80.00")),
                offer("TELEPORTATION", "Service inconnu", "FLAT", new BigDecimal("10.00"))))
            .build();

        assertThatThrownBy(() -> service.apply(invalid, CLIENT_IP))
            .isInstanceOf(IllegalArgumentException.class);
        verify(providerRepository, never()).saveAndFlush(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void whenPricingIsOnQuote_thenNoAmountIsStored() {
        var cleaning = category(1L, "CLEANING");
        when(categoryRepository.findByCodeIn(anyList())).thenReturn(List.of(cleaning));

        var saved = captureSaved(requestBuilder()
            .offers(List.of(offer("CLEANING", "Remise en état", "ON_QUOTE", new BigDecimal("999"))))
            .build());

        // Un montant transmis avec un modele « sur devis » est ignore : la fiche
        // afficherait sinon un prix que le professionnel n'a pas voulu poser.
        assertThat(saved.getOffers().get(0).getPricingModel()).isEqualTo(PricingModel.ON_QUOTE);
        assertThat(saved.getOffers().get(0).getAmount()).isNull();
    }

    @Test
    void whenAmountIsNegative_thenApplicationIsRejected() {
        var cleaning = category(1L, "CLEANING");
        when(categoryRepository.findByCodeIn(anyList())).thenReturn(List.of(cleaning));

        var invalid = requestBuilder()
            .offers(List.of(offer("CLEANING", "Ménage", "FLAT", new BigDecimal("-50"))))
            .build();

        assertThatThrownBy(() -> service.apply(invalid, CLIENT_IP))
            .isInstanceOf(IllegalArgumentException.class);
        verify(providerRepository, never()).saveAndFlush(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void whenPricingModelIsUnknown_thenApplicationIsRejected() {
        var cleaning = category(1L, "CLEANING");
        when(categoryRepository.findByCodeIn(anyList())).thenReturn(List.of(cleaning));

        var invalid = requestBuilder()
            .offers(List.of(offer("CLEANING", "Ménage", "AU_PIFOMETRE", new BigDecimal("80"))))
            .build();

        assertThatThrownBy(() -> service.apply(invalid, CLIENT_IP))
            .isInstanceOf(IllegalArgumentException.class);
        verify(providerRepository, never()).saveAndFlush(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void whenSlotEndsBeforeItStarts_thenApplicationIsRejected() {
        var invalid = requestBuilder()
            .availability(List.of(
                new ProviderApplicationRequest.AvailabilityInput((short) 1, "09:00", "17:00"),
                new ProviderApplicationRequest.AvailabilityInput((short) 2, "18:00", "09:00"),
                new ProviderApplicationRequest.AvailabilityInput((short) 9, "09:00", "17:00")))
            .build();

        assertThatThrownBy(() -> service.apply(invalid, CLIENT_IP))
            .isInstanceOf(IllegalArgumentException.class);
        verify(providerRepository, never()).saveAndFlush(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void whenNoAvailabilityDeclared_thenNoSlotIsInvented() {
        // Aucune declaration vaut DISPONIBLE : le service ne doit surtout pas
        // fabriquer des creneaux pour combler le vide.
        var saved = captureSaved(requestBuilder().availability(null).build());

        assertThat(saved.getAvailability()).isEmpty();
    }

    // ─── Utilitaires ─────────────────────────────────────────────────────────

    @Test
    void whenOfferNamesACatalogueItem_thenItIsLinkedToIt() {
        var cleaning = category(1L, "CLEANING");
        when(categoryRepository.findByCodeIn(anyList())).thenReturn(List.of(cleaning));
        when(serviceItemRepository.findByCodeIn(anyList()))
            .thenReturn(List.of(item("CLEANING_DEPARTURE", cleaning)));

        var saved = captureSaved(requestBuilder()
            .offers(List.of(offer("CLEANING", "CLEANING_DEPARTURE", "Ménage de départ",
                "FLAT", new BigDecimal("80.00"))))
            .build());

        assertThat(saved.getOffers().get(0).getServiceItem()).isNotNull();
        assertThat(saved.getOffers().get(0).getServiceItem().getCode()).isEqualTo("CLEANING_DEPARTURE");
    }

    @Test
    void whenItemBelongsToAnotherTrade_thenApplicationIsRejected() {
        // Ranger une prestation de serrurerie sous « Ménage » fausserait tous
        // les comptes par prestation : le rattachement est refuse, la ligne
        // survit en texte.
        var cleaning = category(1L, "CLEANING");
        var locksmith = category(2L, "LOCKSMITH");
        when(categoryRepository.findByCodeIn(anyList())).thenReturn(List.of(cleaning));
        when(serviceItemRepository.findByCodeIn(anyList()))
            .thenReturn(List.of(item("LOCKSMITH_EMERGENCY", locksmith)));

        var invalid = requestBuilder()
            .offers(List.of(offer("CLEANING", "LOCKSMITH_EMERGENCY", "Ménage",
                "FLAT", new BigDecimal("80.00"))))
            .build();

        assertThatThrownBy(() -> service.apply(invalid, CLIENT_IP))
            .isInstanceOf(IllegalArgumentException.class);
        verify(providerRepository, never()).saveAndFlush(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void whenNoOfferNamesAnItem_thenTheCatalogueIsNotQueried() {
        var cleaning = category(1L, "CLEANING");
        when(categoryRepository.findByCodeIn(anyList())).thenReturn(List.of(cleaning));

        captureSaved(requestBuilder()
            .offers(List.of(offer("CLEANING", "Ménage", "FLAT", new BigDecimal("80"))))
            .build());

        verifyNoInteractions(serviceItemRepository);
    }

    // ─── Confirmation de l'adresse ───────────────────────────────────────────

    @Test
    void whenApplicationSubmitted_thenTheAddressIsNotYetProven() {
        // Le formulaire est public : tant que personne n'a clique le lien,
        // l'adresse n'est qu'une affirmation.
        var saved = captureSaved(requestBuilder().build());

        assertThat(saved.isEmailConfirmed()).isFalse();
        assertThat(saved.getEmailConfirmTokenHash()).isNotNull().hasSize(64);
    }

    @Test
    void whenConfirmationTokenIsUsed_thenTheAddressIsProvenAndTheTokenConsumed() {
        var provider = new MarketplaceProvider();
        provider.setId(7L);
        provider.setEmailConfirmTokenHash(MarketplaceUploadTokens.hash("jeton-conf"));
        when(providerRepository.findByEmailConfirmTokenHash(MarketplaceUploadTokens.hash("jeton-conf")))
            .thenReturn(java.util.Optional.of(provider));

        assertThat(service.confirmEmail("jeton-conf")).isTrue();

        assertThat(provider.getEmailConfirmedAt()).isEqualTo(NOW.atZone(ZoneOffset.UTC).toLocalDateTime());
        // Consomme : le garder laisserait une seconde voie ouverte pour rien.
        assertThat(provider.getEmailConfirmTokenHash()).isNull();
    }

    @Test
    void whenTheConfirmationTokenIsUnknown_thenNothingHappensAndItSaysSo() {
        when(providerRepository.findByEmailConfirmTokenHash(any())).thenReturn(java.util.Optional.empty());

        assertThat(service.confirmEmail("jeton-inconnu")).isFalse();
        assertThat(service.confirmEmail("  ")).isFalse();

        verify(providerRepository, never()).save(any());
    }

    @Test
    void whenApplicationSubmitted_thenConsentProofIsStored() {
        var saved = captureSaved(requestBuilder().build());

        assertThat(saved.getTermsVersion()).isEqualTo(UserService.PROVIDER_TERMS_VERSION);
        assertThat(saved.getTermsAcceptedAt()).isEqualTo(NOW.atZone(ZoneOffset.UTC).toLocalDateTime());
        assertThat(saved.getTermsAcceptedIp()).isEqualTo(CLIENT_IP);
    }

    @Test
    void whenIpCannotBeResolved_thenTheRestOfTheProofIsStillStored() {
        // Une IP absente ne doit pas faire perdre la version et l'horodatage :
        // une preuve partielle vaut mieux qu'aucune trace d'acceptation.
        var saved = captureSaved(requestBuilder().build(), null);

        assertThat(saved.getTermsAcceptedIp()).isNull();
        assertThat(saved.getTermsVersion()).isEqualTo(UserService.PROVIDER_TERMS_VERSION);
    }

    @Test
    void whenAnnouncedTermsVersionIsStale_thenApplicationIsRefused() {
        var request = requestBuilder().termsVersion("2019-01").build();

        assertThatThrownBy(() -> service.apply(request, CLIENT_IP))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Rechargez");

        verify(providerRepository, never()).saveAndFlush(any());
    }

    @Test
    void whenFormAnnouncesNoVersion_thenTheCurrentOneIsRecorded() {
        // Le formulaire public a precede l'ajout du champ : ne pas l'annoncer
        // reste accepte, et c'est la version courante qui est consignee.
        var saved = captureSaved(requestBuilder().termsVersion(null).build());

        assertThat(saved.getTermsVersion()).isEqualTo(UserService.PROVIDER_TERMS_VERSION);
    }

    @Test
    void theDetailDtoNeverCarriesTheAcceptanceIp() {
        // L'IP est une preuve a produire en cas de contestation, pas une donnee
        // d'ecran. Ce test tient la frontiere : ajouter le champ au DTO le casse.
        var components = Arrays.stream(ProviderDetailDto.class.getRecordComponents())
            .map(java.lang.reflect.RecordComponent::getName)
            .toList();

        assertThat(components).contains("termsVersion", "termsAcceptedAt");
        assertThat(components).noneMatch(name -> name.toLowerCase().contains("ip"));
    }

    @Test
    void countriesOutsideTheInitialListKeepTheirDeclaredZone() {
        var saved = captureSaved(requestBuilder().baseCountryCode("JP")
            .zones(List.of(new ProviderApplicationRequest.ZoneInput("JP", null, "Kyoto", null, null, true))).build());
        assertThat(saved.getBaseCountryCode()).isEqualTo("JP");
        assertThat(saved.getZones()).singleElement().satisfies(zone -> {
            assertThat(zone.getCountryCode()).isEqualTo("JP");
            assertThat(zone.getCity()).isEqualTo("Kyoto");
        });
    }

    @Test
    void anIncompleteZoneIsRejectedInsteadOfBeingWidenedOrDropped() {
        var invalid = requestBuilder().zones(List.of(
            new ProviderApplicationRequest.ZoneInput("FR", null, "Paris", null, null, true))).build();
        assertThatThrownBy(() -> service.apply(invalid, CLIENT_IP)).isInstanceOf(IllegalArgumentException.class);
        verify(providerRepository, never()).saveAndFlush(any());
        verifyNoInteractions(notificationService);
    }

    @Test
    void invalidCountryAndNullSlotsFailBeforeSaving() {
        assertThatThrownBy(() -> service.apply(requestBuilder().baseCountryCode("F").build(), CLIENT_IP))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.apply(requestBuilder().availability(Arrays.asList((ProviderApplicationRequest.AvailabilityInput)null)).build(), CLIENT_IP))
            .isInstanceOf(IllegalArgumentException.class);
        verify(providerRepository, never()).saveAndFlush(any());
    }

    private MarketplaceProvider captureSaved(ProviderApplicationRequest request) {
        return captureSaved(request, CLIENT_IP);
    }

    private MarketplaceProvider captureSaved(ProviderApplicationRequest request, String clientIp) {
        when(providerRepository.saveAndFlush(any())).thenAnswer(invocation -> {
            MarketplaceProvider p = invocation.getArgument(0);
            p.setId(42L);
            return p;
        });

        service.apply(request, clientIp);

        var captor = ArgumentCaptor.forClass(MarketplaceProvider.class);
        verify(providerRepository).saveAndFlush(captor.capture());
        return captor.getValue();
    }

    private static MarketplaceServiceItem item(String code, MarketplaceServiceCategory category) {
        var serviceItem = new MarketplaceServiceItem();
        serviceItem.setCode(code);
        serviceItem.setCategory(category);
        serviceItem.setLabelFr(code);
        return serviceItem;
    }

    private static MarketplaceServiceCategory category(Long id, String code) {
        var category = new MarketplaceServiceCategory();
        category.setId(id);
        category.setCode(code);
        category.setLabelFr(code);
        category.setLabelEn(code);
        return category;
    }

    private static ProviderApplicationRequest.OfferInput offer(
            String categoryCode, String label, String pricingModel, BigDecimal amount) {
        return offer(categoryCode, null, label, pricingModel, amount);
    }

    private static ProviderApplicationRequest.OfferInput offer(
            String categoryCode, String serviceItemCode, String label,
            String pricingModel, BigDecimal amount) {
        return new ProviderApplicationRequest.OfferInput(
            categoryCode, serviceItemCode, label, null, pricingModel, amount, "EUR", null, null);
    }

    /** Construit une candidature valide, que chaque test derive sur un seul point. */
    private static Builder requestBuilder() {
        return new Builder();
    }

    private static final class Builder {
        private String email = "pro@exemple.fr";
        private String baseCountryCode = "FR";
        private List<String> languages = List.of("fr");
        private List<ProviderApplicationRequest.OfferInput> offers = List.of();
        private List<ProviderApplicationRequest.ZoneInput> zones = List.of();
        private List<ProviderApplicationRequest.AvailabilityInput> availability = List.of();
        private boolean acceptedTerms = true;
        private String termsVersion = UserService.PROVIDER_TERMS_VERSION;

        Builder email(String value) { this.email = value; return this; }
        Builder baseCountryCode(String value) { this.baseCountryCode = value; return this; }
        Builder languages(List<String> value) { this.languages = value; return this; }
        Builder offers(List<ProviderApplicationRequest.OfferInput> value) { this.offers = value; return this; }
        Builder zones(List<ProviderApplicationRequest.ZoneInput> value) { this.zones = value; return this; }
        Builder availability(List<ProviderApplicationRequest.AvailabilityInput> value) {
            this.availability = value; return this;
        }
        Builder acceptedTerms(boolean value) { this.acceptedTerms = value; return this; }
        Builder termsVersion(String value) { this.termsVersion = value; return this; }

        ProviderApplicationRequest build() {
            return new ProviderApplicationRequest(
                "Atelier Ourika", "ATELIER OURIKA SARL", "Yasmine", "Benali",
                email, "+212600000000", null, "Ménage et blanchisserie", null,
                null, "Marrakech", "40000", baseCountryCode, 25,
                languages, "12345678901234", List.of(),
                offers, zones, availability, acceptedTerms, termsVersion, null);
        }
    }
}
