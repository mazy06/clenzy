package com.clenzy.controller;

import com.clenzy.dto.*;
import com.clenzy.exception.*;
import com.clenzy.model.DocumentGeneration;
import com.clenzy.model.DocumentType;
import com.clenzy.model.TagCategory;
import com.clenzy.service.DocumentComplianceService;
import com.clenzy.service.DocumentGeneratorService;
import com.clenzy.service.DocumentStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/documents")
@Tag(name = "Documents", description = "Generation et gestion de documents")
@PreAuthorize("isAuthenticated()")
public class DocumentController {

    private static final Logger log = LoggerFactory.getLogger(DocumentController.class);

    private final DocumentGeneratorService generatorService;
    private final DocumentStorageService documentStorageService;
    private final DocumentComplianceService complianceService;

    public DocumentController(DocumentGeneratorService generatorService,
                               DocumentStorageService documentStorageService,
                               DocumentComplianceService complianceService) {
        this.generatorService = generatorService;
        this.documentStorageService = documentStorageService;
        this.complianceService = complianceService;
    }

    // ─── Templates ──────────────────────────────────────────────────────────

    @GetMapping("/templates")
    @Operation(summary = "Lister tous les templates")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<List<DocumentTemplateDto>> listTemplates() {
        List<DocumentTemplateDto> templates = generatorService.listTemplates().stream()
                .map(DocumentTemplateDto::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(templates);
    }

    @GetMapping("/templates/{id}")
    @Operation(summary = "Detail d'un template avec ses tags")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<DocumentTemplateDto> getTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(DocumentTemplateDto.fromEntity(generatorService.getTemplate(id)));
    }

    @PostMapping(value = "/templates", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Uploader un nouveau template .odt")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<DocumentTemplateDto> uploadTemplate(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file,
            @RequestParam("name") String name,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam("documentType") String documentType,
            @RequestParam(value = "eventTrigger", required = false) String eventTrigger,
            @RequestParam(value = "emailSubject", required = false) String emailSubject,
            @RequestParam(value = "emailBody", required = false) String emailBody
    ) {
        var template = generatorService.uploadTemplate(
                file, name, description, documentType, eventTrigger, emailSubject, emailBody, jwt);
        return ResponseEntity.status(HttpStatus.CREATED).body(DocumentTemplateDto.fromEntity(template));
    }

    @PutMapping("/templates/{id}")
    @Operation(summary = "Modifier les metadata d'un template")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<DocumentTemplateDto> updateTemplate(
            @PathVariable Long id,
            @RequestBody UpdateTemplateRequest body
    ) {
        var template = generatorService.updateTemplate(id,
                body.name(), body.description(),
                body.eventTrigger(), body.emailSubject(), body.emailBody());
        return ResponseEntity.ok(DocumentTemplateDto.fromEntity(template));
    }

    public record UpdateTemplateRequest(
            String name,
            String description,
            String eventTrigger,
            String emailSubject,
            String emailBody
    ) {}

