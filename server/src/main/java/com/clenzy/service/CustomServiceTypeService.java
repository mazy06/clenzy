package com.clenzy.service;

import com.clenzy.model.CustomServiceType;
import com.clenzy.repository.CustomServiceTypeRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/**
 * Gère les types de service personnalisés (« Autre ») réutilisables, org-scopés.
 * L'organisation vient TOUJOURS du {@code TenantContext} (jamais du client) : les
 * méthodes reçoivent l'orgId résolu par le controller.
 */
@Service
public class CustomServiceTypeService {

    private static final Set<String> CATEGORIES = Set.of("cleaning", "maintenance", "other");
    private static final int MAX_LABEL = 100;

    private final CustomServiceTypeRepository repository;

    public CustomServiceTypeService(CustomServiceTypeRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<CustomServiceType> list(Long organizationId, String category) {
        return repository.findByOrganizationIdAndCategoryOrderByLabelAsc(organizationId, normalizeCategory(category));
    }

    /**
     * Crée le type s'il n'existe pas (idempotent, insensible à la casse). Le total
     * est renvoyé même en cas de course : contrainte unique DB + repli sur la ligne
     * existante (pas de check-then-act naïf).
     */
    @Transactional
    public CustomServiceType create(Long organizationId, String category, String label) {
        String cat = normalizeCategory(category);
        String trimmed = label == null ? "" : label.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Le libellé du type de service est requis");
        }
        if (trimmed.length() > MAX_LABEL) {
            trimmed = trimmed.substring(0, MAX_LABEL);
        }
        final String finalLabel = trimmed;

        return repository.findByOrganizationIdAndCategoryAndLabelIgnoreCase(organizationId, cat, finalLabel)
                .orElseGet(() -> {
                    CustomServiceType e = new CustomServiceType();
                    e.setOrganizationId(organizationId);
                    e.setCategory(cat);
                    e.setLabel(finalLabel);
                    try {
                        return repository.save(e);
                    } catch (DataIntegrityViolationException ex) {
                        // Course : une autre transaction a inséré le même libellé.
                        return repository
                                .findByOrganizationIdAndCategoryAndLabelIgnoreCase(organizationId, cat, finalLabel)
                                .orElseThrow(() -> ex);
                    }
                });
    }

    private String normalizeCategory(String category) {
        if (category == null) {
            return "other";
        }
        String lc = category.toLowerCase();
        return CATEGORIES.contains(lc) ? lc : "other";
    }
}
