package com.clenzy.controller;

import com.clenzy.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@Tag(name = "Reports", description = "Génération de rapports PDF")
public class ReportController {
    
    private static final Logger logger = LoggerFactory.getLogger(ReportController.class);
    
    @Autowired
    private ReportService reportService;
    
    @GetMapping("/financial/{reportType}")
    @Operation(summary = "Générer un rapport financier")
    @PreAuthorize("hasPermission(null, 'reports:generate')")
    public ResponseEntity<?> generateFinancialReport(
            @PathVariable String reportType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        try {
            // Dates par défaut : dernier mois
            if (startDate == null) {
                startDate = LocalDate.now().minusMonths(1);
            }
            if (endDate == null) {
                endDate = LocalDate.now();
            }
            
            logger.info("Génération du rapport financier: type={}, startDate={}, endDate={}", reportType, startDate, endDate);
            
            byte[] pdfBytes = reportService.generateFinancialReport(reportType, startDate, endDate);
            
            if (pdfBytes == null || pdfBytes.length == 0) {
                logger.error("Le rapport généré est vide");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur lors de la génération du rapport", "message", "Le rapport généré est vide"));
            }
            
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=rapport-financier-" + reportType + "-" + LocalDate.now() + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
        } catch (Exception e) {
            logger.error("Erreur lors de la génération du rapport financier", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de la génération du rapport", "message", e.getMessage() != null ? e.getMessage() : "Une erreur inattendue s'est produite"));
        }
    }
    
    @GetMapping("/interventions/{reportType}")
    @Operation(summary = "Générer un rapport d'interventions")
    @PreAuthorize("hasPermission(null, 'reports:generate')")
    public ResponseEntity<?> generateInterventionReport(
            @PathVariable String reportType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        try {
            if (startDate == null) {
                startDate = LocalDate.now().minusMonths(1);
            }
            if (endDate == null) {
                endDate = LocalDate.now();
            }
            
            logger.info("Génération du rapport d'interventions: type={}, startDate={}, endDate={}", reportType, startDate, endDate);
            
            byte[] pdfBytes = reportService.generateInterventionReport(reportType, startDate, endDate);
            
            if (pdfBytes == null || pdfBytes.length == 0) {
                logger.error("Le rapport généré est vide");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur lors de la génération du rapport", "message", "Le rapport généré est vide"));
            }
            
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=rapport-interventions-" + reportType + "-" + LocalDate.now() + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
        } catch (Exception e) {
            logger.error("Erreur lors de la génération du rapport d'interventions", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de la génération du rapport", "message", e.getMessage() != null ? e.getMessage() : "Une erreur inattendue s'est produite"));
        }
    }
    
    @GetMapping("/teams/{reportType}")
    @Operation(summary = "Générer un rapport d'équipes")
    @PreAuthorize("hasPermission(null, 'reports:generate')")
    public ResponseEntity<?> generateTeamReport(
            @PathVariable String reportType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        try {
            if (startDate == null) {
                startDate = LocalDate.now().minusMonths(1);
            }
            if (endDate == null) {
                endDate = LocalDate.now();
            }
            
            logger.info("Génération du rapport d'équipes: type={}, startDate={}, endDate={}", reportType, startDate, endDate);
            
            byte[] pdfBytes = reportService.generateTeamReport(reportType, startDate, endDate);
            
            if (pdfBytes == null || pdfBytes.length == 0) {
                logger.error("Le rapport généré est vide");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur lors de la génération du rapport", "message", "Le rapport généré est vide"));
            }
            
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=rapport-equipes-" + reportType + "-" + LocalDate.now() + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
        } catch (Exception e) {
            logger.error("Erreur lors de la génération du rapport d'équipes", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de la génération du rapport", "message", e.getMessage() != null ? e.getMessage() : "Une erreur inattendue s'est produite"));
        }
    }
    
    @GetMapping("/properties/{reportType}")
    @Operation(summary = "Générer un rapport de propriétés")
    @PreAuthorize("hasPermission(null, 'reports:generate')")
    public ResponseEntity<?> generatePropertyReport(
            @PathVariable String reportType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        try {
            if (startDate == null) {
                startDate = LocalDate.now().minusMonths(1);
            }
            if (endDate == null) {
                endDate = LocalDate.now();
            }
            
            logger.info("Génération du rapport de propriétés: type={}, startDate={}, endDate={}", reportType, startDate, endDate);
            
            byte[] pdfBytes = reportService.generatePropertyReport(reportType, startDate, endDate);
            
            if (pdfBytes == null || pdfBytes.length == 0) {
                logger.error("Le rapport généré est vide");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Erreur lors de la génération du rapport", "message", "Le rapport généré est vide"));
            }
            
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=rapport-proprietes-" + reportType + "-" + LocalDate.now() + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
        } catch (Exception e) {
            logger.error("Erreur lors de la génération du rapport de propriétés", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de la génération du rapport", "message", e.getMessage() != null ? e.getMessage() : "Une erreur inattendue s'est produite"));
        }
    }
}
