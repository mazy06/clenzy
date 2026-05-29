package com.clenzy.controller;

import com.clenzy.dto.voucher.BookingVoucherCreateRequestDto;
import com.clenzy.dto.voucher.BookingVoucherDto;
import com.clenzy.dto.voucher.BookingVoucherUpdateRequestDto;
import com.clenzy.dto.voucher.VoucherAnalyticsDto;
import com.clenzy.dto.voucher.VoucherStatsDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.BookingVoucher;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.model.voucher.VoucherCreatorOrgType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.voucher.BookingVoucherService;
import com.clenzy.service.voucher.VoucherAnalyticsService;
import com.clenzy.tenant.TenantContext;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

/**
 * Endpoints REST admin pour la gestion des {@link BookingVoucher}.
 *
 * <h3>Auth</h3>
 * Endpoint authentifie ({@code @PreAuthorize("isAuthenticated()")}). L'ownership
 * est verifiee implicitement via Hibernate {@code @Filter(organizationFilter)}
 * + explicitement dans {@link BookingVoucherService}.
 *
 * <h3>Detection HOST vs MANAGEMENT_ORG</h3>
 * Pour la creation, le controller determine automatiquement le
 * {@link VoucherCreatorOrgType} :
 * <ul>
 *   <li>Si le requester est proprietaire de TOUTES les properties cibles
 *       ({@code property.ownerId == requesterUserId}) → HOST</li>
 *   <li>Si au moins une property a un autre owner → MANAGEMENT_ORG
 *       (le service verifiera alors les flags {@code has_voucher_contract} +
 *       {@code org_can_create_vouchers})</li>
 * </ul>
 * <p>Cas particulier : si {@code propertyIds} vide (= toutes les properties
 * de l'org), considere comme HOST. Si en realite le requester n'est pas owner,
 * le service refusera (HOST type ne peut creer un voucher cross-property que
 * sur les properties qu'il possede).</p>
 */
@RestController
@RequestMapping("/api/vouchers")
@Tag(name = "Booking Vouchers", description = "Gestion des promos/vouchers sur les nuitees")
@PreAuthorize("isAuthenticated()")
public class BookingVoucherController {

    private static final Logger log = LoggerFactory.getLogger(BookingVoucherController.class);

