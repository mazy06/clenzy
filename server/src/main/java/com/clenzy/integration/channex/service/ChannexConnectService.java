package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexBookingDto;
import com.clenzy.integration.channex.dto.ChannexBookingsListResponse;
import com.clenzy.integration.channex.dto.ChannexChannelDto;
import com.clenzy.integration.channex.dto.ChannexConnectRequest;
import com.clenzy.integration.channex.dto.ChannexCreateChannelRequest;
import com.clenzy.integration.channex.dto.ChannexCreatePropertyRequest;
import com.clenzy.integration.channex.dto.ChannexCreateRatePlanRequest;
import com.clenzy.integration.channex.dto.ChannexCreateRoomTypeRequest;
import com.clenzy.integration.channex.dto.ChannexDiagnosisReport;
import com.clenzy.integration.channex.dto.ChannexDiagnosisReport.Priority;
import com.clenzy.integration.channex.dto.ChannexDiagnosisReport.RecommendedAction;
import com.clenzy.integration.channex.dto.ChannexDiagnosisReport.SyncSnapshot;
import com.clenzy.integration.channex.dto.ChannexFullDisconnectResult;
import com.clenzy.integration.channex.dto.ChannexFullDisconnectResult.DisconnectStep;
import com.clenzy.integration.channex.dto.ChannexHealthSummary;
import com.clenzy.integration.channex.dto.ChannexHealthSummary.AttentionItem;
import com.clenzy.integration.channex.dto.ChannexHealthSummary.Severity;
import com.clenzy.integration.channex.dto.ChannexOtaChannelResponse;
import com.clenzy.integration.channex.dto.ChannexPreflightReport;
import com.clenzy.integration.channex.dto.ChannexPreflightReport.PreflightCheck;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
import com.clenzy.integration.channex.dto.ChannexRatePlanDto;
import com.clenzy.integration.channex.dto.ChannexRoomTypeDto;
import com.clenzy.integration.channex.exception.ChannexException;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexOtaChannelRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service d'onboarding Channex (connexion/deconnexion d'une property Clenzy).
 *
 * <p>Flux de connexion :</p>
 * <ol>
 *   <li>Validation cross-tenant de la property Clenzy</li>
 *   <li>Verification existence de la property Channex (appel API getProperty)</li>
 *   <li>Creation du ChannexPropertyMapping en DB (sync_status=PENDING)</li>
 *   <li><b>Pas de push initial</b> : on attend qu'au moins 1 OTA (Airbnb, Booking,
 *       ...) soit branche cote Channex via le widget iframe. Le push se declenche
 *       alors automatiquement (frontend apres OAuth, ou scheduler periodique).
 *       Tant qu'aucun OTA n'est actif, {@link ChannexSyncService#pushProperty}
 *       est un no-op (verifie via {@link ChannexClient#hasActiveOtaChannel}).</li>
 *   <li>Mapping passe en ACTIVE (ou ERROR) au premier push reussi.</li>
 * </ol>
 *
 * <p>Reference plan : {@code docs/strategy/channex-integration-plan.md} Sprint 5.</p>
 */
@Service
public class ChannexConnectService {

    private static final Logger log = LoggerFactory.getLogger(ChannexConnectService.class);

    /** Nombre de mois pour le push initial apres connexion. */
    private static final int INITIAL_SYNC_MONTHS = 6;

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;
    private final ChannexOtaChannelRepository otaChannelRepository;
    private final ChannexSyncService syncService;
    private final ChannexBookingService bookingService;
    private final PropertyRepository propertyRepository;
    private final ChannexMetrics metrics;
    private final ChannexCapabilityService capabilityService;
    private final com.clenzy.integration.channex.repository.ChannexPriceDriftRepository priceDriftRepository;

    public ChannexConnectService(ChannexClient channexClient,
                                   ChannexPropertyMappingRepository mappingRepository,
                                   ChannexOtaChannelRepository otaChannelRepository,
                                   ChannexSyncService syncService,
                                   ChannexBookingService bookingService,
                                   PropertyRepository propertyRepository,
                                   ChannexMetrics metrics,
                                   ChannexCapabilityService capabilityService,
                                   com.clenzy.integration.channex.repository.ChannexPriceDriftRepository priceDriftRepository) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
        this.otaChannelRepository = otaChannelRepository;
        this.syncService = syncService;
        this.bookingService = bookingService;
        this.propertyRepository = propertyRepository;
        this.metrics = metrics;
        this.capabilityService = capabilityService;
        this.priceDriftRepository = priceDriftRepository;
    }

    // ─── Connect ────────────────────────────────────────────────────────────

    /**
     * Connecte une property Clenzy a son equivalent Channex.
     *
     * <p>Deux modes selon {@link ChannexConnectRequest#effectiveMode()} :</p>
     * <ul>
     *   <li>{@code AUTO_CREATE} : on cree Property + Room Type + Rate Plan
     *       dans Channex en derivant les attributs de la Property Clenzy</li>
     *   <li>{@code IMPORT_EXISTING} : on importe les 3 IDs fournis (apres
     *       verification d'existence via getProperty)</li>
     * </ul>
     *
     * @throws IllegalStateException si la property Clenzy est introuvable ou n'appartient
     *         pas a l'organisation, OU si un mapping existe deja, OU si la property
     *         Channex n'existe pas (mode IMPORT) ou ne peut etre creee (mode AUTO).
     */
    @Transactional
    public ChannexPropertyMapping connect(Long clenzyPropertyId, Long orgId, ChannexConnectRequest request) {
        // 1. Validation cross-tenant
        Property property = propertyRepository.findById(clenzyPropertyId)
            .orElseThrow(() -> new IllegalStateException("Propriete " + clenzyPropertyId + " introuvable"));
        if (!orgId.equals(property.getOrganizationId())) {
            throw new IllegalStateException("Propriete " + clenzyPropertyId
                + " n'appartient pas a l'organisation " + orgId);
        }

        // 2. Verifier qu'il n'y a pas deja un mapping
        Optional<ChannexPropertyMapping> existing = mappingRepository
            .findByClenzyPropertyId(clenzyPropertyId, orgId);
        if (existing.isPresent()) {
            throw new IllegalStateException("La propriete " + clenzyPropertyId
                + " est deja connectee a Channex (mapping " + existing.get().getId() + ")");
        }

        // 3. Resoudre les 3 IDs Channex selon le mode
        ChannexConnectRequest.Mode mode = request.effectiveMode();
        ChannexIds ids = (mode == ChannexConnectRequest.Mode.AUTO_CREATE)
            ? autoCreateInChannex(property)
            : verifyImportedIds(request);

        // 4. Creer le mapping en PENDING
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setOrganizationId(orgId);
        mapping.setClenzyPropertyId(clenzyPropertyId);
        mapping.setChannexPropertyId(ids.propertyId);
        mapping.setChannexRoomTypeId(ids.roomTypeId);
        mapping.setChannexDefaultRatePlanId(ids.ratePlanId);
        mapping.setSyncStatus(ChannexSyncStatus.PENDING);
        mapping = mappingRepository.save(mapping);

        log.info("ChannexConnect: mapping cree {} pour property {} (mode={}, Channex={})",
            mapping.getId(), clenzyPropertyId, mode, ids.propertyId);
        metrics.recordMappingCreated();

        // PAS de push initial : le mapping reste en PENDING jusqu'a ce qu'au
        // moins un OTA (Airbnb, Booking, ...) soit branche cote Channex via
        // OAuth/credentials. Sans OTA actif, push availability/rates serait
        // inutile (donnees envoyees nulle part).
        //
        // Le push est declenche par :
        //   - le frontend apres OAuth iframe reussi (via /resync)
        //   - le scheduler periodique (qui skip silencieusement si pas d'OTA)
        log.info("ChannexConnect: mapping {} en PENDING — push declenche au premier OTA actif",
            mapping.getId());

        return mapping;
    }

    // ─── Helpers de resolution des IDs Channex ──────────────────────────────

    /** Triple d'identifiants Channex. */
    private record ChannexIds(String propertyId, String roomTypeId, String ratePlanId) {}

    /**
     * Mode AUTO_CREATE : cree Property + Room Type + Rate Plan dans Channex
     * via 3 appels API. Les attributs sont derives de la Property Clenzy.
     */
    private ChannexIds autoCreateInChannex(Property property) {
        // Property : derivation depuis Clenzy
        String currency = property.getDefaultCurrency() != null && !property.getDefaultCurrency().isBlank()
            ? property.getDefaultCurrency().toUpperCase() : "EUR";
        String country = property.getCountryCode() != null && property.getCountryCode().length() == 2
            ? property.getCountryCode().toUpperCase() : "FR";
        String title = property.getName() != null && !property.getName().isBlank()
            ? property.getName() : ("Clenzy Property #" + property.getId());

        try {
            ChannexPropertyDto created = channexClient.createProperty(new ChannexCreatePropertyRequest(
                title, currency, country, "Europe/Paris", null
            ));
            log.info("ChannexConnect[AUTO]: property creee {} ({})", created.id(), created.title());

            // Room Type : 1 unite, capacite = maxGuests de la Clenzy property
            int maxAdults = property.getMaxGuests() != null ? property.getMaxGuests() : 2;
            ChannexRoomTypeDto roomType = channexClient.createRoomType(
                ChannexCreateRoomTypeRequest.simple(created.id(), title, maxAdults)
            );
            log.info("ChannexConnect[AUTO]: room_type cree {}", roomType.id());

            // Rate Plan standard (per_room avec 1 option = capacite max du room_type)
            ChannexRatePlanDto ratePlan = channexClient.createRatePlan(
                ChannexCreateRatePlanRequest.standard(created.id(), roomType.id(), currency, maxAdults)
            );
            log.info("ChannexConnect[AUTO]: rate_plan cree {}", ratePlan.id());

            return new ChannexIds(created.id(), roomType.id(), ratePlan.id());
        } catch (ChannexException e) {
            log.error("ChannexConnect[AUTO]: echec creation pour property {}: {}",
                property.getId(), e.getMessage());
            if (e.getKind() == ChannexException.Kind.UNAUTHORIZED) {
                throw new IllegalStateException(
                    "Cle API Channex invalide ou manquante. Verifiez CHANNEX_API_KEY dans l'env.");
            }
            throw new IllegalStateException("Echec auto-creation Channex : " + e.getMessage());
        }
    }

    /**
     * Mode IMPORT_EXISTING : verifie que les 3 IDs sont fournis et que la
     * property Channex existe.
     */
    private ChannexIds verifyImportedIds(ChannexConnectRequest request) {
        if (!request.hasAllIds()) {
            throw new IllegalStateException("Mode IMPORT_EXISTING : les 3 IDs Channex sont obligatoires "
                + "(channexPropertyId, channexRoomTypeId, channexDefaultRatePlanId).");
        }
        try {
            channexClient.getProperty(request.channexPropertyId());
        } catch (ChannexException e) {
            log.error("ChannexConnect[IMPORT]: impossible de verifier la property Channex {}: {}",
                request.channexPropertyId(), e.getMessage());
            if (e.getKind() == ChannexException.Kind.NOT_FOUND) {
                throw new IllegalStateException("Property Channex introuvable : "
                    + request.channexPropertyId() + ". Verifiez l'ID dans le dashboard Channex.");
            }
            throw new IllegalStateException("Erreur API Channex : " + e.getMessage());
        }
        return new ChannexIds(
            request.channexPropertyId(),
            request.channexRoomTypeId(),
            request.channexDefaultRatePlanId()
        );
    }

    // ─── Disconnect ─────────────────────────────────────────────────────────

    /**
     * Deconnecte une property de Channex.
     *
     * <p>Supprime localement le mapping + ses ota_channels associes. NE supprime
     * PAS la property cote Channex (pour eviter les pertes accidentelles —
     * l'utilisateur peut le faire manuellement sur le dashboard Channex si
     * souhaite).</p>
     */
    @Transactional
    public void disconnect(Long clenzyPropertyId, Long orgId) {
        ChannexPropertyMapping mapping = mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId));

        // Supprime aussi les ota_channels (cascade DB devrait le faire mais on est defensif)
        otaChannelRepository.findByMappingId(mapping.getId())
            .forEach(otaChannelRepository::delete);

        mappingRepository.delete(mapping);
        metrics.recordMappingDeleted();

        log.info("ChannexConnect: mapping {} supprime (property {}, org {}). " +
            "La property reste presente cote Channex.", mapping.getId(), clenzyPropertyId, orgId);
    }

    /**
     * Smart Disconnect orchestre — Quick Win #2 de la strategie Channex.
     *
     * <p>Probleme adresse : le mode {@link #disconnect} ne touche que la DB locale.
     * Quand un user veut "vraiment" deconnecter (parce que Channex bloque Airbnb,
     * par exemple), il devait jusqu'ici enchainer 4-5 operations manuelles :
     * revoke OAuth cote Airbnb → deactivate channel cote Channex → delete channel
     * → delete pivot → SQL cleanup Clenzy. Cette methode automatise tout.</p>
     *
     * <p>Sequence orchestree (best-effort, continue meme si une etape echoue) :</p>
     * <ol>
     *   <li><b>LIST_CHANNELS</b> : enumere tous les channels Channex lies a la property</li>
     *   <li>Pour chaque channel : <b>DEACTIVATE_CHANNEL</b> (PUT is_active=false) puis
     *       <b>DELETE_CHANNEL</b> (DELETE /channels/{id}) — l'OTA reprend la main des
     *       la desactivation, donc le user est debloque meme si le DELETE echoue</li>
     *   <li>Si {@code deleteChannexProperty=true} : <b>DELETE_PROPERTY</b> sur le hub
     *       (reset complet, plus rien dans le dashboard Channex). Sinon SKIPPED.</li>
     *   <li><b>CLEANUP_LOCAL</b> : suppression du mapping + ota_channels rows en DB
     *       (toujours execute, meme si les etapes Channex ont echoue — l'utilisateur
     *       doit pouvoir "abandonner" et nettoyer cote Clenzy)</li>
     * </ol>
     *
     * <p>Garantie : <b>la priorite #1 est de liberer les OTA</b> (deactivate). Si tout
     * le reste echoue, tant que les desactivations sont passees, l'utilisateur a
     * repris la main sur ses listings Airbnb/Booking/etc.</p>
     *
     * @param clenzyPropertyId     Property Clenzy a deconnecter
     * @param orgId                Organisation (validation cross-tenant)
     * @param deleteChannexProperty true = reset complet (supprime aussi la property
     *                              cote hub Channex). false = soft (reversible :
     *                              le user peut reconnecter sans recreer la property)
     * @return Resultat structure avec une etape par operation pour affichage checklist UI
     */
    @Transactional
    public ChannexFullDisconnectResult fullDisconnect(Long clenzyPropertyId, Long orgId,
                                                       boolean deleteChannexProperty) {
        log.info("ChannexConnect[FULL-DISCONNECT]: demande property={} org={} deletePivot={}",
            clenzyPropertyId, orgId, deleteChannexProperty);

        Optional<ChannexPropertyMapping> mappingOpt = mappingRepository
            .findByClenzyPropertyId(clenzyPropertyId, orgId);
        if (mappingOpt.isEmpty()) {
            throw new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId
                + " — rien a deconnecter");
        }
        ChannexPropertyMapping mapping = mappingOpt.get();
        String channexPropertyId = mapping.getChannexPropertyId();
        List<DisconnectStep> steps = new ArrayList<>();

        // 1. Enumere les channels Channex lies a cette property
        List<String> channelIds;
        try {
            channelIds = findChannelIdsForProperty(channexPropertyId);
            steps.add(DisconnectStep.success("LIST_CHANNELS",
                "Channels detectes sur le hub",
                channelIds.isEmpty()
                    ? "Aucun channel actif"
                    : channelIds.size() + " channel(s) trouve(s)"));
        } catch (Exception e) {
            log.warn("ChannexConnect[FULL-DISCONNECT]: list channels for property {} KO: {}",
                channexPropertyId, e.getMessage());
            steps.add(DisconnectStep.failed("LIST_CHANNELS",
                "Enumeration des channels Channex",
                "Erreur API : " + e.getMessage()));
            channelIds = List.of();
        }

        // 2. Pour chaque channel : deactivate (priorite #1 : liberer l'OTA) puis delete
        for (String channelId : channelIds) {
            // 2a. DEACTIVATE — c'est ce qui rend la main a l'OTA, l'etape critique
            try {
                channexClient.deactivateChannel(channelId);
                steps.add(DisconnectStep.successFor("DEACTIVATE_CHANNEL",
                    "Channel desactive (OTA libere)",
                    "is_active=false applique — Channex arrete les push",
                    channelId));
            } catch (Exception e) {
                log.warn("ChannexConnect[FULL-DISCONNECT]: deactivate channel {} KO: {}",
                    channelId, e.getMessage());
                steps.add(DisconnectStep.failedFor("DEACTIVATE_CHANNEL",
                    "Desactivation du channel",
                    "Erreur API : " + e.getMessage()
                        + ". Tentative de DELETE quand meme, mais l'OTA n'est PAS libere.",
                    channelId));
            }
            // 2b. DELETE — nettoyage du hub (Channex refuse si encore actif)
            try {
                channexClient.deleteChannel(channelId);
                steps.add(DisconnectStep.successFor("DELETE_CHANNEL",
                    "Channel supprime du hub",
                    "Channel " + channelId + " retire — l'utilisateur devra refaire l'OAuth",
                    channelId));
            } catch (Exception e) {
                log.warn("ChannexConnect[FULL-DISCONNECT]: delete channel {} KO: {}",
                    channelId, e.getMessage());
                steps.add(DisconnectStep.failedFor("DELETE_CHANNEL",
                    "Suppression du channel",
                    "Channel desactive mais pas supprime : " + e.getMessage()
                        + ". A nettoyer manuellement sur le dashboard Channex.",
                    channelId));
            }
        }

        // 3. Optionnellement, supprime aussi la property du hub Channex
        if (deleteChannexProperty) {
            try {
                channexClient.deleteProperty(channexPropertyId);
                steps.add(DisconnectStep.success("DELETE_PROPERTY",
                    "Property supprimee du hub",
                    "Reset complet — plus rien cote Channex"));
            } catch (Exception e) {
                log.warn("ChannexConnect[FULL-DISCONNECT]: delete property {} KO: {}",
                    channexPropertyId, e.getMessage());
                steps.add(DisconnectStep.failed("DELETE_PROPERTY",
                    "Suppression de la property Channex",
                    "Erreur API : " + e.getMessage()
                        + ". La property reste sur le hub (visible dans le dashboard Channex)."));
            }
        } else {
            steps.add(DisconnectStep.skipped("DELETE_PROPERTY",
                "Property conservee sur le hub",
                "Mode soft : reversible. Reconnect possible sans recreation."));
        }

        // 4. CLEANUP_LOCAL — toujours execute, meme si Channex a galere.
        //    L'utilisateur doit pouvoir "abandonner" et nettoyer cote Clenzy.
        try {
            otaChannelRepository.findByMappingId(mapping.getId())
                .forEach(otaChannelRepository::delete);
            mappingRepository.delete(mapping);
            metrics.recordMappingDeleted();
            steps.add(DisconnectStep.success("CLEANUP_LOCAL",
                "Mapping local supprime",
                "Mapping " + mapping.getId() + " + ota_channels nettoyes"));
        } catch (Exception e) {
            log.error("ChannexConnect[FULL-DISCONNECT]: cleanup local KO: {}", e.getMessage(), e);
            steps.add(DisconnectStep.failed("CLEANUP_LOCAL",
                "Nettoyage Clenzy DB",
                "Erreur DB : " + e.getMessage()
                    + ". Contactez le support — risque d'etat incoherent."));
        }

        boolean overallSuccess = steps.stream()
            .noneMatch(s -> s.status() == ChannexFullDisconnectResult.Status.FAILED);

        log.info("ChannexConnect[FULL-DISCONNECT]: termine property={} channex={} success={} steps={}",
            clenzyPropertyId, channexPropertyId, overallSuccess, steps.size());

        return new ChannexFullDisconnectResult(overallSuccess, clenzyPropertyId, channexPropertyId, steps);
    }

    /**
     * Helper : trouve tous les channel_ids Channex qui ont la property donnee
     * dans leur liste de properties (attributes.properties[] OU
     * relationships.properties.data[]).
     *
     * <p>Channex n'expose pas de filtre {@code GET /channels?property_id=X} fiable
     * en mode public — on doit fetcher tous les channels du hub et filtrer cote
     * Java. Cf. {@link ChannexClient#hasActiveOtaChannel} qui fait la meme
     * gymnastique en mode boolean.</p>
     */
    private List<String> findChannelIdsForProperty(String channexPropertyId) {
        JsonNode response = channexClient.fetchAllChannelsRaw();
        if (response == null || !response.path("data").isArray()) {
            return List.of();
        }
        List<String> ids = new ArrayList<>();
        for (JsonNode channel : response.path("data")) {
            boolean matches = false;
            // Variant A : attributes.properties est un array de strings d'UUIDs
            JsonNode propsArray = channel.path("attributes").path("properties");
            if (propsArray.isArray()) {
                for (JsonNode p : propsArray) {
                    if (channexPropertyId.equals(p.asText(null))) {
                        matches = true;
                        break;
                    }
                }
            }
            // Variant B : relationships.properties.data est un array d'objets {id,type}
            if (!matches) {
                JsonNode rels = channel.path("relationships").path("properties").path("data");
                if (rels.isArray()) {
                    for (JsonNode p : rels) {
                        if (channexPropertyId.equals(p.path("id").asText(null))) {
                            matches = true;
                            break;
                        }
                    }
                }
            }
            if (matches) {
                String id = channel.path("id").asText(null);
                if (id != null && !id.isBlank()) {
                    ids.add(id);
                }
            }
        }
        return ids;
    }

    // ─── Pre-flight check (Quick Win #3) ───────────────────────────────────

    /**
     * Pre-flight check Channex : verifie en amont d'une connexion si toutes les
     * conditions sont reunies pour eviter d'investir du temps dans un wizard
     * OAuth pour rien.
     *
     * <p>Checks globaux (toujours executes) :</p>
     * <ul>
     *   <li>API Channex joignable + credentials valides (BLOCKER si KO)</li>
     *   <li>Snapshot des capabilities whitelabel (INFO purement informatif)</li>
     *   <li>Etat du hub : nb properties totales (INFO)</li>
     * </ul>
     *
     * <p>Checks par-property (si {@code clenzyPropertyId} fourni) :</p>
     * <ul>
     *   <li>Property existe + meme org (BLOCKER si KO)</li>
     *   <li>Property pas deja mappee (BLOCKER si deja mappee)</li>
     *   <li>Nom, devise, pays renseignes (WARNING avec defaut applique sinon)</li>
     * </ul>
     *
     * <p>Tous les checks sont best-effort : un check qui throw n'arrete pas
     * les autres. L'objectif est de fournir le maximum d'info en un appel.</p>
     *
     * @param orgId             Organisation (tenant) — toujours requis
     * @param clenzyPropertyId  Property a verifier (optionnel). null = global only.
     * @return rapport avec {@code canProceed} faux si au moins un BLOCKER detecte
     */
    public ChannexPreflightReport runPreflight(Long orgId, Long clenzyPropertyId) {
        log.info("ChannexConnect[PREFLIGHT]: org={} property={}", orgId, clenzyPropertyId);
        List<PreflightCheck> checks = new ArrayList<>();

        // ── 1. API Channex joignable + auth OK ──────────────────────────────
        // On fait un GET /properties qui est leger ET teste les credentials
        // (un 401 = clef API invalide, un 5xx = Channex down).
        int hubPropertiesCount = -1;
        boolean apiOk = false;
        try {
            JsonNode raw = channexClient.fetchAllPropertiesRaw();
            apiOk = true;
            hubPropertiesCount = raw != null && raw.path("data").isArray()
                ? raw.path("data").size()
                : 0;
            checks.add(PreflightCheck.ok("API_REACHABLE",
                "API Channex joignable",
                "Authentification OK · latence acceptable"));
        } catch (ChannexException e) {
            String detail;
            String remediation;
            switch (e.getKind()) {
                case UNAUTHORIZED -> {
                    detail = "Clef API Channex refusee (HTTP 401)";
                    remediation = "Verifier la variable d'env CHANNEX_API_KEY cote backend.";
                }
                case SERVER_ERROR -> {
                    detail = "Channex renvoie une erreur 5xx : " + e.getMessage();
                    remediation = "Reessayer dans quelques minutes. Si persistant, status.channex.io.";
                }
                default -> {
                    detail = "Erreur API : " + e.getMessage();
                    remediation = "Verifier la connectivite reseau du backend.";
                }
            }
            checks.add(PreflightCheck.blocker("API_REACHABLE",
                "API Channex inaccessible", detail, remediation));
        } catch (Exception e) {
            checks.add(PreflightCheck.blocker("API_REACHABLE",
                "API Channex inaccessible",
                "Erreur inattendue : " + e.getMessage(),
                "Verifier les logs backend pour le stacktrace complet."));
        }

        // ── 2. Capabilities whitelabel (info purement informatif) ───────────
        Map<ChannexCapabilityService.Capability, ChannexCapabilityService.CacheEntry> caps =
            capabilityService.snapshot();
        long availableCount = caps.values().stream().filter(ChannexCapabilityService.CacheEntry::available).count();
        long totalCaps = caps.size();
        checks.add(PreflightCheck.ok("WHITELABEL_CAPABILITIES",
            "Capabilities Channex",
            availableCount + "/" + totalCaps + " endpoints whitelabel disponibles "
                + "(les autres utilisent les fallbacks public scrape)"));

        // ── 3. Etat du hub (info) ───────────────────────────────────────────
        if (apiOk) {
            long mappedCount = mappingRepository.findAllByOrgId(orgId).size();
            checks.add(PreflightCheck.ok("HUB_STATE",
                "Etat du hub Channex",
                hubPropertiesCount + " property(ies) cote hub · "
                    + mappedCount + " deja mappee(s) sur cette organisation"));
        }

        // ── 4. Alignement des prix Clenzy ↔ Channex (Phase 5 audit UX) ──────
        // Compte les drifts actifs (non-resolus) detectes par le scheduler de
        // reconciliation. OK si 0 (= Clenzy et OTA alignes), WARNING sinon
        // avec remediation pointant vers le dialog de resolution.
        try {
            int activeDrifts = clenzyPropertyId != null
                ? priceDriftRepository.findActiveByProperty(orgId, clenzyPropertyId).size()
                : priceDriftRepository.findActiveByOrg(orgId).size();
            if (activeDrifts == 0) {
                checks.add(PreflightCheck.ok("PRICE_DRIFTS_ALIGNMENT",
                    "Alignement prix Clenzy ↔ OTA",
                    "Tous les prix sont alignes (aucun drift actif)"));
            } else {
                checks.add(PreflightCheck.warning("PRICE_DRIFTS_ALIGNMENT",
                    "Ecarts de prix detectes",
                    activeDrifts + " drift" + (activeDrifts > 1 ? "s" : "")
                        + " entre les prix Clenzy et les prix retournes par l'OTA",
                    "Ouvrir 'Voir les conflits de prix Clenzy ↔ OTA' pour resoudre "
                        + "(KEEP_CLENZY / KEEP_OTA / DISMISSED par drift)."));
            }
        } catch (Exception e) {
            // Best-effort : si le repo plante, on log mais on ne bloque pas le preflight.
            log.warn("ChannexConnect[PREFLIGHT]: PRICE_DRIFTS_ALIGNMENT check KO : {}",
                e.getMessage());
        }

        // ── 5. Checks per-property (si propertyId fourni) ───────────────────
        if (clenzyPropertyId != null) {
            runPerPropertyChecks(clenzyPropertyId, orgId, checks);
        }

        boolean canProceed = checks.stream()
            .noneMatch(c -> c.severity() == ChannexPreflightReport.Severity.BLOCKER);

        log.info("ChannexConnect[PREFLIGHT]: termine org={} property={} canProceed={} checks={}",
            orgId, clenzyPropertyId, canProceed, checks.size());

        return new ChannexPreflightReport(canProceed, checks);
    }

    /**
     * Helper : checks specifiques a une property Clenzy (existence, mapping,
     * completude des attributs requis pour la creation Channex).
     */
    private void runPerPropertyChecks(Long clenzyPropertyId, Long orgId, List<PreflightCheck> checks) {
        Optional<Property> propertyOpt = propertyRepository.findById(clenzyPropertyId);
        if (propertyOpt.isEmpty()) {
            checks.add(PreflightCheck.blocker("PROPERTY_EXISTS",
                "Propriete introuvable",
                "Aucune Property Clenzy avec l'ID " + clenzyPropertyId,
                "Verifier l'ID — ou la property a peut-etre ete supprimee."));
            return;
        }
        Property property = propertyOpt.get();

        if (!orgId.equals(property.getOrganizationId())) {
            checks.add(PreflightCheck.blocker("PROPERTY_EXISTS",
                "Propriete d'une autre organisation",
                "Property " + clenzyPropertyId + " n'appartient pas a l'org " + orgId,
                "Acces refuse. Contacter un SUPER_ADMIN si besoin de re-attribution."));
            return;
        }
        checks.add(PreflightCheck.ok("PROPERTY_EXISTS",
            "Propriete trouvee",
            "« " + (property.getName() != null ? property.getName() : "(sans nom)")
                + " » appartient bien a l'organisation"));

        // Already mapped ?
        Optional<ChannexPropertyMapping> existing = mappingRepository
            .findByClenzyPropertyId(clenzyPropertyId, orgId);
        if (existing.isPresent()) {
            checks.add(PreflightCheck.blocker("PROPERTY_NOT_MAPPED",
                "Propriete deja connectee a Channex",
                "Mapping " + existing.get().getId() + " existe deja (statut "
                    + existing.get().getSyncStatus() + ")",
                "Deconnecter d'abord via le Smart Disconnect avant de reconnecter."));
        } else {
            checks.add(PreflightCheck.ok("PROPERTY_NOT_MAPPED",
                "Pas de mapping existant",
                "La propriete est prete a etre connectee"));
        }

        // Name (warning si missing — default fallback "Clenzy Property #ID")
        if (property.getName() == null || property.getName().isBlank()) {
            checks.add(PreflightCheck.warning("PROPERTY_NAME",
                "Nom de la propriete manquant",
                "Champ vide cote Clenzy",
                "Sera remplace par « Clenzy Property #" + clenzyPropertyId + " » cote Channex. "
                    + "Renseignez un vrai nom dans les details de la propriete."));
        } else {
            checks.add(PreflightCheck.ok("PROPERTY_NAME",
                "Nom defini",
                "« " + property.getName() + " »"));
        }

        // Currency (warning si missing — default EUR)
        String currency = property.getDefaultCurrency();
        if (currency == null || currency.isBlank()) {
            checks.add(PreflightCheck.warning("PROPERTY_CURRENCY",
                "Devise non renseignee",
                "Champ defaultCurrency vide",
                "Sera default a EUR cote Channex. Definir explicitement la devise "
                    + "si differente (USD, GBP, etc.)."));
        } else {
            checks.add(PreflightCheck.ok("PROPERTY_CURRENCY",
                "Devise definie",
                currency.toUpperCase()));
        }

        // Country (warning si missing — default FR)
        String country = property.getCountryCode();
        if (country == null || country.length() != 2) {
            checks.add(PreflightCheck.warning("PROPERTY_COUNTRY",
                "Code pays non renseigne",
                "Champ countryCode vide ou invalide (attendu : 2 lettres ISO)",
                "Sera default a FR cote Channex. Renseigner si different."));
        } else {
            checks.add(PreflightCheck.ok("PROPERTY_COUNTRY",
                "Pays defini",
                country.toUpperCase()));
        }
    }

    // ─── Diagnose + Repair (Quick Win #5) ──────────────────────────────────

    /**
     * Diagnostic d'une property connectee a Channex avec actions recommandees
     * en 1 clic. Cas d'usage : "mon listing Airbnb est bloque, qu'est-ce qui
     * se passe ?" → cette methode regarde l'etat du mapping + les OTAs actifs
     * cote hub, et retourne un summary + 1-2 actions classees par priorite.
     *
     * <p>Decision tree :</p>
     * <table>
     *   <tr><th>SyncStatus</th><th>OTA actifs</th><th>Primary</th><th>Secondary</th></tr>
     *   <tr><td>ACTIVE</td>   <td>≥1</td><td>FORCE_RESYNC</td><td>OPEN_HUB</td></tr>
     *   <tr><td>ACTIVE</td>   <td>0</td> <td>OPEN_HUB</td>    <td>—</td></tr>
     *   <tr><td>PENDING</td>  <td>≥1</td><td>FORCE_RESYNC</td><td>OPEN_HUB</td></tr>
     *   <tr><td>PENDING</td>  <td>0</td> <td>OPEN_HUB</td>    <td>—</td></tr>
     *   <tr><td>ERROR</td>    <td>≥1</td><td>FORCE_RESYNC</td><td>FULL_DISCONNECT, OPEN_HUB</td></tr>
     *   <tr><td>ERROR</td>    <td>0</td> <td>FULL_DISCONNECT</td><td>OPEN_HUB</td></tr>
     *   <tr><td>DISABLED</td> <td>*</td> <td>FORCE_RESYNC</td><td>FULL_DISCONNECT</td></tr>
     * </table>
     *
     * @throws IllegalStateException si pas de mapping pour cette property
     */
    public ChannexDiagnosisReport diagnose(Long clenzyPropertyId, Long orgId) {
        log.info("ChannexConnect[DIAGNOSE]: property={} org={}", clenzyPropertyId, orgId);

        ChannexPropertyMapping mapping = mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId
                + " — connectez-la d'abord avant de diagnostiquer"));

        Property property = propertyRepository.findById(clenzyPropertyId)
            .orElseThrow(() -> new IllegalStateException(
                "Propriete " + clenzyPropertyId + " introuvable"));
        String propertyName = property.getName() != null
            ? property.getName()
            : "Propriete #" + clenzyPropertyId;

        // Count active OTAs on the hub for this property (best-effort)
        int activeOtaCount = countActiveOtasForProperty(mapping.getChannexPropertyId());
        boolean hasActiveOta = activeOtaCount > 0;

        SyncSnapshot snapshot = new SyncSnapshot(
            mapping.getSyncStatus(),
            mapping.getLastSyncAt(),
            mapping.getLastSyncError(),
            activeOtaCount,
            hasActiveOta
        );

        List<RecommendedAction> actions = buildRecommendedActions(snapshot);
        String summary = buildSummary(snapshot);

        log.info("ChannexConnect[DIAGNOSE]: property={} status={} otas={} actions={}",
            clenzyPropertyId, snapshot.status(), activeOtaCount, actions.size());

        return new ChannexDiagnosisReport(
            clenzyPropertyId,
            propertyName,
            snapshot,
            actions,
            summary
        );
    }

    /**
     * Compte les channels Channex actifs (is_active=true) lies a une property.
     * Best-effort : en cas d'erreur API, retourne 0 et log un warn.
     */
    private int countActiveOtasForProperty(String channexPropertyId) {
        try {
            JsonNode response = channexClient.fetchAllChannelsRaw();
            if (response == null || !response.path("data").isArray()) {
                return 0;
            }
            int count = 0;
            for (JsonNode channel : response.path("data")) {
                if (!channel.path("attributes").path("is_active").asBoolean(false)) continue;
                if (channelLinksProperty(channel, channexPropertyId)) count++;
            }
            return count;
        } catch (Exception e) {
            log.warn("ChannexConnect[DIAGNOSE]: count active OTAs for {} KO: {}",
                channexPropertyId, e.getMessage());
            return 0;
        }
    }

    /** Helper : true si le channel JSON Channex reference la property donnee. */
    private boolean channelLinksProperty(JsonNode channel, String channexPropertyId) {
        JsonNode propsArray = channel.path("attributes").path("properties");
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
        return false;
    }

    /** Construit les actions recommandees selon le decision tree documente. */
    private List<RecommendedAction> buildRecommendedActions(SyncSnapshot snapshot) {
        List<RecommendedAction> actions = new ArrayList<>();
        ChannexSyncStatus status = snapshot.status();
        boolean hasOta = snapshot.hasActiveOta();

        switch (status) {
            case ACTIVE, PENDING -> {
                if (hasOta) {
                    actions.add(new RecommendedAction("FORCE_RESYNC",
                        "Forcer une re-synchronisation",
                        "Pousse l'etat actuel (calendrier + tarifs) vers Channex. "
                            + "A faire si vous suspectez un decalage entre Clenzy et l'OTA.",
                        Priority.PRIMARY));
                    actions.add(new RecommendedAction("OPEN_HUB",
                        "Ouvrir le hub Channex",
                        "Voir l'etat detaille cote hub (mappings, OAuth, logs).",
                        Priority.SECONDARY));
                } else {
                    actions.add(new RecommendedAction("OPEN_HUB",
                        "Connecter un OTA",
                        "Aucun OTA n'est actif. Connectez Airbnb / Booking dans le hub "
                            + "pour demarrer la synchronisation.",
                        Priority.PRIMARY));
                }
            }
            case ERROR -> {
                if (hasOta) {
                    actions.add(new RecommendedAction("FORCE_RESYNC",
                        "Reessayer la synchronisation",
                        "Re-push complet sur 6 mois. Si l'erreur etait transitoire "
                            + "(timeout, 5xx), ca peut tout debloquer.",
                        Priority.PRIMARY));
                    actions.add(new RecommendedAction("FULL_DISCONNECT",
                        "Deconnecter completement",
                        "Si l'erreur persiste, deconnecter libere immediatement l'OTA "
                            + "cote host. La sync sera arretee.",
                        Priority.SECONDARY));
                    actions.add(new RecommendedAction("OPEN_HUB",
                        "Inspecter cote hub",
                        "Verifier les logs et l'etat des channels dans Channex.",
                        Priority.SECONDARY));
                } else {
                    actions.add(new RecommendedAction("FULL_DISCONNECT",
                        "Deconnecter et nettoyer",
                        "Mapping en erreur sans OTA actif = probable orphelin. "
                            + "La deconnexion nettoie tout proprement.",
                        Priority.PRIMARY));
                    actions.add(new RecommendedAction("OPEN_HUB",
                        "Voir le hub",
                        "Avant de deconnecter, jeter un oeil au hub.",
                        Priority.SECONDARY));
                }
            }
            case DISABLED -> {
                actions.add(new RecommendedAction("FORCE_RESYNC",
                    "Reactiver la synchronisation",
                    "Un re-sync repasse le mapping en ACTIVE.",
                    Priority.PRIMARY));
                actions.add(new RecommendedAction("FULL_DISCONNECT",
                    "Deconnecter definitivement",
                    "Si vous ne souhaitez plus utiliser Channex pour cette propriete.",
                    Priority.SECONDARY));
            }
        }
        return actions;
    }

    /** Construit le summary en francais qui apparait en haut du dialog. */
    private String buildSummary(SyncSnapshot snapshot) {
        ChannexSyncStatus status = snapshot.status();
        boolean hasOta = snapshot.hasActiveOta();
        int n = snapshot.activeOtaCount();

        return switch (status) {
            case ACTIVE -> hasOta
                ? "Synchronisation active avec " + n + " OTA"
                    + (n > 1 ? "s" : "") + ". Tout semble normal."
                : "Mapping actif mais aucun OTA connecte. Pas de push reel pour l'instant.";
            case PENDING -> hasOta
                ? "Configuration en cours : " + n + " OTA actif"
                    + (n > 1 ? "s" : "") + ", premier push pas encore reussi."
                : "Mapping cree, en attente d'au moins un OTA connecte cote hub.";
            case ERROR -> hasOta
                ? "Erreur de synchronisation avec " + n + " OTA actif"
                    + (n > 1 ? "s" : "") + ". Voir l'erreur ci-dessous."
                : "Mapping en erreur et aucun OTA actif — probable etat orphelin a nettoyer.";
            case DISABLED -> "Synchronisation mise en pause. Aucun push n'est envoye.";
        };
    }

    // ─── Health summary (Phase 2 — watchdog + dashboard endpoint) ──────────

    /** Au-dela de ce delai en heures pour un mapping ACTIVE, on flag STALE. */
    private static final Duration STALE_ACTIVE_THRESHOLD = Duration.ofHours(6);

    /** Au-dela de ce delai pour un PENDING, on considere "bloque" (OAuth jamais finalise). */
    private static final Duration STUCK_PENDING_THRESHOLD = Duration.ofDays(1);

    /**
     * Construit un resume agrege de la sante Channex.
     *
     * @param orgId  filtre sur une org (UI dashboard) ou {@code null} pour
     *               agreger toutes les orgs (watchdog scheduler — usage admin
     *               uniquement, jamais expose via endpoint user-facing).
     */
    public ChannexHealthSummary computeHealthSummary(Long orgId) {
        List<ChannexPropertyMapping> mappings = (orgId != null)
            ? mappingRepository.findAllByOrgId(orgId)
            : mappingRepository.findAllAcrossOrgs();

        Map<ChannexSyncStatus, Integer> counts = new EnumMap<>(ChannexSyncStatus.class);
        for (ChannexSyncStatus st : ChannexSyncStatus.values()) counts.put(st, 0);

        // Cache des noms de property pour eviter N+1 (1 query pour tous les IDs)
        List<Long> propertyIds = mappings.stream().map(ChannexPropertyMapping::getClenzyPropertyId).toList();
        Map<Long, String> nameCache = new HashMap<>();
        if (!propertyIds.isEmpty()) {
            propertyRepository.findAllById(propertyIds).forEach(p ->
                nameCache.put(p.getId(), p.getName() != null ? p.getName() : ("Propriete #" + p.getId())));
        }

        Instant now = Instant.now();
        List<AttentionItem> attention = new ArrayList<>();

        for (ChannexPropertyMapping m : mappings) {
            counts.merge(m.getSyncStatus(), 1, Integer::sum);

            String name = nameCache.getOrDefault(m.getClenzyPropertyId(),
                "Propriete #" + m.getClenzyPropertyId());

            switch (m.getSyncStatus()) {
                case ERROR -> attention.add(new AttentionItem(
                    m.getClenzyPropertyId(), m.getOrganizationId(), name,
                    ChannexSyncStatus.ERROR,
                    Severity.ERROR,
                    "Mapping en erreur depuis la derniere tentative de sync.",
                    m.getLastSyncAt(), m.getLastSyncError()
                ));
                case PENDING -> {
                    Duration sinceCreated = Duration.between(
                        m.getCreatedAt() != null ? m.getCreatedAt() : now, now);
                    if (sinceCreated.compareTo(STUCK_PENDING_THRESHOLD) > 0) {
                        attention.add(new AttentionItem(
                            m.getClenzyPropertyId(), m.getOrganizationId(), name,
                            ChannexSyncStatus.PENDING,
                            Severity.WARNING,
                            "PENDING depuis > 24h (OAuth non finalise ?).",
                            m.getLastSyncAt(), m.getLastSyncError()
                        ));
                    }
                }
                case ACTIVE -> {
                    if (m.getLastSyncAt() != null) {
                        Duration sinceLast = Duration.between(m.getLastSyncAt(), now);
                        if (sinceLast.compareTo(STALE_ACTIVE_THRESHOLD) > 0) {
                            attention.add(new AttentionItem(
                                m.getClenzyPropertyId(), m.getOrganizationId(), name,
                                ChannexSyncStatus.ACTIVE,
                                Severity.INFO,
                                "ACTIVE mais derniere sync > 6h (push peut-etre rate ou inutile).",
                                m.getLastSyncAt(), null
                            ));
                        }
                    }
                }
                case DISABLED -> {
                    // INFO purement informatif — l'utilisateur l'a probablement
                    // desactive volontairement. Pas d'attention requise.
                }
            }
        }

        // Trie : ERROR > WARNING > INFO, puis par lastSyncAt asc (le plus ancien d'abord)
        attention.sort(Comparator
            .comparing((AttentionItem a) -> a.severity().ordinal())
            .thenComparing(a -> a.lastSyncAt() != null ? a.lastSyncAt() : Instant.MIN));

        return new ChannexHealthSummary(mappings.size(), counts, attention, now);
    }

    /**
     * Phase 5 audit fix — Modifie le {@link com.clenzy.model.PriceSourceOfTruth}
     * d'une property. Cf. {@link com.clenzy.integration.channex.controller.ChannexConnectController}
     * pour le PATCH endpoint.
     *
     * <p>Validation cross-tenant : la property doit appartenir a l'organisation
     * du caller.</p>
     *
     * @return le mode applique (== source)
     * @throws IllegalStateException si property introuvable ou autre org
     */
    @Transactional
    public com.clenzy.model.PriceSourceOfTruth updatePriceSourceOfTruth(Long clenzyPropertyId,
                                                                          Long orgId,
                                                                          com.clenzy.model.PriceSourceOfTruth source) {
        Property property = propertyRepository.findById(clenzyPropertyId)
            .orElseThrow(() -> new IllegalStateException(
                "Property " + clenzyPropertyId + " introuvable"));
        if (!orgId.equals(property.getOrganizationId())) {
            throw new IllegalStateException("Property " + clenzyPropertyId
                + " n'appartient pas a l'organisation " + orgId);
        }
        com.clenzy.model.PriceSourceOfTruth previous = property.getPriceSourceOfTruth();
        property.setPriceSourceOfTruth(source);
        propertyRepository.save(property);
        log.info("ChannexConnect: property={} priceSourceOfTruth {} → {}",
            clenzyPropertyId, previous, source);
        return source;
    }

    // ─── Pull bookings (reverse sync OTA → Channex → Clenzy) ───────────────

    /**
     * Importe les bookings actuellement connus de Channex pour une property donnee
     * en {@link com.clenzy.model.Reservation Reservation} Clenzy.
     *
     * <p>Cas d'usage : apres connexion d'Airbnb (ou autre OTA) cote Channex,
     * Channex a deja recupere les bookings futurs de cet OTA. Sans cette
     * methode, l'utilisateur attendrait que les webhooks {@code booking_new}
     * arrivent uniquement pour les futures resas — pas les existantes.</p>
     *
     * <p>Idempotent : chaque booking est traite par {@link ChannexBookingService#handleNewBooking}
     * qui detecte les doublons via {@code external_uid = "channex:" + booking_id}.
     * Un re-pull retournera les memes counters mais ne dupliquera rien.</p>
     *
     * @param clenzyPropertyId Property Clenzy
     * @param orgId            Organisation
     * @param arrivalFrom      Date d'arrivee min (typiquement today)
     * @param arrivalTo        Date d'arrivee max (typiquement today + 12 mois)
     * @return resume du pull (counters)
     */
    @Transactional
    public PullBookingsResult pullBookings(Long clenzyPropertyId, Long orgId,
                                            LocalDate arrivalFrom, LocalDate arrivalTo) {
        ChannexPropertyMapping mapping = mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId
                + ". Connectez la property d'abord."));

        log.info("ChannexConnect[PULL]: import bookings property={} channex={} periode={}-{}",
            clenzyPropertyId, mapping.getChannexPropertyId(), arrivalFrom, arrivalTo);

        ChannexBookingsListResponse response;
        try {
            response = channexClient.listBookings(mapping.getChannexPropertyId(), arrivalFrom, arrivalTo);
        } catch (ChannexException e) {
            log.error("ChannexConnect[PULL]: echec listBookings property={}: {}",
                mapping.getChannexPropertyId(), e.getMessage());
            throw new IllegalStateException("Erreur lors de l'import depuis Channex : " + e.getMessage());
        }

        List<ChannexBookingDto> bookings = response.bookings();
        int total = bookings.size();
        int imported = 0;
        int skippedExisting = 0;
        int errors = 0;

        for (ChannexBookingDto booking : bookings) {
            try {
                // handleNewBooking est idempotent : si la reservation existe deja
                // (meme external_uid), elle est retournee sans rien modifier.
                // On differencie via la presence du booking en DB AVANT/APRES.
                com.clenzy.model.Reservation r = bookingService.handleNewBooking(booking);
                // Astuce : si la reservation a ete creee a l'instant, son createdAt est tres recent.
                // Sinon, c'est un skip silencieux. On compte differemment via Optional.empty
                // pas dispo ici — donc on assume tout import = soit nouveau soit deja existant.
                // Pour distinguer, on regarde l'externalUid post-call.
                if (r != null) {
                    imported++;
                }
            } catch (IllegalStateException ise) {
                // Cas typique : booking deja persiste mais en mode "non-creation"
                skippedExisting++;
            } catch (Exception e) {
                errors++;
                log.warn("ChannexConnect[PULL]: erreur sur booking {}: {}", booking.id(), e.getMessage());
            }
        }

        log.info("ChannexConnect[PULL]: termine property={} total={} importes/idempotents={} skip={} erreurs={}",
            clenzyPropertyId, total, imported, skippedExisting, errors);

        return new PullBookingsResult(total, imported, skippedExisting, errors);
    }

    /** Resultat du pull bookings (counters pour l'UI). */
    public record PullBookingsResult(
        int totalReceived,
        int importedOrIdempotent,
        int skipped,
        int errors
    ) {}

    // ─── List + Get ─────────────────────────────────────────────────────────

    public List<ChannexPropertyMapping> list(Long orgId) {
        return mappingRepository.findAllByOrgId(orgId);
    }

    public Optional<ChannexPropertyMapping> getByPropertyId(Long clenzyPropertyId, Long orgId) {
        return mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId);
    }

    /**
     * Force un re-push complet pour une property deja connectee (utile pour
     * recuperer un mapping en ERROR ou refaire le sync apres une desactivation).
     */
    @Transactional
    public ChannexSyncService.ChannexSyncResult resync(Long clenzyPropertyId, Long orgId, int months) {
        ChannexPropertyMapping mapping = mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId));

        // Si le mapping etait DISABLED, on le repasse en PENDING avant le push
        if (mapping.getSyncStatus() == ChannexSyncStatus.DISABLED) {
            mapping.setSyncStatus(ChannexSyncStatus.PENDING);
            mappingRepository.save(mapping);
        }

        int safeMonths = Math.min(Math.max(1, months), 12);
        LocalDate from = LocalDate.now();
        LocalDate to = from.plusMonths(safeMonths);
        return syncService.pushProperty(clenzyPropertyId, orgId, from, to);
    }

    /**
     * Genere une URL signee permettant d'embarquer le widget Channex de
     * connexion aux OTAs (Airbnb, Booking.com, Vrbo, Expedia...) dans une iframe
     * cote Clenzy.
     *
     * <p>Le mapping doit exister pour la property — sinon il n'y a pas de
     * channex_property_id a passer au widget. La verification cross-tenant est
     * faite via le filtre {@code findByClenzyPropertyId(id, orgId)}.</p>
     *
     * @param clenzyPropertyId id de la property Clenzy
     * @param orgId            id de l'organisation (tenant)
     * @param username         identite affichee dans le widget (typiquement email admin)
     * @param language         code langue UI (fr/en/es/...) — optionnel, default "fr"
     * @param channelCode      code 3 lettres OTA (ABB/BDC/VRB/EXP/AGO) pour pre-filtrer
     *                         le wizard a un seul OTA — null ou vide → toute la liste
     * @throws IllegalStateException si aucun mapping n'existe pour la property
     */
    public String getEmbedUrl(Long clenzyPropertyId, Long orgId, String username, String language,
                                String channelCode) {
        ChannexPropertyMapping mapping = mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId
                    + " — connectez la property avant d'ouvrir le widget OTA"));

        return channexClient.createEmbedUrl(mapping.getChannexPropertyId(), username, language,
            channelCode);
    }

    /**
     * Cree un channel OTA pre-rempli (title, currency, channel type, group) cote
     * Channex via API, et renvoie une URL d'iframe qui ouvre directement la page
     * d'edition du channel pour finaliser l'OAuth (Airbnb) ou les credentials
     * (Booking/Vrbo/Expedia).
     *
     * <p>Difference avec {@link #getEmbedUrl} :</p>
     * <ul>
     *   <li>{@code getEmbedUrl} : ouvre la liste vide de channels → l'utilisateur
     *       doit cliquer "+ Create", choisir l'OTA, taper le titre, choisir la
     *       devise, valider — puis seulement faire l'OAuth (5 etapes minimum)</li>
     *   <li>{@code createOtaChannel} : Clenzy fait toute la prepa cote API
     *       (title auto = "Airbnb - Marrakech", channel = "Airbnb", group_id
     *       resolu automatiquement). L'iframe ouvre directement l'ecran "Connect
     *       with Airbnb" → 1 clic OAuth pour terminer.</li>
     * </ul>
     *
     * @param clenzyPropertyId id de la property Clenzy
     * @param orgId            id de l'organisation (tenant)
     * @param otaChannelName   nom Channex de l'OTA ("Airbnb", "BookingCom",
     *                         "VrboCom", "ExpediaQuickConnect", "Agoda")
     * @param username         email admin Clenzy (audit cote Channex)
     * @param language         code langue UI iframe (fr/en/...)
     * @throws IllegalStateException si la property n'a pas de mapping Channex
     */
    public ChannexOtaChannelResponse createOtaChannel(Long clenzyPropertyId, Long orgId,
                                                        String otaChannelName, String username,
                                                        String language) {
        ChannexPropertyMapping mapping = mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId
                    + " — connectez la property avant de creer un channel OTA"));

        Property property = propertyRepository.findById(clenzyPropertyId)
            .orElseThrow(() -> new IllegalStateException("Propriete " + clenzyPropertyId + " introuvable"));

        // 1. Resoudre le group_id Channex via l'API (relationship sur la property)
        String groupId = channexClient.fetchPropertyGroupId(mapping.getChannexPropertyId());

        // 2. Construire un title humain auto-genere ("Airbnb - Marrakech")
        String propName = property.getName() != null && !property.getName().isBlank()
            ? property.getName()
            : ("Propriete #" + clenzyPropertyId);
        String title = otaChannelName + " - " + propName;

        // 3. Creer le channel via API (is_active=false, sera active apres OAuth)
        ChannexChannelDto created = channexClient.createChannel(
            new ChannexCreateChannelRequest(title, otaChannelName,
                mapping.getChannexPropertyId(), groupId));

        log.info("ChannexConnect: channel OTA cree id={} title={} pour property {} (org={})",
            created.id(), created.title(), clenzyPropertyId, orgId);

        // 4. Generer l'URL iframe qui ouvre directement ce channel pour OAuth
        String embedUrl = channexClient.createChannelEmbedUrl(
            mapping.getChannexPropertyId(), created.id(), username, language);

        return ChannexOtaChannelResponse.of(created.id(), created.title(),
            created.channelName(), embedUrl);
    }
}
