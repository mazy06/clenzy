package com.clenzy.controller;

import com.clenzy.dto.GuestDto;
import com.clenzy.dto.GuestListDto;
import com.clenzy.dto.GuestPageDto;
import com.clenzy.service.GuestPhotoUrlResolver;
import com.clenzy.service.GuestService;
import com.clenzy.service.MediaTicketService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/guests")
@Tag(name = "Guests", description = "Gestion des voyageurs (fiches clients)")
@PreAuthorize("isAuthenticated()")
public class GuestController {

    /** Borne haute de la taille de page du mode pagine. */
    private static final int MAX_PAGE_SIZE = 200;

    private final GuestService guestService;
    private final TenantContext tenantContext;
    private final MediaTicketService mediaTicketService;

    public GuestController(GuestService guestService,
                           TenantContext tenantContext,
                           MediaTicketService mediaTicketService) {
        this.guestService = guestService;
        this.tenantContext = tenantContext;
        this.mediaTicketService = mediaTicketService;
    }

    // ── GET /list : listing complet pour la page Voyageurs ───────────────────

    @GetMapping("/list")
    @Operation(summary = "Lister les voyageurs",
            description = "Retourne tous les voyageurs. "
                    + "Les SUPER_ADMIN et SUPER_MANAGER voient toutes les organisations. "
                    + "Filtrage optionnel par search et channel.")
    public ResponseEntity<List<GuestListDto>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String channel) {

        // null = platform staff, lecture cross-org
        Long orgId = tenantContext.isSuperAdmin() ? null : tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(guestService.listGuests(orgId, search, channel));
    }

    // ── GET /list?page= : mode pagine opt-in (enveloppe {content, totalElements}) ──

    @GetMapping(value = "/list", params = "page")
    @Operation(summary = "Lister les voyageurs (mode pagine)",
            description = "Mode pagine opt-in via ?page=&size=. Sans search : pagination SQL vraie "
                    + "(tri stable sur valeurs chiffrees). Avec search : filtre en memoire "
                    + "(champs chiffres AES) puis decoupage serveur — le payload reste borne a la page. "
                    + "Enveloppe {content, page, size, totalElements}.")
    public ResponseEntity<GuestPageDto> listPaged(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String channel,
            @RequestParam int page,
            @RequestParam(defaultValue = "25") int size) {

        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);

        // null = platform staff, lecture cross-org
        Long orgId = tenantContext.isSuperAdmin() ? null : tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(guestService.listGuestsPage(orgId, search, channel, safePage, safeSize));
    }

    // ── GET : recherche par nom ──────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "Rechercher des voyageurs par nom",
            description = "Recherche en memoire (champs chiffres AES-256). "
                    + "Minimum 2 caracteres, limite a 20 resultats.")
    public ResponseEntity<List<GuestDto>> search(@RequestParam String search) {
        if (search == null || search.isBlank() || search.length() < 2) {
            return ResponseEntity.ok(List.of());
        }

        Long orgId = tenantContext.getRequiredOrganizationId();
        return ResponseEntity.ok(guestService.searchByName(orgId, search));
    }

    // ── POST : creer une fiche client ────────────────────────────────────────

    @PostMapping
    @Operation(summary = "Creer un voyageur",
            description = "Cree une fiche client (channel = DIRECT). "
                    + "La deduplication par email est geree automatiquement.")
    public ResponseEntity<GuestDto> create(@RequestBody GuestDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        // findOrCreate DIRECT + application des infos optionnelles (langue, pays, notes).
        return ResponseEntity.ok(guestService.createDirect(dto, orgId));
    }

    // ── PUT : mettre a jour une fiche voyageur ──────────────────────────────

    @PutMapping("/{guestId}")
    @Operation(summary = "Mettre a jour une fiche voyageur",
            description = "Met a jour les infos d'un voyageur existant (nom, email, telephone, "
                    + "nationalite, langue, notes). Org-scope.")
    public ResponseEntity<GuestDto> update(
            @PathVariable Long guestId,
            @RequestBody GuestDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return guestService.updateGuest(guestId, orgId, dto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── PATCH : mettre a jour l'email d'un voyageur ─────────────────────────

    @PatchMapping("/{guestId}/email")
    @Operation(summary = "Mettre a jour l'email d'un voyageur",
            description = "Permet de corriger l'email manquant ou errone d'un voyageur.")
    public ResponseEntity<GuestDto> updateEmail(
            @PathVariable Long guestId,
            @RequestBody Map<String, String> body) {

        Long orgId = tenantContext.getRequiredOrganizationId();
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        return guestService.updateGuestEmail(guestId, orgId, email)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ── POST /recalculate-stats : recalcul des compteurs totalStays/totalSpent ──

    @PostMapping("/recalculate-stats")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Object> recalculateStats() {
        int updated = guestService.recalculateAllStats();
        return Map.of("updated", updated, "status", "ok");
    }

    // ── GET /{id}/photo : photo de profil du voyageur ────────────────────────

    /**
     * Sert la photo de profil d'un voyageur.
     *
     * <p><b>Pourquoi une route plutot qu'une image dans le JSON.</b> La photo
     * etait auparavant embarquee en data URI dans chaque reservation : le meme
     * portrait repartait autant de fois que le voyageur avait de sejours, sans
     * que le navigateur puisse rien mettre en cache. Servie ici, elle est
     * demandee une fois et rangee dans le cache HTTP.</p>
     *
     * <p><b>Acces, ferme par defaut.</b> Deux chemins, jamais un troisieme :
     * soit un ticket HMAC valide pour CE voyageur — indispensable parce qu'un
     * {@code <img src>} n'envoie aucun en-tete d'autorisation —, soit un
     * utilisateur authentifie de la meme organisation. Un voyageur d'une autre
     * organisation ressort en 404 et non en 403 : repondre « interdit »
     * confirmerait son existence et rendrait les identifiants enumerables.</p>
     */
    @GetMapping("/{id}/photo")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Recuperer la photo de profil d'un voyageur")
    public ResponseEntity<Resource> getPhoto(
            @PathVariable Long id,
            @RequestParam(value = "ticket", required = false) String ticket,
            @AuthenticationPrincipal Jwt jwt) {

        // Portee de lecture : null = cross-org. Le ticket vaut autorisation pour
        // ce voyageur precis, il n'a donc pas a etre re-borne par organisation.
        final Long scopeOrgId;
        if (mediaTicketService.verify(GuestPhotoUrlResolver.scopeFor(id), ticket)) {
            scopeOrgId = null;
        } else if (jwt == null) {
            return ResponseEntity.status(401).build();
        } else {
            scopeOrgId = tenantContext.isSuperAdmin() ? null : tenantContext.getRequiredOrganizationId();
        }

        return guestService.streamPhoto(id, scopeOrgId)
                .map(photo -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(photo.contentType()))
                        // Privee : la photo n'est pas publique, aucun cache
                        // partage ne doit la garder. La fenetre suit celle du
                        // ticket, pour qu'une URL cachee reste valide.
                        .cacheControl(CacheControl.maxAge(15, TimeUnit.MINUTES).cachePrivate())
                        .body(photo.resource()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