    private final BookingVoucherService voucherService;
    private final VoucherAnalyticsService analyticsService;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public BookingVoucherController(
        BookingVoucherService voucherService,
        VoucherAnalyticsService analyticsService,
        PropertyRepository propertyRepository,
        UserRepository userRepository,
        TenantContext tenantContext
    ) {
        this.voucherService = voucherService;
        this.analyticsService = analyticsService;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    // ─── READ ───────────────────────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "Liste les vouchers de l'organisation courante")
    public List<BookingVoucherDto> list(
        @RequestParam(required = false) VoucherStatus status
    ) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return voucherService.listByOrg(orgId, status).stream()
            .map(v -> BookingVoucherDto.from(v, voucherService.getScopedPropertyIds(v.getId())))
            .toList();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Detail d'un voucher")
    public BookingVoucherDto getOne(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingVoucher v = voucherService.findOrThrow(id, orgId);
        return BookingVoucherDto.from(v, voucherService.getScopedPropertyIds(v.getId()));
    }

    // ─── WRITE ──────────────────────────────────────────────────────────────

    @PostMapping
    @Operation(summary = "Cree un nouveau voucher")
    @ResponseStatus(HttpStatus.CREATED)
    public BookingVoucherDto create(
        @RequestBody @Valid BookingVoucherCreateRequestDto request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = resolveUserId(jwt);
        VoucherCreatorOrgType creatorType = detectCreatorOrgType(userId, request.propertyIds());

        BookingVoucher created = voucherService.create(orgId, userId, creatorType, request.toPayload());
        log.info("Voucher created : id={}, code={}, by user={}, type={}",
            created.getId(), created.getCode(), userId, creatorType);
        return BookingVoucherDto.from(created, voucherService.getScopedPropertyIds(created.getId()));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Modifie un voucher existant")
    public BookingVoucherDto update(
        @PathVariable Long id,
        @RequestBody @Valid BookingVoucherUpdateRequestDto request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Long userId = resolveUserId(jwt);
        // Pour l'update, on detecte le creatorType sur le scope demande (si change)
        // ou sur le scope existant (si non touche).
        List<Long> effectiveScope = request.propertyIds() != null
            ? request.propertyIds()
            : List.copyOf(voucherService.getScopedPropertyIds(id));
        VoucherCreatorOrgType creatorType = detectCreatorOrgType(userId, effectiveScope);

        BookingVoucher updated = voucherService.update(id, orgId, userId, creatorType, request.toPayload());
        return BookingVoucherDto.from(updated, voucherService.getScopedPropertyIds(updated.getId()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Supprime un voucher (refuse si deja utilise)")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        voucherService.delete(id, orgId);
    }

    @PostMapping("/{id}/pause")
    @Operation(summary = "Pause un voucher (preserve historique vs delete)")
    public BookingVoucherDto pause(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingVoucher updated = voucherService.setStatus(id, orgId, VoucherStatus.PAUSED);
        return BookingVoucherDto.from(updated, voucherService.getScopedPropertyIds(updated.getId()));
    }

    @PostMapping("/{id}/resume")
    @Operation(summary = "Reprend un voucher PAUSED")
    public BookingVoucherDto resume(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingVoucher updated = voucherService.setStatus(id, orgId, VoucherStatus.ACTIVE);
        return BookingVoucherDto.from(updated, voucherService.getScopedPropertyIds(updated.getId()));
    }

    // ─── Analytics ──────────────────────────────────────────────────────────

    @GetMapping("/analytics")
    @Operation(summary = "Analytics agregees de tous les vouchers de l'org sur une periode")
    public VoucherAnalyticsDto getOrgAnalytics(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
    ) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return analyticsService.getOrgAnalytics(orgId, from, to);
    }

    @GetMapping("/{id}/analytics")
    @Operation(summary = "Stats detaillees d'un voucher")
    public VoucherStatsDto getVoucherAnalytics(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return analyticsService.getVoucherStats(id, orgId);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private Long resolveUserId(Jwt jwt) {
        String keycloakId = jwt.getSubject();
        User user = userRepository.findByKeycloakId(keycloakId)
            .orElseThrow(() -> new NotFoundException("User " + keycloakId + " introuvable"));
        return user.getId();
    }

    /**
     * Detecte le type de createur en fonction du lien user-property.
     *
     * <ul>
     *   <li>HOST si le user est owner de TOUTES les properties cibles (ou
     *       liste vide = pas de scope explicite, on considere HOST par
     *       defaut — si en realite il n'est pas owner d'une property dans
     *       son org, le service le verifiera quand il listera les properties
     *       affectees).</li>
     *   <li>MANAGEMENT_ORG des qu'au moins une property a un autre owner
     *       (le service verifiera les consentements requis).</li>
     * </ul>
     */
    private VoucherCreatorOrgType detectCreatorOrgType(Long userId, List<Long> propertyIds) {
        if (propertyIds == null || propertyIds.isEmpty()) {
            // Scope vide = "toutes les properties de l'org" : on parie HOST
            // (le service refusera si MANAGEMENT_ORG necessite scope explicit).
            return VoucherCreatorOrgType.HOST;
        }
        List<Property> properties = propertyRepository.findAllById(propertyIds);
        for (Property p : properties) {
            // Si un seul property n'est pas owned par le requester, c'est MANAGEMENT_ORG
            User owner = p.getOwner();
            if (owner == null || owner.getId() == null || !owner.getId().equals(userId)) {
                return VoucherCreatorOrgType.MANAGEMENT_ORG;
            }
        }
        return VoucherCreatorOrgType.HOST;
    }
}
