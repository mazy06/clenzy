package com.clenzy.service;

import com.clenzy.dto.UpsellTypeDto;
import com.clenzy.model.UpsellTypeDef;
import com.clenzy.repository.UpsellTypeDefRepository;
import com.clenzy.tenant.TenantContext;
import jakarta.persistence.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

/**
 * Referentiel des types de vente additionnelle.
 *
 * <p>Une organisation voit les types de PLATEFORME et les siens, et ne peut
 * modifier que les siens. Toucher un type de plateforme depuis un compte client
 * aurait change ce que voient toutes les autres organisations.</p>
 */
@Service
public class UpsellTypeService {

    private static final Logger log = LoggerFactory.getLogger(UpsellTypeService.class);

    /** Les types propres a une organisation se rangent apres le catalogue de plateforme. */
    private static final int ORG_TYPE_SORT_BASE = 2000;

    private final UpsellTypeDefRepository repository;
    private final TenantContext tenantContext;

    public UpsellTypeService(UpsellTypeDefRepository repository, TenantContext tenantContext) {
        this.repository = repository;
        this.tenantContext = tenantContext;
    }

    @Transactional(readOnly = true)
    public List<UpsellTypeDto> list() {
        return repository.findVisibleFor(tenantContext.getOrganizationId()).stream()
            .map(UpsellTypeDto::from)
            .toList();
    }

    /**
     * Cree un type propre a l'organisation.
     *
     * @param code  identifiant stable, normalise en minuscules a tirets ; c'est
     *              lui que porteront les offres, et il ne changera plus
     * @param label libelle affiche
     */
    @Transactional
    public UpsellTypeDto create(String code, String label, String description, String iconKey) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        String normalized = normalizeCode(code, label);

        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Le code du type est obligatoire.");
        }
        if (repository.existsByCodeAndOrganizationId(normalized, orgId)) {
            throw new IllegalArgumentException("Ce type existe deja : " + normalized);
        }
        // Un code qui existe deja en plateforme est refuse : l'organisation
        // croirait creer un type a elle et masquerait celui de tout le monde.
        if (repository.findByCodeInScope(normalized, orgId).stream()
                .anyMatch(t -> t.getOrganizationId() == null)) {
            throw new IllegalArgumentException(
                "Ce code est deja celui d'un type propose a toutes les organisations : " + normalized);
        }

        var type = new UpsellTypeDef();
        type.setOrganizationId(orgId);
        type.setCode(normalized);
        type.setLabelFr(label.trim());
        // Pas de traduction inventee : le libelle francais sert aux deux tant que
        // personne n'en a fourni un autre.
        type.setLabelEn(label.trim());
        type.setDescription(description == null || description.isBlank() ? null : description.trim());
        type.setIconKey(iconKey == null || iconKey.isBlank() ? "more" : iconKey.trim());
        type.setSortOrder(ORG_TYPE_SORT_BASE);
        type.setSystem(false);

        var saved = repository.save(type);
        log.info("Type de vente additionnelle cree : {} (organisation {})", normalized, orgId);
        return UpsellTypeDto.from(saved);
    }

    /**
     * Retire un type du choix, sans le supprimer.
     *
     * <p>Desactivation et non suppression : les offres deja creees portent ce
     * code, et un livret diffuse continuerait de le servir. Le supprimer aurait
     * laisse ces offres sans libelle.</p>
     */
    @Transactional
    public void deactivate(Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        var type = repository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new EntityNotFoundException(
                "Type introuvable, ou appartenant a la plateforme : " + id));
        type.setActive(false);
        repository.save(type);
        log.info("Type de vente additionnelle desactive : {} (organisation {})", type.getCode(), orgId);
    }

    /**
     * Normalise un code : minuscules, tirets, sans accent.
     *
     * <p>A defaut de code fourni, il derive du libelle — un hote saisit « Cours
     * de surf », pas un identifiant.</p>
     */
    static String normalizeCode(String code, String label) {
        String source = (code == null || code.isBlank()) ? label : code;
        if (source == null) return "";
        String ascii = java.text.Normalizer.normalize(source, java.text.Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        return ascii.trim().toLowerCase(Locale.ROOT)
            .replaceAll("[^a-z0-9]+", "-")
            .replaceAll("^-+|-+$", "");
    }
}
