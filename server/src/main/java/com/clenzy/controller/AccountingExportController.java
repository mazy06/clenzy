package com.clenzy.controller;

import com.clenzy.model.Organization;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.service.AccountingExportService;
import com.clenzy.service.SepaXmlService;
import com.clenzy.tenant.TenantContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/accounting/export")
@PreAuthorize("isAuthenticated()")
public class AccountingExportController {

    private final AccountingExportService exportService;
    private final SepaXmlService sepaXmlService;
    private final OwnerPayoutRepository payoutRepository;
    private final OwnerPayoutConfigRepository configRepository;
    private final OrganizationRepository organizationRepository;
    private final TenantContext tenantContext;

    public AccountingExportController(AccountingExportService exportService,
                                      SepaXmlService sepaXmlService,
                                      OwnerPayoutRepository payoutRepository,
                                      OwnerPayoutConfigRepository configRepository,
                                      OrganizationRepository organizationRepository,
                                      TenantContext tenantContext) {
        this.exportService = exportService;
        this.sepaXmlService = sepaXmlService;
        this.payoutRepository = payoutRepository;
        this.configRepository = configRepository;
        this.organizationRepository = organizationRepository;
        this.tenantContext = tenantContext;
    }

    @GetMapping("/fec")
    public ResponseEntity<byte[]> exportFec(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = tenantContext.getOrganizationId();
        String content = exportService.exportFec(orgId, from, to);
        String filename = "FEC_" + from + "_" + to + ".txt";

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.TEXT_PLAIN)
            .body(content.getBytes());
    }

    @GetMapping("/reservations-csv")
    public ResponseEntity<byte[]> exportReservationsCsv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = tenantContext.getOrganizationId();
        String content = exportService.exportReservationsCsv(orgId, from, to);
        String filename = "reservations_" + from + "_" + to + ".csv";

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(content.getBytes());
    }

    @GetMapping("/payouts-csv")
    public ResponseEntity<byte[]> exportPayoutsCsv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = tenantContext.getOrganizationId();
        String content = exportService.exportPayoutsCsv(orgId, from, to);
        String filename = "payouts_" + from + "_" + to + ".csv";

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(content.getBytes());
    }

    @GetMapping("/expenses-csv")
    public ResponseEntity<byte[]> exportExpensesCsv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = tenantContext.getOrganizationId();
        String content = exportService.exportExpensesCsv(orgId, from, to);
        String filename = "depenses_" + from + "_" + to + ".csv";

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(content.getBytes());
    }

    @GetMapping("/invoices-csv")
    public ResponseEntity<byte[]> exportInvoicesCsv(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Long orgId = tenantContext.getOrganizationId();
        String content = exportService.exportInvoicesCsv(orgId, from, to);
        String filename = "factures_" + from + "_" + to + ".csv";

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(content.getBytes());
    }

    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'SUPER_MANAGER')")
    @PostMapping("/sepa-xml")
    public ResponseEntity<byte[]> exportSepaXml(@RequestBody List<Long> payoutIds) {
        Long orgId = tenantContext.getOrganizationId();

        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new IllegalArgumentException("Organisation introuvable"));

        List<OwnerPayout> payouts = payoutRepository.findByIdsAndOrgId(payoutIds, orgId);
        if (payouts.isEmpty()) {
            throw new IllegalArgumentException("Aucun payout trouve pour les IDs fournis");
        }

        List<Long> ownerIds = payouts.stream().map(OwnerPayout::getOwnerId).distinct().toList();
        Map<Long, OwnerPayoutConfig> configsByOwnerId = configRepository.findAllByOrgId(orgId).stream()
                .filter(c -> ownerIds.contains(c.getOwnerId()))
                .collect(Collectors.toMap(OwnerPayoutConfig::getOwnerId, Function.identity()));

        String xml = sepaXmlService.generatePain001(org, payouts, configsByOwnerId);
        String filename = "SEPA_" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + ".xml";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_XML)
                .body(xml.getBytes(StandardCharsets.UTF_8));
    }
}
