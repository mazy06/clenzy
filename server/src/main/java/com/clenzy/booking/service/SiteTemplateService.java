package com.clenzy.booking.service;

import com.clenzy.booking.dto.SiteTemplateCreateRequest;
import com.clenzy.booking.dto.SiteTemplateDto;
import com.clenzy.booking.model.SiteTemplate;
import com.clenzy.booking.repository.SiteTemplateRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.EmailHtmlSanitizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Catalogue de templates de site (galerie « Choisir un design »).
 * <ul>
 *   <li>Liste = catalogue GLOBAL Clenzy (org NULL) + templates privés de l'org courante.</li>
 *   <li>Création GLOBAL réservée au staff plateforme ({@link TenantContext#isSuperAdmin()} =
 *       {@code role.isPlatformStaff()}, donc SUPER_ADMIN ou SUPER_MANAGER) ; ORG = org courante.</li>
 *   <li>Suppression : staff plateforme pour un template global, org propriétaire (ou staff) pour un
 *       template privé.</li>
 * </ul>
 */
@Service
public class SiteTemplateService {

    private static final int MAX_CONTENT_BYTES = 512 * 1024; // garde-fou : template.json raisonnable
    private static final String GRAPES_FORMAT = "grapesjs";

    private final SiteTemplateRepository repository;
    private final TenantContext tenantContext;
    private final SiteTemplateContractValidator contractValidator;
    private final ObjectMapper objectMapper;

    public SiteTemplateService(SiteTemplateRepository repository, TenantContext tenantContext,
                               SiteTemplateContractValidator contractValidator, ObjectMapper objectMapper) {
        this.repository = repository;
        this.tenantContext = tenantContext;
        this.contractValidator = contractValidator;
        this.objectMapper = objectMapper;
    }

    /**
     * Templates visibles. Le staff plateforme voit tout (brouillons compris) ; un user org ne voit que les
     * templates PUBLISHED du catalogue global + ses propres templates privés publiés.
     */
    @Transactional(readOnly = true)
    public List<SiteTemplateDto> list() {
        Long orgId = tenantContext.getOrganizationId();
        List<SiteTemplate> templates = tenantContext.isSuperAdmin()
            ? repository.findVisibleTo(orgId)
            : repository.findVisiblePublishedTo(orgId);
        return templates.stream().map(SiteTemplateDto::from).toList();
    }

    /**
     * Ingère un template d'authoring (produit au CLI, cf. {@code DESIGN-BAITLY.md}) au catalogue GLOBAL.
     * Réservé au staff plateforme. Pipeline : validation du contrat ({@link SiteTemplateContractValidator})
     * → assainissement HTML de chaque page ({@link EmailHtmlSanitizer}) → conversion en enveloppes GrapesJS
     * directement instanciables → persistance ({@code status=PUBLISHED}).
     *
     * @param authoring payload d'authoring {@code {meta, designVars, css, pages:[{path,type,title,html,seo…}]}}.
     * @param createdBy keycloakId du curateur (audit).
     */
    @Transactional
    public SiteTemplateDto ingest(JsonNode authoring, String createdBy) {
        if (!tenantContext.isSuperAdmin()) {
            throw new AccessDeniedException("L'ingestion au catalogue global est réservée au staff plateforme.");
        }
        List<String> errors = contractValidator.validate(authoring);
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException("Template non conforme : " + String.join(" ; ", errors));
        }
        JsonNode meta = authoring.path("meta");
        JsonNode designVars = authoring.path("designVars");
        // CSS commun préfixé du bloc :root{--bt-*} → les widgets (light DOM sous .site-root) héritent du
        // même design par cascade (cohérence pages ↔ widgets), comme SiteGenerationService.
        final String pageCss = buildRootVarsBlock(designVars) + authoring.path("css").asText("");

        ArrayNode storedPages = objectMapper.createArrayNode();
        for (JsonNode p : authoring.path("pages")) {
            String html = EmailHtmlSanitizer.sanitize(p.path("html").asText(""));
            ObjectNode sp = objectMapper.createObjectNode();
            sp.put("path", p.path("path").asText());
            sp.put("type", p.path("type").asText());
            sp.put("title", p.path("title").asText(p.path("path").asText()));
            sp.put("seoTitle", p.path("seoTitle").asText(null));
            sp.put("seoDescription", p.path("seoDescription").asText(null));
            sp.put("blocks", wrapGrapesEnvelope(html, pageCss)); // enveloppe = SitePage.blocks à l'instanciation
            storedPages.add(sp);
        }
        ObjectNode content = objectMapper.createObjectNode();
        content.set("meta", meta);
        content.set("designVars", designVars);
        content.set("pages", storedPages);
        final String contentJson;
        try {
            contentJson = objectMapper.writeValueAsString(content);
        } catch (Exception e) {
            throw new IllegalArgumentException("Sérialisation du template impossible", e);
        }
        if (contentJson.length() > MAX_CONTENT_BYTES) {
            throw new IllegalArgumentException("Template trop volumineux.");
        }

        SiteTemplate t = new SiteTemplate();
        t.setOrganizationId(null); // catalogue GLOBAL Baitly
        t.setName(meta.path("name").asText());
        t.setDescription(meta.path("description").asText(null));
        t.setRegister("product");
        t.setPreviewUrl(meta.path("thumbnailUrl").asText(null));
        t.setCategory(meta.path("category").asText(null));
        t.setArchetype(meta.path("archetype").asText(null));
        t.setStatus("PUBLISHED");
        t.setContentJson(contentJson);
        t.setCreatedBy(createdBy);
        return SiteTemplateDto.from(repository.save(t));
    }

    /** Bloc {@code :root{--bt-*:…}} déterministe (préfixé au CSS de chaque page), miroir de SiteGenerationService. */
    private String buildRootVarsBlock(JsonNode designVars) {
        if (designVars == null || !designVars.isObject() || designVars.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder(":root{");
        designVars.fields().forEachRemaining(e -> {
            if (e.getValue() != null && e.getValue().isValueNode()) {
                sb.append(e.getKey()).append(':').append(e.getValue().asText()).append(';');
            }
        });
        return sb.append("}\n").toString();
    }

    /** Emballe html+css dans l'enveloppe GrapesJS attendue par {@code SitePage.blocks} ({@code projectData:null}). */
    private String wrapGrapesEnvelope(String html, String css) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("format", GRAPES_FORMAT);
        node.put("html", html != null ? html : "");
        node.put("css", css != null ? css : "");
        node.putNull("projectData");
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            throw new IllegalArgumentException("Sérialisation de l'enveloppe GrapesJS impossible", e);
        }
    }

    @Transactional
    public SiteTemplateDto create(SiteTemplateCreateRequest req, String createdBy) {
        if (req == null || req.name() == null || req.name().isBlank()) {
            throw new IllegalArgumentException("Le nom du template est requis.");
        }
        if (req.contentJson() == null || req.contentJson().isBlank()) {
            throw new IllegalArgumentException("Le contenu du template est requis.");
        }
        if (req.contentJson().length() > MAX_CONTENT_BYTES) {
            throw new IllegalArgumentException("Template trop volumineux.");
        }
        final boolean global = "GLOBAL".equalsIgnoreCase(req.scope());

        SiteTemplate t = new SiteTemplate();
        if (global) {
            if (!tenantContext.isSuperAdmin()) {
                throw new AccessDeniedException("Le catalogue global est réservé au staff plateforme.");
            }
            t.setOrganizationId(null);
        } else {
            t.setOrganizationId(tenantContext.getRequiredOrganizationId());
        }
        t.setName(req.name().trim());
        t.setDescription(req.description());
        t.setRegister(req.register() == null || req.register().isBlank() ? "product" : req.register());
        t.setPreviewUrl(req.previewUrl());
        t.setContentJson(req.contentJson());
        t.setDesignSystemId(req.designSystemId());
        t.setCreatedBy(createdBy);
        return SiteTemplateDto.from(repository.save(t));
    }

    @Transactional
    public SiteTemplateDto update(Long id, SiteTemplateCreateRequest req) {
        SiteTemplate t = repository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Template introuvable."));
        // Ownership : mêmes règles que la suppression.
        if (t.getOrganizationId() == null) {
            if (!tenantContext.isSuperAdmin()) {
                throw new AccessDeniedException("Modification d'un template global réservée au staff plateforme.");
            }
        } else {
            Long orgId = tenantContext.getOrganizationId();
            boolean owner = orgId != null && orgId.equals(t.getOrganizationId());
            if (!owner && !tenantContext.isSuperAdmin()) {
                throw new AccessDeniedException("Vous ne pouvez modifier que les templates de votre organisation.");
            }
        }
        if (req == null) throw new IllegalArgumentException("Requête vide.");
        if (req.name() != null && !req.name().isBlank()) t.setName(req.name().trim());
        if (req.description() != null) t.setDescription(req.description());
        if (req.register() != null && !req.register().isBlank()) t.setRegister(req.register());
        if (req.previewUrl() != null) t.setPreviewUrl(req.previewUrl());
        if (req.designSystemId() != null) t.setDesignSystemId(req.designSystemId());
        // Contenu : remplacé uniquement si fourni (édition de métadonnées seule = on garde le design).
        if (req.contentJson() != null && !req.contentJson().isBlank()) {
            if (req.contentJson().length() > MAX_CONTENT_BYTES) {
                throw new IllegalArgumentException("Template trop volumineux.");
            }
            t.setContentJson(req.contentJson());
        }
        // Changement de portée (mêmes garde-fous que la création).
        if (req.scope() != null) {
            if ("GLOBAL".equalsIgnoreCase(req.scope())) {
                if (!tenantContext.isSuperAdmin()) {
                    throw new AccessDeniedException("Le catalogue global est réservé au staff plateforme.");
                }
                t.setOrganizationId(null);
            } else {
                Long orgId = tenantContext.getOrganizationId();
                if (orgId != null) {
                    t.setOrganizationId(orgId);
                } else if (t.getOrganizationId() == null) {
                    throw new IllegalArgumentException("Organisation requise pour un template privé.");
                }
                // sinon : staff plateforme éditant un template d'org → on conserve son org.
            }
        }
        return SiteTemplateDto.from(t); // entité gérée : flush au commit
    }

    @Transactional
    public void delete(Long id) {
        SiteTemplate t = repository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Template introuvable."));
        if (t.getOrganizationId() == null) {
            if (!tenantContext.isSuperAdmin()) {
                throw new AccessDeniedException("Suppression d'un template global réservée au staff plateforme.");
            }
        } else {
            Long orgId = tenantContext.getOrganizationId();
            boolean owner = orgId != null && orgId.equals(t.getOrganizationId());
            if (!owner && !tenantContext.isSuperAdmin()) {
                throw new AccessDeniedException("Vous ne pouvez supprimer que les templates de votre organisation.");
            }
        }
        repository.delete(t);
    }
}
