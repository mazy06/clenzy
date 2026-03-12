package com.clenzy.booking.service;

import com.clenzy.booking.dto.BookingEngineAdminConfigDto;
import com.clenzy.booking.model.BookingEngineConfig;
import com.clenzy.booking.repository.BookingEngineConfigRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service d'administration du Booking Engine (multi-template).
 * Gere le CRUD complet des templates de configuration.
 * Auto-cree un template "Default" au premier acces si aucun n'existe.
 */
@Service
@Transactional(readOnly = true)
public class BookingEngineAdminService {

    private static final Logger logger = LoggerFactory.getLogger(BookingEngineAdminService.class);

    private final BookingEngineConfigRepository configRepository;
    private final TenantContext tenantContext;

    public BookingEngineAdminService(BookingEngineConfigRepository configRepository,
                                      TenantContext tenantContext) {
        this.configRepository = configRepository;
        this.tenantContext = tenantContext;
    }

    // ─── Legacy (compatible avec dashboard /status) ────────────────────────

    /**
     * Retourne la premiere configuration du Booking Engine.
     * Auto-cree avec des valeurs par defaut si aucune config n'existe.
     * Utilise par le dashboard status widget.
     */
    @Transactional
    public BookingEngineAdminConfigDto getConfig() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        List<BookingEngineConfig> configs = configRepository.findAllByOrganizationId(orgId);
        if (configs.isEmpty()) {
            BookingEngineConfig defaultConfig = createDefaultConfig(orgId);
            return BookingEngineAdminConfigDto.from(defaultConfig);
        }
        return BookingEngineAdminConfigDto.from(configs.get(0));
    }

    // ─── CRUD Multi-template ───────────────────────────────────────────────

    /**
     * Liste tous les templates de l'organisation.
     * Auto-cree un template "Default" si aucun n'existe.
     */
    @Transactional
    public List<BookingEngineAdminConfigDto> listConfigs() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        List<BookingEngineConfig> configs = configRepository.findAllByOrganizationId(orgId);
        if (configs.isEmpty()) {
            BookingEngineConfig defaultConfig = createDefaultConfig(orgId);
            configs = List.of(defaultConfig);
        }
        return configs.stream().map(BookingEngineAdminConfigDto::from).toList();
    }

    /**
     * Recupere un template par ID (avec validation tenant).
     */
    public BookingEngineAdminConfigDto getConfigById(Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingEngineConfig config = configRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Configuration introuvable : " + id));
        return BookingEngineAdminConfigDto.from(config);
    }

    /**
     * Cree un nouveau template.
     */
    @Transactional
    public BookingEngineAdminConfigDto createConfig(BookingEngineAdminConfigDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        // Verifier l'unicite du nom
        String name = dto.name() != null && !dto.name().isBlank() ? dto.name().trim() : "Default";
        if (configRepository.existsByOrganizationIdAndName(orgId, name)) {
            throw new IllegalArgumentException("Un template avec le nom '" + name + "' existe deja");
        }

        BookingEngineConfig config = new BookingEngineConfig();
        config.setOrganizationId(orgId);
        config.setApiKey(UUID.randomUUID().toString());
        config.setName(name);

        // Appliquer les champs settings du DTO
        dto.applyTo(config);
        // Re-forcer le nom car applyTo peut l'ecraser avec null
        config.setName(name);

        config = configRepository.save(config);
        logger.info("Booking Engine template '{}' created for org {}", name, orgId);
        return BookingEngineAdminConfigDto.from(config);
    }

    /**
     * Met a jour un template existant.
     */
    @Transactional
    public BookingEngineAdminConfigDto updateConfig(Long id, BookingEngineAdminConfigDto dto) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingEngineConfig config = configRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Configuration introuvable : " + id));

        // Verifier l'unicite du nom si change
        String newName = dto.name() != null && !dto.name().isBlank() ? dto.name().trim() : config.getName();
        if (!newName.equals(config.getName()) && configRepository.existsByOrganizationIdAndName(orgId, newName)) {
            throw new IllegalArgumentException("Un template avec le nom '" + newName + "' existe deja");
        }

        dto.applyTo(config);
        config.setName(newName);
        config = configRepository.save(config);
        logger.info("Booking Engine template '{}' (id={}) updated for org {}", newName, id, orgId);
        return BookingEngineAdminConfigDto.from(config);
    }

    /**
     * Supprime un template.
     */
    @Transactional
    public void deleteConfig(Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingEngineConfig config = configRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Configuration introuvable : " + id));
        configRepository.delete(config);
        logger.info("Booking Engine template '{}' (id={}) deleted for org {}", config.getName(), id, orgId);
    }

    /**
     * Active ou desactive un template.
     */
    @Transactional
    public BookingEngineAdminConfigDto toggleEnabled(Long id, boolean enabled) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingEngineConfig config = configRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Configuration introuvable : " + id));
        config.setEnabled(enabled);
        config = configRepository.save(config);
        logger.info("Booking Engine template '{}' (id={}) {} for org {}",
            config.getName(), id, enabled ? "enabled" : "disabled", orgId);
        return BookingEngineAdminConfigDto.from(config);
    }

    /**
     * Regenere la cle API d'un template.
     * L'ancienne cle est immediatement invalidee.
     */
    @Transactional
    public BookingEngineAdminConfigDto regenerateApiKey(Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        BookingEngineConfig config = configRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Configuration introuvable : " + id));
        String newKey = UUID.randomUUID().toString();
        config.setApiKey(newKey);
        config = configRepository.save(config);
        logger.info("Booking Engine API key regenerated for template '{}' (id={}) org {}",
            config.getName(), id, orgId);
        return BookingEngineAdminConfigDto.from(config);
    }

    // ─── Helpers ───────────────────────────────────────────────────────────

    private BookingEngineConfig createDefaultConfig(Long organizationId) {
        logger.info("No Booking Engine config for org {} — creating defaults", organizationId);
        BookingEngineConfig config = new BookingEngineConfig();
        config.setOrganizationId(organizationId);
        config.setApiKey(UUID.randomUUID().toString());
        config.setName("Default");
        // All other defaults are set on entity field declarations
        return configRepository.save(config);
    }
}
