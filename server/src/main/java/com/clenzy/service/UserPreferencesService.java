package com.clenzy.service;

import com.clenzy.dto.UserPreferencesDto;
import com.clenzy.model.UserPreferences;
import com.clenzy.repository.UserPreferencesRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Preferences utilisateur persistees en BDD (timezone, devise, langue, theme,
 * notifications). Chaque utilisateur a un singleton de preferences, cree
 * lazily au premier acces. Logique deplacee depuis
 * {@code UserPreferencesController} (refactor T-ARCH-01 — controller mince).
 *
 * <p>Scope strictement personnel : la cle est le {@code keycloakId} issu du
 * JWT de l'utilisateur authentifie.</p>
 */
@Service
public class UserPreferencesService {

    private final UserPreferencesRepository repository;
    private final TenantContext tenantContext;

    public UserPreferencesService(UserPreferencesRepository repository,
                                  TenantContext tenantContext) {
        this.repository = repository;
        this.tenantContext = tenantContext;
    }

    /** Retourne les preferences de l'utilisateur, en les creant si absentes. */
    @Transactional
    public UserPreferencesDto getOrCreateForUser(String keycloakId) {
        return toDto(getOrCreate(keycloakId));
    }

    /**
     * Mise a jour partielle : seuls les champs texte non-null du DTO sont
     * appliques (les booleens de notification sont toujours appliques).
     */
    @Transactional
    public UserPreferencesDto updateForUser(String keycloakId, UserPreferencesDto dto) {
        final UserPreferences entity = getOrCreate(keycloakId);

        if (dto.getTimezone() != null) entity.setTimezone(dto.getTimezone());
        if (dto.getCurrency() != null) entity.setCurrency(dto.getCurrency());
        if (dto.getLanguage() != null) entity.setLanguage(dto.getLanguage());
        if (dto.getThemeMode() != null) entity.setThemeMode(dto.getThemeMode());
        entity.setNotifyEmail(dto.isNotifyEmail());
        entity.setNotifyPush(dto.isNotifyPush());
        entity.setNotifySms(dto.isNotifySms());

        repository.save(entity);
        return toDto(entity);
    }

    private UserPreferences getOrCreate(String keycloakId) {
        return repository.findByKeycloakId(keycloakId)
                .orElseGet(() -> {
                    final var prefs = new UserPreferences(keycloakId, tenantContext.getOrganizationId());
                    return repository.save(prefs);
                });
    }

    private UserPreferencesDto toDto(UserPreferences entity) {
        return new UserPreferencesDto(
                entity.getTimezone(),
                entity.getCurrency(),
                entity.getLanguage(),
                entity.getThemeMode(),
                entity.isNotifyEmail(),
                entity.isNotifyPush(),
                entity.isNotifySms()
        );
    }
}
