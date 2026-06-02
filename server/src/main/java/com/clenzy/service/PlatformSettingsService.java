package com.clenzy.service;

import com.clenzy.model.PlatformSettings;
import com.clenzy.repository.PlatformSettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Accès aux réglages plateforme Baitly (singleton, id = 1).
 *
 * La ligne est seedée par la migration 0166. {@link #getOrDefault()} reste
 * défensif (retourne des valeurs par défaut si la ligne manque) pour ne jamais
 * casser un flux public comme la demande de devis.
 */
@Service
public class PlatformSettingsService {

    private final PlatformSettingsRepository repository;

    public PlatformSettingsService(PlatformSettingsRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public PlatformSettings getOrDefault() {
        return repository.findById(PlatformSettings.SINGLETON_ID)
                .orElseGet(PlatformSettings::new);
    }

    /** Les emails de devis aux prospects sont-ils activés ? (défaut : true). */
    @Transactional(readOnly = true)
    public boolean isSendProspectDevisEmails() {
        return getOrDefault().isSendProspectDevisEmails();
    }

    /** Les demandes de devis sont-elles versées dans la waitlist ? (défaut : true). */
    @Transactional(readOnly = true)
    public boolean isAddDevisLeadsToWaitlist() {
        return getOrDefault().isAddDevisLeadsToWaitlist();
    }

    @Transactional
    public PlatformSettings updateSendProspectDevisEmails(boolean enabled, String updatedBy) {
        return update(s -> s.setSendProspectDevisEmails(enabled), updatedBy);
    }

    @Transactional
    public PlatformSettings updateAddDevisLeadsToWaitlist(boolean enabled, String updatedBy) {
        return update(s -> s.setAddDevisLeadsToWaitlist(enabled), updatedBy);
    }

    private PlatformSettings update(java.util.function.Consumer<PlatformSettings> mutation, String updatedBy) {
        PlatformSettings settings = repository.findById(PlatformSettings.SINGLETON_ID)
                .orElseGet(() -> {
                    PlatformSettings fresh = new PlatformSettings();
                    fresh.setId(PlatformSettings.SINGLETON_ID);
                    return fresh;
                });
        mutation.accept(settings);
        settings.setUpdatedAt(LocalDateTime.now());
        settings.setUpdatedBy(updatedBy);
        return repository.save(settings);
    }
}
