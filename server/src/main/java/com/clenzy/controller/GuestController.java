package com.clenzy.controller;

import com.clenzy.dto.GuestDto;
import com.clenzy.dto.GuestListDto;
import com.clenzy.model.Guest;
import com.clenzy.model.GuestChannel;
import com.clenzy.model.Organization;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.GuestService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/guests")
@Tag(name = "Guests", description = "Gestion des voyageurs (fiches clients)")
@PreAuthorize("isAuthenticated()")
public class GuestController {

    private final GuestService guestService;
    private final GuestRepository guestRepository;
    private final OrganizationRepository organizationRepository;
    private final TenantContext tenantContext;

    public GuestController(GuestService guestService,
                           GuestRepository guestRepository,
                           OrganizationRepository organizationRepository,
                           TenantContext tenantContext) {
        this.guestService = guestService;
        this.guestRepository = guestRepository;
        this.organizationRepository = organizationRepository;
        this.tenantContext = tenantContext;
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

        boolean crossTenant = tenantContext.isSuperAdmin();
        List<Guest> guests = crossTenant
                ? guestRepository.findAllOrderByLastName()
                : guestRepository.findByOrganizationId(tenantContext.getRequiredOrganizationId());

        // Build org name lookup for cross-tenant view
        Map<Long, String> orgNames = crossTenant
                ? organizationRepository.findAll().stream()
                    .collect(Collectors.toMap(Organization::getId, Organization::getName, (a, b) -> a))
                : Map.of();

        String lowerSearch = (search != null && search.length() >= 2)
                ? search.toLowerCase().trim() : null;

        List<GuestListDto> results = guests.stream()
                .filter(g -> {
                    // Search filter (in-memory — encrypted fields)
                    if (lowerSearch != null) {
                        String fn = g.getFirstName() != null ? g.getFirstName().toLowerCase() : "";
                        String ln = g.getLastName() != null ? g.getLastName().toLowerCase() : "";
                        String email = g.getEmail() != null ? g.getEmail().toLowerCase() : "";
                        String full = fn + " " + ln;
                        if (!fn.contains(lowerSearch) && !ln.contains(lowerSearch)
                                && !full.contains(lowerSearch) && !email.contains(lowerSearch)) {
                            return false;
                        }
                    }
                    // Channel filter
                    if (channel != null && !channel.isBlank()) {
                        return g.getChannel() != null && g.getChannel().name().equalsIgnoreCase(channel);
                    }
                    return true;
                })
                .map(g -> toListDto(g, orgNames.getOrDefault(g.getOrganizationId(), null)))
                .toList();

        return ResponseEntity.ok(results);
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
        String lowerSearch = search.toLowerCase().trim();

        // Recherche en memoire car firstName/lastName sont chiffres en base
        List<GuestDto> results = guestRepository.findByOrganizationId(orgId).stream()
                .filter(g -> {
                    String fn = g.getFirstName() != null ? g.getFirstName().toLowerCase() : "";
                    String ln = g.getLastName() != null ? g.getLastName().toLowerCase() : "";
                    String full = fn + " " + ln;
                    return fn.contains(lowerSearch) || ln.contains(lowerSearch)
                            || full.contains(lowerSearch);
                })
                .limit(20)
                .map(this::toDto)
                .toList();

        return ResponseEntity.ok(results);
    }

    // ── POST : creer une fiche client ────────────────────────────────────────

    @PostMapping
    @Operation(summary = "Creer un voyageur",
            description = "Cree une fiche client (channel = DIRECT). "
                    + "La deduplication par email est geree automatiquement.")
    public ResponseEntity<GuestDto> create(@RequestBody GuestDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Guest guest = guestService.findOrCreate(
                dto.firstName(),
                dto.lastName(),
                dto.email(),
                dto.phone(),
                GuestChannel.DIRECT,
                null,
                orgId
        );

        return ResponseEntity.ok(toDto(guest));
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

        Guest guest = guestRepository.findById(guestId)
            .filter(g -> g.getOrganizationId().equals(orgId))
            .orElse(null);

        if (guest == null) {
            return ResponseEntity.notFound().build();
        }

        guest.setEmail(email.trim());
        guestRepository.save(guest);

        return ResponseEntity.ok(toDto(guest));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private GuestDto toDto(Guest g) {
        return new GuestDto(
                g.getId(),
                g.getFirstName(),
                g.getLastName(),
                g.getEmail(),
                g.getPhone(),
                g.getFullName()
        );
    }

    // ── POST /recalculate-stats : recalcul des compteurs totalStays/totalSpent ──

    @PostMapping("/recalculate-stats")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public Map<String, Object> recalculateStats() {
        int updated = guestService.recalculateAllStats();
        return Map.of("updated", updated, "status", "ok");
    }

    private GuestListDto toListDto(Guest g, String organizationName) {
        return new GuestListDto(
                g.getId(),
                g.getFirstName(),
                g.getLastName(),
                g.getEmail(),
                g.getPhone(),
                g.getFullName(),
                g.getChannel() != null ? g.getChannel().name() : null,
                g.getTotalStays(),
                g.getTotalSpent(),
                g.getLanguage(),
                g.getCreatedAt(),
                g.getOrganizationId(),
                organizationName
        );
    }
}
