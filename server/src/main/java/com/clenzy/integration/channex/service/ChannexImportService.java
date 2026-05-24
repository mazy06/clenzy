package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexCreateRatePlanRequest;
import com.clenzy.integration.channex.dto.ChannexCreateRoomTypeRequest;
import com.clenzy.integration.channex.dto.ChannexDiscoveredProperty;
import com.clenzy.integration.channex.dto.ChannexConnectedOta;
import com.clenzy.integration.channex.dto.ChannexPropertyOtaSync;
import com.clenzy.integration.channex.dto.ChannexCreatePropertyRequest;
import com.clenzy.integration.channex.dto.ChannexDiscoveryResponse;
import com.clenzy.integration.channex.dto.ChannexOauthSetupResponse;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
import com.clenzy.integration.channex.dto.ChannexImportRequest;
import com.clenzy.integration.channex.dto.ChannexImportResult;
import com.clenzy.integration.channex.dto.ChannexRatePlanDto;
import com.clenzy.integration.channex.dto.ChannexRoomTypeDto;
import com.clenzy.integration.channex.exception.ChannexException;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.LengthOfStayDiscount;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyPhoto;
import com.clenzy.model.PropertyStatus;
import com.clenzy.model.PropertyType;
import com.clenzy.model.User;
import com.clenzy.repository.LengthOfStayDiscountRepository;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.AmenityManagementService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Import bulk de properties Channex existantes vers Clenzy (discovery).
 *
 * <p><b>Cas d'usage</b> : apres OAuth Airbnb (via le picker + iframe sur une
 * property Clenzy existante), Channex cree automatiquement des properties pour
 * tous les listings Airbnb detectes dans le compte de l'utilisateur. Ces
 * properties Channex ne sont pas encore connectees a Clenzy. Ce service permet
 * de les detecter et de les importer en masse comme Properties Clenzy.</p>
 *
 * <p><b>Flow utilisateur</b> :</p>
 * <ol>
 *   <li>L'admin clique "Importer depuis Channex" dans la UI Clenzy</li>
 *   <li>Frontend appelle {@link #discoverUnmappedProperties}</li>
 *   <li>Modal affiche les properties Channex non-mappees avec checkboxes</li>
 *   <li>L'admin coche + override les types Clenzy → POST {@link #importProperties}</li>
 *   <li>Pour chaque coche : creation Property Clenzy + ChannexPropertyMapping</li>
 * </ol>
 */
@Service
public class ChannexImportService {

    private static final Logger log = LoggerFactory.getLogger(ChannexImportService.class);

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;
    private final PropertyRepository propertyRepository;
    private final PropertyPhotoRepository propertyPhotoRepository;
    private final ChannexConnectService connectService;
    private final UserRepository userRepository;
    private final LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    private final ObjectMapper objectMapper;
    private final AmenityManagementService amenityManagementService;

    /** HttpClient reuse pour le scrape Airbnb (og:title). Pool persistant + suit redirects. */
    private final HttpClient httpClient = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NORMAL)
        .connectTimeout(Duration.ofSeconds(5))
        .build();

    public ChannexImportService(ChannexClient channexClient,
                                  ChannexPropertyMappingRepository mappingRepository,
                                  PropertyRepository propertyRepository,
                                  PropertyPhotoRepository propertyPhotoRepository,
                                  ChannexConnectService connectService,
                                  UserRepository userRepository,
                                  LengthOfStayDiscountRepository lengthOfStayDiscountRepository,
                                  ObjectMapper objectMapper,
                                  AmenityManagementService amenityManagementService) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
        this.propertyRepository = propertyRepository;
        this.propertyPhotoRepository = propertyPhotoRepository;
        this.connectService = connectService;
        this.userRepository = userRepository;
        this.lengthOfStayDiscountRepository = lengthOfStayDiscountRepository;
        this.objectMapper = objectMapper;
        this.amenityManagementService = amenityManagementService;
    }

    /**
     * Donnees structurees d'un channel actif Channex, indexees par propertyId.
     * Extraites depuis {@code attributes.rate_plans[0].settings.*} — TOUTES
     * ces valeurs sont des champs structures de l'API Channex, pas du scraping.
     * Si Channex ne les fournit pas (rate_plan absent / channel inactif), les
     * champs sont {@code null} (pas de fabrication).
     */
    private record ChannelListingInfo(
        // Identite OTA
        String otaName,             // "AirBNB", "BookingCom", ...
        String listingId,           // settings.listing_id (ex Airbnb: "1512384244344462850")
        String channelId,           // ID du channel Channex (necessaire pour API whitelabel)
        String listingType,         // settings.listing_type ("house", "apartment", ...)

        // Tarifs (pricing_setting)
        BigDecimal defaultPrice,    // pricing_setting.default_daily_price
        BigDecimal weekendPrice,    // pricing_setting.weekend_price
        String currency,            // pricing_setting.listing_currency
        Integer guestsIncluded,     // pricing_setting.guests_included (BASE, pas max)
        BigDecimal pricePerExtraPerson, // pricing_setting.price_per_extra_person
        Double weeklyPriceFactor,   // pricing_setting.weekly_price_factor
        Double monthlyPriceFactor,  // pricing_setting.monthly_price_factor

        // Sejour (availability_rule)
        Integer minNights,          // availability_rule.default_min_nights
        Integer maxNights,          // availability_rule.default_max_nights

        // Reservation (booking_setting)
        String checkInTimeStart,    // booking_setting.check_in_time_start ("FLEXIBLE" ou heure)
        String checkInTimeEnd,      // booking_setting.check_in_time_end
        Integer checkOutTime,       // booking_setting.check_out_time (heure, ex: 11)
        String cancellationPolicy,  // booking_setting.cancellation_policy_settings.cancellation_policy_category
        String instantBookingPolicy,// booking_setting.instant_booking_allowed_category

        // Regles du logement (guest_controls)
        Boolean allowsPets,         // guest_controls.allows_pets_as_host
        Boolean allowsSmoking,      // guest_controls.allows_smoking_as_host
        Boolean allowsEvents        // guest_controls.allows_events_as_host
    ) {}

    /**
     * Liste les properties Channex qui n'ont pas encore de mapping local Clenzy.
     *
     * <p>Strategie : GET /properties Channex (toutes les properties du compte) puis
     * filtre celles dont l'UUID n'apparait dans aucun ChannexPropertyMapping de
     * cette organisation.</p>
     */
    public ChannexDiscoveryResponse discoverUnmappedProperties(Long orgId) {
        // 1. Recupere toutes les properties cote Channex (raw JsonNode pour acceder
        //    aux relationships qui ne sont pas dans nos DTOs).
        JsonNode raw = channexClient.fetchAllPropertiesRaw();
        if (raw == null || !raw.path("data").isArray()) {
            return ChannexDiscoveryResponse.of(List.of(), 0);
        }
        int totalInHub = raw.path("data").size();

        // 2. Map des UUIDs Channex deja mappes dans Clenzy pour cette org → infos Property Clenzy
        Map<String, com.clenzy.integration.channex.model.ChannexPropertyMapping> mappingsByChannexId = new HashMap<>();
        for (com.clenzy.integration.channex.model.ChannexPropertyMapping m
                : mappingRepository.findAllByOrgId(orgId)) {
            mappingsByChannexId.put(m.getChannexPropertyId(), m);
        }

        // 3. Resoudre les noms des Property Clenzy pour les mappings existants
        Map<Long, String> clenzyPropertyNames = new HashMap<>();
        for (var mapping : mappingsByChannexId.values()) {
            propertyRepository.findById(mapping.getClenzyPropertyId())
                .ifPresent(p -> clenzyPropertyNames.put(p.getId(), p.getName()));
        }

        // 4. Construit le map propertyId → List<OTAs> via les channels du hub
        //    (un channel par OTA, lie a 1+ properties via attributes.properties[]).
        // Map propertyId → infos OTA enrichies (otaName, listingId, pricing)
        // — utilise plus bas pour overrider le titre technique des pivots et
        // afficher le vrai nom de la listing (scrape Airbnb).
        Map<String, ChannelListingInfo> listingInfoByPropertyId = buildListingInfoMap();

        Map<String, List<ChannexPropertyOtaSync>> otasByPropertyId = new HashMap<>();
        JsonNode channelsRaw = channexClient.fetchAllChannelsRaw();
        if (channelsRaw != null && channelsRaw.path("data").isArray()) {
            for (JsonNode ch : channelsRaw.path("data")) {
                JsonNode chAttrs = ch.path("attributes");
                String otaName = chAttrs.path("channel").asText("");
                if (otaName.isEmpty()) continue;
                boolean chActive = chAttrs.path("is_active").asBoolean(false);
                boolean chHasToken = chAttrs.path("settings").path("tokens")
                    .path("access_token").isTextual();

                Set<String> propIds = new HashSet<>();
                JsonNode propsArr = chAttrs.path("properties");
                if (propsArr.isArray()) {
                    for (JsonNode pid : propsArr) propIds.add(pid.asText(""));
                }
                JsonNode rels = ch.path("relationships").path("properties").path("data");
                if (rels.isArray()) {
                    for (JsonNode r : rels) propIds.add(r.path("id").asText(""));
                }
                for (String pid : propIds) {
                    if (pid.isEmpty()) continue;
                    otasByPropertyId
                        .computeIfAbsent(pid, k -> new ArrayList<>())
                        .add(new ChannexPropertyOtaSync(otaName, chActive, chHasToken));
                }
            }
        }

        // 5. Transforme en DTOs : on garde TOUTES les properties (importees + non),
        //    chacune avec un flag isImported pour distinguer cote UI.
        List<ChannexDiscoveredProperty> result = new ArrayList<>();
        for (JsonNode prop : raw.path("data")) {
            String channexId = prop.path("id").asText(null);
            if (channexId == null) continue;

            JsonNode attrs = prop.path("attributes");
            String title = attrs.path("title").asText("");

            // Filtrer les properties techniques Clenzy (containers OAuth) :
            //  - "[Clenzy Hub] OAuth Bridge" : container legacy partage
            //  - "[Clenzy] OAuth Container ..." : pivot consomme (rename apres usage)
            // Strategie unifiee : un pivot devient IMPORTABLE des qu'il a un OTA
            // actif (= l'utilisateur a mappe au moins un listing Airbnb/Booking/
            // Vrbo sur sa room dans le wizard Channex). Sinon il reste cache
            // (dormant). Le user pourra alors l'importer dans Clenzy en lui
            // donnant un vrai nom (Channex ne propose pas de creer une nouvelle
            // property inline dans son wizard de mapping).
            boolean isPivot = title.startsWith("[Clenzy Hub]") || title.startsWith("[Clenzy]");

            // Verifier si OTA actif sur cette property (best-effort).
            // Pour les pivots : conditionne la visibilite (cf. filtre ci-dessous).
            // Pour les autres : info contextuelle pour le user.
            boolean hasOta = false;
            try {
                hasOta = channexClient.hasActiveOtaChannel(channexId);
            } catch (Exception e) {
                log.debug("ChannexImport: check OTA actif KO pour {} : {}", channexId, e.getMessage());
            }

            // Pivot sans OTA actif = container dormant cree pour faciliter un
            // OAuth qui n'a pas encore donne lieu a un mapping. On le cache.
            if (isPivot && !hasOta) {
                continue;
            }

            String currency = attrs.path("currency").asText("EUR");
            String country = attrs.path("country").asText("FR");
            String timezone = attrs.path("timezone").asText("Europe/Paris");
            Integer maxOcc = attrs.has("max_count_of_occupancies")
                ? attrs.get("max_count_of_occupancies").asInt() : null;

            // Verifier la presence de room_type / rate_plan (info pour l'admin :
            // s'ils sont absents, l'import les creera automatiquement).
            boolean hasRoomType = false;
            boolean hasRatePlan = false;
            try {
                hasRoomType = !channexClient.fetchRoomTypesForProperty(channexId).isEmpty();
                hasRatePlan = !channexClient.fetchRatePlansForProperty(channexId).isEmpty();
            } catch (Exception e) {
                log.debug("ChannexImport: check structures KO pour {} : {}", channexId, e.getMessage());
            }

            // Indicateurs de richesse du contenu Channex (anticipe le tier payant
            // qui sync depuis Airbnb : photos, description, address rempliront ces
            // flags et le frontend les affichera avec un compteur visuel).
            JsonNode content = attrs.path("content");
            JsonNode photos = content.path("photos");
            int photoCount = photos.isArray() ? photos.size() : 0;
            String desc = content.path("description").asText(null);
            boolean hasDescription = desc != null && !desc.isBlank();
            String address = attrs.path("address").asText(null);
            boolean hasAddress = address != null && !address.isBlank();

            // Flag isImported : true si cette property hub a deja un mapping local
            var mapping = mappingsByChannexId.get(channexId);
            boolean isImported = mapping != null;
            Long clenzyId = isImported ? mapping.getClenzyPropertyId() : null;
            String clenzyName = isImported ? clenzyPropertyNames.get(clenzyId) : null;

            List<ChannexPropertyOtaSync> connectedOtasForProp =
                otasByPropertyId.getOrDefault(channexId, List.of());

            // UX : pour un pivot mappé à une listing OTA, on remplace le titre
            // technique ([Clenzy Hub] OAuth Bridge) par le VRAI nom de la
            // listing — recupere via scrape de la page Airbnb publique (Channex
            // ne l'expose pas via l'API publique). Et on prefere la capacite
            // explicite Airbnb (og:description "Jusqu'a X voyageurs").
            String displayTitle = title;
            String listingTypeRaw = null;
            ChannelListingInfo info = listingInfoByPropertyId.get(channexId);
            if (info != null) {
                listingTypeRaw = info.listingType();
            }
            if (isPivot) {
                if (info != null && "AirBNB".equalsIgnoreCase(info.otaName())) {
                    // resolveListingData : prefere l'API whitelabel si dispo
                    // (capability CHANNEL_DETAILS), sinon scrape Airbnb JSON-LD.
                    AirbnbListingData data = resolveListingData(info);
                    displayTitle = data != null && data.name() != null
                        ? data.name()
                        : "Listing AirBNB #" + info.listingId();
                } else if (info != null) {
                    displayTitle = "Listing " + info.otaName() + " #" + info.listingId();
                } else {
                    displayTitle = "Pivot OAuth (sans listing mappee)";
                }
            }
            // maxOccupancy reste celui de la property Channex (donnee structuree).
            // Pour un pivot c'est notre defaut (10) — pas reliable mais c'est ce
            // que Channex nous donne. Bedrooms/beds/bathrooms ne sont PAS dispo
            // via l'API publique (whitelabel-only) → on les laisse null.
            Integer displayMaxOcc = maxOcc;
            // Type Clenzy suggere : mapping prioritaire depuis listing_type OTA
            // (donnee structuree, plus fiable que parser le titre). Fallback
            // sur l'heuristique titre si l'OTA ne nous donne rien.
            String suggested = suggestPropertyTypeFromOta(listingTypeRaw);
            if (suggested == null) {
                suggested = suggestPropertyType(displayTitle);
            }

            result.add(new ChannexDiscoveredProperty(
                channexId, displayTitle, currency, country, timezone, displayMaxOcc, suggested,
                hasOta, hasRoomType, hasRatePlan,
                photoCount, hasDescription, hasAddress,
                isImported, clenzyId, clenzyName,
                connectedOtasForProp,
                listingTypeRaw,
                info != null ? info.defaultPrice() : null,
                info != null ? info.weekendPrice() : null,
                info != null ? info.guestsIncluded() : null,
                info != null ? info.pricePerExtraPerson() : null,
                info != null ? info.weeklyPriceFactor() : null,
                info != null ? info.monthlyPriceFactor() : null,
                info != null ? info.minNights() : null,
                info != null ? info.maxNights() : null,
                info != null ? info.checkInTimeStart() : null,
                info != null ? info.checkInTimeEnd() : null,
                info != null ? info.checkOutTime() : null,
                info != null ? info.cancellationPolicy() : null,
                info != null ? info.instantBookingPolicy() : null,
                info != null ? info.allowsPets() : null,
                info != null ? info.allowsSmoking() : null,
                info != null ? info.allowsEvents() : null));
        }

        long unmappedCount = result.stream().filter(p -> !p.isImported()).count();
        log.info("ChannexImport: discovery org={} -> {} non-importees + {} importees (sur {} totales hub)",
            orgId, unmappedCount, result.size() - unmappedCount, totalInHub);
        return ChannexDiscoveryResponse.of(result, totalInHub);
    }

    /**
     * Importe les properties Channex selectionnees comme Properties Clenzy.
     *
     * <p>Pour chaque ID Channex :</p>
     * <ol>
     *   <li>Verifie qu'aucun mapping n'existe deja (idempotent — skip si oui)</li>
     *   <li>Recupere les details Channex via API pour auto-filler la Property</li>
     *   <li>Cree la Property Clenzy + sauvegarde</li>
     *   <li>Cree le ChannexPropertyMapping (sync_status=PENDING)</li>
     * </ol>
     *
     * <p>Si une etape echoue pour un ID, on continue avec les suivants (best-effort).
     * Le resultat detaille le statut de chaque ID.</p>
     */
    @Transactional
    public ChannexImportResult importProperties(Long orgId, ChannexImportRequest request,
                                                  String requesterKeycloakId,
                                                  boolean isPlatformStaff) {
        List<ChannexImportResult.Item> details = new ArrayList<>();
        int created = 0;
        int skipped = 0;
        int errors = 0;

        // Resolve current user (besoin pour audit + fallback owner si pas d'override)
        if (requesterKeycloakId == null || requesterKeycloakId.isBlank()) {
            throw new IllegalStateException(
                "Import Channex impossible : identite utilisateur manquante dans le JWT.");
        }
        User currentUser = userRepository.findByKeycloakId(requesterKeycloakId)
            .orElseThrow(() -> new IllegalStateException(
                "Import Channex impossible : aucun User Clenzy pour keycloakId="
                + requesterKeycloakId + ". Verifiez que le compte est bien provisionne."));

        // ─── Resolution org + owner cibles ──────────────────────────────────
        // Override autorise uniquement pour platform staff (SUPER_ADMIN/SUPER_MANAGER).
        // Pour les autres roles, target* sont ignores et on prend les valeurs
        // du contexte courant (= self attribution dans l'org courante).
        final Long resolvedOrgId;
        final User owner;
        if (isPlatformStaff
            && (request.targetOrganizationId() != null || request.targetOwnerId() != null)) {
            // Cas override : staff veut reattribuer. Les deux champs DOIVENT etre
            // fournis ensemble pour eviter les incoherences (ex: owner de l'org A
            // attribue a une property de l'org B).
            if (request.targetOrganizationId() == null) {
                throw new IllegalArgumentException(
                    "targetOrganizationId est requis si targetOwnerId est fourni.");
            }
            if (request.targetOwnerId() == null) {
                throw new IllegalArgumentException(
                    "targetOwnerId est requis si targetOrganizationId est fourni.");
            }
            resolvedOrgId = request.targetOrganizationId();
            owner = userRepository.findById(request.targetOwnerId())
                .orElseThrow(() -> new IllegalStateException(
                    "Owner cible introuvable : userId=" + request.targetOwnerId()));
            // Coherence : le user cible DOIT appartenir a l'org cible.
            if (owner.getOrganizationId() == null
                || !owner.getOrganizationId().equals(resolvedOrgId)) {
                throw new IllegalArgumentException(
                    "Incoherence : l'user " + owner.getId() + " (org="
                    + owner.getOrganizationId() + ") n'appartient pas a l'org cible "
                    + resolvedOrgId + ".");
            }
            log.info("ChannexImport[STAFF-OVERRIDE] requester={} → cible org={} owner={}",
                currentUser.getId(), resolvedOrgId, owner.getId());
        } else {
            // Cas standard : utilise le contexte courant + l'user qui a clique.
            // Si non-staff a tente de fournir target* on log un warning.
            if (!isPlatformStaff
                && (request.targetOrganizationId() != null || request.targetOwnerId() != null)) {
                log.warn("ChannexImport: champs target* ignores pour user non-staff {}",
                    currentUser.getId());
            }
            resolvedOrgId = orgId;
            owner = currentUser;
        }
        // Remplace l'orgId du parametre par celui resolu (override staff peut
        // changer la cible).
        orgId = resolvedOrgId;

        // Pre-fetch les channels OTA pour resoudre listing_id + pricing en bloc
        // (utile au moment de nommer + setter le tarif de chaque Property Clenzy).
        Map<String, ChannelListingInfo> listingInfoByPropertyId = buildListingInfoMap();

        // Pre-charge les aliases admin + ignored de l'org : appliques au moment
        // de classer les amenities scrapees (cf. resolveAmenities()).
        Map<String, String> userAliases = amenityManagementService.loadAliasesByOrg(orgId);
        Set<String> userIgnored = amenityManagementService.loadIgnoredByOrg(orgId);

        for (ChannexImportRequest.Item item : request.imports()) {
            String channexId = item.channexPropertyId();
            try {
                // Idempotence : si deja mappe, skip
                if (mappingRepository.findByChannexPropertyId(channexId, orgId).isPresent()) {
                    details.add(new ChannexImportResult.Item(channexId,
                        "SKIPPED_ALREADY_MAPPED", null, "Mapping existant"));
                    skipped++;
                    continue;
                }

                // Fetch les details Channex pour auto-filler la Property
                JsonNode channexProp = channexClient.fetchPropertyRaw(channexId);
                if (channexProp == null) {
                    throw new ChannexException(ChannexException.Kind.NOT_FOUND,
                        "Property Channex " + channexId + " introuvable");
                }
                JsonNode attrs = channexProp.path("data").path("attributes");

                // 1. Resoudre (ou creer) le room_type Channex
                //    Sans room_type, push availability/rates est impossible.
                String title = attrs.path("title").asText("Sans titre");
                int maxOccupancy = attrs.has("max_count_of_occupancies")
                    ? attrs.get("max_count_of_occupancies").asInt() : 2;

                String roomTypeId = resolveOrCreateRoomType(channexId, title, maxOccupancy);

                // 2. Resoudre (ou creer) le rate_plan Channex
                //    Sans rate_plan, push rates est impossible.
                String currency = attrs.path("currency").asText("EUR");
                String ratePlanId = resolveOrCreateRatePlan(channexId, roomTypeId, currency, maxOccupancy);

                // 3. Creer Property Clenzy auto-fillee depuis les data STRUCTUREES
                // Channex (rate_plan). Le nom textuel est le SEUL champ pour lequel
                // on scrape la page Airbnb publique (Channex non-whitelabel ne le
                // donne pas). Tout le reste vient des structures fiables.
                ChannelListingInfo info = listingInfoByPropertyId.get(channexId);
                boolean isPivotImport = title.startsWith("[Clenzy]")
                    || title.startsWith("[Clenzy Hub]");
                String displayTitle;
                AirbnbListingData airbnbData = null;
                if (isPivotImport) {
                    if (info != null && "AirBNB".equalsIgnoreCase(info.otaName())) {
                        // resolveListingData : whitelabel d'abord, fallback scrape
                        airbnbData = resolveListingData(info);
                    }
                    if (airbnbData != null && airbnbData.name() != null) {
                        displayTitle = airbnbData.name();
                    } else if (info != null) {
                        displayTitle = "Listing " + info.otaName() + " #" + info.listingId();
                    } else {
                        displayTitle = "Property a renommer (OAuth import)";
                    }
                } else {
                    displayTitle = title;
                }

                // Enrichment Channex API : room_type detail (capacites fiables)
                // + hotel_policies (horaires, pets, smoking). Ces 2 endpoints
                // exposent les valeurs structurees SAISIES dans le wizard
                // Channex — bien plus fiables que les defaults qu'on met sur
                // le pivot. Pour un pivot pur c'est notre default, pour une
                // vraie property creee dans le wizard c'est les valeurs reelles.
                com.clenzy.integration.channex.dto.ChannexRoomTypeDetailDto roomDetail =
                    channexClient.fetchRoomTypeDetail(roomTypeId);
                List<com.clenzy.integration.channex.dto.ChannexHotelPolicyDto> hotelPolicies =
                    channexClient.fetchHotelPoliciesForProperty(channexId);

                Property prop = new Property();
                prop.setOrganizationId(orgId);
                prop.setOwner(owner);
                prop.setName(displayTitle);
                // Currency : prefere celle du rate_plan OTA si dispo (ex EUR pour
                // un listing Airbnb FR), sinon celle de la property Channex.
                String resolvedCurrency = (info != null && info.currency() != null)
                    ? info.currency() : currency;
                prop.setDefaultCurrency(resolvedCurrency);
                // Capacite : priorite room_type.occ_* > hotel_policy.max_count_of_guests
                // > property.max_count_of_occupancies (fallback).
                int resolvedMaxGuests = maxOccupancy;
                if (roomDetail != null && roomDetail.resolveMaxGuests() != null) {
                    resolvedMaxGuests = roomDetail.resolveMaxGuests();
                } else if (!hotelPolicies.isEmpty()
                    && hotelPolicies.get(0).maxCountOfGuests() != null) {
                    resolvedMaxGuests = hotelPolicies.get(0).maxCountOfGuests();
                }
                prop.setMaxGuests(resolvedMaxGuests);
                prop.setType(parsePropertyType(item.propertyType()));
                prop.setStatus(PropertyStatus.ACTIVE);

                // --- Tarifs + sejour : extraits du rate_plan OTA mappe (structure) ---
                if (info != null) {
                    if (info.defaultPrice() != null) {
                        prop.setNightlyPrice(info.defaultPrice());
                    }
                    if (info.minNights() != null && info.minNights() > 0) {
                        prop.setMinimumNights(info.minNights());
                    }
                    // Lien retour vers la fiche Airbnb publique (pour affichage UX)
                    if ("AirBNB".equalsIgnoreCase(info.otaName())) {
                        prop.setAirbnbListingId(info.listingId());
                        prop.setAirbnbUrl("https://www.airbnb.com/rooms/" + info.listingId());
                    }
                }

                // --- Localisation (address est NOT NULL en BDD : fallback safe) ---
                String addressFromChannex = attrs.path("address").asText(null);
                prop.setAddress(addressFromChannex != null && !addressFromChannex.isBlank()
                    ? addressFromChannex
                    : "Adresse a completer");
                prop.setCity(emptyToNull(attrs.path("city").asText(null)));
                prop.setPostalCode(emptyToNull(attrs.path("zip_code").asText(null)));
                prop.setCountryCode(attrs.path("country").asText("FR"));
                // Coordonnees GPS : Channex les stocke en string, on parse en BigDecimal
                prop.setLatitude(parseBigDecimal(attrs.path("latitude").asText(null)));
                prop.setLongitude(parseBigDecimal(attrs.path("longitude").asText(null)));

                // --- Contenu (description) : prefere property.content.description,
                //     fallback room_type.content.description (Channex stocke parfois
                //     les contenus au niveau room plutot que property pour les
                //     vacation rentals single-room).
                JsonNode content = attrs.path("content");
                String description = content.path("description").asText(null);
                if ((description == null || description.isBlank()) && roomDetail != null
                    && roomDetail.content() != null) {
                    description = roomDetail.content().path("description").asText(null);
                }
                if (description != null && !description.isBlank()) {
                    prop.setDescription(description);
                }

                // --- bedroom : depuis room_type.count_of_rooms si dispo
                //     (donnee structuree Channex saisie au wizard).
                //     bathroom : Channex public ne l'expose pas → defaut 1.
                int resolvedBedrooms = roomDetail != null && roomDetail.countOfRooms() != null
                    && roomDetail.countOfRooms() > 0
                    ? roomDetail.countOfRooms() : 1;
                prop.setBedroomCount(resolvedBedrooms);
                prop.setBathroomCount(1);

                // --- check-in/out : depuis hotel_policies si renseigne
                //     (sinon defaults Property = 15:00/11:00).
                if (!hotelPolicies.isEmpty()) {
                    var hp = hotelPolicies.get(0);
                    if (hp.checkinTime() != null && !hp.checkinTime().isBlank()) {
                        prop.setDefaultCheckInTime(hp.checkinTime());
                    }
                    if (hp.checkoutTime() != null && !hp.checkoutTime().isBlank()) {
                        prop.setDefaultCheckOutTime(hp.checkoutTime());
                    }
                }
                // Fallback : rate_plan.booking_setting.check_out_time donne aussi
                // l'heure de checkout (entier ex 11 → "11:00").
                if ((hotelPolicies.isEmpty() || hotelPolicies.get(0).checkoutTime() == null)
                    && info != null && info.checkOutTime() != null) {
                    prop.setDefaultCheckOutTime(String.format("%02d:00", info.checkOutTime()));
                }

                // --- Amenities : depuis JSON-LD Schema.org de la page Airbnb.
                //     Classification en 3 buckets :
                //       1. mappees (built-in static + alias admin) → `amenities`
                //       2. ignorees (admin) → silencieusement droppees
                //       3. non mappees restantes → `ota_raw_amenities`
                //          (pour review via UI Settings > Commodites OTA)
                ResolvedAmenities resolvedAmenities = resolveAmenitiesWithUserConfig(
                    airbnbData, userAliases, userIgnored);
                if (airbnbData != null) {
                    try {
                        if (!resolvedAmenities.mapped.isEmpty()) {
                            prop.setAmenities(objectMapper.writeValueAsString(resolvedAmenities.mapped));
                        }
                        if (!resolvedAmenities.stillUnmapped.isEmpty()) {
                            prop.setOtaRawAmenities(
                                objectMapper.writeValueAsString(resolvedAmenities.stillUnmapped));
                        }
                    } catch (Exception e) {
                        log.warn("ChannexImport: serialisation amenities KO property={} : {}",
                            channexId, e.getMessage());
                    }
                }

                prop = propertyRepository.save(prop);

                // 4. Importer les photos Channex (URLs externes, pas de download bytea).
                //    Source 1 : property.content.photos (photos uploadees au niveau property)
                //    Source 2 : room_type.content.photos (photos liees au room)
                //    Source 3 : endpoint plat /photos?filter[property_id]=... (cross-check)
                int photoCount = importPhotos(prop, orgId, content.path("photos"));
                if (roomDetail != null && roomDetail.content() != null) {
                    photoCount += importPhotos(prop, orgId, roomDetail.content().path("photos"));
                }
                // Cross-check avec l'endpoint plat /photos (best-effort).
                // Channex ne sync PAS automatiquement les photos OTA, mais l'admin
                // peut en avoir uploade via API/wizard sans qu'elles soient dans
                // content.photos. On les rapatrie ici.
                try {
                    var flatPhotos = channexClient.fetchPhotosForProperty(channexId);
                    if (!flatPhotos.isEmpty()) {
                        // Convertit en JsonNode pour reutiliser importPhotos
                        var photosArray = objectMapper.valueToTree(flatPhotos);
                        photoCount += importPhotos(prop, orgId, photosArray);
                    }
                } catch (Exception e) {
                    log.debug("ChannexImport: fetch flat photos KO property={} : {}",
                        channexId, e.getMessage());
                }

                // 5. Creer le mapping Channex avec les 3 IDs resolus
                ChannexPropertyMapping mapping = new ChannexPropertyMapping();
                mapping.setOrganizationId(orgId);
                mapping.setClenzyPropertyId(prop.getId());
                mapping.setChannexPropertyId(channexId);
                mapping.setChannexRoomTypeId(roomTypeId);
                mapping.setChannexDefaultRatePlanId(ratePlanId);
                mapping.setSyncStatus(ChannexSyncStatus.PENDING);
                mappingRepository.save(mapping);

                // 6. Creer les LengthOfStayDiscount (= campagnes de prix
                //    longue-duree) depuis les facteurs Channex :
                //      - weekly_price_factor  → discount [7, 27] nuits
                //      - monthly_price_factor → discount [28, +∞[ nuits
                //    Les facteurs Channex sont des pourcentages de remise.
                //    On ne cree QUE si > 0 (skip "0" qui signifie pas de remise).
                int discountsCreated = createLengthOfStayDiscounts(prop, orgId, info);

                // 7. Pull initial des reservations OTA (Airbnb / Booking / Vrbo).
                //    Plage : [1er janvier annee courante → aujourd'hui + 12 mois]
                //      - Passe : toutes les reservations de l'annee fiscale en
                //        cours (declaration LMNP / compta : on a besoin du
                //        passe de l'annee meme apres l'import).
                //      - Futur : 12 mois d'avenir pour la visibilite calendrier.
                //    Best-effort : un echec ici ne doit pas faire planter
                //    l'import (la property est deja creee). L'admin peut
                //    re-trigger un pull manuel depuis le module Channels.
                int importedBookings = 0;
                try {
                    LocalDate arrivalFrom = LocalDate.of(LocalDate.now().getYear(), 1, 1);
                    LocalDate arrivalTo = LocalDate.now().plusMonths(12);
                    var pullResult = connectService.pullBookings(prop.getId(), orgId,
                        arrivalFrom, arrivalTo);
                    importedBookings = pullResult.importedOrIdempotent();
                    log.info("ChannexImport: pull bookings OK property={} periode=[{},{}] total={} imported={} skipped={}",
                        prop.getId(), arrivalFrom, arrivalTo, pullResult.totalReceived(),
                        pullResult.importedOrIdempotent(), pullResult.skipped());
                } catch (Exception bex) {
                    log.warn("ChannexImport: pull bookings KO property={} : {} "
                        + "(import termine, l'admin peut re-trigger manuellement)",
                        prop.getId(), bex.getMessage());
                }

                // 7. PUSH INITIAL availability + rates sur 12 mois.
                //    CRITIQUE : sans ce push, Channex sert "0 inventaire" aux
                //    OTAs des que le mapping listing est actif → Airbnb bloque
                //    TOUTES les dates par defaut (le listing devient
                //    invisible/inreservable). On debloque immediatement en
                //    publiant 12 mois d'availability=1 + les tarifs PriceEngine.
                //    Best-effort : si OTA pas encore actif, le gate dans
                //    pushProperty skip silencieusement (sera retente plus tard
                //    via les events Kafka calendar.update).
                try {
                    LocalDate pushFrom = LocalDate.now();
                    LocalDate pushTo = LocalDate.now().plusMonths(12);
                    var pushResult = connectService.resync(prop.getId(), orgId, 12);
                    log.info("ChannexImport: push initial availability+rates property={} periode=[{},{}] success={}",
                        prop.getId(), pushFrom, pushTo, pushResult.success());
                } catch (Exception pex) {
                    log.warn("ChannexImport: push initial KO property={} : {} "
                        + "(import termine — relancer 'Re-pousser prix + dispo' depuis l'UI)",
                        prop.getId(), pex.getMessage());
                }

                String msg = "Property Clenzy " + prop.getId() + " creee (room="
                    + roomTypeId.substring(0, 8) + ", rate=" + ratePlanId.substring(0, 8) + ")";
                if (photoCount > 0) msg += ", " + photoCount + " photo" + (photoCount > 1 ? "s" : "");
                if (description != null && !description.isBlank()) msg += ", description importee";
                if (importedBookings > 0) msg += ", " + importedBookings + " reservation"
                    + (importedBookings > 1 ? "s" : "") + " importee" + (importedBookings > 1 ? "s" : "");
                if (discountsCreated > 0) msg += ", " + discountsCreated + " campagne"
                    + (discountsCreated > 1 ? "s" : "") + " de prix";
                int mappedCount = resolvedAmenities.mapped.size();
                int unmappedCount = resolvedAmenities.stillUnmapped.size();
                int totalAmenities = mappedCount + unmappedCount;
                if (totalAmenities > 0) {
                    msg += ", " + totalAmenities + " commodite"
                        + (totalAmenities > 1 ? "s" : "")
                        + " (" + mappedCount + " mappees + " + unmappedCount + " brutes a mapper)";
                }
                if (info != null && info.defaultPrice() != null) {
                    msg += ", tarif=" + info.defaultPrice() + " " + resolvedCurrency;
                }

                details.add(new ChannexImportResult.Item(channexId, "CREATED", prop.getId(), msg));
                created++;

                log.info("ChannexImport: property Channex {} -> Clenzy property {} (room={} rate={}, {} photos, desc={}, {} bookings)",
                    channexId, prop.getId(), roomTypeId, ratePlanId, photoCount,
                    description != null && !description.isBlank() ? "oui" : "non", importedBookings);

            } catch (Exception e) {
                log.error("ChannexImport: echec import {} pour org {} : {}",
                    channexId, orgId, e.getMessage());
                details.add(new ChannexImportResult.Item(channexId, "ERROR", null, e.getMessage()));
                errors++;
            }
        }

        return new ChannexImportResult(request.imports().size(), created, skipped, errors, details);
    }

    // ─── Re-sync content (re-scrape OTA + apply aliases) ────────────────────

    /**
     * Re-synchronise le contenu OTA d'une property deja importee :
     *
     * <ol>
     *   <li>Resoud le {@code listing_id} OTA via le mapping Channex + channels</li>
     *   <li>Re-scrape la page Airbnb publique (nom + amenities JSON-LD)</li>
     *   <li>Charge les aliases + ignored de l'org</li>
     *   <li>Resout les amenities en 3 buckets (mapped / ignored / unmapped)</li>
     *   <li>Met a jour {@code property.amenities} + {@code property.otaRawAmenities}
     *       (ainsi que le name si Airbnb donne un meilleur titre)</li>
     * </ol>
     *
     * <p>Utile dans 2 cas :</p>
     * <ul>
     *   <li>Property importee AVANT que le scraping d'amenities soit en place</li>
     *   <li>Listing OTA modifie cote Airbnb (nouvel equipement ajoute par le host)</li>
     * </ul>
     */
    @Transactional
    public com.clenzy.integration.channex.dto.ChannexResyncContentResult resyncPropertyContent(
            Long clenzyPropertyId, Long orgId) {
        Property prop = propertyRepository.findById(clenzyPropertyId)
            .orElseThrow(() -> new IllegalArgumentException(
                "Property " + clenzyPropertyId + " introuvable"));
        if (!Objects.equals(prop.getOrganizationId(), orgId)) {
            throw new SecurityException("Cette property n'appartient pas a votre organisation.");
        }
        var mapping = mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la property " + clenzyPropertyId));

        // Resoud le listing_id depuis le channel actif liee a la property Channex
        ChannelListingInfo info = buildListingInfoMap().get(mapping.getChannexPropertyId());
        if (info == null || !"AirBNB".equalsIgnoreCase(info.otaName())) {
            throw new IllegalStateException(
                "Cette property n'a pas de listing Airbnb actif sur le hub.");
        }

        // Re-sync : whitelabel API en priorite, scrape Airbnb en fallback
        AirbnbListingData data = resolveListingData(info);
        if (data == null) {
            throw new IllegalStateException(
                "Impossible de recuperer les donnees Airbnb pour cette listing.");
        }

        // Resout avec les aliases + ignored actuels
        Map<String, String> aliases = amenityManagementService.loadAliasesByOrg(orgId);
        Set<String> ignored = amenityManagementService.loadIgnoredByOrg(orgId);
        ResolvedAmenities resolved = resolveAmenitiesWithUserConfig(data, aliases, ignored);

        // Met a jour le nom si scrape OK et different
        if (data.name() != null && !data.name().isBlank()
            && !data.name().equals(prop.getName())) {
            log.info("Resync: rename property {} '{}' → '{}'",
                clenzyPropertyId, prop.getName(), data.name());
            prop.setName(data.name());
        }

        // Enrichment Channex API : room_type detail + hotel_policies
        // MAJ uniquement si la valeur est plus precise que l'existant (merge,
        // on n'ECRASE PAS les valeurs corrigees manuellement par l'admin).
        var roomDetail = channexClient.fetchRoomTypeDetail(mapping.getChannexRoomTypeId());
        if (roomDetail != null) {
            if (roomDetail.countOfRooms() != null && roomDetail.countOfRooms() > 0) {
                prop.setBedroomCount(roomDetail.countOfRooms());
            }
            Integer maxGuests = roomDetail.resolveMaxGuests();
            if (maxGuests != null && maxGuests > 0) {
                prop.setMaxGuests(maxGuests);
            }
            if (roomDetail.content() != null) {
                String desc = roomDetail.content().path("description").asText(null);
                if (desc != null && !desc.isBlank() && (prop.getDescription() == null
                    || prop.getDescription().isBlank())) {
                    prop.setDescription(desc);
                }
            }
        }
        var hotelPolicies = channexClient.fetchHotelPoliciesForProperty(mapping.getChannexPropertyId());
        if (!hotelPolicies.isEmpty()) {
            var hp = hotelPolicies.get(0);
            if (hp.checkinTime() != null && !hp.checkinTime().isBlank()) {
                prop.setDefaultCheckInTime(hp.checkinTime());
            }
            if (hp.checkoutTime() != null && !hp.checkoutTime().isBlank()) {
                prop.setDefaultCheckOutTime(hp.checkoutTime());
            }
        }

        // Met a jour amenities + ota_raw_amenities (merge avec l'existant : on
        // n'ECRASE PAS les codes deja mis manuellement par l'admin).
        try {
            Set<String> currentCodes = new LinkedHashSet<>(parseAmenitiesJson(prop.getAmenities()));
            currentCodes.addAll(resolved.mapped);
            prop.setAmenities(currentCodes.isEmpty()
                ? null : objectMapper.writeValueAsString(currentCodes));
            prop.setOtaRawAmenities(resolved.stillUnmapped.isEmpty()
                ? null : objectMapper.writeValueAsString(resolved.stillUnmapped));
            propertyRepository.save(prop);
        } catch (Exception e) {
            log.warn("Resync: serialisation KO property={} : {}", clenzyPropertyId, e.getMessage());
        }

        int ignoredCount = (data.unmappedAmenities() == null ? 0
            : data.unmappedAmenities().size()) - resolved.mapped.size() + (data.mappedAmenities() == null
                ? 0 : data.mappedAmenities().size()) - resolved.stillUnmapped.size();
        // Simpler: ignoredCount = (unmapped raws) - (alias-mapped) - (stillUnmapped)
        int totalRaw = data.unmappedAmenities() != null ? data.unmappedAmenities().size() : 0;
        int aliasMapped = resolved.mapped.size() - (data.mappedAmenities() != null
            ? data.mappedAmenities().size() : 0);
        if (aliasMapped < 0) aliasMapped = 0;
        ignoredCount = totalRaw - aliasMapped - resolved.stillUnmapped.size();
        if (ignoredCount < 0) ignoredCount = 0;

        log.info("Resync OK property={} : mapped={} stillRaw={} ignored={}",
            clenzyPropertyId, resolved.mapped.size(), resolved.stillUnmapped.size(), ignoredCount);

        return new com.clenzy.integration.channex.dto.ChannexResyncContentResult(
            prop.getId(),
            prop.getName(),
            data.name(),
            new java.util.ArrayList<>(resolved.mapped),
            new java.util.ArrayList<>(resolved.stillUnmapped),
            ignoredCount
        );
    }

    /**
     * Bulk : re-sync content de TOUTES les properties de l'org qui ont un
     * mapping Channex + un listing OTA actif. Best-effort : un echec sur une
     * property ne stoppe pas les autres.
     */
    @Transactional
    public List<com.clenzy.integration.channex.dto.ChannexResyncContentResult> resyncAllPropertiesContent(Long orgId) {
        List<com.clenzy.integration.channex.dto.ChannexResyncContentResult> results = new java.util.ArrayList<>();
        // Toutes les mappings de l'org (= toutes les properties importees Channex)
        var mappings = mappingRepository.findAllByOrgId(orgId);
        Map<String, ChannelListingInfo> infos = buildListingInfoMap();
        for (var m : mappings) {
            ChannelListingInfo info = infos.get(m.getChannexPropertyId());
            if (info == null || !"AirBNB".equalsIgnoreCase(info.otaName())) {
                continue;
            }
            try {
                results.add(resyncPropertyContent(m.getClenzyPropertyId(), orgId));
            } catch (Exception e) {
                log.warn("Resync bulk: KO property={} : {}", m.getClenzyPropertyId(), e.getMessage());
            }
        }
        log.info("Resync bulk org={} : {} properties re-synchronisees", orgId, results.size());
        return results;
    }

    /** Helper local : parse safely un JSON array de strings (amenities). */
    private List<String> parseAmenitiesJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json,
                new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * Retourne l'ID du 1er room_type existant pour la property, ou en cree un
     * par defaut si la liste est vide.
     *
     * <p>Cas typique d'auto-create : property Channex creee automatiquement
     * apres OAuth Airbnb (Channex ne pre-cree pas systematiquement les
     * room_types pour les listings detectes — depend de la maturite du sync OTA).</p>
     */
    private String resolveOrCreateRoomType(String channexPropertyId, String propertyTitle, int maxOccupancy) {
        List<ChannexRoomTypeDto> existing = channexClient.fetchRoomTypesForProperty(channexPropertyId);
        if (!existing.isEmpty()) {
            ChannexRoomTypeDto first = existing.get(0);
            log.info("ChannexImport: room_type existant trouve pour property {} : {} ({})",
                channexPropertyId, first.id(), first.title());
            return first.id();
        }

        // Aucun room_type → on cree un room_type par defaut (1 unite, capacite = maxOccupancy)
        log.info("ChannexImport: aucun room_type pour property {} → creation auto",
            channexPropertyId);
        ChannexRoomTypeDto created = channexClient.createRoomType(
            ChannexCreateRoomTypeRequest.simple(channexPropertyId, propertyTitle, maxOccupancy));
        return created.id();
    }

    /**
     * Retourne l'ID du 1er rate_plan existant pour la property, ou en cree un
     * par defaut si la liste est vide.
     */
    private String resolveOrCreateRatePlan(String channexPropertyId, String roomTypeId,
                                             String currency, int maxOccupancy) {
        List<ChannexRatePlanDto> existing = channexClient.fetchRatePlansForProperty(channexPropertyId);
        if (!existing.isEmpty()) {
            // Si plusieurs rate_plans existent, on prend celui lie au room_type qu'on a resolu
            // (ou le 1er a defaut, pour ne pas planter — l'admin pourra corriger via la UI)
            ChannexRatePlanDto preferred = existing.stream()
                .filter(rp -> roomTypeId.equals(rp.roomTypeId()))
                .findFirst()
                .orElse(existing.get(0));
            log.info("ChannexImport: rate_plan existant trouve pour property {} : {} ({})",
                channexPropertyId, preferred.id(), preferred.title());
            return preferred.id();
        }

        // Aucun rate_plan → on cree un "Standard Rate" par defaut (per_room, occupancy max)
        log.info("ChannexImport: aucun rate_plan pour property {} → creation auto",
            channexPropertyId);
        ChannexRatePlanDto created = channexClient.createRatePlan(
            ChannexCreateRatePlanRequest.standard(channexPropertyId, roomTypeId, currency, maxOccupancy));
        return created.id();
    }

    /**
     * Demarre un flux OAuth OTA "global" sans necessiter de property Clenzy preexistante.
     *
     * <p>Cas d'usage : un nouvel utilisateur sans aucune property Clenzy/Channex
     * veut importer ses listings Airbnb. Il ne peut pas faire l'OAuth via une
     * property cible (Channex exige {@code property_id} pour le one-time-token).</p>
     *
     * <p>Workaround : on cree (ou reutilise) une property Channex "pivot"
     * intitulee {@code [Clenzy Hub] OAuth Bridge} qui sert juste de container
     * pour l'OAuth. Apres OAuth Airbnb, Channex cree automatiquement des
     * properties pour chaque listing detecte du compte. La pivot reste vide
     * et n'est pas mappee a Clenzy (donc invisible dans la discovery).</p>
     *
     * @param channelCode code 3 lettres OTA (ABB/BDC/...) pour pre-filtrer le wizard
     * @return URL iframe + ID de la pivot (cleanup futur)
     */
    public ChannexOauthSetupResponse setupGlobalOauth(Long orgId, String username,
                                                        String channelCode, String language,
                                                        String existingChannelId) {
        // Cas "re-detection" : un OTA est deja connecte (OAuth fait), l'utilisateur
        // veut juste revenir dans le wizard pour mapper de nouveaux listings ajoutes
        // recemment cote OTA (Airbnb par ex). On reutilise le channel existant
        // (avec ses tokens OAuth) au lieu de tout recreer.
        if (existingChannelId != null && !existingChannelId.isBlank()) {
            log.info("ChannexImport: re-detection listings via channel existant {}", existingChannelId);
            // On recupere la property pivot attachee au channel pour generer l'URL iframe
            JsonNode channels = channexClient.fetchAllChannelsRaw();
            String attachedPropertyId = null;
            if (channels != null && channels.path("data").isArray()) {
                for (JsonNode ch : channels.path("data")) {
                    if (existingChannelId.equals(ch.path("id").asText(null))) {
                        JsonNode propsArr = ch.path("attributes").path("properties");
                        if (propsArr.isArray() && propsArr.size() > 0) {
                            attachedPropertyId = propsArr.get(0).asText(null);
                        }
                        break;
                    }
                }
            }
            if (attachedPropertyId == null) {
                throw new IllegalStateException(
                    "Channel " + existingChannelId + " introuvable ou sans property attachee — "
                        + "impossible de generer le lien iframe");
            }
            String embedUrl = channexClient.createChannelEmbedUrl(
                attachedPropertyId, existingChannelId, username, language);
            return ChannexOauthSetupResponse.of(embedUrl, attachedPropertyId);
        }

        // Cas standard : pas de channel existant → flow OAuth complet via pivot
        // Conventions de naming :
        //   - PIVOT_TITLE : pivot active (libre, prete pour OAuth)
        //   - CONSUMED_PREFIX : prefixe d'une pivot deja utilisee (avec channel OAuth attache)
        //     → renommee pour liberer le nom canonique, l'utilisateur sait que c'est
        //       un container OAuth ancien et qu'il ne doit pas la confondre avec une
        //       vraie property.
        final String PIVOT_TITLE = "[Clenzy Hub] OAuth Bridge";
        final String CONSUMED_PREFIX = "[Clenzy] OAuth Container ";

        // 1. Cherche une pivot existante par titre canonique
        String existingPivotId = findPivotPropertyId(PIVOT_TITLE);

        if (existingPivotId != null) {
            // 2. Tenter une suppression directe (cas : pivot orpheline sans channel attache)
            try {
                channexClient.deleteProperty(existingPivotId);
                log.info("ChannexImport: pivot orpheline {} supprimee (pas de channel attache)", existingPivotId);
            } catch (Exception deleteEx) {
                // 3. Suppression bloquee → c'est qu'un channel OAuth y est attache.
                //    On renomme avec un timestamp pour liberer le nom canonique sans
                //    casser le channel (et donc preserver les tokens OAuth).
                String newName = CONSUMED_PREFIX + java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
                try {
                    channexClient.updatePropertyTitle(existingPivotId, newName);
                    log.info("ChannexImport: pivot {} avec channel attache renommee en '{}' "
                        + "(suppression bloquee : {})", existingPivotId, newName, deleteEx.getMessage());
                } catch (Exception renameEx) {
                    // Si meme le rename echoue, on continue : la pivot existante reste
                    // en place mais on va creer une nouvelle ci-dessous, donc le nom
                    // canonique sera duplique. Pas critique : findPivotPropertyId prendra
                    // la 1ere trouvee la prochaine fois.
                    log.warn("ChannexImport: rename de la pivot {} a echoue ({}), une duplication "
                        + "de nom est possible", existingPivotId, renameEx.getMessage());
                }
            }
        }

        // 4. Crée une nouvelle pivot fraiche (parametres minimaux, jamais distribuee)
        log.info("ChannexImport: creation d'une nouvelle pivot OAuth pour org={}", orgId);
        ChannexPropertyDto created = channexClient.createProperty(new ChannexCreatePropertyRequest(
            PIVOT_TITLE, "EUR", "FR", "Europe/Paris", null
        ));
        String pivotId = created.id();

        // 5. Genere l'URL iframe pre-filtree sur l'OTA choisi
        String embedUrl = channexClient.createEmbedUrl(pivotId, username, language, channelCode);
        return ChannexOauthSetupResponse.of(embedUrl, pivotId);
    }

    /**
     * Liste tous les channels OTA actuellement connectes dans le hub.
     *
     * <p>Affiche par la vue "Gerer les OTAs connectes" du modal Distribution.
     * Permet a l'admin de voir ses OAuth Airbnb/Booking/Vrbo actifs et de les
     * deconnecter (suppression du channel hub + tokens).</p>
     */
    public List<ChannexConnectedOta> listConnectedOtaChannels(Long orgId) {
        JsonNode raw = channexClient.fetchAllChannelsRaw();
        if (raw == null || !raw.path("data").isArray()) {
            return List.of();
        }

        // Pre-fetch les titres des properties du hub pour enrichir le DTO
        Map<String, String> propertyTitles = new HashMap<>();
        JsonNode propsRaw = channexClient.fetchAllPropertiesRaw();
        if (propsRaw != null && propsRaw.path("data").isArray()) {
            for (JsonNode p : propsRaw.path("data")) {
                propertyTitles.put(
                    p.path("id").asText(""),
                    p.path("attributes").path("title").asText("")
                );
            }
        }

        List<ChannexConnectedOta> result = new ArrayList<>();
        for (JsonNode channel : raw.path("data")) {
            JsonNode attrs = channel.path("attributes");
            String channelId = channel.path("id").asText(null);
            if (channelId == null) continue;

            // Recupere la 1ere property liee (s'il y en a) pour traçabilite
            String firstPropId = null;
            JsonNode propsArr = attrs.path("properties");
            if (propsArr.isArray() && propsArr.size() > 0) {
                firstPropId = propsArr.get(0).asText(null);
            }
            if (firstPropId == null) {
                JsonNode rels = channel.path("relationships").path("properties").path("data");
                if (rels.isArray() && rels.size() > 0) {
                    firstPropId = rels.get(0).path("id").asText(null);
                }
            }

            boolean hasToken = attrs.path("settings").path("tokens").path("access_token").isTextual();

            result.add(new ChannexConnectedOta(
                channelId,
                attrs.path("title").asText(""),
                attrs.path("channel").asText(""),
                attrs.path("is_active").asBoolean(false),
                hasToken,
                firstPropId != null ? propertyTitles.getOrDefault(firstPropId, "") : "",
                firstPropId
            ));
        }
        log.info("ChannexImport: listConnectedOtaChannels org={} -> {} channels", orgId, result.size());
        return result;
    }

    /**
     * Deconnecte un OTA en 2 etapes pour respecter la contrainte Channex
     * (refus de DELETE sur un channel {@code is_active=true}) :
     *
     * <ol>
     *   <li><b>PUT</b> {@code /channels/{id}} avec {@code is_active=false} —
     *       desactive le channel. Effet immediat : Channex arrete de pusher
     *       vers l'OTA, l'OTA (Airbnb) reprend le controle du listing.</li>
     *   <li><b>DELETE</b> {@code /channels/{id}} — supprime le channel + tokens
     *       OAuth. L'utilisateur devra refaire l'OAuth pour reconnecter.</li>
     * </ol>
     *
     * <p>Si l'etape 1 reussit mais 2 echoue, le channel reste juste desactive
     * (etat fonctionnel pour le user : Airbnb est libere). On log un warning.</p>
     */
    public void disconnectOtaChannel(Long orgId, String channelId) {
        log.info("ChannexImport: disconnect OTA channel {} demande par org {} (2-step: deactivate + delete)",
            channelId, orgId);
        // Etape 1 : desactiver (toujours requis, meme si deja inactif → no-op cote Channex)
        try {
            channexClient.deactivateChannel(channelId);
        } catch (Exception e) {
            log.warn("ChannexImport: deactivate channel {} KO : {} — on tente DELETE quand meme",
                channelId, e.getMessage());
        }
        // Etape 2 : supprimer (Channex accepte maintenant que c'est inactif)
        try {
            channexClient.deleteChannel(channelId);
        } catch (Exception e) {
            log.warn("ChannexImport: delete channel {} KO : {} — le channel reste DESACTIVE "
                + "(OTA libere). Re-tenter manuellement le DELETE plus tard ou supprimer "
                + "directement sur le dashboard Channex.", channelId, e.getMessage());
            // Re-throw pour informer l'UI que le delete a echoue (le channel reste neanmoins
            // inactif → Airbnb a repris la main, ce qui etait le but principal)
            throw e;
        }
    }

    /** Cherche dans toutes les properties du hub celle qui sert de pivot OAuth (par titre). */
    private String findPivotPropertyId(String pivotTitle) {
        JsonNode raw = channexClient.fetchAllPropertiesRaw();
        if (raw == null || !raw.path("data").isArray()) return null;
        for (JsonNode prop : raw.path("data")) {
            String title = prop.path("attributes").path("title").asText("");
            if (pivotTitle.equals(title)) {
                return prop.path("id").asText(null);
            }
        }
        return null;
    }

    /**
     * Cree un PropertyPhoto par photo Channex avec son URL externe.
     *
     * <p>Format attendu Channex : array d'objets avec champs :</p>
     * <ul>
     *   <li>{@code url} (string)</li>
     *   <li>{@code position} (int, 0 = cover)</li>
     *   <li>{@code description} (string, optionnel) → mappe en caption Clenzy</li>
     *   <li>{@code author_name}, {@code kind} (ignores ici)</li>
     * </ul>
     *
     * <p>On ne telecharge PAS les bytes : on stocke uniquement l'URL Airbnb
     * dans {@code external_url}. {@link PropertyPhoto#getUrl()} la retourne
     * directement aux clients API (booking engine, frontend, etc.).</p>
     *
     * @return nombre de photos importees (0 si liste vide ou null)
     */
    private int importPhotos(Property property, Long orgId, JsonNode photosArray) {
        if (!photosArray.isArray() || photosArray.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (JsonNode photo : photosArray) {
            String url = photo.path("url").asText(null);
            if (url == null || url.isBlank()) continue;

            PropertyPhoto pp = new PropertyPhoto();
            pp.setOrganizationId(orgId);
            pp.setProperty(property);
            pp.setExternalUrl(url);
            pp.setSortOrder(photo.path("position").asInt(count));
            String caption = photo.path("description").asText(null);
            if (caption != null && !caption.isBlank()) {
                pp.setCaption(caption);
            }
            pp.setSource(PropertyPhoto.PhotoSource.AIRBNB);
            pp.setContentType("image/jpeg"); // defaut Airbnb (champ NOT NULL en DB)
            propertyPhotoRepository.save(pp);
            count++;
        }
        return count;
    }

    /** Parse une string en BigDecimal de facon safe (null si invalide). */
    private static java.math.BigDecimal parseBigDecimal(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return new java.math.BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Normalise : "" / null → null. */
    private static String emptyToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }

    /** Heuristique simple pour suggerer le type Clenzy a partir du titre. */
    private static String suggestPropertyType(String title) {
        if (title == null) return "APARTMENT";
        String lower = title.toLowerCase();
        if (lower.contains("riad")) return "RIAD";
        if (lower.contains("duplex")) return "DUPLEX";
        if (lower.contains("villa")) return "VILLA";
        if (lower.contains("maison") || lower.contains("house")) return "HOUSE";
        if (lower.contains("studio")) return "STUDIO";
        if (lower.contains("loft")) return "LOFT";
        if (lower.contains("chalet")) return "CHALET";
        if (lower.contains("bungalow")) return "BUNGALOW";
        if (lower.contains("townhouse")) return "TOWNHOUSE";
        return "APARTMENT";
    }

    /**
     * Map le listing_type brut d'un OTA (Airbnb / Booking / ...) vers un
     * PropertyType Clenzy. Plus fiable que parser un titre car c'est de la
     * donnee structuree fournie par l'OTA.
     *
     * <p>Listing types Airbnb communs : apartment, house, secondary_unit,
     * loft, townhouse, condohotel, serviced_apartment, villa, bungalow,
     * cottage, chalet, riad, bed_and_breakfast, boutique_hotel, etc.</p>
     *
     * @return code PropertyType Clenzy ou {@code null} si pas de mapping
     *         connu (le caller fera fallback sur l'heuristique titre)
     */
    private static String suggestPropertyTypeFromOta(String listingType) {
        if (listingType == null || listingType.isBlank()) return null;
        return switch (listingType.toLowerCase()) {
            case "apartment", "condo", "condohotel", "serviced_apartment" -> "APARTMENT";
            case "house", "secondary_unit" -> "HOUSE";
            case "studio", "studio_apartment" -> "STUDIO";
            case "loft" -> "LOFT";
            case "villa" -> "VILLA";
            case "duplex" -> "DUPLEX";
            case "townhouse", "townhome" -> "TOWNHOUSE";
            case "bungalow" -> "BUNGALOW";
            case "riad" -> "RIAD";
            case "chalet" -> "CHALET";
            case "cottage" -> "COTTAGE";
            case "bed_and_breakfast", "guest_suite", "guesthouse" -> "GUEST_ROOM";
            case "boat", "houseboat" -> "BOAT";
            default -> null;
        };
    }

    /** Parse le type Clenzy depuis la string (fallback APARTMENT si invalide). */
    private static PropertyType parsePropertyType(String value) {
        if (value == null) return PropertyType.APARTMENT;
        try {
            return PropertyType.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException e) {
            return PropertyType.APARTMENT;
        }
    }

    /**
     * Pre-fetch les channels OTA actifs et compile pour chaque propertyId
     * Channex les infos extraites de son rate_plan : nom OTA, listing_id,
     * prix de base, min nights, devise.
     *
     * <p>Channex ne renvoie pas le NOM textuel des listings via l'API publique
     * (whitelabel-only), mais expose ces champs dans
     * {@code attributes.rate_plans[].settings.*}. Combine avec un scrape de la
     * page Airbnb publique (cf. {@link #fetchAirbnbListingTitle}) pour obtenir
     * le titre humain.</p>
     */
    private Map<String, ChannelListingInfo> buildListingInfoMap() {
        Map<String, ChannelListingInfo> result = new HashMap<>();
        try {
            JsonNode channelsRaw = channexClient.fetchAllChannelsRaw();
            if (channelsRaw == null || !channelsRaw.path("data").isArray()) {
                return result;
            }
            for (JsonNode ch : channelsRaw.path("data")) {
                JsonNode chAttrs = ch.path("attributes");
                String otaName = chAttrs.path("channel").asText("");
                if (otaName.isEmpty()) continue;

                JsonNode ratePlans = chAttrs.path("rate_plans");
                if (!ratePlans.isArray() || ratePlans.size() == 0) continue;
                JsonNode rp0Settings = ratePlans.get(0).path("settings");
                String listingId = rp0Settings.path("listing_id").asText("");
                if (listingId.isEmpty()) continue;

                JsonNode pricing = rp0Settings.path("pricing_setting");
                JsonNode availRule = rp0Settings.path("availability_rule");
                JsonNode booking = rp0Settings.path("booking_setting");
                JsonNode controls = booking.path("guest_controls");
                JsonNode cancelPol = booking.path("cancellation_policy_settings");

                String channelId = ch.path("id").asText(null);

                ChannelListingInfo info = new ChannelListingInfo(
                    otaName,
                    listingId,
                    channelId,
                    rp0Settings.path("listing_type").asText(null),
                    // Tarifs
                    bigDecimalOrNull(pricing, "default_daily_price"),
                    bigDecimalOrNull(pricing, "weekend_price"),
                    pricing.path("listing_currency").asText(null),
                    intOrNull(pricing, "guests_included"),
                    bigDecimalOrNull(pricing, "price_per_extra_person"),
                    doubleOrNull(pricing, "weekly_price_factor"),
                    doubleOrNull(pricing, "monthly_price_factor"),
                    // Sejour
                    intOrNull(availRule, "default_min_nights"),
                    intOrNull(availRule, "default_max_nights"),
                    // Reservation
                    booking.path("check_in_time_start").asText(null),
                    booking.path("check_in_time_end").asText(null),
                    intOrNull(booking, "check_out_time"),
                    cancelPol.path("cancellation_policy_category").asText(null),
                    booking.path("instant_booking_allowed_category").asText(null),
                    // Regles
                    boolOrNull(controls, "allows_pets_as_host"),
                    boolOrNull(controls, "allows_smoking_as_host"),
                    boolOrNull(controls, "allows_events_as_host")
                );

                Set<String> propIds = new HashSet<>();
                JsonNode propsArr = chAttrs.path("properties");
                if (propsArr.isArray()) {
                    for (JsonNode pid : propsArr) propIds.add(pid.asText(""));
                }
                JsonNode rels = ch.path("relationships").path("properties").path("data");
                if (rels.isArray()) {
                    for (JsonNode r : rels) propIds.add(r.path("id").asText(""));
                }
                for (String pid : propIds) {
                    if (pid.isEmpty()) continue;
                    result.putIfAbsent(pid, info);
                }
            }
        } catch (Exception e) {
            log.debug("ChannexImport: buildListingInfoMap KO : {}", e.getMessage());
        }
        return result;
    }

    /**
     * Donnees scrapees depuis la page Airbnb publique. Toutes nullables —
     * best-effort, dependant de la presence de balises Schema.org JSON-LD
     * (donnee structuree par Airbnb, pas du regex sur du texte libre).
     *
     * @param mappedAmenities  codes Clenzy reconnus (WIFI, TV, ...)
     * @param unmappedAmenities noms OTA bruts non reconnus (ex: "Smoke alarm")
     *                          — stockes pour transparence + futur mapping
     */
    private record AirbnbListingData(
        String name,
        java.util.Set<String> mappedAmenities,
        java.util.Set<String> unmappedAmenities
    ) {}

    /**
     * Resolution de listing data avec circuit-breaker whitelabel automatique.
     *
     * <p><b>Strategie</b> : on tente toujours l'API whitelabel en premier
     * ({@code GET /channels/{id}/listings/{lid}}) qui donne le NOM textuel
     * directement. Si elle echoue (401/403 → compte public) le client
     * automatiquement cache l'indisponibilite 1h et retourne {@code empty}.
     * On bascule alors sur le scraping Airbnb JSON-LD.</p>
     *
     * <p>Aucune config a toucher : si demain Channex active votre acces WL,
     * le scraping s'arrete automatiquement au prochain call (cache expire),
     * et tout passe par l'API structuree.</p>
     */
    private AirbnbListingData resolveListingData(ChannelListingInfo info) {
        if (info == null) return null;
        // Tentative whitelabel (auto-detect : si cache=unavailable → empty direct)
        if (info.channelId() != null) {
            var detail = channexClient.fetchChannelListingDetail(info.channelId(), info.listingId());
            if (detail.isPresent() && detail.get().title() != null) {
                log.info("Channex WL: listing data direct (no scrape) listing={}", info.listingId());
                // Pour les amenities on garde le scrape : la facilities relation
                // Channex couvre seulement ~180 standards et pas le riche
                // catalogue Airbnb. Nom via WL, amenities via scrape.
                java.util.Set<String> mapped = java.util.Collections.emptySet();
                java.util.Set<String> unmapped = java.util.Collections.emptySet();
                AirbnbListingData scraped = fetchAirbnbListingData(info.listingId());
                if (scraped != null) {
                    mapped = scraped.mappedAmenities();
                    unmapped = scraped.unmappedAmenities();
                }
                return new AirbnbListingData(detail.get().title(), mapped, unmapped);
            }
        }
        // Fallback : scrape complet (cas standard sur compte public)
        return fetchAirbnbListingData(info.listingId());
    }

    /**
     * Best-effort : recupere les donnees publiques d'une listing Airbnb
     * (nom + amenities) via le JSON-LD Schema.org embarque dans la page.
     *
     * <p><b>Pourquoi scraper :</b> Channex (non-whitelabel) n'expose ni le
     * titre humain ni les amenities d'une listing OTA. Le champ Channex
     * {@code facilities} (relations) est documente mais toujours vide dans
     * la pratique. Le seul champ structure qu'on a est le {@code listing_id}.</p>
     *
     * <p><b>Pourquoi le JSON-LD est OK :</b> contrairement aux meta og:* qui
     * sont du texte libre (regex fragile), JSON-LD est de la donnee
     * Schema.org standard ({@code "@type":"LodgingBusiness"} avec
     * {@code amenityFeature: [{name: "Wifi"}, ...]}). Airbnb suit ce schema.</p>
     *
     * <p>Timeout 8s. Retourne {@code null} si scrape echoue completement.</p>
     */
    private AirbnbListingData fetchAirbnbListingData(String listingId) {
        if (listingId == null || listingId.isBlank()) return null;
        String url = "https://www.airbnb.com/rooms/" + listingId;
        try {
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                // User-Agent realiste : Airbnb sert un 403 si l'UA ressemble a un bot.
                .header("User-Agent",
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                    + " (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .header("Accept",
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "fr-FR,fr;q=0.9,en;q=0.8")
                .timeout(Duration.ofSeconds(8))
                .GET()
                .build();
            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) {
                log.debug("Airbnb scrape: HTTP {} pour listing {}", resp.statusCode(), listingId);
                return null;
            }
            String body = resp.body();
            String name = extractAirbnbListingName(body);
            // Split mapped/unmapped pour transparence : rien ignore silencieusement.
            java.util.Set<String> allAmenities = extractAirbnbAmenitiesRaw(body);
            java.util.Set<String> mapped = new java.util.LinkedHashSet<>();
            java.util.Set<String> unmapped = new java.util.LinkedHashSet<>();
            for (String raw : allAmenities) {
                String clenzyCode = AIRBNB_AMENITY_TO_CLENZY.get(raw.toLowerCase().trim());
                if (clenzyCode != null) {
                    mapped.add(clenzyCode);
                } else {
                    unmapped.add(raw);
                }
            }
            if (!unmapped.isEmpty()) {
                log.info("Airbnb scrape : {} amenities NON MAPPEES pour listing {} "
                    + "(stockees dans ota_raw_amenities pour review) : {}",
                    unmapped.size(), listingId, unmapped);
            }
            log.info("Airbnb scrape OK listing={} name='{}' mapped={} unmapped={}",
                listingId, name, mapped, unmapped);
            return new AirbnbListingData(name, mapped, unmapped);
        } catch (Exception e) {
            log.debug("Airbnb scrape KO listing={}: {}", listingId, e.getMessage());
            return null;
        }
    }

    /** Mapping Airbnb amenity name (en/fr) → code Clenzy. Toutes les cles en minuscule. */
    private static final Map<String, String> AIRBNB_AMENITY_TO_CLENZY = Map.ofEntries(
        // Comfort
        Map.entry("wifi", "WIFI"),
        Map.entry("wi-fi", "WIFI"),
        Map.entry("tv", "TV"),
        Map.entry("hdtv", "TV"),
        Map.entry("television", "TV"),
        Map.entry("air conditioning", "AIR_CONDITIONING"),
        Map.entry("climatisation", "AIR_CONDITIONING"),
        Map.entry("heating", "HEATING"),
        Map.entry("chauffage", "HEATING"),
        Map.entry("central heating", "HEATING"),
        // Kitchen
        Map.entry("kitchen", "EQUIPPED_KITCHEN"),
        Map.entry("cuisine", "EQUIPPED_KITCHEN"),
        Map.entry("cuisine equipee", "EQUIPPED_KITCHEN"),
        Map.entry("dishwasher", "DISHWASHER"),
        Map.entry("lave-vaisselle", "DISHWASHER"),
        Map.entry("microwave", "MICROWAVE"),
        Map.entry("micro-ondes", "MICROWAVE"),
        Map.entry("oven", "OVEN"),
        Map.entry("four", "OVEN"),
        Map.entry("stove", "OVEN"),
        // Appliances
        Map.entry("washer", "WASHING_MACHINE"),
        Map.entry("washing machine", "WASHING_MACHINE"),
        Map.entry("lave-linge", "WASHING_MACHINE"),
        Map.entry("dryer", "DRYER"),
        Map.entry("seche-linge", "DRYER"),
        Map.entry("iron", "IRON"),
        Map.entry("fer a repasser", "IRON"),
        Map.entry("hair dryer", "HAIR_DRYER"),
        Map.entry("seche-cheveux", "HAIR_DRYER"),
        // Outdoor
        Map.entry("free parking on premises", "PARKING"),
        Map.entry("parking", "PARKING"),
        Map.entry("paid parking", "PARKING"),
        Map.entry("parking gratuit sur place", "PARKING"),
        Map.entry("pool", "POOL"),
        Map.entry("private pool", "POOL"),
        Map.entry("shared pool", "POOL"),
        Map.entry("piscine", "POOL"),
        Map.entry("hot tub", "JACUZZI"),
        Map.entry("jacuzzi", "JACUZZI"),
        Map.entry("bain a remous", "JACUZZI"),
        Map.entry("garden", "GARDEN_TERRACE"),
        Map.entry("backyard", "GARDEN_TERRACE"),
        Map.entry("patio or balcony", "GARDEN_TERRACE"),
        Map.entry("patio", "GARDEN_TERRACE"),
        Map.entry("balcony", "GARDEN_TERRACE"),
        Map.entry("terrace", "GARDEN_TERRACE"),
        Map.entry("jardin", "GARDEN_TERRACE"),
        Map.entry("terrasse", "GARDEN_TERRACE"),
        Map.entry("bbq grill", "BARBECUE"),
        Map.entry("barbecue", "BARBECUE"),
        Map.entry("barbeque utensils", "BARBECUE"),
        // Safety / Family
        Map.entry("safe", "SAFE"),
        Map.entry("coffre-fort", "SAFE"),
        Map.entry("crib", "BABY_BED"),
        Map.entry("cot", "BABY_BED"),
        Map.entry("lit bebe", "BABY_BED"),
        Map.entry("high chair", "HIGH_CHAIR"),
        Map.entry("chaise haute", "HIGH_CHAIR")
    );

    /**
     * Extrait les noms d'amenities BRUTS depuis JSON-LD Schema.org embarque
     * dans la page Airbnb. Schema standard : {@code amenityFeature: [{name: "Wifi"}, ...]}.
     *
     * <p>Retourne les noms tels que renvoyes par Airbnb (pas de transformation
     * ni de mapping). Le caller fait le split mapped/unmapped via
     * {@link #AIRBNB_AMENITY_TO_CLENZY}.</p>
     */
    private static java.util.Set<String> extractAirbnbAmenitiesRaw(String html) {
        java.util.Set<String> result = new java.util.LinkedHashSet<>();
        if (html == null) return result;
        Pattern ldPattern = Pattern.compile(
            "<script[^>]+type=\"application/ld\\+json\"[^>]*>(.*?)</script>",
            Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
        Matcher ldMatcher = ldPattern.matcher(html);
        Pattern amenityNamePattern = Pattern.compile(
            "\"name\"\\s*:\\s*\"([^\"\\\\]{1,80}(?:\\\\.[^\"\\\\]{0,80})*)\"");
        while (ldMatcher.find()) {
            String json = ldMatcher.group(1);
            int idx = json.indexOf("\"amenityFeature\"");
            if (idx < 0) continue;
            int bracketStart = json.indexOf('[', idx);
            if (bracketStart < 0) continue;
            int depth = 1;
            int end = bracketStart + 1;
            while (end < json.length() && depth > 0) {
                char c = json.charAt(end);
                if (c == '[') depth++;
                else if (c == ']') depth--;
                end++;
            }
            String featuresBlock = json.substring(bracketStart, Math.min(end, json.length()));
            Matcher nm = amenityNamePattern.matcher(featuresBlock);
            while (nm.find()) {
                String rawName = nm.group(1).trim();
                if (!rawName.isEmpty()) result.add(rawName);
            }
        }
        return result;
    }

    /**
     * Extrait le nom du listing en testant plusieurs sources, par ordre de
     * fiabilite : JSON-LD (data structuree Schema.org), &lt;title&gt; (strip
     * suffixe), og:title (fallback metadata).
     */
    private static String extractAirbnbListingName(String html) {
        // 1. JSON-LD : Airbnb embed un Schema.org LodgingBusiness/Product avec name
        Pattern ldPattern = Pattern.compile(
            "<script[^>]+type=\"application/ld\\+json\"[^>]*>(.*?)</script>",
            Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
        Matcher ldMatcher = ldPattern.matcher(html);
        while (ldMatcher.find()) {
            String json = ldMatcher.group(1);
            // Match "name":"..." (gerant les escapes simples)
            Matcher nameMatcher = Pattern.compile(
                "\"name\"\\s*:\\s*\"([^\"\\\\]*(?:\\\\.[^\"\\\\]*)*)\""
            ).matcher(json);
            if (nameMatcher.find()) {
                String name = nameMatcher.group(1)
                    .replace("\\\"", "\"")
                    .replace("\\\\", "\\");
                if (!name.isBlank() && name.length() > 3) {
                    return decodeHtmlEntities(name);
                }
            }
        }

        // 2. <title>...</title> — strip suffixe Airbnb commun
        Matcher titleMatcher = Pattern.compile(
            "<title[^>]*>([^<]+)</title>", Pattern.CASE_INSENSITIVE
        ).matcher(html);
        if (titleMatcher.find()) {
            String title = titleMatcher.group(1).trim();
            // Patterns de suffixe Airbnb : " - Houses for Rent in...", " - Airbnb", " | Airbnb"
            int sepIdx = -1;
            for (String sep : new String[]{" - Houses for Rent", " - Apartments for Rent",
                                            " - Vacation Rentals", " | Airbnb", " - Airbnb"}) {
                int idx = title.indexOf(sep);
                if (idx > 0 && (sepIdx == -1 || idx < sepIdx)) sepIdx = idx;
            }
            if (sepIdx > 0) title = title.substring(0, sepIdx);
            if (!title.isBlank() && title.length() > 3) {
                return decodeHtmlEntities(title);
            }
        }

        // 3. Fallback : og:title (metadata structuree, pas le vrai nom mais mieux que rien)
        return extractMetaContent(html, "og:title");
    }

    /** Extrait le content d'une meta tag par property (og:title, etc.). */
    private static String extractMetaContent(String html, String propertyName) {
        // Pattern bidirectionnel : content avant ou apres l'attribut property
        String escaped = Pattern.quote(propertyName);
        Pattern p1 = Pattern.compile(
            "<meta[^>]+(?:property|name)=[\"']" + escaped + "[\"'][^>]+content=[\"']([^\"']+)[\"']",
            Pattern.CASE_INSENSITIVE);
        Pattern p2 = Pattern.compile(
            "<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']" + escaped + "[\"']",
            Pattern.CASE_INSENSITIVE);
        Matcher m = p1.matcher(html);
        if (m.find()) return decodeHtmlEntities(m.group(1));
        m = p2.matcher(html);
        if (m.find()) return decodeHtmlEntities(m.group(1));
        return null;
    }

    /**
     * Cree les campagnes de prix Clenzy ({@link LengthOfStayDiscount}) a partir
     * des facteurs de remise expose par Channex dans le rate_plan settings.
     *
     * <p>Channex stocke les remises long-sejour dans :</p>
     * <ul>
     *   <li>{@code pricing_setting.weekly_price_factor}  : % de remise pour
     *       sejours de 7+ nuits (0 = pas de remise)</li>
     *   <li>{@code pricing_setting.monthly_price_factor} : % de remise pour
     *       sejours de 28+ nuits (0 = pas de remise)</li>
     * </ul>
     *
     * <p>On les materialise en {@link LengthOfStayDiscount} actifs avec :</p>
     * <ul>
     *   <li>weekly  : minNights=7, maxNights=27, type=PERCENTAGE</li>
     *   <li>monthly : minNights=28, maxNights=null, type=PERCENTAGE</li>
     * </ul>
     *
     * <p>Idempotent : si une discount existe deja pour cette property avec
     * meme minNights, on skip (evite les doublons si re-import).</p>
     *
     * @return nb de campagnes effectivement creees
     */
    private int createLengthOfStayDiscounts(Property prop, Long orgId, ChannelListingInfo info) {
        if (info == null) return 0;
        int created = 0;
        try {
            // Weekly discount [7, 27] nuits
            if (info.weeklyPriceFactor() != null && info.weeklyPriceFactor() > 0) {
                if (!hasExistingDiscount(prop.getId(), orgId, 7)) {
                    var d = new LengthOfStayDiscount();
                    d.setOrganizationId(orgId);
                    d.setProperty(prop);
                    d.setMinNights(7);
                    d.setMaxNights(27);
                    d.setDiscountType(LengthOfStayDiscount.DiscountType.PERCENTAGE);
                    d.setDiscountValue(BigDecimal.valueOf(info.weeklyPriceFactor()));
                    d.setActive(true);
                    lengthOfStayDiscountRepository.save(d);
                    created++;
                    log.info("ChannexImport: created LengthOfStayDiscount weekly property={} -{}%",
                        prop.getId(), info.weeklyPriceFactor());
                }
            }
            // Monthly discount [28, +∞[ nuits
            if (info.monthlyPriceFactor() != null && info.monthlyPriceFactor() > 0) {
                if (!hasExistingDiscount(prop.getId(), orgId, 28)) {
                    var d = new LengthOfStayDiscount();
                    d.setOrganizationId(orgId);
                    d.setProperty(prop);
                    d.setMinNights(28);
                    d.setMaxNights(null);
                    d.setDiscountType(LengthOfStayDiscount.DiscountType.PERCENTAGE);
                    d.setDiscountValue(BigDecimal.valueOf(info.monthlyPriceFactor()));
                    d.setActive(true);
                    lengthOfStayDiscountRepository.save(d);
                    created++;
                    log.info("ChannexImport: created LengthOfStayDiscount monthly property={} -{}%",
                        prop.getId(), info.monthlyPriceFactor());
                }
            }
        } catch (Exception e) {
            log.warn("ChannexImport: creation LengthOfStayDiscount KO property={} : {}",
                prop.getId(), e.getMessage());
        }
        return created;
    }

    /** Idempotence check : evite de creer une 2e discount avec le meme minNights. */
    private boolean hasExistingDiscount(Long propertyId, Long orgId, int minNights) {
        return lengthOfStayDiscountRepository.findByPropertyId(propertyId, orgId).stream()
            .anyMatch(d -> d.getMinNights() == minNights);
    }

    /**
     * Resultat de la resolution d'amenities en 3 buckets : codes Clenzy mappes
     * (built-in + aliases admin), noms bruts ignores silencieusement, noms
     * bruts qui restent a mapper (stockes dans ota_raw_amenities).
     */
    private static final class ResolvedAmenities {
        java.util.Set<String> mapped = new java.util.LinkedHashSet<>();
        java.util.Set<String> stillUnmapped = new java.util.LinkedHashSet<>();
    }

    /**
     * Classe les amenities scrapees en appliquant, dans l'ordre :
     * <ol>
     *   <li>Le mapping built-in {@link #AIRBNB_AMENITY_TO_CLENZY} → mapped</li>
     *   <li>Les aliases admin de l'org → mapped</li>
     *   <li>Les ignored admin de l'org → droppe</li>
     *   <li>Reste → stillUnmapped (pour ota_raw_amenities)</li>
     * </ol>
     */
    private static ResolvedAmenities resolveAmenitiesWithUserConfig(
            AirbnbListingData data,
            Map<String, String> userAliases,
            Set<String> userIgnored) {
        ResolvedAmenities r = new ResolvedAmenities();
        if (data == null) return r;

        // Bucket 1 : deja mappes par le built-in (WIFI, TV, ...)
        if (data.mappedAmenities() != null) {
            r.mapped.addAll(data.mappedAmenities());
        }

        // Bucket 2 : applique aliases admin + ignored sur les unmapped restants
        if (data.unmappedAmenities() != null) {
            for (String raw : data.unmappedAmenities()) {
                String lower = raw.toLowerCase().trim();
                if (userIgnored.contains(lower)) {
                    continue; // explicitement droppe par l'admin
                }
                String aliasedCode = userAliases.get(lower);
                if (aliasedCode != null) {
                    r.mapped.add(aliasedCode);
                } else {
                    r.stillUnmapped.add(raw); // a mapper plus tard via UI
                }
            }
        }
        return r;
    }

    // ─── Helpers null-safe pour extraction structuree JsonNode ──────────────
    // Channex peut renvoyer le champ absent, null, ou type wrong — ces helpers
    // retournent null dans tous ces cas plutot que de lever une exception.

    private static BigDecimal bigDecimalOrNull(JsonNode parent, String fieldName) {
        JsonNode node = parent.path(fieldName);
        if (node.isMissingNode() || node.isNull()) return null;
        try {
            return BigDecimal.valueOf(node.asDouble());
        } catch (Exception e) {
            return null;
        }
    }

    private static Integer intOrNull(JsonNode parent, String fieldName) {
        JsonNode node = parent.path(fieldName);
        if (node.isMissingNode() || node.isNull() || !node.canConvertToInt()) return null;
        return node.asInt();
    }

    private static Double doubleOrNull(JsonNode parent, String fieldName) {
        JsonNode node = parent.path(fieldName);
        if (node.isMissingNode() || node.isNull()) return null;
        try {
            return node.asDouble();
        } catch (Exception e) {
            return null;
        }
    }

    private static Boolean boolOrNull(JsonNode parent, String fieldName) {
        JsonNode node = parent.path(fieldName);
        if (node.isMissingNode() || node.isNull() || !node.isBoolean()) return null;
        return node.asBoolean();
    }

    /** Decode les entites HTML basiques rencontrees dans og:title. */
    private static String decodeHtmlEntities(String s) {
        return s.replace("&amp;", "&")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&nbsp;", " ");
    }
}