    @PutMapping("/templates/{id}/activate")
    @Operation(summary = "Activer un template (desactive les autres du meme type)")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<DocumentTemplateDto> activateTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(DocumentTemplateDto.fromEntity(generatorService.activateTemplate(id)));
    }

    @DeleteMapping("/templates/{id}")
    @Operation(summary = "Supprimer un template")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        generatorService.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/templates/{id}/reparse")
    @Operation(summary = "Re-scanner les tags d'un template")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<DocumentTemplateDto> reparseTemplate(@PathVariable Long id) {
        return ResponseEntity.ok(DocumentTemplateDto.fromEntity(generatorService.reparseTemplate(id)));
    }

    // ─── Generation ─────────────────────────────────────────────────────────

    @PostMapping("/generate")
    @Operation(summary = "Generer un document manuellement")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<DocumentGenerationDto> generateDocument(
            @AuthenticationPrincipal Jwt jwt,
            @jakarta.validation.Valid @RequestBody GenerateDocumentRequest request
    ) {
        DocumentGenerationDto result = generatorService.generateDocument(request, jwt);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    // ─── Historique ─────────────────────────────────────────────────────────

    @GetMapping("/generations")
    @Operation(summary = "Historique des generations de documents")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<Page<DocumentGenerationDto>> listGenerations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = safePageable(page, size);
        return ResponseEntity.ok(generatorService.listGenerations(pageable));
    }

    @GetMapping("/generations/{id}/download")
    @Operation(summary = "Telecharger un document genere")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<Resource> downloadGeneration(@PathVariable Long id) {
        DocumentGeneration generation = generatorService.getGeneration(id);

        if (generation.getFilePath() == null || generation.getFilePath().isBlank()) {
            throw new DocumentNotFoundException("Fichier non disponible pour cette generation");
        }

        Resource resource = documentStorageService.load(generation.getFilePath());
        String filename = generation.getFileName() != null ? generation.getFileName() : "document.pdf";
        String encodedFilename = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");

        return ResponseEntity.ok()
                .header("Content-Type", "application/pdf")
                .header("Content-Disposition", "attachment; filename=\"" + filename + "\"; "
                        + "filename*=UTF-8''" + encodedFilename)
                .header("Cache-Control", "private, max-age=86400")
                .body(resource);
    }

    // ─── References ─────────────────────────────────────────────────────────

    @GetMapping("/types")
    @Operation(summary = "Liste des types de documents disponibles")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<List<Map<String, String>>> getDocumentTypes() {
        List<Map<String, String>> types = Arrays.stream(DocumentType.values())
                .map(t -> Map.of("value", t.name(), "label", t.getLabel()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(types);
    }

    @GetMapping("/tag-categories")
    @Operation(summary = "Liste des categories de tags")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<List<Map<String, String>>> getTagCategories() {
        List<Map<String, String>> categories = Arrays.stream(TagCategory.values())
                .map(c -> Map.of("value", c.name(), "label", c.name()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(categories);
    }

    // ─── Conformite NF ────────────────────────────────────────────────────

    @GetMapping("/generations/{id}/verify")
    @Operation(summary = "Verifier l'integrite d'un document (hash SHA-256)")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> verifyDocumentIntegrity(@PathVariable Long id) {
        Map<String, Object> result = complianceService.verifyDocumentIntegrity(id);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/templates/{id}/compliance-check")
    @Operation(summary = "Verifier la conformite NF d'un template")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ComplianceReportDto> checkTemplateCompliance(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String checkedBy = jwt != null ? jwt.getClaimAsString("email") : "system";
        ComplianceReportDto report = complianceService.checkTemplateCompliance(id, checkedBy);
        return ResponseEntity.ok(report);
    }

    @GetMapping("/compliance/stats")
    @Operation(summary = "Statistiques globales de conformite NF")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ComplianceStatsDto> getComplianceStats() {
        return ResponseEntity.ok(complianceService.getComplianceStats());
    }

    @GetMapping("/generations/by-number/{legalNumber}")
    @Operation(summary = "Rechercher un document par numero legal")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<DocumentGenerationDto> getGenerationByLegalNumber(@PathVariable String legalNumber) {
        DocumentGeneration generation = generatorService.getGenerationByLegalNumber(legalNumber);
        return ResponseEntity.ok(DocumentGenerationDto.fromEntity(generation));
    }

    @PostMapping("/generations/{id}/correct")
    @Operation(summary = "Creer un document correctif (avoir)")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<DocumentGenerationDto> createCorrectiveDocument(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody GenerateDocumentRequest request
    ) {
        DocumentGenerationDto result = generatorService.generateDocument(request, jwt);
        complianceService.markAsCorrection(result.id(), id);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    // ─── Exception handlers ─────────────────────────────────────────────────

    @ExceptionHandler(DocumentValidationException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(DocumentValidationException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(DocumentNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(DocumentNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(DocumentComplianceException.class)
    public ResponseEntity<Map<String, Object>> handleCompliance(DocumentComplianceException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(DocumentGenerationException.class)
    public ResponseEntity<Map<String, Object>> handleGeneration(DocumentGenerationException e) {
        log.error("Document generation error: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur lors de la generation du document"));
    }

    @ExceptionHandler(DocumentStorageException.class)
    public ResponseEntity<Map<String, Object>> handleStorage(DocumentStorageException e) {
        log.error("Document storage error: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur de stockage du document"));
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, Object>> handleForbidden(SecurityException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception e) {
        log.error("Erreur sur le module documents: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "Erreur interne"));
    }

    private Pageable safePageable(int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        return PageRequest.of(safePage, safeSize);
    }
}
