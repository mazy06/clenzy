package com.clenzy.controller;

import com.clenzy.model.KbDocument;
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
    private final com.clenzy.service.agent.kb.KbSearchService kbSearchService;
    private final com.clenzy.service.agent.kb.KbRetrievalEvalService kbRetrievalEvalService;
    private final com.clenzy.scheduler.KbIndexTuningScheduler kbIndexTuningScheduler;
    private final TenantContext tenantContext;

    public KbAdminController(IngestionService ingestionService,
                              com.clenzy.service.agent.kb.KbSearchService kbSearchService,
                              com.clenzy.service.agent.kb.KbRetrievalEvalService kbRetrievalEvalService,
                              com.clenzy.scheduler.KbIndexTuningScheduler kbIndexTuningScheduler,
                              TenantContext tenantContext) {
        this.ingestionService = ingestionService;
        this.kbSearchService = kbSearchService;
        this.kbRetrievalEvalService = kbRetrievalEvalService;
        this.kbIndexTuningScheduler = kbIndexTuningScheduler;
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
        List<KbDocument> docs = ingestionService.listVisibleDocuments(orgId);
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

    /**
     * KPI plateforme de la knowledge base : volumes (documents, chunks, orphelins)
     * + sante de l'index vectoriel ivfflat (lists actuel vs optimal). C'est le
     * signal pour activer l'auto-tune ({@code clenzy.assistant.kb.auto-tune-enabled})
     * quand la base grossit. Reserve au staff plateforme : l'index est global.
     */
    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<Map<String, Object>> stats() {
        IngestionService.KbStats kb = ingestionService.stats();
        var index = kbIndexTuningScheduler.inspect();

        Map<String, Object> documents = new LinkedHashMap<>();
        documents.put("total", kb.totalDocuments());
        documents.put("global", kb.globalDocuments());
        documents.put("org", kb.totalDocuments() - kb.globalDocuments());

        Map<String, Object> chunks = new LinkedHashMap<>();
        chunks.put("total", kb.totalChunks());
        chunks.put("indexed", kb.totalChunks() - kb.orphanChunks());
        chunks.put("orphans", kb.orphanChunks());

        Map<String, Object> indexHealth = new LinkedHashMap<>();
        indexHealth.put("status", index.status().name());
        indexHealth.put("currentLists", index.currentLists());
        indexHealth.put("optimalLists", index.optimalLists());
        indexHealth.put("autoTuneEnabled", kbIndexTuningScheduler.isAutoApplyEnabled());
        indexHealth.put("retuneRecommended",
                index.status() == com.clenzy.scheduler.KbIndexTuningScheduler.TuningOutcome.Status.RECOMMENDATION);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("documents", documents);
        response.put("chunks", chunks);
        response.put("index", indexHealth);
        return ResponseEntity.ok(response);
    }

    /**
     * Lance l'evaluation du retrieval sur le golden set embarque (~40 questions,
     * ~30s, quelques centimes d'API embeddings/rerank). POST : ce n'est pas une
     * lecture — chaque run consomme des appels provider. Reserve au staff
     * plateforme. Retourne recall@4, MRR et le detail des questions ratees.
     */
    @PostMapping("/eval")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ResponseEntity<Map<String, Object>> runRetrievalEval() {
        var report = kbRetrievalEvalService.evaluate();

        List<Map<String, Object>> misses = report.entries().stream()
                .filter(e -> e.rank() < 0)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("question", e.question());
                    m.put("expected", e.expected());
                    m.put("retrieved", e.retrieved());
                    return m;
                }).toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("topK", com.clenzy.service.agent.kb.KbRetrievalEvalService.TOP_K);
        response.put("recallAtK", report.recallAtK());
        response.put("mrr", report.mrr());
        response.put("total", report.total());
        response.put("hits", report.hits());
        response.put("misses", misses);
        return ResponseEntity.ok(response);
    }

    /**
     * Playground de recherche : execute la MEME recherche hybride que l'assistant
     * (embeddings + full-text + fusion RRF + rerank) et retourne les chunks avec
     * leurs scores. Permet aux admins de verifier ce que l'assistant « voit » pour
     * une question donnee, et de diagnostiquer les seuils. Read-only, scope = org
     * du caller (docs globaux dans la langue demandee + docs de l'org).
     */
    @GetMapping("/search-test")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','HOST','SUPER_MANAGER')")
    public ResponseEntity<Map<String, Object>> searchTest(
            @RequestParam("query") String query,
            @RequestParam(value = "topK", defaultValue = "5") int topK,
            @RequestParam(value = "lang", defaultValue = "fr") String lang) {
        if (query == null || query.isBlank()) {
            throw new IllegalArgumentException("query est requis");
        }
        Long orgId = tenantContext.getRequiredOrganizationId();
        int safeTopK = Math.max(1, Math.min(10, topK));

        List<com.clenzy.service.agent.kb.KbSearchService.KbSearchHit> hits =
                kbSearchService.search(query, orgId, safeTopK, lang);

        List<Map<String, Object>> items = hits.stream().map(h -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("documentId", h.documentId());
            m.put("title", h.title());
            m.put("sourcePath", h.sourcePath());
            m.put("snippet", h.snippet());
            m.put("relevance", h.relevance());
            return m;
        }).toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("query", query);
        response.put("lang", lang);
        response.put("relevanceThreshold", kbSearchService.getRelevanceThreshold());
        response.put("items", items);
        response.put("count", items.size());
        return ResponseEntity.ok(response);
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
