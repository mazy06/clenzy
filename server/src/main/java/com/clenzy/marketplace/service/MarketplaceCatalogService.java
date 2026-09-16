package com.clenzy.marketplace.service;

import com.clenzy.marketplace.dto.*;
import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.Organization;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.UserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Lecture du catalogue de professionnels.
 *
 * <h2>Portee</h2>
 * <p>Ce service lit une table PLATEFORME : il ne connait pas de tenant et n'en
 * applique aucun. C'est l'autorisation du controleur appelant qui borne
 * l'acces. Aucune methode d'ecriture ici — la moderation vit dans
 * {@link MarketplaceModerationService}, la candidature publique dans
 * {@link MarketplaceApplicationService}.</p>
 *
 * <h2>Chargement par lot</h2>
 * <p>Prestations, zones et creneaux sont charges en trois requetes pour la page
 * entiere, puis regroupes en memoire. Les lire depuis chaque fiche aurait
 * produit trois requetes par carte — vingt-quatre cartes, soixante-douze
 * requetes.</p>
 */
@Service
public class MarketplaceCatalogService {

    private final MarketplaceProviderRepository providerRepository;
    private final MarketplaceProviderOfferRepository offerRepository;
    private final MarketplaceProviderZoneRepository zoneRepository;
    private final MarketplaceProviderAvailabilityRepository availabilityRepository;
    private final MarketplaceServiceCategoryRepository categoryRepository;
    private final MarketplaceServiceItemRepository serviceItemRepository;
    private final OrganizationRepository organizationRepository;
    private final MarketplaceProviderImportService importService;
    private final MarketplaceImportRepository importRepository;
    private final UserService userService;
    private final ProviderDocumentaryService documentary;
    private final Clock clock;

    public MarketplaceCatalogService(MarketplaceProviderRepository providerRepository,
                                     MarketplaceProviderOfferRepository offerRepository,
                                     MarketplaceProviderZoneRepository zoneRepository,
                                     MarketplaceProviderAvailabilityRepository availabilityRepository,
                                     MarketplaceServiceCategoryRepository categoryRepository,
                                     MarketplaceServiceItemRepository serviceItemRepository,
                                     OrganizationRepository organizationRepository,
                                     MarketplaceProviderImportService importService,
                                     MarketplaceImportRepository importRepository,
                                     UserService userService,
                                     Clock clock, ProviderDocumentaryService documentary) {
        this.documentary=documentary;
        this.providerRepository = providerRepository;
        this.offerRepository = offerRepository;
        this.zoneRepository = zoneRepository;
        this.availabilityRepository = availabilityRepository;
        this.categoryRepository = categoryRepository;
        this.serviceItemRepository = serviceItemRepository;
        this.organizationRepository = organizationRepository;
        this.importService = importService;
        this.importRepository = importRepository;
        this.userService = userService;
        this.clock = clock;
    }

    // ─── Referentiel ─────────────────────────────────────────────────────────

    /**
     * Referentiel complet : les metiers ET leurs prestations.
     *
     * <p>Servi en UN appel parce que le formulaire d'inscription et le filtre en
     * ont besoin ensemble. Deux appels separes auraient laisse l'interface
     * afficher des metiers sans leurs prestations le temps du second
     * aller-retour.</p>
     */
    @Transactional(readOnly = true)
    public List<ServiceCategoryDto> getCategories() {
        Map<String, List<ServiceItemDto>> itemsByCategory = serviceItemRepository
            .findAllActiveWithCategory().stream()
            .map(ServiceItemDto::from)
            .collect(Collectors.groupingBy(ServiceItemDto::categoryCode));

        return categoryRepository.findByActiveTrueOrderBySortOrderAsc().stream()
            .map(c -> ServiceCategoryDto.from(c, itemsByCategory.get(c.getCode())))
            .toList();
    }

    /** Villes couvertes, pour alimenter le filtre geographique de l'ecran. */
    @Transactional(readOnly = true)
    public List<String> getCoveredCities() {
        return zoneRepository.findDistinctCities();
    }

    // ─── Catalogue vu par une organisation ───────────────────────────────────

