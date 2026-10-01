package com.clenzy.controller;

import com.clenzy.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/**
 * Generation de rapports PDF.
 *
 * <h3>Securite</h3>
 * <p>Les quatre routes sont gardees par {@code reports:generate}, accordee a
 * SUPER_ADMIN et SUPER_MANAGER ({@code PermissionInitializer}).</p>
 *
 * <p><b>Pourquoi une permission et pas une liste de roles</b> : les permissions
 * par role sont administrables ({@code PUT /api/permissions/roles/{role}}). Une
 * liste ecrite en dur dans l'annotation ignorerait cette administration —
 * retirer {@code reports:generate} a SUPER_MANAGER depuis l'ecran ne changerait
 * rien a l'API. Ce sont les seules routes du projet dans ce cas ; partout
 * ailleurs la regle se reduit a une liste de roles figee, et
 * {@code hasAnyRole} y reste l'ecriture juste, moins couteuse.</p>
 *
 * <p><b>Historique</b> : cette expression etait auparavant inerte. Faute de
 * {@code PermissionEvaluator} enregistre, Spring Security retombait sur
 * {@code DenyAllPermissionEvaluator}, dont la reponse est toujours
 * {@code false} : la regle ne refusait pas les profils sans la permission, elle
 * refusait <b>tout le monde</b>, SUPER_ADMIN compris, et ces rapports etaient
 * injoignables. C'est {@link com.clenzy.config.MethodSecurityConfig} qui lui
 * donne son sens ; sans cette configuration dans le contexte, les quatre routes
 * se referment d'un bloc — comportement fige par
 * {@code MethodSecurityDefaultDenyTest}.</p>
 */
@RestController
@RequestMapping("/api/reports")
@Tag(name = "Reports", description = "Génération de rapports PDF")
@PreAuthorize("isAuthenticated()")
public class ReportController {
    
    private static final Logger logger = LoggerFactory.getLogger(ReportController.class);

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }
    
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
