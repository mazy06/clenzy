package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionConfigDto;
import com.clenzy.dto.SupervisionModuleDto;
import com.clenzy.model.SupervisionAutonomy;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.model.SupervisionSettings;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.service.agent.supervision.SupervisionModuleRegistry.SupervisionModule;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Config org-level de la constellation Superviseur (master + modules).
 *
 * <p>La config <b>effective</b> est calculée en superposant les overrides org
 * (tables {@link SupervisionSettings} / {@link SupervisionModuleSettings}) sur
 * les défauts du catalogue ({@link SupervisionModuleRegistry}). Une org sans
 * ligne → master ON (l'observation est le défaut produit) + tous les modules
 * aux défauts du catalogue, donc SUGGEST : elle voit des cartes, rien ne
 * s'applique tout seul.</p>
 */
@Service
public class SupervisionConfigService {

    /** Défaut quand l'org n'a pas encore de ligne (aligné sur l'entité). */
    public static final int DEFAULT_DAILY_SCAN_BUDGET = 20;

    /**
     * Master d'une org sans ligne : l'observation est le défaut produit. Lu par
     * le balayage autonome, qui doit trancher le même cas sans passer par ici.
     */
    public static final boolean DEFAULT_ENABLED = true;

    private final SupervisionSettingsRepository settingsRepository;
    private final SupervisionModuleSettingsRepository moduleRepository;
    private final SupervisionModuleRegistry registry;

    public SupervisionConfigService(SupervisionSettingsRepository settingsRepository,
                                    SupervisionModuleSettingsRepository moduleRepository,
                                    SupervisionModuleRegistry registry) {
        this.settingsRepository = settingsRepository;
        this.moduleRepository = moduleRepository;
        this.registry = registry;
    }

    /** Config effective de l'org (overrides superposés sur les défauts catalogue). */
    @Transactional(readOnly = true)
    public SupervisionConfigDto getConfig(Long organizationId) {
        SupervisionSettings settings = settingsRepository.findByOrganizationId(organizationId).orElse(null);
        boolean enabled = settings != null ? settings.isEnabled() : DEFAULT_ENABLED;
        boolean paused = settings != null && settings.isPaused();
        int dailyScanBudget = settings != null ? settings.getDailyScanBudget() : DEFAULT_DAILY_SCAN_BUDGET;

        Map<String, SupervisionModuleSettings> overrides = moduleRepository
                .findByOrganizationId(organizationId).stream()
                .collect(Collectors.toMap(SupervisionModuleSettings::getModuleKey, Function.identity(),
                        (a, b) -> a));

        List<SupervisionModuleDto> modules = registry.all().stream()
                .map(module -> toModuleDto(module, overrides.get(module.key())))
                .toList();

        return new SupervisionConfigDto(enabled, paused, dailyScanBudget, modules);
    }

    /**
     * Met à jour la config de l'org. Upsert du master + des modules connus du
     * catalogue (les clés inconnues sont ignorées défensivement). Renvoie la
     * config effective recalculée.
     */
    @Transactional
    public SupervisionConfigDto updateConfig(Long organizationId, SupervisionConfigDto update) {
        SupervisionSettings settings = settingsRepository.findByOrganizationId(organizationId)
                .orElseGet(() -> new SupervisionSettings(organizationId));
        settings.setEnabled(update.enabled());
        settings.setPaused(update.paused());
        settings.setDailyScanBudget(Math.max(0, update.dailyScanBudget()));
        settingsRepository.save(settings);

        if (update.modules() != null) {
            for (SupervisionModuleDto moduleDto : update.modules()) {
                if (moduleDto == null || moduleDto.key() == null || !registry.isKnown(moduleDto.key())) {
                    continue; // clé inconnue / absente du catalogue → ignorée
                }
                SupervisionModuleSettings row = moduleRepository
                        .findByOrganizationIdAndModuleKey(organizationId, moduleDto.key())
                        .orElseGet(() -> new SupervisionModuleSettings(
                                organizationId, moduleDto.key(), true, SupervisionAutonomy.SUGGEST));
                row.setEnabled(moduleDto.enabled());
                final SupervisionAutonomy requested = SupervisionAutonomy.fromWire(moduleDto.autonomy());
                // La PLEINE autonomie ne s'obtient PAS par un simple PUT de config :
                // elle engage la responsabilité de l'organisation (l'agent agit seul
                // et en silence) et exige une acceptation tracée — sinon la garde ne
                // vaudrait que dans l'interface, contournable par un appel direct.
                if (requested == SupervisionAutonomy.FULL
                        && row.getFullAutonomyAcceptedAt() == null) {
                    throw new IllegalStateException("La pleine autonomie du module « " + moduleDto.key()
                            + " » requiert une acceptation explicite (POST /api/ai/supervision/modules/"
                            + moduleDto.key() + "/full-autonomy-consent)");
                }
                row.setAutonomyLevel(requested);
                row.setThresholds(moduleDto.thresholds()); // seuils configurables (B5), null accepté
                moduleRepository.save(row);
            }
        }

        return getConfig(organizationId);
    }

    /**
     * Enregistre l'acceptation de la pleine autonomie d'un module et l'applique
     * dans la FOULÉE : l'acceptation et le niveau qu'elle autorise ne doivent
     * pas pouvoir diverger. Ré-accepter (changement d'opérateur, nouveau texte)
     * rafraîchit la trace. Le module doit exister au catalogue.
     */
    @Transactional
    public SupervisionConfigDto acceptFullAutonomy(Long organizationId, String moduleKey,
                                                   String acceptedBy, String noticeVersion) {
        if (moduleKey == null || !registry.isKnown(moduleKey)) {
            throw new IllegalArgumentException("Module inconnu : " + moduleKey);
        }
        SupervisionModuleSettings row = moduleRepository
                .findByOrganizationIdAndModuleKey(organizationId, moduleKey)
                .orElseGet(() -> new SupervisionModuleSettings(
                        organizationId, moduleKey, true, SupervisionAutonomy.SUGGEST));
        row.setFullAutonomyAcceptedAt(Instant.now());
        row.setFullAutonomyAcceptedBy(acceptedBy);
        row.setFullAutonomyNoticeVersion(noticeVersion);
        row.setAutonomyLevel(SupervisionAutonomy.FULL);
        moduleRepository.save(row);
        return getConfig(organizationId);
    }

    private SupervisionModuleDto toModuleDto(SupervisionModule module, SupervisionModuleSettings override) {
        boolean enabled = override != null ? override.isEnabled() : true;
        SupervisionAutonomy autonomy = override != null ? override.getAutonomyLevel() : module.defaultAutonomy();
        String thresholds = override != null ? override.getThresholds() : null;
        return new SupervisionModuleDto(
                module.key(), module.labelKey(), enabled, autonomy.toWire(), module.builtin(), thresholds);
    }
}