    /**
     * Recherche cote ORGANISATION.
     *
     * <p>Meme moteur de filtres que la console — metier, ville, disponibilite —
     * mais borne par ce que cette organisation a le droit de voir, et rendu dans
     * une vue SANS coordonnees : un catalogue qui exposerait l'adresse de chaque
     * prestataire serait un annuaire de prospection.</p>
     */
    @Transactional(readOnly = true)
    public CatalogPageDto searchCatalog(ProviderSearchCriteria criteria, Long organizationId,
                                        List<Long> hiddenIds) {
        return searchCatalog(criteria, organizationId, hiddenIds, null);
    }

    @Transactional(readOnly = true)
    public CatalogPageDto searchCatalog(ProviderSearchCriteria criteria, Long organizationId,
                                        List<Long> hiddenIds, com.clenzy.model.Property property) {
        LocalDate today = LocalDate.now(clock);
        var pageable = PageRequest.of(criteria.page(), criteria.size(), sortOf(criteria.sort()));

        Page<MarketplaceProvider> page = providerRepository.findAll(
            MarketplaceProviderSpecifications.from(criteria, today)
                .and(MarketplaceProviderSpecifications.visibleTo(organizationId, hiddenIds))
                .and(MarketplaceProviderSpecifications.covers(property)),
            pageable);

        List<MarketplaceProvider> providers = page.getContent();
        if (providers.isEmpty()) {
            return new CatalogPageDto(List.of(), page.getNumber(), page.getSize(),
                page.getTotalElements(), page.getTotalPages());
        }

        List<Long> ids = providers.stream().map(MarketplaceProvider::getId).toList();
        Map<Long, List<MarketplaceProviderOffer>> offersByProvider =
            groupBy(offerRepository.findActiveByProviderIds(ids), o -> o.getProvider().getId());
        Map<Long, List<MarketplaceProviderZoneRepository.EffectiveZone>> zonesByProvider =
            groupBy(zoneRepository.effectiveZones(ids), MarketplaceProviderZoneRepository.EffectiveZone::getProviderId);
        Set<Long> userIdsWithPhoto = resolveUserIdsWithPhoto(providers);

        List<CatalogProviderDto> items = providers.stream()
            .map(p -> toCatalogEntry(p,
                offersByProvider.getOrDefault(p.getId(), List.of()),
                zonesByProvider.getOrDefault(p.getId(), List.of()),
                userIdsWithPhoto,
                organizationId))
            .toList();

        return new CatalogPageDto(items, page.getNumber(), page.getSize(),
            page.getTotalElements(), page.getTotalPages());
    }

    /**
     * Fiche brute, pour trancher la visibilite.
     *
     * <p>L'entite et non le DTO : decider si une organisation a le droit de voir
     * une fiche demande son etat et son mode d'engagement, qu'aucune vue
     * publique ne porte — et pour cause.</p>
     */
    @Transactional(readOnly = true)
    public Optional<MarketplaceProvider> getProvider(Long id) {
        return providerRepository.findById(id);
    }

    /** Fiche detaillee cote organisation. Le controle de visibilite est fait par l'appelant. */
    @Transactional(readOnly = true)
    public Optional<CatalogProviderDto> getCatalogEntry(Long providerId, Long organizationId) {
        return providerRepository.findById(providerId)
            .map(p -> toCatalogEntry(p,
                offerRepository.findActiveByProviderIds(List.of(p.getId())),
                zoneRepository.effectiveZones(List.of(p.getId())),
                resolveUserIdsWithPhoto(List.of(p)),
                organizationId));
    }

