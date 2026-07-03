package com.clenzy.controller;

import com.clenzy.dto.TouristTaxCalculationDto;
import com.clenzy.dto.TouristTaxConfigDto;
import com.clenzy.dto.TouristTaxConfigRequest;
import com.clenzy.dto.TouristTaxReportDto;
import com.clenzy.service.TouristTaxService;
import com.clenzy.tenant.TenantContext;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

/**
 * Taxe de séjour Baitly : CRUD des barèmes (org-scopé), rapport et export CSV
 * par période, calcul de devis. Controller mince : validation d'entrée +
 * délégation au service + DTOs (aucun repository ici — règle ArchUnit).
 */
@RestController
@RequestMapping("/api/tourist-tax")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER','HOST')")
public class TouristTaxController {

    private final TouristTaxService taxService;
    private final TenantContext tenantContext;

    public TouristTaxController(TouristTaxService taxService, TenantContext tenantContext) {
        this.taxService = taxService;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<TouristTaxConfigDto> getConfigs() {
        return taxService.getAllConfigs(tenantContext.getOrganizationId()).stream()
            .map(TouristTaxConfigDto::from)
            .toList();
    }

    @GetMapping("/{propertyId}")
    public TouristTaxConfigDto getConfig(@PathVariable Long propertyId) {
        return taxService.getConfigForProperty(propertyId, tenantContext.getOrganizationId())
            .map(TouristTaxConfigDto::from)
            .orElseThrow(() -> new IllegalArgumentException("No tax config for property: " + propertyId));
    }

    @PutMapping
    public TouristTaxConfigDto saveConfig(@RequestBody TouristTaxConfigRequest request) {
        return TouristTaxConfigDto.from(
            taxService.upsertConfig(request, tenantContext.getOrganizationId()));
    }

    @DeleteMapping("/configs/{id}")
    public ResponseEntity<Void> deleteConfig(@PathVariable Long id) {
        taxService.deleteConfig(id, tenantContext.getOrganizationId());
        return ResponseEntity.noContent().build();
    }

    /** Rapport JSON : taxe par réservation (check-out dans [from, to]) + total. */
    @GetMapping("/report")
    public TouristTaxReportDto report(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return taxService.computeForPeriod(tenantContext.getOrganizationId(), from, to);
    }

    /** Export CSV du rapport de période (téléchargement). */
    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        TouristTaxReportDto report = taxService.computeForPeriod(
            tenantContext.getOrganizationId(), from, to);
        // BOM UTF-8 pour l'ouverture directe dans Excel.
        byte[] csv = ("\uFEFF" + taxService.toCsv(report)).getBytes(StandardCharsets.UTF_8);
        String filename = "taxe-sejour_" + from + "_" + to + ".csv";
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
            .body(csv);
    }

    @GetMapping("/calculate/{propertyId}")
    public TouristTaxCalculationDto calculate(
            @PathVariable Long propertyId,
            @RequestParam int nights,
            @RequestParam int guests,
            @RequestParam(defaultValue = "100") BigDecimal nightlyRate) {
        return taxService.calculate(propertyId, tenantContext.getOrganizationId(),
            nights, guests, nightlyRate);
    }
}
