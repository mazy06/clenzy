package com.clenzy.service.agent.vision;

import com.clenzy.repository.AssistantMessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Mesure l'usage de tokens vision (messages user avec attachments) par
 * organisation, sur une fenetre glissante de 30 jours.
 *
 * <p>Source : {@code assistant_message.prompt_tokens} pour les messages dont
 * {@code attachments IS NOT NULL}. C'est une approximation : tous les tokens
 * du tour (texte + images) sont comptes, pas uniquement les tokens vision —
 * mais en pratique, sur un tour avec image, la part vision domine largement.
 * Suffisant pour declencher une alerte de seuil.</p>
 */
@Service
@Transactional(readOnly = true)
public class VisionTokenUsageService {

    private static final Logger log = LoggerFactory.getLogger(VisionTokenUsageService.class);
    private static final int WINDOW_DAYS = 30;

    private final AssistantMessageRepository messageRepository;
    private final Clock clock;

    public VisionTokenUsageService(AssistantMessageRepository messageRepository) {
        this(messageRepository, Clock.systemUTC());
    }

    VisionTokenUsageService(AssistantMessageRepository messageRepository, Clock clock) {
        this.messageRepository = messageRepository;
        this.clock = clock;
    }

    /**
     * Total tokens vision consommes par l'org sur les {@value #WINDOW_DAYS}
     * derniers jours. Retourne 0 si l'org n'a aucun message vision ou si la
     * query echoue (fail-soft).
     */
    public long getMonthlyUsage(Long organizationId) {
        if (organizationId == null) return 0L;
        LocalDateTime since = LocalDateTime.now(clock.withZone(ZoneId.of("UTC")))
                .minusDays(WINDOW_DAYS);
        try {
            Long total = messageRepository.sumVisionPromptTokensSince(organizationId, since);
            return total != null ? total : 0L;
        } catch (Exception e) {
            log.warn("VisionTokenUsageService : query failed for org {} : {}",
                    organizationId, e.getMessage());
            return 0L;
        }
    }

    /** Snapshot detaille pour l'endpoint admin. */
    public UsageSnapshot snapshot(Long organizationId) {
        long usage = getMonthlyUsage(organizationId);
        return new UsageSnapshot(organizationId, usage, WINDOW_DAYS,
                LocalDateTime.now(clock.withZone(ZoneId.of("UTC"))));
    }

    public record UsageSnapshot(Long organizationId, long tokensLast30Days,
                                  int windowDays, LocalDateTime computedAt) {}
}