    private CatalogProviderDto toCatalogEntry(MarketplaceProvider p,
                                              List<MarketplaceProviderOffer> offers,
                                              List<MarketplaceProviderZoneRepository.EffectiveZone> zones,
                                              Set<Long> userIdsWithPhoto,
                                              Long organizationId) {
        offers=offers.stream().filter(o -> documentary.hasReviewedScope(p.getId(),
                o.getServiceItem()!=null ? "ITEM:"+o.getServiceItem().getCode() : "CATEGORY:"+o.getCategory().getCode())).toList();
        List<String> coverageCities = zones.stream()
            .sorted((a, b) -> Boolean.compare(b.isPrimary(), a.isPrimary()))
            .map(MarketplaceProviderZoneRepository.EffectiveZone::getCity)
            .filter(city -> city != null && !city.isBlank())
            .distinct()
            .toList();

        List<String> categoryCodes = offers.stream()
            .map(o -> o.getCategory().getCode())
            .distinct()
            .toList();

        BigDecimal priceFrom = lowestPrice(offers);

        boolean own = organizationId != null && organizationId.equals(p.getHomeOrganizationId());

        return CatalogProviderDto.from(p,
            resolveAvatarUrl(p, userIdsWithPhoto),
            coverageCities,
            categoryCodes,
            offers.stream().map(ProviderOfferDto::from).toList(),
            priceFrom,
            own);
    }

    // ─── Recherche ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public ProviderPageDto search(ProviderSearchCriteria criteria) {
        LocalDate today = LocalDate.now(clock);
        var pageable = PageRequest.of(criteria.page(), criteria.size(), sortOf(criteria.sort()));

        Page<MarketplaceProvider> page = providerRepository.findAll(
            MarketplaceProviderSpecifications.from(criteria, today), pageable);

        List<MarketplaceProvider> providers = page.getContent();
        if (providers.isEmpty()) {
            return new ProviderPageDto(List.of(), page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
        }

        List<Long> ids = providers.stream().map(MarketplaceProvider::getId).toList();

        Map<Long, List<MarketplaceProviderOffer>> offersByProvider =
            groupBy(offerRepository.findActiveByProviderIds(ids), o -> o.getProvider().getId());
        Map<Long, List<MarketplaceProviderZoneRepository.EffectiveZone>> zonesByProvider =
            groupBy(zoneRepository.effectiveZones(ids), MarketplaceProviderZoneRepository.EffectiveZone::getProviderId);
        Map<Long, List<MarketplaceProviderAvailabilityRepository.EffectiveSlot>> slotsByProvider =
            groupBy(availabilityRepository.effectiveWeekly(ids.toArray(Long[]::new)), MarketplaceProviderAvailabilityRepository.EffectiveSlot::getProviderId);
        Set<Long> restrictedCalendars = new java.util.HashSet<>(availabilityRepository.restrictedProviderIds(ids));
        Map<Long, String> organizationNames = resolveOrganizationNames(providers);
        Map<Long, MarketplaceProviderRepository.ObservedMetrics> metrics = providerRepository.observedMetrics(ids.toArray(Long[]::new))
            .stream().collect(Collectors.toMap(MarketplaceProviderRepository.ObservedMetrics::getId, Function.identity()));
        Set<Long> userIdsWithPhoto = resolveUserIdsWithPhoto(providers);

        List<ProviderSummaryDto> items = providers.stream()
            .map(p -> toSummary(
                p,
                offersByProvider.getOrDefault(p.getId(), List.of()),
                zonesByProvider.getOrDefault(p.getId(), List.of()),
                slotsByProvider.getOrDefault(p.getId(), List.of()),
                restrictedCalendars.contains(p.getId()),
                organizationNames.get(p.getHomeOrganizationId()),
                userIdsWithPhoto,
                today, metrics.get(p.getId())))
            .toList();

        return new ProviderPageDto(items, page.getNumber(), page.getSize(),
            page.getTotalElements(), page.getTotalPages());
    }

