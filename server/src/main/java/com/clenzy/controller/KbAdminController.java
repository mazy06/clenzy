package com.clenzy.controller;

import com.clenzy.model.KbDocument;
import com.clenzy.repository.KbDocumentRepository;
import com.clenzy.service.agent.kb.IngestionService;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Endpoints administration de la knowledge base (RAG).
 *
 * <p>Securite :
 * <ul>
 *   <li>Classe : {@code isAuthenticated()} (toute personne loggee de l'org peut
 *       lister les docs visibles).</li>
 *   <li>Upload + delete : {@code hasAnyRole('SUPER_ADMIN','HOST','SUPER_MANAGER')}.</li>
 *   <li>L'ingestion d'un doc en scope organization_id != caller's org est interdite
 *       (le service IngestionService verifie l'ownership en amont).</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/admin/kb")
@PreAuthorize("isAuthenticated()")
public class KbAdminController {

    private static final Logger log = LoggerFactory.getLogger(KbAdminController.class);
    private static final long MAX_UPLOAD_BYTES = 2L * 1024 * 1024; // 2 MB par fichier markdown

    private final IngestionService ingestionService;
    private final KbDocumentRepository documentRepository;
    private final TenantContext tenantContext;

    public KbAdminController(IngestionService ingestionService,
                              KbDocumentRepository documentRepository,
                              TenantContext tenantContext) {
        this.ingestionService = ingestionService;
        this.documentRepository = documentRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Upload d'un .md a indexer. Le scope (global vs org) est decide par
     * {@code scope=global|org} (defaut org). Seuls les admins plateforme peuvent
     * uploader en scope global.
     */
    @PostMapping(value = "/ingest", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','HOST','SUPER_MANAGER')")
    public ResponseEntity<Map<String, Object>> ingest(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "scope", defaultValue = "org") String scope,
            @AuthenticationPrincipal Jwt jwt) {

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("file est requis");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new IllegalArgumentException(
                    "Fichier trop volumineux (max " + (MAX_UPLOAD_BYTES / 1024) + " KB)");
        }
        String contentType = file.getContentType();
        boolean acceptable = contentType == null
                || contentType.startsWith("text/")
                || contentType.equals("application/octet-stream");
        if (!acceptable) {
            throw new IllegalArgumentException("Type de fichier non supporte : " + contentType);
        }

        // Resolution du scope
        Long orgId;
        if ("global".equalsIgnoreCase(scope)) {
            if (!hasRole(jwt, "SUPER_ADMIN") && !hasRole(jwt, "SUPER_MANAGER")) {
                throw new SecurityException(
                        "Upload en scope global reserve aux admins plateforme");
            }
            orgId = null;
        } else {
            orgId = tenantContext.getRequiredOrganizationId();
        }

        String content;
        try {
            content = new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalArgumentException("Lecture du fichier impossible");
        }

        String sourcePath = file.getOriginalFilename() != null
                ? file.getOriginalFilename()
                : ("upload-" + System.currentTimeMillis() + ".md");

        KbDocument doc = ingestionService.ingestMarkdown(sourcePath, content, orgId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", doc.getId());
        response.put("sourcePath", doc.getSourcePath());
        response.put("title", doc.getTitle());
        response.put("scope", orgId == null ? "global" : "org");
        response.put("size", content.length());
        log.info("KB upload : doc {} '{}' scope={} by user {}",
                doc.getId(), doc.getSourcePath(),
                orgId == null ? "global" : "org-" + orgId, jwt.getSubject());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /** Liste les docs visibles par l'org courante (globaux + propres). */
    @GetMapping("/documents")
    public ResponseEntity<List<Map<String, Object>>> listDocuments() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        List<KbDocument> docs = documentRepository.findVisibleByOrg(orgId);
        List<Map<String, Object>> dto = docs.stream().map(d -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", d.getId());
            m.put("sourcePath", d.getSourcePath());
            m.put("title", d.getTitle());
            m.put("scope", d.getOrganizationId() == null ? "global" : "org");
            m.put("lang", d.getLang());
            m.put("createdAt", d.getCreatedAt());
            m.put("updatedAt", d.getUpdatedAt());
            return m;
        }).toList();
        return ResponseEntity.ok(dto);
    }

    /** Supprime un document. Ownership validee dans {@link IngestionService}. */
    @DeleteMapping("/documents/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','HOST','SUPER_MANAGER')")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        boolean isPlatformAdmin = hasRole(jwt, "SUPER_ADMIN") || hasRole(jwt, "SUPER_MANAGER");
        ingestionService.deleteDocument(id, orgId, isPlatformAdmin);
        return ResponseEntity.noContent().build();
    }

    private static boolean hasRole(Jwt jwt, String role) {
        try {
            Object roles = jwt.getClaim("realm_access");
            if (roles instanceof Map) {
                Object list = ((Map<?, ?>) roles).get("roles");
                if (list instanceof List<?> l) {
                    return l.contains(role);
                }
            }
        } catch (Exception ignored) {}
        return false;
    }
}
