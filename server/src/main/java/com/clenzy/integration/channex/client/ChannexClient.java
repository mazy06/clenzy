package com.clenzy.integration.channex.client;

import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.config.ChannexProperties;
import com.clenzy.integration.channex.dto.ChannexAvailabilityUpdate;
import com.clenzy.integration.channex.dto.ChannexChannelDto;
import com.clenzy.integration.channex.dto.ChannexCreateChannelRequest;
import com.clenzy.integration.channex.dto.ChannexCreatePropertyRequest;
import com.clenzy.integration.channex.dto.ChannexCreateRatePlanRequest;
import com.clenzy.integration.channex.dto.ChannexCreateRoomTypeRequest;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
import com.clenzy.integration.channex.dto.ChannexRatePlanDto;
import com.clenzy.integration.channex.dto.ChannexRateUpdate;
import com.clenzy.integration.channex.dto.ChannexRoomTypeDto;
import com.clenzy.integration.channex.exception.ChannexException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Client HTTP REST pour l'API Channex (v1).
 *
 * <p><b>Auth :</b> API key dans le header custom {@code user-api-key}
 * (Channex n'utilise PAS {@code Authorization: Bearer} — voir docs.channex.io/api-v1/authorization).</p>
 *
 * <p><b>Retry :</b> {@link ChannexProperties#getMaxRetries()} tentatives en
 * backoff exponentiel (200ms, 400ms, 800ms) sur les erreurs retryables
 * (rate limit 429, 5xx, timeout). Les 4xx (sauf 429) ne sont pas retries.</p>
 *
 * <p><b>Limites Channex (selon docs.channex.io) :</b></p>
 * <ul>
 *   <li>Rate limit : 100 req/min par API key</li>
 *   <li>Batch availability : max 500 updates par appel</li>
 *   <li>Batch rates : max 500 updates par appel</li>
 * </ul>
 *
 * <p>Tous les payloads sont au format JSON:API (wrapper {@code data}). Le
 * client gere la transformation.</p>
 */
@Component
public class ChannexClient {

    private static final Logger log = LoggerFactory.getLogger(ChannexClient.class);

    private final RestTemplate restTemplate;
    private final ChannexProperties props;
    private final ChannexMetrics metrics;
    private final ObjectMapper objectMapper;
    private final com.clenzy.integration.channex.service.ChannexCapabilityService capabilities;

    public ChannexClient(@Qualifier("channexRestTemplate") RestTemplate restTemplate,
                          ChannexProperties props,
                          ChannexMetrics metrics,
                          ObjectMapper objectMapper,
                          com.clenzy.integration.channex.service.ChannexCapabilityService capabilities) {
        this.restTemplate = restTemplate;
        this.props = props;
        this.metrics = metrics;
        this.objectMapper = objectMapper;
        this.capabilities = capabilities;
    }

    // ─── Properties ─────────────────────────────────────────────────────────

    /**
     * Cree une nouvelle property cote Channex et retourne ses identifiants.
     * Doit etre suivi de la creation d'un room_type et d'un rate_plan.
     */
    public ChannexPropertyDto createProperty(ChannexCreatePropertyRequest req) {
        String url = props.getBaseUrl() + "/properties";
        ChannexPropertyDto created = exchange(HttpMethod.POST, url, req.toApiPayload(), ChannexPropertyDto.class);
        log.info("Channex: property created id={} title={}", created.id(), created.title());
        return created;
    }

    /** Recupere une property Channex par ID. */
    public ChannexPropertyDto getProperty(String channexPropertyId) {
        String url = props.getBaseUrl() + "/properties/" + channexPropertyId;
        return exchange(HttpMethod.GET, url, null, ChannexPropertyDto.class);
    }

    /** Supprime une property Channex (utilise quand un mapping est supprime cote Clenzy). */
    public void deleteProperty(String channexPropertyId) {
        String url = props.getBaseUrl() + "/properties/" + channexPropertyId;
        exchange(HttpMethod.DELETE, url, null, Void.class);
        log.info("Channex: property deleted id={}", channexPropertyId);
    }

    /**
     * Met a jour le titre d'une property Channex existante (utile pour renommer
     * une property "pivot" OAuth Bridge consommee afin de liberer le nom canonique
     * pour une nouvelle session OAuth).
     */
    public void updatePropertyTitle(String channexPropertyId, String newTitle) {
        String url = props.getBaseUrl() + "/properties/" + channexPropertyId;
        Map<String, Object> body = Map.of("property", Map.of("title", newTitle));
        exchange(HttpMethod.PUT, url, body, Void.class);
        log.info("Channex: property {} renamed to '{}'", channexPropertyId, newTitle);
    }

    /**
     * Recupere TOUTES les properties Channex du compte (raw JSON pour acceder
     * aux attributes + relationships).
     *
     * <p>Utilise par {@link com.clenzy.integration.channex.service.ChannexImportService}
     * pour la discovery des properties non-mappees dans Clenzy.</p>
     *
     * @return JsonNode racine du payload Channex {@code {"data":[...], "meta":...}}
     */
    public JsonNode fetchAllPropertiesRaw() {
        String url = props.getBaseUrl() + "/properties";
        return exchange(HttpMethod.GET, url, null, JsonNode.class);
    }

    /**
     * Recupere une property Channex specifique en raw JSON (utile quand on a
     * besoin de relationships ou de champs non exposes dans {@link ChannexPropertyDto}).
     */
    public JsonNode fetchPropertyRaw(String channexPropertyId) {
        String url = props.getBaseUrl() + "/properties/" + channexPropertyId;
        return exchange(HttpMethod.GET, url, null, JsonNode.class);
    }

    // ─── Channels (creation + mapping aux OTAs) ─────────────────────────────

    /**
     * Recupere le group_id Channex d'une property donnee.
     *
     * <p>Tout channel doit etre attache a un group : c'est l'organisation
     * proprietaire dans Channex (un compte = potentiellement plusieurs groups
     * via co-hosting). On extrait l'id depuis {@code relationships.groups.data[0].id}
     * du payload GET /properties/{id}.</p>
     *
     * @throws ChannexException si la property n'a pas de group (cas anormal)
     */
    public String fetchPropertyGroupId(String channexPropertyId) {
        String url = props.getBaseUrl() + "/properties/" + channexPropertyId;
        // JsonNode.class : exchange() court-circuite l'unwrap JSON:API et on
        // recupere le payload brut {data:{id, attributes, relationships}}.
        // On a besoin de relationships qui n'est pas dans attributes.
        JsonNode response = exchange(HttpMethod.GET, url, null, JsonNode.class);
        JsonNode groupNode = response != null
            ? response.path("data").path("relationships").path("groups").path("data")
            : null;
        if (groupNode != null && groupNode.isArray() && groupNode.size() > 0) {
            String groupId = groupNode.get(0).path("id").asText(null);
            if (groupId != null && !groupId.isBlank()) {
                return groupId;
            }
        }
        throw new ChannexException(ChannexException.Kind.NOT_FOUND,
            "No group_id found for Channex property " + channexPropertyId);
    }

    /**
     * Cree un nouveau channel cote Channex avec tout pre-rempli (title, OTA, mapping).
     *
     * <p>Le channel est cree en {@code is_active = false} : c'est l'OAuth (Airbnb)
     * ou la saisie de credentials (Booking/Vrbo/Expedia) cote iframe Channex qui
     * va l'activer. Notre frontend ouvre ensuite l'iframe directement sur le
     * channel cree (cf. {@link #createChannelEmbedUrl}).</p>
     *
     * @return DTO avec l'ID Channex du channel cree (utile pour le deep-link iframe)
     */
    public ChannexChannelDto createChannel(ChannexCreateChannelRequest req) {
        String url = props.getBaseUrl() + "/channels";
        ChannexChannelDto created = exchange(HttpMethod.POST, url, req.toApiPayload(),
            ChannexChannelDto.class);
        log.info("Channex: channel created id={} title={} channel={} property={}",
            created.id(), created.title(), created.channelName(), req.propertyId());
        return created;
    }

    /** Supprime un channel Channex (cas d'erreur / rollback / disconnect OTA).
     *
     * <p><b>ATTENTION</b> : Channex refuse de DELETE un channel actif avec un
     * 400 {@code validation_error: channel is active}. Toujours appeler
     * {@link #deactivateChannel} d'abord, OU utiliser
     * {@code ChannexImportService#disconnectOtaChannel} qui fait le 2-step.</p>
     */
    public void deleteChannel(String channexChannelId) {
        String url = props.getBaseUrl() + "/channels/" + channexChannelId;
        exchange(HttpMethod.DELETE, url, null, Void.class);
        log.info("Channex: channel deleted id={}", channexChannelId);
    }

    /**
     * Desactive un channel Channex ({@code is_active=false}) sans le supprimer.
     * Necessaire avant {@link #deleteChannel} (Channex refuse DELETE sur actif).
     * Effet immediat : Channex arrete de pusher vers l'OTA → l'OTA reprend
     * la main sur la gestion du listing.
     */
    public void deactivateChannel(String channexChannelId) {
        String url = props.getBaseUrl() + "/channels/" + channexChannelId;
        Map<String, Object> body = Map.of(
            "channel", Map.of("is_active", false)
        );
        exchange(HttpMethod.PUT, url, body, Void.class);
        log.info("Channex: channel deactivated id={} (is_active=false)", channexChannelId);
    }

    /**
     * Liste TOUS les channels du hub en JSON brut (utilise par
     * {@link com.clenzy.integration.channex.service.ChannexImportService}
     * pour la vue "Gerer les OTAs connectes").
     */
    public JsonNode fetchAllChannelsRaw() {
        String url = props.getBaseUrl() + "/channels";
        return exchange(HttpMethod.GET, url, null, JsonNode.class);
    }

    /**
     * Verifie si au moins un channel OTA est actif (OAuth ou credentials valides)
     * pour une property Channex donnee.
     *
     * <p>Sert de gate pour les push de sync Clenzy → Channex : tant qu'aucun OTA
     * n'est branche, push availability/rates est inutile (les donnees n'iront
     * nulle part). On evite ainsi les API calls inutiles et la pollution de
     * Channex.</p>
     *
     * <p><b>Limitation Channex</b> : le filter {@code ?filter[property_id]=X}
     * sur {@code /channels} ne renvoie rien (le mapping property↔channel n'est
     * pas indexe dans l'API publique). On fait donc un GET de tous les channels
     * du group et on filtre cote Java sur {@code is_active} + presence de la
     * property dans {@code properties[]}.</p>
     *
     * @return true si au moins un channel actif lie a cette property existe
     */
    public boolean hasActiveOtaChannel(String channexPropertyId) {
        String url = props.getBaseUrl() + "/channels";
        JsonNode response = exchange(HttpMethod.GET, url, null, JsonNode.class);
        if (response == null || !response.path("data").isArray()) {
            return false;
        }
        for (JsonNode channel : response.path("data")) {
            JsonNode attrs = channel.path("attributes");
            if (!attrs.path("is_active").asBoolean(false)) continue;
            // Channex peut exposer la liste des property_ids du channel soit dans
            // attributes.properties[] (array de strings d'UUIDs), soit dans
            // relationships.properties.data[].id. On verifie les deux.
            JsonNode propsArray = attrs.path("properties");
            if (propsArray.isArray()) {
                for (JsonNode p : propsArray) {
                    if (channexPropertyId.equals(p.asText(null))) return true;
                }
            }
            JsonNode rels = channel.path("relationships").path("properties").path("data");
            if (rels.isArray()) {
                for (JsonNode p : rels) {
                    if (channexPropertyId.equals(p.path("id").asText(null))) return true;
                }
            }
        }
        return false;
    }

    /**
     * Genere une URL iframe Channex qui ouvre directement la page d'edition
     * d'un channel deja cree — l'utilisateur n'a plus qu'a finaliser l'OAuth
     * (bouton "Connect with Airbnb") ou saisir ses credentials OTA.
     *
     * <p>Skip toute l'etape "Create Channel" (selection OTA + title + currency)
     * qui est deja faite via {@link #createChannel}.</p>
     */
    public String createChannelEmbedUrl(String channexPropertyId, String channexChannelId,
                                          String username, String language) {
        String tokenUrl = props.getBaseUrl() + "/auth/one_time_token";
        Map<String, Object> body = Map.of(
            "one_time_token", Map.of(
                "property_id", channexPropertyId,
                "username", username
            )
        );

        JsonNode response = exchange(HttpMethod.POST, tokenUrl, body, JsonNode.class);
        String token = response != null ? response.path("data").path("token").asText(null) : null;
        if (token == null || token.isBlank()) {
            throw new ChannexException(ChannexException.Kind.SERVER_ERROR,
                "Channex did not return a one-time token");
        }

        String iframeBase = stripApiSuffix(props.getBaseUrl());
        String lang = (language != null && !language.isBlank()) ? language : "fr";

        // Tests empiriques : Channex n'expose pas /channels/{id} ni /channels/{id}/edit
        // en deep-link (les paths non /channels font fallback sur le dashboard).
        // Strategie : on ouvre /channels (la liste) qui CONTIENT deja notre channel
        // fraichement cree via API. L'utilisateur le voit, clique dessus, et
        // arrive sur la page d'edition avec le bouton "Connect with <OTA>".
        // Le channelId n'est pas dans l'URL mais on le loggue pour traceabilite.
        String url = iframeBase + "/auth/exchange"
            + "?oauth_session_key=" + token
            + "&app_mode=headless"
            + "&redirect_to=/channels"
            + "&property_id=" + channexPropertyId
            + "&lng=" + lang;

        log.info("Channex: channel-scoped embed URL generated channel={} property={} lang={}",
            channexChannelId, channexPropertyId, lang);
        return url;
    }

    // ─── Embedded iframe (Channel IFrame) ───────────────────────────────────

    /**
     * Cree un one-time access token Channex et retourne l'URL d'iframe a embarquer
     * cote Clenzy pour permettre a l'utilisateur de connecter Airbnb / Booking /
     * Vrbo / Expedia a sa property sans quitter le PMS.
     *
     * <p>Flow Channex (cf. docs.channex.io/api-v.1-documentation/channel-iframe) :</p>
     * <ol>
     *   <li>{@code POST /api/v1/auth/one_time_token} avec property_id + username
     *       → renvoie un token UUID a usage unique, valable 15 minutes</li>
     *   <li>Le frontend ouvre {@code https://staging.channex.io/auth/exchange?
     *       oauth_session_key=&lt;token&gt;&app_mode=headless&redirect_to=/channels
     *       &property_id=&lt;id&gt;}</li>
     *   <li>La iframe consomme le token et garde une session active jusqu'a
     *       fermeture de l'onglet (pas de TTL apres exchange).</li>
     * </ol>
     *
     * @param channexPropertyId UUID Channex de la property a connecter
     * @param username          identite cote Clenzy (typiquement l'email de l'admin)
     *                          — sert d'audit cote dashboard Channex
     * @param language          code langue UI iframe (fr, en, es, ...) — default "fr"
     * @param channelCode       code 3 lettres Channex pour pre-filtrer le wizard a un seul OTA
     *                          (ABB=Airbnb, BDC=Booking, VRB=Vrbo, EXP=Expedia, AGO=Agoda).
     *                          {@code null} ou vide → tous les OTAs visibles.
     * @return URL complete prete pour {@code <iframe src=...>}
     */
    public String createEmbedUrl(String channexPropertyId, String username, String language,
                                   String channelCode) {
        String tokenUrl = props.getBaseUrl() + "/auth/one_time_token";
        Map<String, Object> body = Map.of(
            "one_time_token", Map.of(
                "property_id", channexPropertyId,
                "username", username
            )
        );

        JsonNode response = exchange(HttpMethod.POST, tokenUrl, body, JsonNode.class);
        String token = response != null ? response.path("data").path("token").asText(null) : null;
        if (token == null || token.isBlank()) {
            throw new ChannexException(ChannexException.Kind.SERVER_ERROR,
                "Channex did not return a one-time token (response: " + response + ")");
        }

        // L'iframe se trouve sur la base du domaine Channex (sans /api/v1).
        // base-url ex: https://staging.channex.io/api/v1 → iframe: https://staging.channex.io
        String iframeBase = stripApiSuffix(props.getBaseUrl());
        String lang = (language != null && !language.isBlank()) ? language : "fr";

        // redirect_to=/channels = path officiel documente Channex qui ouvre
        // la liste des channels avec le bouton "+ Create" en haut a droite.
        // (On a teste /channels/new mais Channex fallback sur le dashboard /,
        // ce qui pert l'utilisateur. /channels est le path safe.)
        StringBuilder url = new StringBuilder(iframeBase + "/auth/exchange")
            .append("?oauth_session_key=").append(token)
            .append("&app_mode=headless")
            .append("&redirect_to=/channels")
            .append("&property_id=").append(channexPropertyId)
            .append("&lng=").append(lang);

        // Pre-filtre la liste Channex sur un seul OTA si le caller a choisi.
        // Channex param documente : available_channels (filtre les OTAs connectables).
        if (channelCode != null && !channelCode.isBlank()) {
            url.append("&available_channels=").append(channelCode.toUpperCase());
        }

        log.info("Channex: embed URL generated property={} username={} lang={} channel={}",
            channexPropertyId, username, lang, channelCode);
        return url.toString();
    }

    /** Overload sans pre-filtre OTA (toute la liste Channex visible). */
    public String createEmbedUrl(String channexPropertyId, String username, String language) {
        return createEmbedUrl(channexPropertyId, username, language, null);
    }

    /** Retire le suffixe {@code /api/v1} (ou {@code /api}) d'une base URL pour obtenir l'origine. */
    private static String stripApiSuffix(String baseUrl) {
        return baseUrl.replaceAll("/api(/v\\d+)?/?$", "");
    }

    // ─── Room Types ─────────────────────────────────────────────────────────

    /**
     * Cree un Room Type cote Channex, sous-resource d'une Property.
     * Au moins 1 room_type est requis avant de pouvoir creer un rate_plan
     * ou push des disponibilites.
     */
    public ChannexRoomTypeDto createRoomType(ChannexCreateRoomTypeRequest req) {
        String url = props.getBaseUrl() + "/room_types";
        ChannexRoomTypeDto created = exchange(HttpMethod.POST, url, req.toApiPayload(), ChannexRoomTypeDto.class);
        log.info("Channex: room_type created id={} title={} property={}",
            created.id(), created.title(), created.propertyId());
        return created;
    }

    // ─── Rate Plans ─────────────────────────────────────────────────────────

    /**
     * Cree un Rate Plan cote Channex, lie a un Room Type.
     * Au moins 1 rate_plan est requis avant de pouvoir push des prix.
     */
    /**
     * Update partiel des settings d'un rate_plan Channex existant — Phase 5
     * OTA pricing (push complet bidirectionnel).
     *
     * <p>Permet de pousser vers l'OTA les modifs faites cote Clenzy sur :
     * weekend_price, guests_included, price_per_extra_person, weekly/monthly
     * factors, default_min/max_nights. Seuls les champs non-null dans
     * {@code update} sont inclus dans le payload (partial update).</p>
     *
     * <p>Best-effort cote caller : Channex peut rejeter si l'API ne supporte
     * pas l'update sur un rate_plan provenant d'OAuth Airbnb (read-only cote
     * channel managed). On laisse l'exception remonter pour que le caller log.</p>
     *
     * @param channexRatePlanId UUID du rate_plan a updater
     * @param update            settings a pousser (au moins 1 champ non-null)
     * @throws IllegalArgumentException si {@code update.hasContent() == false}
     */
    public void updateRatePlanSettings(String channexRatePlanId,
                                         com.clenzy.integration.channex.dto.ChannexRatePlanSettingsUpdate update) {
        if (update == null || !update.hasContent()) {
            throw new IllegalArgumentException(
                "updateRatePlanSettings: payload vide (au moins 1 champ requis)");
        }
        String url = props.getBaseUrl() + "/rate_plans/" + channexRatePlanId;
        exchange(HttpMethod.PUT, url, update.toApiPayload(), Void.class);
        log.info("Channex: rate_plan settings updated id={} (fields applied via partial update)",
            channexRatePlanId);
    }

    public ChannexRatePlanDto createRatePlan(ChannexCreateRatePlanRequest req) {
        String url = props.getBaseUrl() + "/rate_plans";
        ChannexRatePlanDto created = exchange(HttpMethod.POST, url, req.toApiPayload(), ChannexRatePlanDto.class);
        log.info("Channex: rate_plan created id={} title={} property={} room_type={}",
            created.id(), created.title(), created.propertyId(), created.roomTypeId());
        return created;
    }

    // ─── Listing room_types / rate_plans par property ───────────────────────

    /**
     * Liste les room_types Channex d'une property donnee (raw JSON pour acceder
     * a tous les champs y compris {@code count_of_rooms} et la liste d'occupancies).
     *
     * <p>Utilise par {@link com.clenzy.integration.channex.service.ChannexImportService}
     * pour resoudre l'ID room_type lors de l'import : si Channex a deja cree un
     * room_type (cas typique apres OAuth Airbnb), on prend le 1er ; sinon, on en
     * cree un par defaut via {@link #createRoomType}.</p>
     *
     * @return liste des room_types (vide si aucun)
     */
    public List<ChannexRoomTypeDto> fetchRoomTypesForProperty(String channexPropertyId) {
        String url = props.getBaseUrl() + "/room_types?filter[property_id]=" + channexPropertyId;
        JsonNode raw = exchange(HttpMethod.GET, url, null, JsonNode.class);
        return parseDtoListFromJsonApi(raw, ChannexRoomTypeDto.class);
    }

    /**
     * Liste les rate_plans Channex d'une property donnee.
     * Meme logique que {@link #fetchRoomTypesForProperty} pour le mapping import.
     */
    public List<ChannexRatePlanDto> fetchRatePlansForProperty(String channexPropertyId) {
        String url = props.getBaseUrl() + "/rate_plans?filter[property_id]=" + channexPropertyId;
        JsonNode raw = exchange(HttpMethod.GET, url, null, JsonNode.class);
        return parseDtoListFromJsonApi(raw, ChannexRatePlanDto.class);
    }

    /**
     * Detail complet d'un room_type Channex (avec occupancies + content).
     * Endpoint exposable {@code GET /room_types/{id}}.
     *
     * <p>Donne enfin les capacites fiables : {@code count_of_rooms},
     * {@code occ_adults/children/infants}, {@code default_occupancy}.
     * Plus precis que les valeurs par defaut Channex (souvent 10) qu'on
     * recupere via property.max_count_of_occupancies.</p>
     *
     * @return null si introuvable ou erreur (best-effort)
     */
    public com.clenzy.integration.channex.dto.ChannexRoomTypeDetailDto fetchRoomTypeDetail(
            String channexRoomTypeId) {
        if (channexRoomTypeId == null || channexRoomTypeId.isBlank()) return null;
        try {
            String url = props.getBaseUrl() + "/room_types/" + channexRoomTypeId;
            return exchange(HttpMethod.GET, url, null,
                com.clenzy.integration.channex.dto.ChannexRoomTypeDetailDto.class);
        } catch (Exception e) {
            log.debug("Channex: fetchRoomTypeDetail KO id={} : {}", channexRoomTypeId, e.getMessage());
            return null;
        }
    }

    /**
     * Hotel policies d'une property Channex.
     * Endpoint {@code GET /hotel_policies?filter[property_id]=...}.
     *
     * <p>Donne les horaires check-in/out + politiques pets/smoking +
     * max_count_of_guests confirme (cross-check avec room_type).</p>
     *
     * @return liste (souvent 0 ou 1 item) — vide si rien defini cote wizard
     */
    public List<com.clenzy.integration.channex.dto.ChannexHotelPolicyDto> fetchHotelPoliciesForProperty(
            String channexPropertyId) {
        if (channexPropertyId == null || channexPropertyId.isBlank()) return List.of();
        try {
            String url = props.getBaseUrl() + "/hotel_policies?filter[property_id]=" + channexPropertyId;
            JsonNode raw = exchange(HttpMethod.GET, url, null, JsonNode.class);
            return parseDtoListFromJsonApi(raw,
                com.clenzy.integration.channex.dto.ChannexHotelPolicyDto.class);
        } catch (Exception e) {
            log.debug("Channex: fetchHotelPoliciesForProperty KO property={} : {}",
                channexPropertyId, e.getMessage());
            return List.of();
        }
    }

    /**
     * Photos uploadees sur Channex pour une property (endpoint plat).
     * Endpoint {@code GET /photos?filter[property_id]=...}.
     *
     * <p>NB : Channex ne sync PAS automatiquement les photos des OTAs vers ce
     * endpoint. Ces photos sont uniquement celles qu'on a uploadees via API
     * ({@code POST /photos}) ou via wizard. A combiner avec les photos de
     * {@code attributes.content.photos} (qui peuvent aussi etre celles
     * uploadees au moment de la creation de la property).</p>
     */
    public List<com.clenzy.integration.channex.dto.ChannexPhotoDto> fetchPhotosForProperty(
            String channexPropertyId) {
        if (channexPropertyId == null || channexPropertyId.isBlank()) return List.of();
        try {
            String url = props.getBaseUrl() + "/photos?filter[property_id]=" + channexPropertyId;
            JsonNode raw = exchange(HttpMethod.GET, url, null, JsonNode.class);
            return parseDtoListFromJsonApi(raw,
                com.clenzy.integration.channex.dto.ChannexPhotoDto.class);
        } catch (Exception e) {
            log.debug("Channex: fetchPhotosForProperty KO property={} : {}",
                channexPropertyId, e.getMessage());
            return List.of();
        }
    }

    /**
     * Catalogue global des facilities Channex (~180 entries standards).
     * Endpoint {@code GET /property_facilities/options} (collection non
     * filtrable par property — c'est un catalogue de reference).
     *
     * <p>Sert a alimenter l'UI Clenzy de mapping des amenities pour suggerer
     * des libelles standards (wifi, free parking, gym, ...) plutot que de
     * forcer l'admin a tout saisir from scratch.</p>
     */
    public List<com.clenzy.integration.channex.dto.ChannexFacilityOptionDto> fetchPropertyFacilityCatalog() {
        try {
            String url = props.getBaseUrl() + "/property_facilities/options";
            JsonNode raw = exchange(HttpMethod.GET, url, null, JsonNode.class);
            return parseDtoListFromJsonApi(raw,
                com.clenzy.integration.channex.dto.ChannexFacilityOptionDto.class);
        } catch (Exception e) {
            log.debug("Channex: fetchPropertyFacilityCatalog KO : {}", e.getMessage());
            return List.of();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ─── WHITELABEL-ONLY (auto-detect runtime, pas de config) ─────────────
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Les methodes ci-dessous appellent les endpoints reserves aux comptes
    // Channex Whitelabel. Comportement automatique :
    //
    //   1. 1er call → on tente l'endpoint
    //   2. Si succes → markAvailable, cached 24h, calls suivants utilisent WL
    //   3. Si UNAUTHORIZED (401/403) → markUnavailable, cached 1h,
    //      calls suivants short-circuit en Optional.empty (caller fait fallback)
    //   4. Apres TTL expire → on retente (detecte automatiquement quand
    //      l'acces whitelabel est accorde sans redeploiement)
    //
    // Aucune config YAML. Aucun feature flag. Le code essaie tout le temps,
    // le cache evite juste de spammer Channex avec des calls deja confirmes KO.
    //
    // Ref : https://docs.channex.io/api-v.1-documentation/channel-api
    // "Access to the channel API is only for Whitelabel accounts"

    /** Pattern commun a toutes les methodes WL : check cache + try + mark. */
    private interface WhitelabelCall<T> { T execute() throws Exception; }
    private <T> java.util.Optional<T> tryWhitelabel(
            com.clenzy.integration.channex.service.ChannexCapabilityService.Capability cap,
            String operationLabel,
            WhitelabelCall<T> call) {
        if (!capabilities.isAvailable(cap)) {
            // Cached as unavailable → skip silencieusement (caller fait fallback)
            return java.util.Optional.empty();
        }
        try {
            T result = call.execute();
            capabilities.markAvailable(cap);
            return java.util.Optional.ofNullable(result);
        } catch (ChannexException e) {
            if (e.getKind() == ChannexException.Kind.UNAUTHORIZED) {
                capabilities.markUnavailable(cap);
                log.debug("Channex WL: {} → UNAUTHORIZED → cached as unavailable 1h", operationLabel);
            } else {
                log.debug("Channex WL: {} → {} : {}", operationLabel, e.getKind(), e.getMessage());
            }
            return java.util.Optional.empty();
        } catch (Exception e) {
            log.debug("Channex WL: {} → {}", operationLabel, e.getMessage());
            return java.util.Optional.empty();
        }
    }

    /**
     * Liste les listings OTA exposes sous un channel donne.
     *
     * <p><b>Endpoint whitelabel</b> : {@code GET /channels/{id}/listings}.</p>
     *
     * <p>Permet de recuperer le nom textuel humain de chaque listing OTA
     * (ex Airbnb "Prestige Duplex Haut Standing") sans avoir a scraper la
     * page publique. Aussi : description, mappings actuels vers les rooms
     * Channex, OTA source.</p>
     */
    public java.util.Optional<List<com.clenzy.integration.channex.dto.ChannexChannelListingDto>>
            fetchChannelListings(String channelId) {
        if (channelId == null || channelId.isBlank()) return java.util.Optional.empty();
        return tryWhitelabel(
            com.clenzy.integration.channex.service.ChannexCapabilityService.Capability.CHANNEL_DETAILS,
            "fetchChannelListings channel=" + channelId,
            () -> {
                String url = props.getBaseUrl() + "/channels/" + channelId + "/listings";
                JsonNode raw = exchange(HttpMethod.GET, url, null, JsonNode.class);
                return parseDtoListFromJsonApi(raw,
                    com.clenzy.integration.channex.dto.ChannexChannelListingDto.class);
            });
    }

    /**
     * Detail d'une listing OTA specifique sous un channel.
     *
     * <p><b>Endpoint whitelabel</b> : {@code GET /channels/{channelId}/listings/{listingId}}.</p>
     */
    public java.util.Optional<com.clenzy.integration.channex.dto.ChannexChannelListingDto>
            fetchChannelListingDetail(String channelId, String listingId) {
        if (channelId == null || listingId == null) return java.util.Optional.empty();
        return tryWhitelabel(
            com.clenzy.integration.channex.service.ChannexCapabilityService.Capability.CHANNEL_DETAILS,
            "fetchChannelListingDetail " + channelId + "/" + listingId,
            () -> {
                String url = props.getBaseUrl() + "/channels/" + channelId
                    + "/listings/" + listingId;
                return exchange(HttpMethod.GET, url, null,
                    com.clenzy.integration.channex.dto.ChannexChannelListingDto.class);
            });
    }

    /**
     * Mappe programmatiquement une listing OTA vers une room + rate_plan Channex.
     *
     * <p><b>Endpoint whitelabel</b> : {@code POST /channels/{cid}/listings/{lid}/map}.</p>
     *
     * <p>Permet d'eviter le wizard manuel Channex (Mapping tab) : on lit les
     * listings via {@link #fetchChannelListings}, on les mappe automatiquement
     * sur le room_type pre-cree, on save. Tout automatise.</p>
     *
     * @return true si OK, false si echec (caller fait fallback)
     */
    public boolean mapListingToRoom(String channelId, String listingId,
                                      String roomTypeId, String ratePlanId) {
        return tryWhitelabel(
            com.clenzy.integration.channex.service.ChannexCapabilityService.Capability.LISTING_OPERATIONS,
            "mapListingToRoom " + channelId + "/" + listingId,
            () -> {
                String url = props.getBaseUrl() + "/channels/" + channelId
                    + "/listings/" + listingId + "/map";
                Map<String, Object> body = Map.of(
                    "room_type_id", roomTypeId,
                    "rate_plan_id", ratePlanId
                );
                exchange(HttpMethod.POST, url, body, Void.class);
                log.info("Channex WL: mapped listing {} → room {} channel {}",
                    listingId, roomTypeId, channelId);
                return true;
            }).orElse(false);
    }

    /**
     * Liste les facilities (= amenities) d'une property via la relation
     * Channex (populated chez whitelabel, vide en public).
     *
     * <p><b>Endpoint whitelabel</b> : {@code GET /properties/{id}?include=facilities}
     * (utilise l'include JSON:API pour ne pas faire 2 calls separes).</p>
     */
    public java.util.Optional<List<com.clenzy.integration.channex.dto.ChannexFacilityOptionDto>>
            fetchPropertyFacilities(String propertyId) {
        if (propertyId == null) return java.util.Optional.empty();
        return tryWhitelabel(
            com.clenzy.integration.channex.service.ChannexCapabilityService.Capability.PROPERTY_FACILITIES,
            "fetchPropertyFacilities property=" + propertyId,
            () -> {
                String url = props.getBaseUrl() + "/properties/" + propertyId
                    + "?include=facilities";
                JsonNode raw = exchange(HttpMethod.GET, url, null, JsonNode.class);
                JsonNode included = raw != null ? raw.path("included") : null;
                if (included == null || !included.isArray()) {
                    return List.<com.clenzy.integration.channex.dto.ChannexFacilityOptionDto>of();
                }
                List<com.clenzy.integration.channex.dto.ChannexFacilityOptionDto> facilities = new ArrayList<>();
                for (JsonNode item : included) {
                    if (!"facility".equals(item.path("type").asText(""))) continue;
                    JsonNode attrs = item.path("attributes");
                    facilities.add(new com.clenzy.integration.channex.dto.ChannexFacilityOptionDto(
                        item.path("id").asText(null),
                        attrs.path("title").asText(null),
                        attrs.path("category").asText(null)
                    ));
                }
                return facilities;
            });
    }

    /**
     * Enregistre un webhook Channex pour recevoir les push events.
     *
     * <p><b>Endpoint whitelabel</b> : {@code POST /webhooks}.</p>
     *
     * @param callbackUrl URL publique de notre controller webhook
     * @param eventNames  events a souscrire ({@code listing_updated},
     *                    {@code content_updated}, {@code property_updated}, ...)
     */
    public boolean registerWebhook(String callbackUrl, List<String> eventNames) {
        return tryWhitelabel(
            com.clenzy.integration.channex.service.ChannexCapabilityService.Capability.WEBHOOKS,
            "registerWebhook url=" + callbackUrl,
            () -> {
                String url = props.getBaseUrl() + "/webhooks";
                Map<String, Object> body = Map.of(
                    "webhook", Map.of(
                        "callback_url", callbackUrl,
                        "events", eventNames,
                        "is_active", true
                    )
                );
                exchange(HttpMethod.POST, url, body, Void.class);
                log.info("Channex WL: webhook registered url={} events={}", callbackUrl, eventNames);
                return true;
            }).orElse(false);
    }

    /**
     * Helper : parse une reponse JSON:API collection {@code {"data":[...]}} vers
     * une liste de DTOs. Chaque element de data a la forme
     * {@code {id, type, attributes:{...}}} — on aplatit id+attributes avant de
     * deserialiser chaque element.
     */
    private <T> List<T> parseDtoListFromJsonApi(JsonNode raw, Class<T> elementType) {
        if (raw == null || !raw.path("data").isArray()) return List.of();
        List<T> result = new ArrayList<>();
        for (JsonNode item : raw.path("data")) {
            JsonNode attrs = item.path("attributes");
            if (!attrs.isObject()) continue;
            ObjectNode flat = ((ObjectNode) attrs).deepCopy();
            if (item.has("id") && item.get("id").isTextual()) {
                flat.put("id", item.get("id").asText());
            }
            try {
                result.add(objectMapper.treeToValue(flat, elementType));
            } catch (Exception e) {
                log.warn("Channex: skip item invalide dans la collection ({}): {}",
                    elementType.getSimpleName(), e.getMessage());
            }
        }
        return result;
    }

    // ─── Availability ───────────────────────────────────────────────────────

    /**
     * Push d'un batch d'updates de disponibilite vers Channex.
     * Split automatique en chunks de 500 si la liste depasse la limite.
     */
    public void pushAvailability(List<ChannexAvailabilityUpdate> updates) {
        if (updates == null || updates.isEmpty()) return;

        for (List<ChannexAvailabilityUpdate> chunk : chunked(updates, 500)) {
            String url = props.getBaseUrl() + "/availability";
            Map<String, Object> body = Map.of(
                "values", chunk.stream().map(u -> Map.<String, Object>of(
                    "property_id", u.channexPropertyId(),
                    "room_type_id", u.channexRoomTypeId(),
                    "date", u.date().toString(),
                    "availability", u.availability()
                )).toList()
            );
            // Void.class : Channex renvoie un array de resultats pour les batches,
            // pas un objet — et on n'utilise pas le retour de toute facon.
            exchange(HttpMethod.POST, url, body, Void.class);
        }
        log.info("Channex: pushed {} availability updates", updates.size());
    }

    // ─── Rates ──────────────────────────────────────────────────────────────

    /**
     * Push d'un batch d'updates de tarifs vers Channex.
     * Inclut optionnellement les restrictions (min stay, closed-to-arrival/departure).
     */
    public void pushRates(List<ChannexRateUpdate> updates) {
        if (updates == null || updates.isEmpty()) return;

        for (List<ChannexRateUpdate> chunk : chunked(updates, 500)) {
            String url = props.getBaseUrl() + "/restrictions";
            Map<String, Object> body = Map.of(
                "values", chunk.stream().map(u -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("property_id", u.channexPropertyId());
                    entry.put("rate_plan_id", u.channexRatePlanId());
                    entry.put("date", u.date().toString());
                    entry.put("rate", normalize(u.rate()));
                    if (u.minStayThrough() != null) entry.put("min_stay_through", u.minStayThrough());
                    if (u.minStayArrival() != null) entry.put("min_stay_arrival", u.minStayArrival());
                    if (u.closedToArrival() != null) entry.put("closed_to_arrival", u.closedToArrival());
                    if (u.closedToDeparture() != null) entry.put("closed_to_departure", u.closedToDeparture());
                    return entry;
                }).toList()
            );
            // Void.class : Channex renvoie un array de resultats pour les batches,
            // pas un objet — et on n'utilise pas le retour de toute facon.
            exchange(HttpMethod.POST, url, body, Void.class);
        }
        log.info("Channex: pushed {} rate updates", updates.size());
    }

    /**
     * Pull du calendrier de tarifs Channex pour un rate_plan donne — Phase 2 OTA pricing.
     *
     * <p>Permet de capturer fidelement les prix par date deja presents cote OTA
     * au moment de la connexion (host qui a override le prix pour des dates
     * specifiques : festival, evenement, etc).</p>
     *
     * <p>Filtres JSON:API standards : property_id + rate_plan_id + plage de dates.
     * Channex retourne un array d'entries {date, rate, min_stay_through, ...}.
     * Best-effort : si Channex ne supporte pas l'endpoint ou renvoie un payload
     * vide, on retourne une {@link Optional#empty}.</p>
     *
     * <p><b>Format de retour</b> : map {@code date → Map(rate, restrictions)}
     * (Map<String,Object> pour rester souple sur les champs additionnels). Le
     * caller filtre/parse ce qui l'interesse.</p>
     *
     * @param channexPropertyId Property Channex
     * @param channexRatePlanId Rate plan a interroger (typiquement le default
     *                          du mapping)
     * @param from              Date min (inclusive)
     * @param to                Date max (inclusive)
     * @return liste des entries (vide si Channex repond mais aucune entry),
     *         {@link Optional#empty()} si l'endpoint ne supporte pas la query
     */
    public java.util.Optional<java.util.List<JsonNode>> fetchRatesForRange(
            String channexPropertyId, String channexRatePlanId,
            java.time.LocalDate from, java.time.LocalDate to) {
        try {
            // Channex JSON:API : filter[X] syntax. property_id + rate_plan_id +
            // plage. limit haut pour ne pas paginer (12 mois = 365 entries max).
            String url = props.getBaseUrl() + "/restrictions"
                + "?filter[property_id]=" + channexPropertyId
                + "&filter[rate_plan_id]=" + channexRatePlanId
                + "&filter[date][gte]=" + from
                + "&filter[date][lte]=" + to
                + "&pagination[limit]=500";
            JsonNode response = exchange(HttpMethod.GET, url, null, JsonNode.class);
            if (response == null || !response.path("data").isArray()) {
                log.debug("Channex: fetchRatesForRange retour vide property={} ratePlan={}",
                    channexPropertyId, channexRatePlanId);
                return java.util.Optional.of(java.util.List.of());
            }
            java.util.List<JsonNode> entries = new java.util.ArrayList<>();
            for (JsonNode entry : response.path("data")) {
                entries.add(entry);
            }
            log.info("Channex: fetched {} rate entries property={} ratePlan={} range=[{}, {}]",
                entries.size(), channexPropertyId, channexRatePlanId, from, to);
            return java.util.Optional.of(entries);
        } catch (ChannexException e) {
            // 404 / 400 / endpoint not supported : on degrade gracefully
            log.warn("Channex: fetchRatesForRange non supporte ou en erreur ({}), on skip",
                e.getMessage());
            return java.util.Optional.empty();
        } catch (Exception e) {
            log.warn("Channex: fetchRatesForRange erreur inattendue : {}", e.getMessage());
            return java.util.Optional.empty();
        }
    }

    // ─── Bookings ───────────────────────────────────────────────────────────

    /** Recupere une booking specifique (utile pour reconciliation post-webhook). */
    public JsonNode getBooking(String bookingId) {
        String url = props.getBaseUrl() + "/bookings/" + bookingId;
        return exchange(HttpMethod.GET, url, null, JsonNode.class);
    }

    /**
     * Liste les bookings d'une property sur une plage de dates.
     *
     * <p>Utilise pour l'import initial des reservations OTAs apres connexion
     * d'une property (reverse sync), et pour la reconciliation periodique.</p>
     *
     * @param channexPropertyId UUID de la property Channex
     * @param arrivalFrom       date d'arrivee minimum (inclus)
     * @param arrivalTo         date d'arrivee maximum (inclus)
     */
    public com.clenzy.integration.channex.dto.ChannexBookingsListResponse listBookings(
            String channexPropertyId,
            java.time.LocalDate arrivalFrom,
            java.time.LocalDate arrivalTo) {
        String url = props.getBaseUrl()
            + "/bookings?property_id=" + channexPropertyId
            + "&arrival_date_from=" + arrivalFrom
            + "&arrival_date_to=" + arrivalTo;
        return exchange(HttpMethod.GET, url, null,
            com.clenzy.integration.channex.dto.ChannexBookingsListResponse.class);
    }

    // ─── HTTP helpers ───────────────────────────────────────────────────────

    /**
     * Wrapper unique pour tous les appels HTTP avec retry + mapping d'erreur.
     * Visible package-private pour les tests.
     *
     * <p>Instrumente avec ChannexMetrics : compteurs success/error/retry
     * + histogramme latence avec tag operation (deduit du path URL).</p>
     */
    <T> T exchange(HttpMethod method, String url, Object body, Class<T> responseType) {
        if (!props.isConfigured()) {
            throw new ChannexException(ChannexException.Kind.UNAUTHORIZED,
                "Channex API key not configured (clenzy.channex.api-key)");
        }

        HttpHeaders headers = new HttpHeaders();
        // Channex utilise un header custom (pas Authorization: Bearer).
        // Ref: https://docs.channex.io/api-v1/authorization
        headers.set("user-api-key", props.getApiKey());
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        headers.set("User-Agent", "Clenzy-PMS/1.0 (channex-client)");

        HttpEntity<Object> entity = new HttpEntity<>(body, headers);
        String operation = deriveOperationTag(method, url);
        long startMs = System.currentTimeMillis();

        int attempt = 0;
        ChannexException lastError = null;
        while (attempt < Math.max(1, props.getMaxRetries())) {
            attempt++;
            try {
                // Toutes les reponses Channex transitent par JsonNode pour pouvoir
                // unwrap le format JSON:API ({data: {id, type, attributes}}) avant
                // deserialisation vers le DTO cible.
                ResponseEntity<JsonNode> response = restTemplate.exchange(url, method, entity, JsonNode.class);
                metrics.recordClientSuccess(operation, System.currentTimeMillis() - startMs);
                return convertJsonApiResponse(response.getBody(), responseType);
            } catch (HttpStatusCodeException e) {
                lastError = mapHttpError(e.getStatusCode(), e.getResponseBodyAsString());
                if (!lastError.isRetryable()) {
                    metrics.recordClientError(operation, lastError.getKind().name(),
                        System.currentTimeMillis() - startMs);
                    throw lastError;
                }
                metrics.recordClientRetry(operation);
                backoff(attempt);
            } catch (ResourceAccessException e) {
                lastError = new ChannexException(ChannexException.Kind.TRANSPORT,
                    "Network error calling Channex " + url + ": " + e.getMessage(), e);
                metrics.recordClientRetry(operation);
                backoff(attempt);
            }
        }
        // Retries exhausted
        metrics.recordClientError(operation,
            lastError != null ? lastError.getKind().name() : "TRANSPORT",
            System.currentTimeMillis() - startMs);
        throw lastError != null ? lastError
            : new ChannexException(ChannexException.Kind.TRANSPORT, "All retries failed for " + url);
    }

    /**
     * Convertit une reponse Channex (JSON:API) vers le type cible.
     *
     * <p>Channex enveloppe ses ressources singleton dans
     * {@code {"data": {"id": "uuid", "type": "property", "attributes": {...}}}}.
     * On flatten {@code id + attributes} au top-level avant deserialisation,
     * sinon Jackson ne retrouve pas les champs et tous les attributs sont null.</p>
     *
     * <p>Comportements speciaux :</p>
     * <ul>
     *   <li>{@code Void.class} ou body null → renvoie null (pour DELETE/PUT sans contenu)</li>
     *   <li>{@code JsonNode.class} → renvoie le payload brut (utile pour les endpoints
     *       qui retournent une structure complexe, ex: getBooking)</li>
     *   <li>Pas de {@code data} a la racine (ex: batch availability/rates) → desérialisation directe</li>
     * </ul>
     */
    private <T> T convertJsonApiResponse(JsonNode raw, Class<T> responseType) {
        if (raw == null || responseType == Void.class) return null;
        if (responseType == JsonNode.class) return responseType.cast(raw);

        JsonNode payload = raw;
        JsonNode data = raw.path("data");
        // On unwrap UNIQUEMENT le cas ressource singleton JSON:API :
        // {"data": {"id": "...", "type": "...", "attributes": {...}}}.
        // Pour les batches (data est un array), les meta (data absent), ou tout autre
        // format, on garde la reponse brute pour ne pas casser la deserialisation.
        if (data.isObject() && data.path("attributes").isObject()) {
            ObjectNode flat = ((ObjectNode) data.get("attributes")).deepCopy();
            if (data.has("id") && data.get("id").isTextual()) {
                flat.put("id", data.get("id").asText());
            }
            payload = flat;
        }

        try {
            return objectMapper.treeToValue(payload, responseType);
        } catch (Exception e) {
            throw new ChannexException(ChannexException.Kind.BAD_REQUEST,
                "Failed to deserialize Channex response (type=" + responseType.getSimpleName() + "): "
                    + e.getMessage(), e);
        }
    }

    /**
     * Derive un tag d'operation simple a partir du verbe HTTP + path.
     * Exemples : POST /properties → "create_property", POST /availability → "push_availability".
     * On garde une enumeration courte pour eviter l'explosion cardinalite Prometheus.
     */
    private static String deriveOperationTag(HttpMethod method, String url) {
        String path = url.replaceAll("^https?://[^/]+(/[^?]*).*$", "$1").toLowerCase();
        if (path.endsWith("/properties") && method == HttpMethod.POST) return "create_property";
        if (path.contains("/properties/") && method == HttpMethod.GET) return "get_property";
        if (path.contains("/properties/") && method == HttpMethod.DELETE) return "delete_property";
        if (path.endsWith("/room_types") && method == HttpMethod.POST) return "create_room_type";
        if (path.endsWith("/rate_plans") && method == HttpMethod.POST) return "create_rate_plan";
        if (path.contains("/rate_plans/") && method == HttpMethod.PUT) return "update_rate_plan_settings";
        if (path.endsWith("/availability")) return "push_availability";
        if (path.endsWith("/restrictions")) return "push_rates";
        if (path.contains("/bookings/")) return "get_booking";
        if (path.startsWith("/bookings") || path.contains("/bookings?")) return "list_bookings";
        return "other";
    }

    private ChannexException mapHttpError(HttpStatusCode status, String body) {
        int code = status.value();
        if (code == 401 || code == 403) {
            return new ChannexException(ChannexException.Kind.UNAUTHORIZED, code,
                "Channex auth failed: " + truncate(body));
        }
        if (code == 404) {
            return new ChannexException(ChannexException.Kind.NOT_FOUND, code,
                "Channex resource not found: " + truncate(body));
        }
        if (code == 429) {
            return new ChannexException(ChannexException.Kind.RATE_LIMITED, code,
                "Channex rate limit exceeded");
        }
        if (code >= 500) {
            return new ChannexException(ChannexException.Kind.SERVER_ERROR, code,
                "Channex server error: " + truncate(body));
        }
        return new ChannexException(ChannexException.Kind.BAD_REQUEST, code,
            "Channex bad request: " + truncate(body));
    }

    private void backoff(int attempt) {
        long delayMs = (long) (200 * Math.pow(2, attempt - 1));
        try {
            Thread.sleep(Math.min(delayMs, Duration.ofSeconds(5).toMillis()));
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new ChannexException(ChannexException.Kind.TRANSPORT, "Interrupted during retry backoff", ie);
        }
    }

    private static String truncate(String s) {
        if (s == null) return "";
        return s.length() > 200 ? s.substring(0, 200) + "..." : s;
    }

    private static String normalize(BigDecimal value) {
        // Channex attend les decimals en string pour eviter les pertes de precision.
        return value.toPlainString();
    }

    /** Split d'une liste en chunks de taille max chunkSize. */
    private static <T> List<List<T>> chunked(List<T> list, int chunkSize) {
        List<List<T>> result = new ArrayList<>();
        for (int i = 0; i < list.size(); i += chunkSize) {
            result.add(list.subList(i, Math.min(i + chunkSize, list.size())));
        }
        return result;
    }
}
