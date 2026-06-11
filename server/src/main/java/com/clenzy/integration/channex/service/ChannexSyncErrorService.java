package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncLog;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * Traitement des notifications {@code sync_error} Channex (Sprint A3)
 * — refactor T-ARCH-01 : plus aucun repository dans les controllers.
 *
 * <p><b>Lookup volontairement tenant-agnostic</b> ({@code AnyOrg}) : le webhook
 * Channex est un flux public sans JWT (donc sans TenantContext).
 * L'authentification y est assuree par le header statique
 * {@code X-Channex-Token} valide en amont par
 * {@link com.clenzy.integration.channex.client.ChannexSignatureValidator}, et
 * le mapping resolu porte lui-meme son organizationId — meme convention que
 * {@code PaymentTransactionService} pour les flux webhooks signes.</p>
 */
@Service
public class ChannexSyncErrorService {

    private final ChannexPropertyMappingRepository mappingRepository;
    private final ChannexSyncLogService syncLogService;

    public ChannexSyncErrorService(ChannexPropertyMappingRepository mappingRepository,
                                   ChannexSyncLogService syncLogService) {
        this.mappingRepository = mappingRepository;
        this.syncLogService = syncLogService;
    }

    /** Lookup tenant-agnostic du mapping par property Channex (voir javadoc de classe). */
    @Transactional(readOnly = true)
    public Optional<ChannexPropertyMapping> findMappingAnyOrg(String channexPropertyId) {
        return mappingRepository.findByChannexPropertyIdAnyOrg(channexPropertyId);
    }

    /**
     * Flag le mapping en ERROR + enregistre un sync_log FAIL consultable dans
     * le diagnose dialog. Le log est commit independamment du caller
     * (REQUIRES_NEW dans {@link ChannexSyncLogService#record}).
     */
    @Transactional
    public void flagSyncError(ChannexPropertyMapping mapping, String errorMessage) {
        mapping.setSyncStatus(ChannexSyncStatus.ERROR);
        mapping.setLastSyncError("OTA sync error: " + errorMessage);
        mapping.setLastSyncAt(Instant.now());
        mappingRepository.save(mapping);
        syncLogService.record(mapping.getOrganizationId(), mapping.getClenzyPropertyId(),
            mapping.getId(),
            ChannexSyncLog.SyncType.PUSH_PROPERTY,
            ChannexSyncLog.Status.FAIL,
            0, Instant.now(), errorMessage);
    }
}
