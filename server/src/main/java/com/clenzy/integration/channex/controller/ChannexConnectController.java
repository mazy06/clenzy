package com.clenzy.integration.channex.controller;

import com.clenzy.integration.channex.dto.ChannexConnectRequest;
import com.clenzy.integration.channex.dto.ChannexConnectedOta;
import com.clenzy.integration.channex.dto.ChannexDiscoveryResponse;
import com.clenzy.integration.channex.dto.ChannexOauthSetupResponse;
import com.clenzy.integration.channex.dto.ChannexEmbedUrlResponse;
import com.clenzy.integration.channex.dto.ChannexImportRequest;
import com.clenzy.integration.channex.dto.ChannexImportResult;
import com.clenzy.integration.channex.dto.ChannexMappingDto;
import com.clenzy.integration.channex.dto.ChannexOtaChannelResponse;
import com.clenzy.integration.channex.service.ChannexConnectService;
import com.clenzy.integration.channex.service.ChannexImportService;
import com.clenzy.integration.channex.service.ChannexSyncService;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Onboarding et gestion des mappings Channel Manager Channex.
 *
 * <p>Endpoints reserves aux administrateurs / managers d'organisation (les
 * mappings impactent la distribution sur les OTAs — operation critique).</p>
 */
@RestController
@RequestMapping("/api/integrations/channex")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
@Tag(name = "Integration Channex", description = "Onboarding et gestion des mappings Channel Manager Channex")
public class ChannexConnectController {

    private final ChannexConnectService connectService;
    private final ChannexImportService importService;
    private final TenantContext tenantContext;
    private final com.clenzy.integration.channex.service.ChannexCapabilityService capabilityService;
    private final com.clenzy.integration.channex.repository.ChannexSyncLogRepository syncLogRepository;
    private final com.clenzy.integration.channex.service.ChannexPriceDriftService priceDriftService;
    private final com.clenzy.integration.channex.service.ChannexSyncService syncService;

    public ChannexConnectController(ChannexConnectService connectService,
                                      ChannexImportService importService,
                                      TenantContext tenantContext,
                                      com.clenzy.integration.channex.service.ChannexCapabilityService capabilityService,
                                      com.clenzy.integration.channex.repository.ChannexSyncLogRepository syncLogRepository,
                                      com.clenzy.integration.channex.service.ChannexPriceDriftService priceDriftService,
                                      com.clenzy.integration.channex.service.ChannexSyncService syncService) {
        this.connectService = connectService;
        this.importService = importService;
        this.tenantContext = tenantContext;
        this.capabilityService = capabilityService;
        this.syncLogRepository = syncLogRepository;
        this.priceDriftService = priceDriftService;
        this.syncService = syncService;
    }

