package com.clenzy.controller;

import com.clenzy.dto.ActivityCommissionDto;
import com.clenzy.dto.ActivityCommissionSummaryDto;
import com.clenzy.dto.ActivityConfigDto;
import com.clenzy.dto.ImportAffiliateEarningRequest;
import com.clenzy.dto.UpsertActivityConfigRequest;
import com.clenzy.model.ActivityProvider;
import com.clenzy.service.ActivityCommissionService;
import com.clenzy.service.AffiliateEarningsCsvParser;
import com.clenzy.service.ActivityService;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Gestion (cote hote) des connexions aux providers d'activites affiliees.
 * La cle API n'est jamais renvoyee (cf. {@link ActivityConfigDto}).
 */
@RestController
@RequestMapping("/api/activities")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class ActivityAffiliateController {

    private final ActivityService activityService;
    private final ActivityCommissionService commissionService;
    private final TenantContext tenantContext;
    private final AffiliateEarningsCsvParser csvParser;

    public ActivityAffiliateController(ActivityService activityService,
                                       ActivityCommissionService commissionService,
                                       TenantContext tenantContext,
                                       AffiliateEarningsCsvParser csvParser) {
        this.activityService = activityService;
        this.commissionService = commissionService;
        this.tenantContext = tenantContext;
        this.csvParser = csvParser;
    }

    @GetMapping("/configs")
    public ResponseEntity<List<ActivityConfigDto>> listConfigs() {
        return ResponseEntity.ok(activityService.listConfigs(tenantContext.getOrganizationId()));
    }

    @PutMapping("/configs/{provider}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER') or (hasRole('HOST') and #request.platformCommissionPct() == null)")
    public ResponseEntity<ActivityConfigDto> upsertConfig(@PathVariable ActivityProvider provider,
                                                          @Valid @RequestBody UpsertActivityConfigRequest request) {
        ActivityConfigDto dto = activityService.upsertConfig(
            tenantContext.getRequiredOrganizationId(), provider,
            request.apiKey(), request.affiliateId(), request.enabled(),
            request.platformCommissionPct());
        return ResponseEntity.ok(dto);
    }

    /**
     * Enregistre des commissions attendues, sans créditer les bénéficiaires.
     *
     * <p>Réservé au staff. Idempotent par
     * {@code externalBookingId}, donc rejouer un rapport est sans danger.</p>
     */
    @PostMapping("/commissions/import")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<List<ActivityCommissionDto>> importEarnings(
            @RequestBody @Valid List<ImportAffiliateEarningRequest> rows) {
        Long orgId = tenantContext.getOrganizationId();
        return ResponseEntity.ok(rows.stream()
            .map(row -> commissionService.recordAffiliateEarning(
                orgId, row.provider(), row.externalBookingId(),
                row.grossCommission(), row.currency(), row.propertyId()))
            .toList());
    }

    /**
     * Importe un export de conversions telecharge depuis le tableau de bord du
     * programme (Viator, GetYourGuide, Klook).
     *
     * <p>Le CSV est le seul canal commun aux trois : c'est donc la voie
     * d'alimentation par defaut. Idempotent par reference de reservation, donc
     * reimporter un fichier qui chevauche le precedent est sans danger.</p>
     */
    @PostMapping(value = "/commissions/import/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<List<ActivityCommissionDto>> importEarningsCsv(
            @RequestParam ActivityProvider provider,
            @RequestParam("file") MultipartFile file) throws IOException {
        String content = new String(file.getBytes(), StandardCharsets.UTF_8);
        Long orgId = tenantContext.getOrganizationId();
        return ResponseEntity.ok(csvParser.parse(content, provider).stream()
            .map(row -> commissionService.recordAffiliateEarning(
                orgId, row.provider(), row.externalBookingId(),
                row.grossCommission(), row.currency(), row.propertyId()))
            .toList());
    }

    @GetMapping("/commissions")
    public ResponseEntity<List<ActivityCommissionDto>> listCommissions() {
        return ResponseEntity.ok(commissionService.listForOrg(tenantContext.getOrganizationId()));
    }

    public record ReceiptRequest(@jakarta.validation.constraints.NotNull java.math.BigDecimal amount,
            @jakarta.validation.constraints.NotBlank String currency,
            @jakarta.validation.constraints.NotNull Long propertyId,
            @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=255) String reference,
            @jakarta.validation.constraints.NotNull java.time.LocalDateTime receivedAt) {}

    @PostMapping("/commissions/{id}/receipt")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<ActivityCommissionDto> receipt(@PathVariable Long id, @Valid @RequestBody ReceiptRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt) {
        return ResponseEntity.ok(commissionService.receive(tenantContext.getOrganizationId(), id, request.amount(),
                request.currency(), request.propertyId(), request.reference(), request.receivedAt(), jwt.getSubject()));
    }

    @PostMapping("/commissions/{id}/cancel")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<ActivityCommissionDto> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(commissionService.cancelExpected(tenantContext.getOrganizationId(),id));
    }

    @GetMapping("/commissions/summary")
    public ResponseEntity<ActivityCommissionSummaryDto> commissionsSummary() {
        return ResponseEntity.ok(commissionService.summaryForOrg(tenantContext.getOrganizationId()));
    }
}
