package com.clenzy.booking.service;

import com.clenzy.booking.dto.SiteDto;
import com.clenzy.booking.dto.SitePageDto;
import com.clenzy.booking.dto.SiteUpsertRequest;
import com.clenzy.booking.model.SiteTemplate;
import com.clenzy.booking.repository.SiteRepository;
import com.clenzy.booking.repository.SiteTemplateRepository;
import com.clenzy.exception.NotFoundException;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/**
 * Instancie un template du catalogue ({@link SiteTemplate}) en un {@link com.clenzy.booking.model.Site}
 * concret pour l'organisation courante (galerie Baitly, phase P3). Le user choisit un template BRUT : on
 * crée le site + ses pages en {@code DRAFT} à partir du {@code contentJson} stocké (pages déjà en enveloppes
 * GrapesJS). Les widgets tirant les vraies données du logement, le site est fonctionnel dès l'instanciation.
 *
 * <p>Ownership : le template doit être visible de l'org (catalogue global {@code org NULL} ou template privé
 * de l'org). Composition sur {@link SiteAdminService} (création site + pages) — pas de duplication de la
 * logique de persistance.</p>
 */
@Service
public class SiteTemplateInstantiationService {

    private final SiteTemplateRepository templateRepository;
    private final SiteRepository siteRepository;
    private final SiteAdminService siteAdminService;
    private final TenantContext tenantContext;
    private final ObjectMapper objectMapper;

    public SiteTemplateInstantiationService(SiteTemplateRepository templateRepository,
                                            SiteRepository siteRepository,
                                            SiteAdminService siteAdminService,
                                            TenantContext tenantContext,
                                            ObjectMapper objectMapper) {
        this.templateRepository = templateRepository;
        this.siteRepository = siteRepository;
        this.siteAdminService = siteAdminService;
        this.tenantContext = tenantContext;
        this.objectMapper = objectMapper;
    }

    /**
     * Crée un site (DRAFT) à partir d'un template du catalogue.
     *
     * @param orgId      organisation cible (ownership).
     * @param templateId template à instancier (doit être visible de l'org).
     * @param name       nom souhaité pour le site (repli sur le nom du template).
     * @return le site créé.
     */
    @Transactional
    public SiteDto instantiate(Long orgId, Long templateId, String name) {
        SiteTemplate template = templateRepository.findById(templateId)
            .orElseThrow(() -> new NotFoundException("Template introuvable: " + templateId));
        // Visibilité : catalogue global (org NULL) OU template privé de l'org courante.
        if (template.getOrganizationId() != null && !template.getOrganizationId().equals(orgId)) {
            throw new AccessDeniedException("Template non accessible à votre organisation.");
        }

        final JsonNode content;
        try {
            content = objectMapper.readTree(template.getContentJson());
        } catch (Exception e) {
            throw new IllegalArgumentException("Contenu de template illisible (JSON attendu).", e);
        }
        JsonNode meta = content.path("meta");
        final String siteName = (name != null && !name.isBlank())
            ? name.trim()
            : orDefault(template.getName(), "Mon site");
        final String defaultLocale = meta.path("defaultLocale").asText("fr");

        // Site en DRAFT (slug unique dérivé du nom). designVars est à la RACINE du contentJson (pas sous meta).
        final String primaryColor = content.path("designVars").path("--bt-color-primary").asText(null);
        SiteUpsertRequest siteReq = new SiteUpsertRequest(
            uniqueSlug(siteName), siteName, "DRAFT", defaultLocale, defaultLocale,
            null, primaryColor,
            null, null, null, null, null, null);
        SiteDto site = siteAdminService.createSite(orgId, siteReq);

        // Héritage de la direction : le site reprend le système de design du template (DS-3) → la retouche
        // IA du site restera on-brand. Chargé dans la même transaction (flush au commit).
        if (template.getDesignSystemId() != null) {
            siteRepository.findByIdAndOrganizationId(site.id(), orgId)
                .ifPresent(s -> s.setDesignSystemId(template.getDesignSystemId()));
        }

        // Pages : copiées telles quelles (enveloppes GrapesJS stockées), en DRAFT.
        int sortOrder = 0;
        for (JsonNode p : content.path("pages")) {
            // Défense en profondeur : une page sans chemin valide est ignorée (le contrat le garantit à
            // l'ingestion, mais on ne crée jamais une SitePage à chemin vide même si le stock est corrompu).
            String pagePath = p.path("path").asText("");
            if (pagePath.isBlank() || !pagePath.startsWith("/")) {
                continue;
            }
            SitePageDto pageReq = new SitePageDto(
                null, site.id(), pagePath, p.path("type").asText("CUSTOM"),
                p.path("title").asText(pagePath), p.path("blocks").asText(""),
                null, "DRAFT", sortOrder++,
                p.path("seoTitle").asText(null), p.path("seoDescription").asText(null), null,
                null, false, false, null, null);
            siteAdminService.createPage(orgId, site.id(), pageReq);
        }
        return site;
    }

    /** Slug kebab-case unique (<=63) dérivé du nom ; suffixe numérique en cas de collision. */
    private String uniqueSlug(String name) {
        String base = name.toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("(^-+|-+$)", "");
        if (base.isBlank()) {
            base = "site";
        }
        if (base.length() > 55) {
            base = base.substring(0, 55).replaceAll("-+$", "");
        }
        String candidate = base;
        int n = 2;
        while (siteRepository.existsBySlug(candidate)) {
            candidate = base + "-" + n++;
        }
        return candidate;
    }

    private static String orDefault(String v, String def) {
        return (v != null && !v.isBlank()) ? v : def;
    }
}