    /**
     * Liste les mappings actifs de l'organisation.
     */
    @GetMapping("/mappings")
    @Operation(summary = "Liste tous les mappings Channex de l'organisation")
    public List<ChannexMappingDto> listMappings() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return connectService.list(orgId).stream().map(ChannexMappingDto::from).toList();
    }

    /**
     * Recupere le mapping d'une property specifique.
     */
    @GetMapping("/properties/{clenzyPropertyId}/mapping")
    @Operation(summary = "Recupere le mapping Channex d'une propriete")
    public ResponseEntity<ChannexMappingDto> getMapping(@PathVariable Long clenzyPropertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return connectService.getByPropertyId(clenzyPropertyId, orgId)
            .map(ChannexMappingDto::from)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Connecte une property a Channex (importe les IDs Channex existants
     * + cree le mapping + push initial 6 mois).
     */
    @PostMapping("/properties/{clenzyPropertyId}/connect")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Connecte une propriete Clenzy a son equivalent Channex")
    public ChannexMappingDto connect(@PathVariable Long clenzyPropertyId,
                                       @Valid @RequestBody ChannexConnectRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ChannexMappingDto.from(connectService.connect(clenzyPropertyId, orgId, request));
    }

    /**
     * Deconnecte une property de Channex (supprime le mapping local — la property
     * Channex reste presente cote dashboard Channex).
     */
    @DeleteMapping("/properties/{clenzyPropertyId}/disconnect")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Deconnecte une propriete de Channex (mapping local supprime)")
    public void disconnect(@PathVariable Long clenzyPropertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        connectService.disconnect(clenzyPropertyId, orgId);
    }

    /**
     * Smart Disconnect orchestre : enchaine deactivate channels → delete channels
     * → (optionnel) delete property Channex → cleanup local en un seul appel REST.
     *
     * <p>Reponse structuree avec une etape par operation (SUCCESS/FAILED/SKIPPED)
     * pour permettre a l'UI d'afficher une checklist de ce qui s'est passe.</p>
     *
     * <p>Body : {@code {"deleteChannexProperty": false}} (default) pour mode soft
     * reversible. Passer {@code true} pour reset complet (supprime aussi la
     * property cote hub Channex — operation irreversible).</p>
     */
    @PostMapping("/properties/{clenzyPropertyId}/full-disconnect")
    @Operation(summary = "Smart Disconnect orchestre (deactivate + delete channels + cleanup local en 1 appel)")
    public com.clenzy.integration.channex.dto.ChannexFullDisconnectResult fullDisconnect(
            @PathVariable Long clenzyPropertyId,
            @RequestBody(required = false) FullDisconnectBody body) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        boolean deletePivot = body != null && Boolean.TRUE.equals(body.deleteChannexProperty());
        return connectService.fullDisconnect(clenzyPropertyId, orgId, deletePivot);
    }

    /** Body pour POST /properties/{id}/full-disconnect (toutes les options sont optionnelles). */
    public record FullDisconnectBody(Boolean deleteChannexProperty) {}

    /**
     * Resume agrege de la sante Channex pour l'organisation courante (Phase 2).
     *
     * <p>Pour les dashboards admin : counts par sync_status + liste des mappings
     * meritant attention (ERROR persistant, PENDING bloque, ACTIVE stale).</p>
     *
     * <p>Filtre toujours sur l'org du tenant courant — pas d'agregat cross-org
     * via endpoint user-facing (reserve au watchdog scheduler interne).</p>
     */
    @GetMapping("/health-summary")
    @Operation(summary = "Resume agrege de la sante Channex pour l'organisation")
    public com.clenzy.integration.channex.dto.ChannexHealthSummary healthSummary() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return connectService.computeHealthSummary(orgId);
    }

    // ─── Phase 3 OTA pricing : price drifts ─────────────────────────────────

    /** Liste tous les drifts actifs (non resolus) de l'organisation. */
    @GetMapping("/price-drifts")
    @Operation(summary = "Liste les ecarts de prix Clenzy ↔ OTA en attente de resolution")
    public List<com.clenzy.integration.channex.dto.ChannexPriceDriftDto> listPriceDrifts() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return priceDriftService.listActive(orgId).stream()
            .map(com.clenzy.integration.channex.dto.ChannexPriceDriftDto::from)
            .toList();
    }

    /** Drifts actifs pour une property specifique. */
    @GetMapping("/properties/{clenzyPropertyId}/price-drifts")
    @Operation(summary = "Drifts de prix actifs pour cette property")
    public List<com.clenzy.integration.channex.dto.ChannexPriceDriftDto> listPriceDriftsForProperty(
            @PathVariable Long clenzyPropertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return priceDriftService.listActiveForProperty(orgId, clenzyPropertyId).stream()
            .map(com.clenzy.integration.channex.dto.ChannexPriceDriftDto::from)
            .toList();
    }

    /**
     * Resout un drift : KEEP_CLENZY (force push au prochain cycle), KEEP_OTA
     * (cree un RateOverride avec le prix OTA), DISMISSED (ignore).
     */
    @PostMapping("/price-drifts/{driftId}/resolve")
    @Operation(summary = "Resout un drift de prix avec la strategie choisie")
    public com.clenzy.integration.channex.dto.ChannexPriceDriftDto resolvePriceDrift(
            @PathVariable Long driftId,
            @RequestBody ResolveDriftBody body,
            @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        if (body == null || body.resolution() == null) {
            throw new IllegalArgumentException("Body requis : { \"resolution\": \"KEEP_CLENZY|KEEP_OTA|DISMISSED\" }");
        }
        com.clenzy.integration.channex.model.ChannexPriceDrift.Resolution res;
        try {
            res = com.clenzy.integration.channex.model.ChannexPriceDrift.Resolution
                .valueOf(body.resolution());
        } catch (IllegalArgumentException iae) {
            throw new IllegalArgumentException(
                "resolution doit etre KEEP_CLENZY, KEEP_OTA ou DISMISSED — recu : " + body.resolution());
        }
        String resolvedBy = jwt != null ? jwt.getClaimAsString("email") : "system";
        return com.clenzy.integration.channex.dto.ChannexPriceDriftDto.from(
            priceDriftService.resolve(orgId, driftId, res, resolvedBy));
    }

    /** Body POST /price-drifts/{id}/resolve. */
    public record ResolveDriftBody(String resolution) {}

    /**
     * Historique des operations de sync Channex pour une property (Phase 3).
     *
     * <p>Trie par date desc, max 100 entrees par defaut. Cas d'usage :
     * "quand a-t-on push pour la derniere fois ?", debugging d'incidents.</p>
     */
    @GetMapping("/properties/{clenzyPropertyId}/sync-logs")
    @Operation(summary = "Historique des operations sync Channex pour cette property")
    public List<com.clenzy.integration.channex.dto.ChannexSyncLogDto> syncLogs(
            @PathVariable Long clenzyPropertyId,
            @RequestParam(defaultValue = "50") int limit) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        int safeLimit = Math.min(Math.max(1, limit), 200);
        return syncLogRepository
            .findByPropertyOrdered(orgId, clenzyPropertyId,
                org.springframework.data.domain.PageRequest.of(0, safeLimit))
            .stream()
            .map(com.clenzy.integration.channex.dto.ChannexSyncLogDto::from)
            .toList();
    }

    /**
     * Diagnostic d'une property connectee a Channex (Quick Win #5) : retourne
     * un snapshot de l'etat de sync + des actions recommandees en 1 clic.
     * Cas d'usage : "mon listing Airbnb est bloque, qu'est-ce qui se passe ?"
     */
    @GetMapping("/properties/{clenzyPropertyId}/diagnose")
    @Operation(summary = "Diagnostic + recommandations en 1 clic pour une property connectee")
    public com.clenzy.integration.channex.dto.ChannexDiagnosisReport diagnose(
            @PathVariable Long clenzyPropertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return connectService.diagnose(clenzyPropertyId, orgId);
    }

    /**
     * Pre-flight check Channex (Quick Win #3) : verifie en amont si toutes les
     * conditions sont reunies pour eviter un wizard OAuth pour rien.
     *
     * <p>Sans {@code propertyId} : checks globaux uniquement (API, hub state,
     * capabilities whitelabel). Avec {@code propertyId} : ajoute les checks
     * par-property (existence, mapping deja present, completude attributs).</p>
     *
     * <p>Reponse : liste de checks (OK / WARNING / BLOCKER) + flag {@code canProceed}
     * faux des qu'un BLOCKER est detecte. L'UI peut afficher un panneau
     * Diagnostic avant de proposer le bouton "Connecter".</p>
     */
    @GetMapping("/preflight")
    @Operation(summary = "Pre-flight check Channex (verifie API + capabilities + property en 1 call)")
    public com.clenzy.integration.channex.dto.ChannexPreflightReport preflight(
            @RequestParam(required = false) Long propertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return connectService.runPreflight(orgId, propertyId);
    }

    /**
     * Force un re-push complet d'une property (utile pour recuperer un mapping ERROR
     * ou apres un changement de prix significatif).
     */
    @PostMapping("/properties/{clenzyPropertyId}/resync")
    @Operation(summary = "Re-push complet d'une propriete (1 a 12 mois)")
    public ChannexSyncService.ChannexSyncResult resync(@PathVariable Long clenzyPropertyId,
                                                        @RequestParam(defaultValue = "6") int months) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return connectService.resync(clenzyPropertyId, orgId, months);
    }

    /**
     * Push les settings tarifaires (Phase 5 OTA pricing) vers Channex via
     * PUT /rate_plans/{id} : weekend_price + occupancy + LOS factors + min/max nights.
     *
     * <p>Complement de {@link #resync} qui ne pousse QUE les rates par date.
     * A appeler quand l'admin modifie un RatePlan(WEEKEND), OccupancyPricing
     * ou LengthOfStayDiscount cote Clenzy et veut le repercuter sur l'OTA.</p>
     */
    @PostMapping("/properties/{clenzyPropertyId}/push-pricing-settings")
    @Operation(summary = "Push les pricing settings (weekend/occupancy/LOS/min-max) vers Channex")
    public ChannexSyncService.ChannexSyncResult pushPricingSettings(@PathVariable Long clenzyPropertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return syncService.pushPricingSettings(clenzyPropertyId, orgId);
    }

    /**
     * Modifie le mode {@link com.clenzy.model.PriceSourceOfTruth} d'une property
     * — qui pilote les prix : Clenzy (push vers OTA), OTA (pull depuis OTA),
     * MANUAL (aucune sync auto).
     *
     * <p>Cas d'usage : l'admin a un Pricelabs/Wheelhouse connecte directement
     * a Airbnb → passe sa property en mode OTA pour que Clenzy ne push pas.</p>
     */
    @org.springframework.web.bind.annotation.PatchMapping(
        "/properties/{clenzyPropertyId}/price-source-of-truth")
    @Operation(summary = "Change le pilote des prix (CLENZY/OTA/MANUAL) d'une property")
    public PriceSourceResponse setPriceSourceOfTruth(@PathVariable Long clenzyPropertyId,
                                                       @RequestBody PriceSourceBody body) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        if (body == null || body.source() == null || body.source().isBlank()) {
            throw new IllegalArgumentException(
                "Body requis : { \"source\": \"CLENZY|OTA|MANUAL\" }");
        }
        com.clenzy.model.PriceSourceOfTruth source;
        try {
            source = com.clenzy.model.PriceSourceOfTruth.valueOf(body.source());
        } catch (IllegalArgumentException iae) {
            throw new IllegalArgumentException(
                "source doit etre CLENZY, OTA ou MANUAL — recu : " + body.source());
        }
        com.clenzy.model.PriceSourceOfTruth applied = connectService
            .updatePriceSourceOfTruth(clenzyPropertyId, orgId, source);
        return new PriceSourceResponse(clenzyPropertyId, applied.name());
    }

    /** Body pour PATCH /properties/{id}/price-source-of-truth. */
    public record PriceSourceBody(String source) {}

    /** Reponse simple : property + nouveau mode applique. */
    public record PriceSourceResponse(Long clenzyPropertyId, String priceSourceOfTruth) {}

    /**
     * Re-synchronise le contenu OTA d'une property deja importee :
     * re-scrape Airbnb (nom + amenities JSON-LD), applique les aliases admin,
     * met a jour {@code property.amenities} + {@code ota_raw_amenities}.
     *
     * <p>Cas d'usage typique : property importee avant le scraping d'amenities,
     * ou listing OTA modifie cote Airbnb (host ajoute un equipement).</p>
     */
    @PostMapping("/properties/{clenzyPropertyId}/resync-content")
    @Operation(summary = "Re-scrape OTA (nom + amenities) + applique aliases sur 1 property")
    public com.clenzy.integration.channex.dto.ChannexResyncContentResult resyncContent(
            @PathVariable Long clenzyPropertyId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return importService.resyncPropertyContent(clenzyPropertyId, orgId);
    }

    /**
     * Bulk : re-sync content de TOUTES les properties de l'org qui ont un
     * mapping Channex actif + un listing OTA mappe. Best-effort.
     */
    @PostMapping("/properties/resync-all-content")
    @Operation(summary = "Re-scrape OTA + aliases pour TOUTES les properties de l'org")
    public List<com.clenzy.integration.channex.dto.ChannexResyncContentResult> resyncAllContent() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return importService.resyncAllPropertiesContent(orgId);
    }

    // ─── Capabilities circuit-breaker (admin) ───────────────────────────────
    // Pas de probe explicite : le cache est auto-rempli au fil des calls
    // (chaque WL endpoint marque dispo/indispo selon le resultat HTTP).

    @GetMapping("/capabilities")
    @Operation(summary = "Snapshot du cache d'auto-detection des capacites Channex whitelabel")
    public com.clenzy.integration.channex.dto.ChannexCapabilityReport listCapabilities() {
        return new com.clenzy.integration.channex.dto.ChannexCapabilityReport(
            capabilityService.snapshot()
        );
    }

    @DeleteMapping("/capabilities/cache")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Reset le cache d'auto-detection (force un retry au prochain call)")
    public void resetCapabilityCache() {
        capabilityService.clearCache();
    }

    /**
     * Importe dans Clenzy les bookings actuellement connus de Channex pour une
     * property (reverse sync OTA -> Channex -> Clenzy).
     *
     * <p>Typiquement appele juste apres avoir connecte un OTA dans Channex
     * (ex: Airbnb) pour recuperer les reservations existantes sur cet OTA.
     * Les webhooks {@code booking_new} prennent le relais pour les futures.</p>
     */
    @PostMapping("/properties/{clenzyPropertyId}/pull-bookings")
    @Operation(summary = "Import des bookings Channex existants en Reservation Clenzy (idempotent)")
    public com.clenzy.integration.channex.service.ChannexConnectService.PullBookingsResult pullBookings(
            @PathVariable Long clenzyPropertyId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        java.time.LocalDate fromDate = from != null
            ? java.time.LocalDate.parse(from)
            : java.time.LocalDate.now();
        java.time.LocalDate toDate = to != null
            ? java.time.LocalDate.parse(to)
            : fromDate.plusMonths(12);
        return connectService.pullBookings(clenzyPropertyId, orgId, fromDate, toDate);
    }

    /**
     * Genere une URL signee permettant d'embarquer le widget officiel Channex
     * de connexion aux OTAs (Airbnb, Booking.com, Vrbo, Expedia, ...) dans une
     * iframe cote frontend Clenzy.
     *
     * <p>La URL retournee contient un token a usage unique valable 15 minutes.
     * Une fois charge dans la iframe, le token est consomme et la session reste
     * active jusqu'a fermeture de l'onglet.</p>
     *
     * <p>Pre-requis : la property doit deja avoir un mapping Channex (connectee).
     * Sinon 4xx avec message explicite.</p>
     */
    @GetMapping("/properties/{clenzyPropertyId}/embed-url")
    @Operation(summary = "URL d'iframe Channex pour connecter les OTAs (Airbnb, Booking, ...)")
    public ChannexEmbedUrlResponse getEmbedUrl(@PathVariable Long clenzyPropertyId,
                                                 @RequestParam(required = false, defaultValue = "fr") String lng,
                                                 @RequestParam(required = false) String channel,
                                                 @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        // username Channex = email admin Clenzy (audit cote dashboard Channex)
        String username = jwt != null ? jwt.getClaimAsString("email") : null;
        if (username == null || username.isBlank()) {
            username = "clenzy-org-" + orgId;
        }
        String url = connectService.getEmbedUrl(clenzyPropertyId, orgId, username, lng, channel);
        return ChannexEmbedUrlResponse.of(url);
    }

    /**
     * Cree un channel OTA pre-rempli (title auto, channel, group, mapping) cote
     * Channex via API, et renvoie une URL d'iframe qui ouvre directement la page
     * d'edition du channel — l'utilisateur n'a plus qu'a finaliser l'OAuth
     * (Airbnb) ou saisir ses credentials (Booking/Vrbo/Expedia).
     *
     * <p>Body : {@code {"otaChannelName": "Airbnb"}} — nom Channex de l'OTA
     * (cf. CHANNEX_OTA_OPTIONS cote frontend pour les valeurs valides).</p>
     */
    @PostMapping("/properties/{clenzyPropertyId}/ota-channels")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Cree un channel OTA Channex pre-rempli + retourne l'URL iframe d'OAuth")
    public ChannexOtaChannelResponse createOtaChannel(@PathVariable Long clenzyPropertyId,
                                                        @RequestBody CreateOtaChannelBody body,
                                                        @RequestParam(required = false, defaultValue = "fr") String lng,
                                                        @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        String username = jwt != null ? jwt.getClaimAsString("email") : null;
        if (username == null || username.isBlank()) {
            username = "clenzy-org-" + orgId;
        }
        if (body == null || body.otaChannelName() == null || body.otaChannelName().isBlank()) {
            throw new IllegalArgumentException("otaChannelName est requis (ex: 'Airbnb', 'BookingCom')");
        }
        return connectService.createOtaChannel(clenzyPropertyId, orgId,
            body.otaChannelName(), username, lng);
    }

    /** Body pour POST /properties/{id}/ota-channels. */
    public record CreateOtaChannelBody(String otaChannelName) {}

    // ─── Discovery / Import depuis Channex ──────────────────────────────────

    /**
     * Liste les properties Channex existantes qui n'ont pas encore de mapping
     * local Clenzy. Utile apres OAuth Airbnb (qui cree automatiquement des
     * properties Channex pour chaque listing detecte du compte).
     *
     * <p>Le frontend affiche la liste avec checkboxes pour permettre a l'admin
     * de selectionner celles a importer en masse.</p>
     */
    @GetMapping("/discover")
    @Operation(summary = "Liste les properties du hub non encore importees + compteur global")
    public ChannexDiscoveryResponse discoverUnmapped() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return importService.discoverUnmappedProperties(orgId);
    }

    /**
     * Importe en masse les properties Channex selectionnees comme Properties
     * Clenzy. Pour chaque ID Channex : creation Property auto-fillee + mapping
     * (sync_status PENDING — push declenche au premier OTA actif).
     *
     * <p>Idempotent : si un ID Channex est deja mappe, il est skip silencieusement
     * (statut SKIPPED_ALREADY_MAPPED dans la reponse).</p>
     */
    @PostMapping("/import")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Importe en masse les properties Channex selectionnees comme Properties Clenzy")
    public ChannexImportResult importProperties(@Valid @RequestBody ChannexImportRequest request,
                                                  @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        String keycloakId = jwt != null ? jwt.getSubject() : null;
        // Platform staff (SUPER_ADMIN/SUPER_MANAGER) peuvent reattribuer la
        // property creee a une autre org / un autre user via request.target*.
        // Les autres roles : leurs valeurs target* sont ignorees, owner = self.
        boolean isPlatformStaff = JwtRoleExtractor.extractUserRole(jwt).isPlatformStaff();
        return importService.importProperties(orgId, request, keycloakId, isPlatformStaff);
    }

    /**
     * Demarre un OAuth OTA global (sans property Clenzy preexistante).
     *
     * <p>Cree (ou reutilise) une property pivot {@code [Clenzy Hub] OAuth Bridge}
     * cote hub, genere une URL iframe pre-filtree sur l'OTA choisi. Apres OAuth,
     * Channex cree automatiquement des properties pour les listings detectes du
     * compte, qui apparaitront alors dans la discovery {@code GET /discover}.</p>
     *
     * <p>Body : {@code {"channelCode": "ABB"}} (ABB=Airbnb, BDC=Booking, ...).</p>
     */
    @PostMapping("/import/setup-oauth")
    @Operation(summary = "URL iframe pour connecter un OTA (nouveau) ou re-detecter listings (channel existant)")
    public ChannexOauthSetupResponse setupOauth(@RequestBody SetupOauthBody body,
                                                  @RequestParam(required = false, defaultValue = "fr") String lng,
                                                  @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        String username = jwt != null ? jwt.getClaimAsString("email") : null;
        if (username == null || username.isBlank()) {
            username = "clenzy-org-" + orgId;
        }
        if (body == null || body.channelCode() == null || body.channelCode().isBlank()) {
            throw new IllegalArgumentException("channelCode est requis (ex: 'ABB' pour Airbnb)");
        }
        return importService.setupGlobalOauth(orgId, username, body.channelCode().toUpperCase(), lng,
            body.existingChannelId());
    }

    /**
     * Body pour POST /import/setup-oauth.
     *
     * @param channelCode       code 3 lettres OTA (ABB pour Airbnb, BDC Booking, ...)
     * @param existingChannelId UUID d'un channel existant deja OAuth (pour re-detecter
     *                          de nouveaux listings). null pour creer un nouveau OAuth.
     */
    public record SetupOauthBody(String channelCode, String existingChannelId) {}

    // ─── Gestion des OTAs connectes ────────────────────────────────────────

    /**
     * Liste les OTAs (Airbnb, Booking, Vrbo, ...) actuellement connectes au hub
     * pour cette organisation. Affiche dans la vue "Gerer les OTAs connectes".
     */
    @GetMapping("/ota-channels")
    @Operation(summary = "Liste les OTAs actuellement connectes au hub")
    public List<ChannexConnectedOta> listConnectedOtaChannels() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return importService.listConnectedOtaChannels(orgId);
    }

    /**
     * Deconnecte un OTA : supprime le channel du hub + tokens OAuth.
     * L'utilisateur devra refaire l'OAuth pour reconnecter cet OTA.
     */
    @DeleteMapping("/ota-channels/{channelId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Deconnecte un OTA (supprime le channel + tokens OAuth)")
    public void disconnectOtaChannel(@PathVariable String channelId) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        importService.disconnectOtaChannel(orgId, channelId);
    }
}
