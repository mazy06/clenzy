package com.clenzy.controller;

import com.clenzy.service.AccountingExportService;
import com.clenzy.tenant.TenantContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/accounting/export")
public class AccountingExportController {

    private final AccountingExportService exportService;
    private final TenantContext tenantContext;

    public AccountingExportController(AccountingExportService exportService,
                                      TenantContext tenantContext) {
        this.exportService = exportService;
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
}
