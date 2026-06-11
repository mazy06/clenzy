package com.clenzy.controller;

import com.clenzy.dto.voucher.BookingVoucherCreateRequestDto;
import com.clenzy.dto.voucher.BookingVoucherDto;
import com.clenzy.dto.voucher.BookingVoucherUpdateRequestDto;
import com.clenzy.dto.voucher.VoucherAnalyticsDto;
import com.clenzy.dto.voucher.VoucherStatsDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.BookingVoucher;
import com.clenzy.model.User;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.service.UserService;
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
 * Deleguee au service (cf. {@code BookingVoucherService.detectCreatorOrgType}).
 * Le controller ne fait que router : userId + orgId + payload → service.
 */
@RestController
@RequestMapping("/api/vouchers")
@Tag(name = "Booking Vouchers", description = "Gestion des promos/vouchers sur les nuitees")
@PreAuthorize("isAuthenticated()")
public class BookingVoucherController {

    private static final Logger log = LoggerFactory.getLogger(BookingVoucherController.class);

    private final BookingVoucherService voucherService;
    private final VoucherAnalyticsService analyticsService;
    private final UserService userService;
    private final TenantContext tenantContext;

    public BookingVoucherController(
        BookingVoucherService voucherService,
        VoucherAnalyticsService analyticsService,
        UserService userService,
        TenantContext tenantContext
    ) {
        this.voucherService = voucherService;
        this.analyticsService = analyticsService;
        this.userService = userService;
        this.tenantContext = tenantContext;
    }

    // ─── READ ───────────────────────────────────────────────────────────────

    @GetMapping
    @Operation(summary = "Liste les vouchers de l'organisation courante")
    public List<BookingVoucherDto> list(
        @RequestParam(required = false) VoucherStatus status
    ) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        List<BookingVoucher> vouchers = voucherService.listByOrg(orgId, status);
        if (vouchers.isEmpty()) return List.of();
        // Fix H2 : batch lookup des scopes (1 SQL au lieu de N).
        var scopesByVoucher = voucherService.getScopedPropertyIdsBatch(
            vouchers.stream().map(BookingVoucher::getId).toList());
        return vouchers.stream()
            .map(v -> BookingVoucherDto.from(v,
                scopesByVoucher.getOrDefault(v.getId(), java.util.Set.of())))
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
        var creatorType = voucherService.detectCreatorOrgType(userId, request.propertyIds());
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
        // Detection delegue au service : si scope dans le payload, on l'utilise ;
        // sinon le service relit le scope existant en interne (1 seul SQL).
        var creatorType = request.propertyIds() != null
            ? voucherService.detectCreatorOrgType(userId, request.propertyIds())
            : voucherService.detectCreatorOrgTypeFromExistingScope(id, userId);
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
        User user = userService.findByKeycloakId(keycloakId);
        if (user == null) {
            throw new NotFoundException("User " + keycloakId + " introuvable");
        }
        return user.getId();
    }
}
