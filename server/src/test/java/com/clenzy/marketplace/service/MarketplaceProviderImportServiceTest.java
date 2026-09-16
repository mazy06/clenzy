package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.MarketplaceImportRepository;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.marketplace.repository.MarketplaceServiceCategoryRepository;
import com.clenzy.marketplace.repository.MarketplaceServiceItemRepository;
import com.clenzy.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.*;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/**
 * Reprise des comptes prestataires existants.
 *
 * <p>Deux proprietes gouvernent tout et sont verifiees ici : l'import ne
 * fabrique pas de credit (aucune fiche reprise n'arrive verifiee ni notee) et
 * il n'ecrase jamais — c'est ce qui le rend rejouable.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MarketplaceProviderImportServiceTest {

    @Mock private MarketplaceImportRepository importRepository;
    @Mock private MarketplaceProviderRepository providerRepository;
    @Mock private MarketplaceServiceCategoryRepository categoryRepository;
    @Mock private MarketplaceServiceItemRepository serviceItemRepository;

    private MarketplaceProviderImportService service;

    private static final Instant NOW = Instant.parse("2026-09-12T10:00:00Z");

    @BeforeEach
    void setUp() {
        service = new MarketplaceProviderImportService(
            importRepository, providerRepository, categoryRepository, serviceItemRepository,
            Clock.fixed(NOW, ZoneOffset.UTC));

        // Referentiel complet : l'import doit trouver une categorie pour chaque role.
        when(categoryRepository.findAll()).thenReturn(List.of(
            category(1L, "CLEANING"), category(2L, "MAINTENANCE"),
            category(3L, "LAUNDRY"), category(4L, "EXTERIOR"),
            category(5L, "CONCIERGE"), category(6L, "OTHER")));

        when(providerRepository.findAll()).thenReturn(List.of());
        // Catalogue minimal : de quoi verifier le rattachement des offres reprises.
        when(serviceItemRepository.findAll()).thenReturn(List.of(
            serviceItem("cleaning-turnover", "CLEANING"),
            serviceItem("maintenance-handyman", "MAINTENANCE"),
            serviceItem("maintenance-plumbing", "MAINTENANCE"),
            serviceItem("exterior-garden", "EXTERIOR"),
            serviceItem("concierge-guest-support", "CONCIERGE")));
        when(importRepository.findProviderTariffs(anyList())).thenReturn(List.of());
        when(importRepository.findApprovedDocumentsWithExpiry(anyList())).thenReturn(List.of());
        when(importRepository.countCompletedInterventionsByUser(anyList())).thenReturn(List.of());
    }

    // ─── Creation ────────────────────────────────────────────────────────────

    @Test
    void whenProviderUserHasNoDeclaredData_thenFicheIsCreatedWithRoleDefaults() {
        var user = user(10L, "yasmine@exemple.fr", UserRole.HOUSEKEEPER);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));

        var report = service.importExistingProviders(EngagementMode.EXCLUSIVE);
        var saved = captureSaved();

        assertThat(report.created()).isEqualTo(1);
        assertThat(saved.getDisplayName()).isEqualTo("Yasmine Benali");
        assertThat(saved.getUserId()).isEqualTo(10L);
        assertThat(saved.getHomeOrganizationId()).isEqualTo(3L);
        assertThat(saved.getSource()).isEqualTo(ProviderSource.INVITATION);
        assertThat(saved.getEngagementMode()).isEqualTo(EngagementMode.EXCLUSIVE);

        // Sans metier, la fiche serait introuvable par le filtre le plus utilise.
        assertThat(saved.getOffers()).hasSize(1);
        assertThat(saved.getOffers().get(0).getCategory().getCode()).isEqualTo("CLEANING");
        assertThat(saved.getOffers().get(0).getPricingModel()).isEqualTo(PricingModel.ON_QUOTE);
    }

    @Test
    void whenFicheIsImported_thenItIsNeverVerifiedNorRated() {
        var user = user(10L, "yasmine@exemple.fr", UserRole.TECHNICIAN);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));

        service.importExistingProviders(EngagementMode.EXCLUSIVE);
        var saved = captureSaved();

        // Personne n'a controle ses pieces au titre du catalogue.
        assertThat(saved.getVerifiedAt()).isNull();
        assertThat(saved.getVerifiedByKeycloakId()).isNull();
        // Rien dans le produit ne note encore un intervenant.
        assertThat(saved.getRatingAvg()).isNull();
        assertThat(saved.getRatingCount()).isZero();
    }

    @Test
    void whenCompanyNameIsSet_thenItBecomesTheDisplayName() {
        var user = user(10L, "contact@brillance.fr", UserRole.HOUSEKEEPER);
        user.setCompanyName("Brillance Services");
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));

        service.importExistingProviders(EngagementMode.EXCLUSIVE);

        assertThat(captureSaved().getDisplayName()).isEqualTo("Brillance Services");
    }

    @Test
    void whenUserAccountIsInactive_thenFicheIsNotPublished() {
        var user = user(10L, "ancien@exemple.fr", UserRole.TECHNICIAN);
        user.setStatus(UserStatus.INACTIVE);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));

        service.importExistingProviders(EngagementMode.EXCLUSIVE);

        assertThat(captureSaved().getStatus()).isEqualTo(ProviderStatus.SUSPENDED);
    }

    // ─── Reprise des donnees d'exploitation ──────────────────────────────────

    @Test
    void whenTechnicianDeclaredPrestations_thenTheyBecomePricedOffers() {
        var user = user(10L, "karim@exemple.fr", UserRole.TECHNICIAN);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));
        when(importRepository.findProviderTariffs(anyList())).thenReturn(List.of(
            prestation(10L, "PLUMBING_REPAIR", 120.0),
            prestation(10L, "GARDENING", 60.0)));

        service.importExistingProviders(EngagementMode.EXCLUSIVE);
        var saved = captureSaved();

        assertThat(saved.getOffers()).hasSize(2);
        assertThat(saved.getOffers())
            .extracting(o -> o.getCategory().getCode())
            .containsExactly("MAINTENANCE", "EXTERIOR");
        assertThat(saved.getOffers().get(0).getPricingModel()).isEqualTo(PricingModel.FLAT);
        assertThat(saved.getOffers().get(0).getAmount()).isEqualByComparingTo("120.00");
    }

    @Test
    void whenHousekeeperHasGeneralRate_thenItBecomesAnHourlyOffer() {
        var user = user(10L, "sofia@exemple.fr", UserRole.HOUSEKEEPER);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));
        when(importRepository.findProviderTariffs(anyList()))
            .thenReturn(List.of(rate(10L, new BigDecimal("18.50"))));

        service.importExistingProviders(EngagementMode.EXCLUSIVE);
        var saved = captureSaved();

        assertThat(saved.getOffers()).hasSize(1);
        assertThat(saved.getOffers().get(0).getPricingModel()).isEqualTo(PricingModel.HOURLY);
        assertThat(saved.getOffers().get(0).getAmount()).isEqualByComparingTo("18.50");
        saved.getOffers().get(0).getTariff().setAmount(new BigDecimal("24"));
        assertThat(saved.getOffers().get(0).getAmount()).isEqualByComparingTo("24");
    }

    @Test
    void whenPersonalTeamExists_thenImportDoesNotCopyTheCalendar() {
        var user = user(10L, "karim@exemple.fr", UserRole.TECHNICIAN);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));
        service.importExistingProviders(EngagementMode.EXCLUSIVE);
        var saved = captureSaved();

        assertThat(saved.getZones()).isEmpty();
        assertThat(saved.getAvailability()).isEmpty();
    }

    @Test
    void whenDocumentsAreApproved_thenExpiryDatesAreCarriedOver() {
        var user = user(10L, "karim@exemple.fr", UserRole.TECHNICIAN);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));
        when(importRepository.findApprovedDocumentsWithExpiry(anyList())).thenReturn(List.of(
            document(10L, ProviderDocument.DocumentType.LIABILITY_INSURANCE, LocalDate.of(2027, 3, 1)),
            document(10L, ProviderDocument.DocumentType.URSSAF_VIGILANCE, LocalDate.of(2026, 11, 1))));

        service.importExistingProviders(EngagementMode.EXCLUSIVE);
        var saved = captureSaved();

        assertThat(saved.getInsuranceExpiresAt()).isEqualTo(LocalDate.of(2027, 3, 1));
        assertThat(saved.getVigilanceExpiresAt()).isEqualTo(LocalDate.of(2026, 11, 1));
    }

    @Test
    void whenInterventionsWereCompleted_thenMissionCountIsCarriedOver() {
        var user = user(10L, "karim@exemple.fr", UserRole.TECHNICIAN);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));
        when(importRepository.countCompletedInterventionsByUser(anyList()))
            .thenReturn(List.<Object[]>of(new Object[]{10L, 37L}));

        service.importExistingProviders(EngagementMode.EXCLUSIVE);

        assertThat(captureSaved().getCompletedMissions()).isEqualTo(37);
    }

    // ─── Idempotence ─────────────────────────────────────────────────────────

    @Test
    void whenFicheAlreadyComplete_thenNothingIsTouched() {
        var user = user(10L, "yasmine@exemple.fr", UserRole.HOUSEKEEPER);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));

        var existing = existingFiche(10L, "yasmine@exemple.fr");
        when(providerRepository.findAll()).thenReturn(List.of(existing));

        var report = service.importExistingProviders(EngagementMode.EXCLUSIVE);

        assertThat(report.unchanged()).isEqualTo(1);
        assertThat(report.created()).isZero();
        verify(providerRepository, never()).save(any());
    }

    @Test
    void whenFicheWasEditedByStaff_thenImportDoesNotOverwriteIt() {
        var user = user(10L, "yasmine@exemple.fr", UserRole.HOUSEKEEPER);
        user.setPhoneNumber("+33600000000");
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));

        var existing = existingFiche(10L, "yasmine@exemple.fr");
        existing.setDisplayName("Nom corrigé à la main");
        existing.setPhone(null); // seul trou restant
        when(providerRepository.findAll()).thenReturn(List.of(existing));

        service.importExistingProviders(EngagementMode.EXCLUSIVE);

        assertThat(existing.getDisplayName()).isEqualTo("Nom corrigé à la main");
        assertThat(existing.getPhone()).isEqualTo("+33600000000");
    }

    @Test
    void whenLandingApplicationSharesTheEmail_thenItIsLinkedInsteadOfDuplicated() {
        var user = user(10L, "yasmine@exemple.fr", UserRole.HOUSEKEEPER);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));

        // Candidature deposee depuis le site public, sans compte rattache.
        var application = existingFiche(null, "yasmine@exemple.fr");
        when(providerRepository.findAll()).thenReturn(List.of(application));

        var report = service.importExistingProviders(EngagementMode.EXCLUSIVE);

        // Creer une seconde fiche aurait bute sur l'unicite de l'adresse et fait
        // echouer l'import entier sur un seul doublon.
        assertThat(report.created()).isZero();
        assertThat(report.enriched()).isEqualTo(1);
        assertThat(application.getUserId()).isEqualTo(10L);
    }

    @Test
    void whenUserHasNoEmail_thenAccountIsSkippedWithAReason() {
        var user = user(10L, null, UserRole.HOUSEKEEPER);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));

        var report = service.importExistingProviders(EngagementMode.EXCLUSIVE);

        assertThat(report.skipped()).isEqualTo(1);
        assertThat(report.created()).isZero();
        assertThat(report.skippedReasons()).singleElement().asString().contains("e-mail");
        verify(providerRepository, never()).save(any());
    }

    @Test
    void whenTwoAccountsShareAnEmail_thenTheSecondIsSkipped() {
        var first = user(10L, "contact@brillance.fr", UserRole.HOUSEKEEPER);
        var second = user(11L, "contact@brillance.fr", UserRole.TECHNICIAN);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(first, second));

        var report = service.importExistingProviders(EngagementMode.EXCLUSIVE);

        assertThat(report.created()).isEqualTo(1);
        assertThat(report.skipped()).isEqualTo(1);
        assertThat(report.skippedReasons()).singleElement().asString().contains("deja portee");
    }

    // ─── Comptage ────────────────────────────────────────────────────────────

    @Test
    void whenFicheIsCreated_thenItCarriesTheEmailHash() {
        var user = user(10L, "yasmine@exemple.fr", UserRole.HOUSEKEEPER);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));

        service.importExistingProviders(EngagementMode.EXCLUSIVE);

        // Le courriel repris est chiffre au repos comme celui du compte source :
        // c'est l'empreinte qui porte l'unicite et le rattachement.
        assertThat(captureSaved().getEmailHash())
            .isEqualTo(com.clenzy.util.StringUtils.computeEmailHash("yasmine@exemple.fr"));
    }

    @Test
    void countImportable_ignoresAccountsAlreadyLinkedOrWithoutEmail() {
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(
            user(10L, "liee@exemple.fr", UserRole.HOUSEKEEPER),
            user(11L, "absente@exemple.fr", UserRole.TECHNICIAN),
            user(12L, null, UserRole.LAUNDRY)));
        when(providerRepository.findAll()).thenReturn(List.of(existingFiche(10L, "liee@exemple.fr")));

        assertThat(service.countImportable()).isEqualTo(1);
    }

    // ─── Utilitaires ─────────────────────────────────────────────────────────

    private MarketplaceProvider captureSaved() {
        var captor = org.mockito.ArgumentCaptor.forClass(MarketplaceProvider.class);
        verify(providerRepository, atLeastOnce()).save(captor.capture());
        return captor.getValue();
    }

    private static User user(Long id, String email, UserRole role) {
        var user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setFirstName("Yasmine");
        user.setLastName("Benali");
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        user.setOrganizationId(3L);
        user.setCreatedAt(LocalDateTime.of(2026, 1, 10, 9, 0));
        return user;
    }

    /** Fiche deja complete : aucun trou a combler. */
    private static MarketplaceProvider existingFiche(Long userId, String email) {
        var provider = new MarketplaceProvider();
        provider.setId(500L);
        provider.setUserId(userId);
        provider.setEmail(email);
        provider.setDisplayName("Yasmine Benali");
        provider.setLegalName("Yasmine Benali EI");
        provider.setContactFirstName("Yasmine");
        provider.setContactLastName("Benali");
        provider.setPhone("+33611111111");
        provider.setAvatarUrl("https://exemple.fr/a.png");
        provider.setBaseCity("Paris");
        provider.setBasePostalCode("75011");
        provider.setHeadline("Ménage entre deux séjours");
        provider.setHomeOrganizationId(3L);
        provider.setInsuranceExpiresAt(LocalDate.of(2027, 1, 1));
        provider.setVigilanceExpiresAt(LocalDate.of(2027, 1, 1));
        provider.setCompletedMissions(5);
        var offers = new ArrayList<MarketplaceProviderOffer>();
        var offer = new MarketplaceProviderOffer();
        offer.setProvider(provider);
        offer.setCategory(category(1L, "CLEANING"));
        offer.setLabel("Ménage");
        offers.add(offer);
        provider.setOffers(offers);
        var zones = new ArrayList<MarketplaceProviderZone>();
        var zone = new MarketplaceProviderZone();
        zone.setProvider(provider);
        zone.setCity("Paris");
        zones.add(zone);
        provider.setZones(zones);
        var slots = new ArrayList<MarketplaceProviderAvailability>();
        var slot = new MarketplaceProviderAvailability();
        slot.setProvider(provider);
        slot.setDayOfWeek((short) 1);
        slot.setStartTime(LocalTime.of(9, 0));
        slot.setEndTime(LocalTime.of(17, 0));
        slots.add(slot);
        provider.setAvailability(slots);
        return provider;
    }

    /** Vérifie que la reprise rattache bien l'offre au catalogue. */
    @Test
    void whenOfferIsDerived_thenItIsLinkedToTheCatalogue() {
        var user = user(10L, "yasmine@exemple.fr", UserRole.HOUSEKEEPER);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));

        service.importExistingProviders(EngagementMode.EXCLUSIVE);
        var saved = captureSaved();

        // Sans ce lien, les fiches reprises resteraient invisibles du filtre par
        // prestation — le referentiel ne servirait qu'aux nouvelles candidatures.
        assertThat(saved.getOffers()).hasSize(1);
        assertThat(saved.getOffers().get(0).getServiceItem()).isNotNull();
        assertThat(saved.getOffers().get(0).getServiceItem().getCode()).isEqualTo("cleaning-turnover");
    }

    @Test
    void whenInterventionTypeHasNoCatalogueMatch_thenOfferKeepsItsFreeLabel() {
        var user = user(10L, "karim@exemple.fr", UserRole.TECHNICIAN);
        when(importRepository.findProviderUsers(anyList())).thenReturn(List.of(user));
        when(importRepository.findProviderTariffs(anyList()))
            .thenReturn(List.of(prestation(10L, "KITCHEN_CLEANING", 90.0)));

        service.importExistingProviders(EngagementMode.EXCLUSIVE);
        var saved = captureSaved();

        // Aucune correspondance certaine : l'offre garde son libelle libre plutot
        // que d'etre rangee sous une prestation que le professionnel ne vend pas.
        assertThat(saved.getOffers()).hasSize(1);
        assertThat(saved.getOffers().get(0).getServiceItem()).isNull();
        assertThat(saved.getOffers().get(0).getLabel()).isNotBlank();
    }

    private static MarketplaceServiceItem serviceItem(String code, String categoryCode) {
        var item = new MarketplaceServiceItem();
        item.setCode(code);
        item.setCategory(category(1L, categoryCode));
        item.setLabelFr(code);
        item.setLabelEn(code);
        return item;
    }

    private static MarketplaceServiceCategory category(Long id, String code) {
        var category = new MarketplaceServiceCategory();
        category.setId(id);
        category.setCode(code);
        category.setLabelFr(code);
        category.setLabelEn(code);
        return category;
    }

    private static ProviderTariff prestation(Long userId, String type, Double price) {
        var prestation = new ProviderTariff();
        prestation.setUserId(userId);
        prestation.setServiceKey(com.clenzy.service.pricing.ProviderTariffService.keyForType(type));
        prestation.setAmount(BigDecimal.valueOf(price));
        prestation.setPricingModel(PricingModel.FLAT);
        prestation.setEnabled(true);
        return prestation;
    }

    private static ProviderTariff rate(Long userId, BigDecimal amount) {
        var rate = new ProviderTariff();
        rate.setUserId(userId);
        rate.setAmount(amount);
        rate.setPricingModel(PricingModel.HOURLY);
        rate.setServiceKey("cleaning-turnover");
        return rate;
    }

    private static Team team(Long id, Long personalUserId) {
        var team = new Team();
        team.setId(id);
        team.setPersonalUserId(personalUserId);
        return team;
    }

    private static TeamCoverageZone zone(Long teamId, String country, String department, String city) {
        var zone = new TeamCoverageZone();
        zone.setTeamId(teamId);
        zone.setCountry(country);
        zone.setDepartment(department);
        zone.setCity(city);
        return zone;
    }

    private static TeamWeeklyAvailability slot(Long teamId, short day, LocalTime start, LocalTime end) {
        var slot = new TeamWeeklyAvailability();
        slot.setTeamId(teamId);
        slot.setDayOfWeek(day);
        slot.setStartTime(start);
        slot.setEndTime(end);
        return slot;
    }

    private static ProviderDocument document(Long userId, ProviderDocument.DocumentType type, LocalDate expiresAt) {
        var document = new ProviderDocument();
        document.setUserId(userId);
        document.setDocumentType(type);
        document.setExpiresAt(expiresAt);
        document.setStatus(ProviderDocument.Status.APPROVED);
        return document;
    }
}
