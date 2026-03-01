package com.clenzy.controller;

import com.clenzy.dto.VatSummaryDto;
import com.clenzy.service.FiscalReportingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * Controller REST pour le reporting fiscal.
 *
 * Endpoints :
 * - GET /api/fiscal-reports/vat-summary         → resume TVA pour une periode
 * - GET /api/fiscal-reports/vat-summary/monthly  → resume TVA mensuel
 * - GET /api/fiscal-reports/vat-summary/quarterly → resume TVA trimestriel
 * - GET /api/fiscal-reports/vat-summary/annual   → resume TVA annuel
 */
@RestController
@RequestMapping("/api/fiscal-reports")
public class FiscalReportingController {

    private final FiscalReportingService reportingService;

    public FiscalReportingController(FiscalReportingService reportingService) {
        this.reportingService = reportingService;
    }

    /**
     * Resume TVA pour une periode personnalisee.
     */
    @GetMapping("/vat-summary")
    public ResponseEntity<VatSummaryDto> getVatSummary(
            @RequestParam LocalDate from,
            @RequestParam LocalDate to) {
        return ResponseEntity.ok(reportingService.getVatSummary(from, to));
    }

    /**
     * Resume TVA mensuel.
     */
    @GetMapping("/vat-summary/monthly")
    public ResponseEntity<VatSummaryDto> getMonthlyVatSummary(
            @RequestParam int year,
            @RequestParam int month) {
        return ResponseEntity.ok(reportingService.getMonthlyVatSummary(year, month));
    }

    /**
     * Resume TVA trimestriel.
     */
    @GetMapping("/vat-summary/quarterly")
    public ResponseEntity<VatSummaryDto> getQuarterlyVatSummary(
            @RequestParam int year,
            @RequestParam int quarter) {
        return ResponseEntity.ok(reportingService.getQuarterlyVatSummary(year, quarter));
    }

    /**
     * Resume TVA annuel.
     */
    @GetMapping("/vat-summary/annual")
    public ResponseEntity<VatSummaryDto> getAnnualVatSummary(
            @RequestParam int year) {
        return ResponseEntity.ok(reportingService.getAnnualVatSummary(year));
    }
}
