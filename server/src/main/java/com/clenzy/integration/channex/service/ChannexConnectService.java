package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.config.ChannexMetrics;
import com.clenzy.integration.channex.dto.ChannexConnectRequest;
import com.clenzy.integration.channex.dto.ChannexPropertyDto;
import com.clenzy.integration.channex.exception.ChannexException;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexOtaChannelRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Service d'onboarding Channex (connexion/deconnexion d'une property Clenzy).
 *
 * <p>Flux de connexion :</p>
 * <ol>
 *   <li>Validation cross-tenant de la property Clenzy</li>
 *   <li>Verification existence de la property Channex (appel API getProperty)</li>
 *   <li>Creation du ChannexPropertyMapping en DB (sync_status=PENDING)</li>
 *   <li>Push initial 6 mois via {@link ChannexSyncService#pushProperty}</li>
 *   <li>Mapping passe en ACTIVE (ou ERROR) selon le resultat</li>
 * </ol>
 *
 * <p>Reference plan : {@code docs/strategy/channex-integration-plan.md} Sprint 5.</p>
 */
@Service
public class ChannexConnectService {

    private static final Logger log = LoggerFactory.getLogger(ChannexConnectService.class);

    /** Nombre de mois pour le push initial apres connexion. */
    private static final int INITIAL_SYNC_MONTHS = 6;

    private final ChannexClient channexClient;
    private final ChannexPropertyMappingRepository mappingRepository;
    private final ChannexOtaChannelRepository otaChannelRepository;
    private final ChannexSyncService syncService;
    private final PropertyRepository propertyRepository;
    private final ChannexMetrics metrics;

    public ChannexConnectService(ChannexClient channexClient,
                                   ChannexPropertyMappingRepository mappingRepository,
                                   ChannexOtaChannelRepository otaChannelRepository,
                                   ChannexSyncService syncService,
                                   PropertyRepository propertyRepository,
                                   ChannexMetrics metrics) {
        this.channexClient = channexClient;
        this.mappingRepository = mappingRepository;
        this.otaChannelRepository = otaChannelRepository;
        this.syncService = syncService;
        this.propertyRepository = propertyRepository;
        this.metrics = metrics;
    }

    // ─── Connect ────────────────────────────────────────────────────────────

    /**
     * Connecte une property Clenzy a son equivalent Channex.
     *
     * @throws IllegalStateException si la property Clenzy est introuvable ou n'appartient
     *         pas a l'organisation, OU si un mapping existe deja, OU si la property
     *         Channex n'existe pas (verifie par appel API).
     */
    @Transactional
    public ChannexPropertyMapping connect(Long clenzyPropertyId, Long orgId, ChannexConnectRequest request) {
        // 1. Validation cross-tenant
        Property property = propertyRepository.findById(clenzyPropertyId)
            .orElseThrow(() -> new IllegalStateException("Propriete " + clenzyPropertyId + " introuvable"));
        if (!orgId.equals(property.getOrganizationId())) {
            throw new IllegalStateException("Propriete " + clenzyPropertyId
                + " n'appartient pas a l'organisation " + orgId);
        }

        // 2. Verifier qu'il n'y a pas deja un mapping
        Optional<ChannexPropertyMapping> existing = mappingRepository
            .findByClenzyPropertyId(clenzyPropertyId, orgId);
        if (existing.isPresent()) {
            throw new IllegalStateException("La propriete " + clenzyPropertyId
                + " est deja connectee a Channex (mapping " + existing.get().getId() + ")");
        }

        // 3. Verifier que la property Channex existe (appel API)
        ChannexPropertyDto channexProperty;
        try {
            channexProperty = channexClient.getProperty(request.channexPropertyId());
        } catch (ChannexException e) {
            log.error("ChannexConnect: impossible de verifier la property Channex {}: {}",
                request.channexPropertyId(), e.getMessage());
            if (e.getKind() == ChannexException.Kind.NOT_FOUND) {
                throw new IllegalStateException("Property Channex introuvable : "
                    + request.channexPropertyId() + ". Verifiez l'ID dans le dashboard Channex.");
            }
            throw new IllegalStateException("Erreur API Channex : " + e.getMessage());
        }

        // 4. Creer le mapping en PENDING
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setOrganizationId(orgId);
        mapping.setClenzyPropertyId(clenzyPropertyId);
        mapping.setChannexPropertyId(request.channexPropertyId());
        mapping.setChannexRoomTypeId(request.channexRoomTypeId());
        mapping.setChannexDefaultRatePlanId(request.channexDefaultRatePlanId());
        mapping.setSyncStatus(ChannexSyncStatus.PENDING);
        mapping = mappingRepository.save(mapping);

        log.info("ChannexConnect: mapping cree {} pour property {} (Channex={})",
            mapping.getId(), clenzyPropertyId, channexProperty.id());
        metrics.recordMappingCreated();

        // 5. Push initial (best-effort, peut echouer sans rollback du mapping —
        //    le scheduler retentera dans l'heure)
        try {
            LocalDate from = LocalDate.now();
            LocalDate to = from.plusMonths(INITIAL_SYNC_MONTHS);
            ChannexSyncService.ChannexSyncResult result = syncService.pushProperty(
                clenzyPropertyId, orgId, from, to
            );
            log.info("ChannexConnect: push initial {} -> avail={} rates={} success={}",
                mapping.getId(), result.availabilityUpdates(), result.rateUpdates(), result.success());
        } catch (Exception e) {
            log.warn("ChannexConnect: push initial KO mapping {} (mapping reste en PENDING, scheduler retentera): {}",
                mapping.getId(), e.getMessage());
        }

        // Re-lire pour avoir le status final apres push
        return mappingRepository.findById(mapping.getId()).orElse(mapping);
    }

    // ─── Disconnect ─────────────────────────────────────────────────────────

    /**
     * Deconnecte une property de Channex.
     *
     * <p>Supprime localement le mapping + ses ota_channels associes. NE supprime
     * PAS la property cote Channex (pour eviter les pertes accidentelles —
     * l'utilisateur peut le faire manuellement sur le dashboard Channex si
     * souhaite).</p>
     */
    @Transactional
    public void disconnect(Long clenzyPropertyId, Long orgId) {
        ChannexPropertyMapping mapping = mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId));

        // Supprime aussi les ota_channels (cascade DB devrait le faire mais on est defensif)
        otaChannelRepository.findByMappingId(mapping.getId())
            .forEach(otaChannelRepository::delete);

        mappingRepository.delete(mapping);
        metrics.recordMappingDeleted();

        log.info("ChannexConnect: mapping {} supprime (property {}, org {}). " +
            "La property reste presente cote Channex.", mapping.getId(), clenzyPropertyId, orgId);
    }

    // ─── List + Get ─────────────────────────────────────────────────────────

    public List<ChannexPropertyMapping> list(Long orgId) {
        return mappingRepository.findAllByOrgId(orgId);
    }

    public Optional<ChannexPropertyMapping> getByPropertyId(Long clenzyPropertyId, Long orgId) {
        return mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId);
    }

    /**
     * Force un re-push complet pour une property deja connectee (utile pour
     * recuperer un mapping en ERROR ou refaire le sync apres une desactivation).
     */
    @Transactional
    public ChannexSyncService.ChannexSyncResult resync(Long clenzyPropertyId, Long orgId, int months) {
        ChannexPropertyMapping mapping = mappingRepository.findByClenzyPropertyId(clenzyPropertyId, orgId)
            .orElseThrow(() -> new IllegalStateException(
                "Aucun mapping Channex pour la propriete " + clenzyPropertyId));

        // Si le mapping etait DISABLED, on le repasse en PENDING avant le push
        if (mapping.getSyncStatus() == ChannexSyncStatus.DISABLED) {
            mapping.setSyncStatus(ChannexSyncStatus.PENDING);
            mappingRepository.save(mapping);
        }

        int safeMonths = Math.min(Math.max(1, months), 12);
        LocalDate from = LocalDate.now();
        LocalDate to = from.plusMonths(safeMonths);
        return syncService.pushProperty(clenzyPropertyId, orgId, from, to);
    }
}
