package com.clenzy.service;

import com.clenzy.dto.AmenityIconOverrideDto;
import com.clenzy.model.OrganizationAmenityIconOverride;
import com.clenzy.repository.OrganizationAmenityIconOverrideRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Service de gestion des overrides d'icones de commodites par organisation.
 *
 * <p>Backend de l'API REST exposee par {@code AmenityIconOverrideController}
 * + utilise pour le sync frontend (le hook {@code useAmenityIconOverrides}
 * peut basculer du localStorage a cette API).</p>
 *
 * <p><b>Validation</b> : on accepte {@code amenityCode} en SCREAMING_SNAKE_CASE
 * (built-ins ou custom) et {@code iconName} en PascalCase (composants lucide).
 * La whitelist precise n'est pas verifiee cote backend — le frontend resout
 * via ICON_REGISTRY avec fallback {@code Sparkles} en cas d'inconnu. Cela
 * autorise une evolution du catalogue frontend sans deploiement backend.</p>
 */
@Service
public class AmenityIconOverrideService {

    private static final Logger log = LoggerFactory.getLogger(AmenityIconOverrideService.class);

    // Validation legere : on accepte du PascalCase, des suffixes numerique
    // (Tv2, Building2, Flower2) et l'underscore (rare mais possible).
    private static final Pattern ICON_NAME_PATTERN = Pattern.compile("^[A-Z][A-Za-z0-9_]{0,79}$");
    private static final Pattern AMENITY_CODE_PATTERN = Pattern.compile("^[A-Z][A-Z0-9_]{0,79}$");

    private final OrganizationAmenityIconOverrideRepository repository;

    public AmenityIconOverrideService(OrganizationAmenityIconOverrideRepository repository) {
        this.repository = repository;
    }

    /**
     * Liste tous les overrides d'icone pour une organisation. Resultat
     * potentiellement vide (lookup d'un org "vierge" qui n'a personnalise
     * aucune icone).
     */
    @Transactional(readOnly = true)
    public List<AmenityIconOverrideDto> listForOrganization(Long organizationId) {
        return repository.findByOrganizationId(organizationId).stream()
                .map(o -> new AmenityIconOverrideDto(o.getAmenityCode(), o.getIconName()))
                .toList();
    }

    /**
     * Cree ou met a jour l'override pour ({@code organizationId}, {@code amenityCode}).
     * Idempotent : 2 appels avec les memes valeurs = aucune insertion supplementaire.
     */
    @Transactional
    public AmenityIconOverrideDto upsert(Long organizationId, String amenityCode, String iconName) {
        validateAmenityCode(amenityCode);
        validateIconName(iconName);

        OrganizationAmenityIconOverride entity = repository
                .findByOrganizationIdAndAmenityCode(organizationId, amenityCode)
                .orElseGet(() -> {
                    OrganizationAmenityIconOverride fresh = new OrganizationAmenityIconOverride();
                    fresh.setOrganizationId(organizationId);
                    fresh.setAmenityCode(amenityCode);
                    return fresh;
                });
        entity.setIconName(iconName);
        OrganizationAmenityIconOverride saved = repository.save(entity);
        log.debug("Amenity icon override upserted: org={} code={} icon={}",
                organizationId, amenityCode, iconName);
        return new AmenityIconOverrideDto(saved.getAmenityCode(), saved.getIconName());
    }

    /**
     * Supprime l'override (= retour a l'icone par defaut Clenzy cote frontend).
     * Idempotent : silencieux si rien a supprimer.
     */
    @Transactional
    public void delete(Long organizationId, String amenityCode) {
        validateAmenityCode(amenityCode);
        repository.deleteByOrganizationIdAndAmenityCode(organizationId, amenityCode);
        log.debug("Amenity icon override deleted: org={} code={}", organizationId, amenityCode);
    }

    private static void validateAmenityCode(String code) {
        if (code == null || !AMENITY_CODE_PATTERN.matcher(code).matches()) {
            throw new IllegalArgumentException("amenityCode invalide : doit etre en SCREAMING_SNAKE_CASE");
        }
    }

    private static void validateIconName(String name) {
        if (name == null || !ICON_NAME_PATTERN.matcher(name).matches()) {
            throw new IllegalArgumentException("iconName invalide : doit etre un composant lucide PascalCase");
        }
    }
}
