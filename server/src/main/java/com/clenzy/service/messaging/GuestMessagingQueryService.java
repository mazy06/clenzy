package com.clenzy.service.messaging;

import com.clenzy.dto.MessagingAutomationConfigDto;
import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.MessagingAutomationConfig;
import com.clenzy.repository.GuestMessageLogRepository;
import com.clenzy.repository.MessagingAutomationConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Lectures messagerie voyageurs (historique, lookups org-scopes) + upsert de
 * la config d'automatisation. Logique deplacee depuis
 * {@code GuestMessagingController} (refactor T-ARCH-01 — controller mince).
 *
 * <h2>Securite</h2>
 * <p>{@code findById} ne passe pas par le filtre Hibernate organizationFilter :
 * tout lookup unitaire de log est suivi d'une validation d'org explicite
 * (un log d'une autre organisation est introuvable). L'historique par
 * reservation est filtre sur l'org du requester (bypass platform staff via
 * {@code organizationId == null}).</p>
 */
@Service
@Transactional(readOnly = true)
public class GuestMessagingQueryService {

    private final MessagingAutomationConfigRepository configRepository;
    private final GuestMessageLogRepository messageLogRepository;

    public GuestMessagingQueryService(MessagingAutomationConfigRepository configRepository,
                                      GuestMessageLogRepository messageLogRepository) {
        this.configRepository = configRepository;
        this.messageLogRepository = messageLogRepository;
    }

    // ── Configuration d'automatisation ──

    /** Config de l'org, ou config par defaut (non persistee) si absente. */
    public MessagingAutomationConfig getConfigOrDefault(Long organizationId) {
        return configRepository.findByOrganizationId(organizationId)
            .orElseGet(() -> new MessagingAutomationConfig(organizationId));
    }

    /** Upsert de la config d'automatisation de l'org. */
    @Transactional
    public MessagingAutomationConfig updateConfig(Long organizationId, MessagingAutomationConfigDto dto) {
        MessagingAutomationConfig config = configRepository.findByOrganizationId(organizationId)
            .orElseGet(() -> new MessagingAutomationConfig(organizationId));

        config.setAutoSendCheckIn(dto.autoSendCheckIn());
        config.setAutoSendCheckOut(dto.autoSendCheckOut());
        config.setHoursBeforeCheckIn(dto.hoursBeforeCheckIn());
        config.setHoursBeforeCheckOut(dto.hoursBeforeCheckOut());
        config.setCheckInTemplateId(dto.checkInTemplateId());
        config.setCheckOutTemplateId(dto.checkOutTemplateId());
        config.setAutoPushPricingEnabled(dto.autoPushPricingEnabled());

        return configRepository.save(config);
    }

    // ── Lookups et historique des logs ──

    /** Log par id, restreint a l'organisation du requester (cross-org = introuvable). */
    public Optional<GuestMessageLog> findLogForOrganization(Long logId, Long organizationId) {
        return messageLogRepository.findById(logId)
            .filter(l -> l.getOrganizationId().equals(organizationId));
    }

    public List<GuestMessageLog> getHistory(Long organizationId) {
        return messageLogRepository.findByOrganizationIdOrderByCreatedAtDesc(organizationId);
    }

    /**
     * Historique des messages d'une reservation, filtre sur l'org du requester.
     * {@code organizationId == null} = platform staff (SUPER_ADMIN/SUPER_MANAGER),
     * pas de filtre (pattern bypass requireSameOrganization de SmartLockService).
     */
    public List<GuestMessageLog> getReservationHistory(Long reservationId, Long organizationId) {
        return messageLogRepository.findByReservationIdOrderByCreatedAtDesc(reservationId).stream()
            .filter(l -> organizationId == null || organizationId.equals(l.getOrganizationId()))
            .toList();
    }
}
