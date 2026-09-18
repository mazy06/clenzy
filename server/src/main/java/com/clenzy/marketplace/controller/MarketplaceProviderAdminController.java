package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.dto.*;
import com.clenzy.marketplace.model.EngagementMode;
import com.clenzy.marketplace.model.ProviderStatus;
import com.clenzy.marketplace.service.MarketplaceApplicationDocumentService;
import com.clenzy.marketplace.service.MarketplaceApplicationEraser;
import com.clenzy.marketplace.service.MarketplaceExposureService;
import com.clenzy.marketplace.service.OrganizationNameResolver;
import com.clenzy.marketplace.model.ExposureEffect;
import com.clenzy.marketplace.service.MarketplaceCatalogService;
import com.clenzy.marketplace.service.MarketplaceModerationService;
import com.clenzy.marketplace.service.MarketplaceProviderImportService;
import com.clenzy.model.ProviderDocument;
import com.clenzy.service.UserService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Administration de la place de marche des professionnels.
 *
 * <h2>Autorisation</h2>
 * <p>Les tables de la place de marche sont PLATEFORME : aucun filtre tenant ne
 * les borne. L'annotation de classe est donc la seule barriere, et elle est
 * volontairement au niveau le plus haut — {@code SUPER_ADMIN} et
 * {@code SUPER_MANAGER} uniquement. Toute methode ajoutee ici herite de cette
 * garde ; l'affaiblir sur une methode exposerait le catalogue entier.</p>
 *
 * <p>Chemin distinct de {@code /api/marketplace}, deja pris par le catalogue des
 * partenaires d'integration (Airbnb, Stripe, Nuki) : deux notions differentes
 * ne doivent pas partager un prefixe.</p>
 */
