package com.clenzy.booking.service;

import com.clenzy.booking.dto.SiteTemplateCreateRequest;
import com.clenzy.booking.dto.SiteTemplateDto;
import com.clenzy.booking.model.SiteTemplate;
import com.clenzy.booking.repository.SiteTemplateRepository;
import com.clenzy.tenant.TenantContext;
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

    private final SiteTemplateRepository repository;
    private final TenantContext tenantContext;

    public SiteTemplateService(SiteTemplateRepository repository, TenantContext tenantContext) {
        this.repository = repository;
        this.tenantContext = tenantContext;
    }

    @Transactional(readOnly = true)
    public List<SiteTemplateDto> list() {
        return repository.findVisibleTo(tenantContext.getOrganizationId())
            .stream().map(SiteTemplateDto::from).toList();
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