    // ─── Fiche detaillee ─────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Optional<ProviderDetailDto> getDetail(Long id) {
        return providerRepository.findById(id).map(p -> {
            LocalDate today = LocalDate.now(clock);
            var metrics = providerRepository.observedMetrics(new Long[]{id}).stream().findFirst().orElse(null);
            var offers = offerRepository.findAllByProviderIdWithCategory(p.getId());
            var zones = zoneRepository.effectiveZones(List.of(p.getId()));
            var slots = availabilityRepository.effectiveWeekly(new Long[]{p.getId()});
            String organizationName = p.getHomeOrganizationId() == null ? null
                : organizationRepository.findById(p.getHomeOrganizationId())
                    .map(Organization::getName).orElse(null);

            return new ProviderDetailDto(
                p.getId(), p.getPublicRef().toString(),
                p.getDisplayName(), p.getLegalName(), p.getContactFirstName(), p.getContactLastName(),
                p.getEmail(), p.getPhone(), p.getWebsite(), p.getHeadline(), p.getBio(), resolveAvatarUrl(p, resolveUserIdsWithPhoto(List.of(p))),
                p.getBaseAddress(), p.getBaseCity(), p.getBasePostalCode(), p.getBaseCountryCode(),
                p.getLatitude(), p.getLongitude(), p.getTravelRadiusKm(), splitLanguages(p.getLanguages()),
                p.getStatus(), p.getEngagementMode(), p.getSource(),
                p.getHomeOrganizationId(), organizationName, p.getUserId(),
                p.getRegistrationNumber(), p.getVatNumber(), p.getInsuranceCompany(),
                p.getInsurancePolicyNumber(), p.getInsuranceExpiresAt(), p.getVigilanceExpiresAt(),
                p.hasComplianceAlert(today),
                p.getCurrency(), p.getMinimumCharge(), p.getTravelFee(), p.isAcceptsUrgent(),
                p.getLeadTimeHours(), p.getCancellationNoticeHours(),
                p.getRatingAvg(), p.getRatingCount(), metrics == null ? 0 : metrics.getCompleted(),
                metrics == null ? null : metrics.getPositiveResponsePct(), metrics == null ? null : metrics.getResponseMinutes(),
                p.getVerifiedAt() != null, p.getVerifiedAt(), p.getReviewNote(),
                p.getTermsVersion(), p.getTermsAcceptedAt(),
                p.getDecisionMessage(), p.getDecisionSentAt(),
                p.getEmailConfirmedAt(),
                p.getSubmittedAt(), p.getActivatedAt(), p.getSuspendedAt(), p.getLastActiveAt(),
                p.getCreatedAt(), p.getUpdatedAt(),
                offers.stream().map(ProviderOfferDto::from).toList(),
                zones.stream().map(ProviderZoneDto::from).toList(),
                slots.stream().map(ProviderAvailabilityDto::from).toList(),
                !availabilityRepository.restrictedProviderIds(List.of(p.getId())).isEmpty());
        });
    }

    /**
     * Volumes du catalogue par dimension de filtre.
     *
     * <p>Cinq agregations, servies en un appel et mises en cache cote interface :
     * le tiroir de filtres en a besoin d'un bloc, et cinq requetes separees
     * l'auraient fait s'afficher par morceaux.</p>
     */
    @Transactional(readOnly = true)
    public MarketplaceFacetsDto getFacets() {
        return new MarketplaceFacetsDto(
            toFacets(providerRepository.countProvidersByCategory()),
            toFacets(providerRepository.countProvidersByServiceItem()),
            toFacets(providerRepository.countProvidersByCity()),
            toFacets(providerRepository.countGroupedByStatus()),
            toFacets(providerRepository.countGroupedByEngagementMode()));
    }

    /**
     * Lignes {@code [clef, compte]} vers des facettes triees par volume
     * decroissant.
     *
     * <p>Le tri se fait ICI plutot que dans chaque requete : l'ordre est une
     * decision d'interface — on va d'abord la ou il y a du monde — et non une
     * propriete des donnees.</p>
     */
    private static List<MarketplaceFacetsDto.FacetCount> toFacets(List<Object[]> rows) {
        return rows.stream()
            .filter(row -> row[0] != null)
            .map(row -> new MarketplaceFacetsDto.FacetCount(
                String.valueOf(row[0]), ((Number) row[1]).longValue()))
            .sorted(Comparator.comparingLong(MarketplaceFacetsDto.FacetCount::count).reversed()
                .thenComparing(MarketplaceFacetsDto.FacetCount::key))
            .toList();
    }

    // ─── Compteurs de tete d'ecran ───────────────────────────────────────────

    @Transactional(readOnly = true)
    public MarketplaceStatsDto getStats() {
        // Trois requetes d'agregation plutot qu'un chargement complet : ces
        // compteurs s'affichent en permanence en tete d'ecran, et ramener tout
        // le catalogue en memoire pour les calculer aurait fait grossir le cout
        // de l'ecran avec le catalogue lui-meme.
        Map<ProviderStatus, Long> byStatus = new EnumMap<>(ProviderStatus.class);
        for (Object[] row : providerRepository.countGroupedByStatus()) {
            byStatus.put((ProviderStatus) row[0], (Long) row[1]);
        }

        Map<EngagementMode, Long> byMode = new EnumMap<>(EngagementMode.class);
        for (Object[] row : providerRepository.countGroupedByEngagementMode()) {
            byMode.put((EngagementMode) row[0], (Long) row[1]);
        }

        LocalDate threshold = LocalDate.now(clock).plusDays(30);

        return new MarketplaceStatsDto(
            providerRepository.count(),
            byStatus.getOrDefault(ProviderStatus.PENDING_REVIEW, 0L),
            byStatus.getOrDefault(ProviderStatus.ACTIVE, 0L),
            byStatus.getOrDefault(ProviderStatus.SUSPENDED, 0L),
            byStatus.getOrDefault(ProviderStatus.REJECTED, 0L),
            byStatus.getOrDefault(ProviderStatus.ARCHIVED, 0L),
            byMode.getOrDefault(EngagementMode.INDEPENDENT, 0L),
            byMode.getOrDefault(EngagementMode.AFFILIATED, 0L),
            byMode.getOrDefault(EngagementMode.EXCLUSIVE, 0L),
            providerRepository.countComplianceAlerts(threshold),
            importService.countImportable());
    }

    // ─── Assemblage ──────────────────────────────────────────────────────────

    private ProviderSummaryDto toSummary(MarketplaceProvider p,
                                         List<MarketplaceProviderOffer> offers,
                                         List<MarketplaceProviderZoneRepository.EffectiveZone> zones,
                                         List<MarketplaceProviderAvailabilityRepository.EffectiveSlot> slots,
                                         boolean weeklyRestricted,
                                         String organizationName,
                                         Set<Long> userIdsWithPhoto,
                                         LocalDate today, MarketplaceProviderRepository.ObservedMetrics metrics) {
        List<String> categoryCodes = offers.stream()
            .map(o -> o.getCategory().getCode())
            .distinct()
            .toList();

        // Zone principale en tete : c'est celle que la carte montre en premier.
        offers=offers.stream().filter(o -> documentary.hasReviewedScope(p.getId(),
                o.getServiceItem()!=null ? "ITEM:"+o.getServiceItem().getCode() : "CATEGORY:"+o.getCategory().getCode())).toList();
        List<String> coverageCities = zones.stream()
            .sorted(Comparator.comparing(MarketplaceProviderZoneRepository.EffectiveZone::isPrimary).reversed())
            .map(MarketplaceProviderZoneRepository.EffectiveZone::getCity)
            .filter(Objects::nonNull)
            .distinct()
            .toList();

        List<Short> availableDays = slots.stream()
            .map(MarketplaceProviderAvailabilityRepository.EffectiveSlot::getDayOfWeek)
            .distinct()
            .sorted()
            .toList();

        return new ProviderSummaryDto(
            p.getId(), p.getPublicRef().toString(),
            p.getDisplayName(), p.getLegalName(), p.getHeadline(), resolveAvatarUrl(p, userIdsWithPhoto),
            p.getEmail(), p.getPhone(),
            p.getBaseCity(), p.getBasePostalCode(), p.getBaseCountryCode(),
            p.getTravelRadiusKm(), coverageCities,
            p.getStatus(), p.getEngagementMode(), p.getHomeOrganizationId(), organizationName,
            categoryCodes, offers.size(), lowestPrice(offers), priceCurrency(offers, p.getCurrency()),
            p.getRatingAvg(), p.getRatingCount(), metrics == null ? 0 : metrics.getCompleted(),
            p.isAcceptsUrgent(), splitLanguages(p.getLanguages()),
            p.getVerifiedAt() != null, p.hasComplianceAlert(today),
            p.getInsuranceExpiresAt(), p.getVigilanceExpiresAt(),
            availableDays, weeklyRestricted,
            p.getSubmittedAt(), p.getCreatedAt());
    }

    /**
     * Plus bas prix affichable.
     *
     * <p>Les prestations sur devis sont ignorees : elles n'ont pas de montant, et
     * les compter comme zero afficherait « a partir de 0 € » sur une fiche qui
     * ne vend rien de gratuit.</p>
     */
    private static String priceCurrency(List<MarketplaceProviderOffer> offers, String fallback) {
        return offers.stream().filter(o -> o.getAmount() != null)
                .map(MarketplaceProviderOffer::getCurrency).findFirst().orElse(fallback);
    }

    private BigDecimal lowestPrice(List<MarketplaceProviderOffer> offers) {
        // Pas de comparaison numérique entre devises ou unités différentes.
        var priced = offers.stream().filter(o -> o.getAmount() != null && o.getPricingModel().requiresAmount()).toList();
        if (priced.stream().map(o -> o.getCurrency() + ":" + o.getPricingModel() + ":" + o.getUnitLabel()).distinct().count() > 1)
            return null;
        return offers.stream()
            .filter(o -> o.getAmount() != null && o.getPricingModel().requiresAmount())
            .map(MarketplaceProviderOffer::getAmount)
            .min(Comparator.naturalOrder())
            .orElse(null);
    }

    /**
     * Photo affichable de la fiche.
     *
     * <p>Une fiche rattachee a un compte emprunte l'URL SIGNEE de ce compte
     * plutot qu'une copie : {@code users.profile_picture_url} est une clef de
     * stockage, pas une adresse, et une copie se desynchroniserait des que la
     * personne change sa photo. Une fiche sans compte — candidature deposee
     * depuis le site public — garde la sienne.</p>
     */
    private String resolveAvatarUrl(MarketplaceProvider provider, Set<Long> userIdsWithPhoto) {
        if (provider.getUserId() != null && userIdsWithPhoto.contains(provider.getUserId())) {
            return userService.publicAvatarUrl(provider.getUserId());
        }
        // Fiche sans compte, ou compte sans photo : la carte retombe sur les
        // initiales, ce qui vaut mieux qu'une image cassee.
        return provider.getUserId() != null ? null : provider.getAvatarUrl();
    }

    /** Comptes lies de la page qui ont une photo, en une requete. */
    private Set<Long> resolveUserIdsWithPhoto(List<MarketplaceProvider> providers) {
        List<Long> userIds = providers.stream()
            .map(MarketplaceProvider::getUserId)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
        return userIds.isEmpty() ? Set.of()
            : Set.copyOf(importRepository.findUserIdsWithPhoto(userIds));
    }

    private Map<Long, String> resolveOrganizationNames(List<MarketplaceProvider> providers) {
        List<Long> orgIds = providers.stream()
            .map(MarketplaceProvider::getHomeOrganizationId)
            .filter(Objects::nonNull)
            .distinct()
            .toList();
        if (orgIds.isEmpty()) return Map.of();
        return organizationRepository.findAllById(orgIds).stream()
            .collect(Collectors.toMap(Organization::getId, Organization::getName));
    }

    private static <T> Map<Long, List<T>> groupBy(List<T> rows, Function<T, Long> key) {
        return rows.stream().collect(Collectors.groupingBy(key));
    }

    static List<String> splitLanguages(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
    }

    /**
     * Tri demande, avec un defaut explicite.
     *
     * <p>Les fiches sans note passent en dernier plutot qu'en tete : PostgreSQL
     * classe les valeurs nulles en premier sur un tri descendant, ce qui aurait
     * mis les professionnels jamais notes devant les mieux notes.</p>
     */
    static Sort sortOf(String sort) {
        if (sort == null) return Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        return switch (sort) {
            case "name" -> Sort.by(Sort.Order.asc("displayName").ignoreCase(), Sort.Order.desc("id"));
            // Le placement explicite des NULL est porté par Criteria, pas par Sort.NullHandling.
            case "rating" -> Sort.unsorted();
            case "missions" -> Sort.unsorted();
            default -> Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        };
    }
}