@RestController
@RequestMapping("/api/admin/marketplace")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class MarketplaceProviderAdminController {

    private final MarketplaceCatalogService catalogService;
    private final MarketplaceModerationService moderationService;
    private final MarketplaceProviderImportService importService;
    private final MarketplaceApplicationDocumentService documentService;
    private final UserService userService;
    private final MarketplaceApplicationEraser eraser;
    private final MarketplaceExposureService exposureService;
    private final OrganizationNameResolver organizationNameResolver;

    public MarketplaceProviderAdminController(MarketplaceCatalogService catalogService,
                                              MarketplaceModerationService moderationService,
                                              MarketplaceProviderImportService importService,
                                              MarketplaceApplicationDocumentService documentService,
                                              UserService userService,
                                              MarketplaceApplicationEraser eraser,
                                              MarketplaceExposureService exposureService,
                                              OrganizationNameResolver organizationNameResolver) {
        this.catalogService = catalogService;
        this.moderationService = moderationService;
        this.importService = importService;
        this.documentService = documentService;
        this.userService = userService;
        this.eraser = eraser;
        this.exposureService = exposureService;
        this.organizationNameResolver = organizationNameResolver;
    }

    // ─── Referentiel ─────────────────────────────────────────────────────────

    @GetMapping("/categories")
    public List<ServiceCategoryDto> categories() {
        return catalogService.getCategories();
    }

    @GetMapping("/cities")
    public List<String> cities() {
        return catalogService.getCoveredCities();
    }

    /**
     * Volumes du catalogue par dimension de filtre.
     *
     * <p>Ils portent sur l'ENSEMBLE du catalogue et non sur le sous-ensemble
     * filtre : leur role est de dire ou chercher, et des comptes qui tomberaient
     * a zero au fil du filtrage cacheraient les pistes de repli.</p>
     */
    @GetMapping("/facets")
    public MarketplaceFacetsDto facets() {
        return catalogService.getFacets();
    }

    @GetMapping("/stats")
    public MarketplaceStatsDto stats() {
        return catalogService.getStats();
    }

    // ─── Recherche ───────────────────────────────────────────────────────────

    /**
     * Catalogue filtre et pagine.
     *
     * <p>Tout parametre omis signifie « pas de contrainte » : l'ecran compose
     * ses filtres librement sans que le serveur connaisse leurs combinaisons.</p>
     */
    @GetMapping("/providers")
    public ProviderPageDto search(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) List<ProviderStatus> status,
            @RequestParam(required = false) List<EngagementMode> engagement,
            @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) List<String> service,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) BigDecimal minRating,
            @RequestParam(defaultValue = "false") boolean verifiedOnly,
            @RequestParam(required = false) Boolean complianceAlert,
            @RequestParam(defaultValue = "false") boolean acceptsUrgent,
            @RequestParam(required = false) Boolean hasOrganization,
            @RequestParam(required = false) Long organizationId,
            @RequestParam(required = false) Short availableOnDay,
            @RequestParam(required = false) String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {

        var criteria = new ProviderSearchCriteria(
            query, status, engagement, category, service, country, department, city,
            minRating, verifiedOnly, complianceAlert, acceptsUrgent,
            hasOrganization, organizationId, availableOnDay, sort, page, size);

        return catalogService.search(criteria);
    }

    @GetMapping("/providers/{id}")
    public ResponseEntity<ProviderDetailDto> detail(@PathVariable Long id) {
        return catalogService.getDetail(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // ─── Moderation ──────────────────────────────────────────────────────────

    @PatchMapping("/providers/{id}/status")
    public ResponseEntity<ProviderDetailDto> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody ProviderStatusUpdateRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        moderationService.updateStatus(id, request, jwt.getSubject());
        return catalogService.getDetail(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** Rattachement a une organisation porteuse, ou detachement. */
    @PatchMapping("/providers/{id}/engagement")
    public ResponseEntity<ProviderDetailDto> updateEngagement(
            @PathVariable Long id,
            @Valid @RequestBody EngagementUpdateRequest request) {

        moderationService.updateEngagement(id, request.engagementMode(), request.organizationId());
        return catalogService.getDetail(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /** @param organizationId organisation porteuse, ou {@code null} pour detacher */
    public record EngagementUpdateRequest(
        @NotNull EngagementMode engagementMode,
        Long organizationId
    ) {}

    // ─── Justificatifs d'une candidature ─────────────────────────────────────

    /**
     * Pieces deposees par un candidat sans compte.
     *
     * <p>Ce sont elles qui permettent de decider : sans cette lecture, le depot
     * sans compte remplirait un stockage que personne ne regarde.</p>
     */
    @GetMapping("/providers/{id}/documents")
    public List<ApplicationDocumentDto> documents(@PathVariable Long id) {
        return documentService.listForApplication(id).stream()
            .map(ApplicationDocumentDto::from)
            .toList();
    }

    /** Binaire d'une piece, pour l'ouvrir ou la telecharger. */
    @GetMapping("/providers/{id}/documents/{documentId}/file")
    public ResponseEntity<byte[]> documentFile(@PathVariable Long id,
                                               @PathVariable Long documentId) {
        var payload = documentService.downloadForApplication(id, documentId);
        // `inline` : une piece se consulte d'abord. Le nom passe par
        // ContentDisposition, qui l'encode — un nom de fichier vient du candidat
        // et ne se concatene pas dans un en-tete.
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                .filename(payload.fileName()).build().toString())
            .contentType(payload.contentType() != null
                ? MediaType.parseMediaType(payload.contentType())
                : MediaType.APPLICATION_OCTET_STREAM)
            .body(payload.data());
    }

    /** Verdict sur une piece : validee, ou refusee avec son motif. */
    @PatchMapping("/providers/{id}/documents/{documentId}")
    public ApplicationDocumentDto reviewDocument(
            @PathVariable Long id,
            @PathVariable Long documentId,
            @Valid @RequestBody DocumentReviewRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        // Peut rester null : le verdict vaut par lui-meme, et perdre la piece
        // parce qu'on n'a pas retrouve l'agent serait un mauvais echange.
        var reviewer = userService.findByKeycloakId(jwt.getSubject());
        Long reviewerId = reviewer != null ? reviewer.getId() : null;
        return ApplicationDocumentDto.from(
            documentService.review(id, documentId, request.status(), request.reviewNote(), reviewerId));
    }

    /** @param reviewNote motif rendu au candidat — indispensable a un refus. */
    public record DocumentReviewRequest(
        @NotNull ProviderDocument.Status status,
        String reviewNote
    ) {}

    /**
     * Efface une candidature a la demande de son auteur.
     *
     * <p>Pour les demandes qui arrivent par courriel plutot que par le lien de
     * depot. Refuse sur une fiche PORTANT UN COMPTE : effacer la fiche seule
     * laisserait un utilisateur sans profil et une place de marche amputee —
     * l'effacement passe alors par le compte.</p>
     */
    @DeleteMapping("/providers/{id}")
    public ResponseEntity<?> eraseApplication(@PathVariable Long id) {
        var provider = catalogService.getDetail(id).orElse(null);
        if (provider == null) {
            return ResponseEntity.notFound().build();
        }
        if (provider.userId() != null) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "error",
                "message", "Cette fiche porte un compte : l'effacement passe par le compte utilisateur."));
        }
        eraser.erase(List.of(id));
        return ResponseEntity.noContent().build();
    }

    // ─── Exposition aux organisations ────────────────────────────────────────

    /**
     * Exceptions posees sur une fiche.
     *
     * <p>Une fiche sans regle est visible de toutes les organisations : la liste
     * vide est donc l'etat normal, pas une anomalie.</p>
     */
    @GetMapping("/providers/{id}/exposure")
    public List<ExposureRuleDto> exposureRules(@PathVariable Long id) {
        return exposureService.rulesFor(id).stream()
            .map(rule -> ExposureRuleDto.from(rule,
                organizationNameResolver.nameOf(rule.getOrganizationId())))
            .toList();
    }

    /** Pose ou remplace une regle. Remplace, car la base interdit le doublon. */
    @PutMapping("/providers/{id}/exposure")
    public ExposureRuleDto setExposureRule(@PathVariable Long id,
                                           @Valid @RequestBody ExposureRuleRequest request,
                                           @AuthenticationPrincipal Jwt jwt) {
        var rule = exposureService.setRule(id, request.organizationId(), request.effect(),
            request.reason(), jwt.getSubject());
        return ExposureRuleDto.from(rule, organizationNameResolver.nameOf(rule.getOrganizationId()));
    }

    /** Retire une regle : la fiche retombe sur le defaut, c'est-a-dire visible. */
    @DeleteMapping("/providers/{id}/exposure/{ruleId}")
    public ResponseEntity<Void> removeExposureRule(@PathVariable Long id, @PathVariable Long ruleId) {
        exposureService.removeRule(id, ruleId);
        return ResponseEntity.noContent().build();
    }

    /**
     * @param organizationId organisation visee, ou {@code null} pour toutes
     * @param reason         obligatoire — une regle sans motif ne se reprend pas
     */
    public record ExposureRuleRequest(
        Long organizationId,
        @NotNull ExposureEffect effect,
        @jakarta.validation.constraints.NotBlank(
            message = "Indiquez pourquoi cette règle existe : sans motif, personne n'osera la retirer.")
        @jakarta.validation.constraints.Size(max = 500) String reason
    ) {}

    // ─── Reprise de l'existant ───────────────────────────────────────────────

    /**
     * Cree les fiches manquantes des comptes prestataires deja inscrits et
     * comble les champs vides des fiches existantes.
     *
     * <p>Rejouable sans degat : l'import n'ecrase aucun champ renseigne. Reserve
     * au staff plateforme par l'annotation de classe — c'est aussi ce qui rend
     * la lecture transverse possible, le {@code TenantFilter} n'activant pas le
     * filtre d'organisation pour ces roles.</p>
     *
     * @param engagement mode d'engagement des fiches CREEES. Defaut
     *                   {@code EXCLUSIVE} : un intervenant recrute par une
     *                   organisation n'a jamais consenti a etre propose aux
     *                   autres, et ce choix se corrige fiche par fiche.
     */
    @PostMapping("/providers/import")
    public MarketplaceProviderImportService.ImportReport importExisting(
            @RequestParam(required = false) EngagementMode engagement) {
        return importService.importExistingProviders(
            engagement == null ? EngagementMode.EXCLUSIVE : engagement);
    }

    // ─── Traduction des erreurs ──────────────────────────────────────────────

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Void> handleNotFound(EntityNotFoundException e) {
        return ResponseEntity.notFound().build();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorBody> handleInvalid(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(new ErrorBody(e.getMessage()));
    }

    public record ErrorBody(String message) {}
}
