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
 * ligne → master OFF + tous les modules aux défauts du catalogue.</p>
 */
@Service
public class SupervisionConfigService {

    /** Défaut quand l'org n'a pas encore de ligne (aligné sur l'entité). */
    static final int DEFAULT_DAILY_SCAN_BUDGET = 20;

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
        boolean enabled = settings != null && settings.isEnabled();
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
                row.setAutonomyLevel(SupervisionAutonomy.fromWire(moduleDto.autonomy()));
                moduleRepository.save(row);
            }
        }

        return getConfig(organizationId);
    }

    private SupervisionModuleDto toModuleDto(SupervisionModule module, SupervisionModuleSettings override) {
        boolean enabled = override != null ? override.isEnabled() : true;
        SupervisionAutonomy autonomy = override != null ? override.getAutonomyLevel() : module.defaultAutonomy();
        return new SupervisionModuleDto(
                module.key(), module.labelKey(), enabled, autonomy.toWire(), module.builtin());
    }
}
