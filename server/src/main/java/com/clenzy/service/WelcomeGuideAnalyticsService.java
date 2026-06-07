package com.clenzy.service;

import com.clenzy.dto.WelcomeGuideStatsDto;
import com.clenzy.dto.WelcomeGuideStatsDto.DailyCount;
import com.clenzy.dto.WelcomeGuideStatsDto.LabeledCount;
import com.clenzy.model.WelcomeGuide;
import com.clenzy.model.WelcomeGuideEvent;
import com.clenzy.model.WelcomeGuideEventType;
import com.clenzy.model.WelcomeGuideToken;
import com.clenzy.repository.WelcomeGuideEventRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Capture des evenements guest (append-only) et agregation des statistiques cote hote.
 *
 * <p>La capture est <b>best-effort</b> : toute erreur est avalee (les stats ne doivent
 * jamais casser la page guest). Un plafond quotidien par token (Redis) limite l'abus.
 * L'agregation est toujours bornee a l'org du demandeur (ownership verifie via le guide).
 */
@Service
public class WelcomeGuideAnalyticsService {

    private static final Logger log = LoggerFactory.getLogger(WelcomeGuideAnalyticsService.class);

    /** Garde-fou anti-spam : au-dela, les evenements d'un meme token sont ignores sur 24h. */
    private static final long DAILY_CAP_PER_TOKEN = 500;
    private static final int TOP_ACTIVITIES = 5;
    private static final int TREND_DAYS = 30;

    private final WelcomeGuideEventRepository eventRepository;
    private final WelcomeGuideTokenRepository tokenRepository;
    private final WelcomeGuideRepository guideRepository;
    private final StringRedisTemplate redisTemplate;

    public WelcomeGuideAnalyticsService(WelcomeGuideEventRepository eventRepository,
                                        WelcomeGuideTokenRepository tokenRepository,
                                        WelcomeGuideRepository guideRepository,
                                        StringRedisTemplate redisTemplate) {
        this.eventRepository = eventRepository;
        this.tokenRepository = tokenRepository;
        this.guideRepository = guideRepository;
        this.redisTemplate = redisTemplate;
    }

    /**
     * Enregistre un evenement guest pour un token valide. No-op silencieux si le type
     * est inconnu, le token invalide/expire, le plafond atteint, ou en cas d'erreur.
     */
    @Transactional
    public void record(UUID token, String typeRaw, String detail) {
        try {
            WelcomeGuideEventType type = parseType(typeRaw);
            if (type == null || token == null) {
                return;
            }
            WelcomeGuideToken tok = tokenRepository.findByToken(token)
                .filter(WelcomeGuideToken::isCurrentlyValid)
                .filter(t -> t.getGuide() != null)
                .orElse(null);
            if (tok == null || overDailyCap(token)) {
                return;
            }
            WelcomeGuide guide = tok.getGuide();
            WelcomeGuideEvent event = new WelcomeGuideEvent();
            event.setOrganizationId(guide.getOrganizationId());
            event.setGuideId(guide.getId());
            event.setReservationId(tok.getReservation() != null ? tok.getReservation().getId() : null);
            event.setEventType(type);
            event.setDetail(truncate(detail));
            eventRepository.save(event);
        } catch (Exception e) {
            log.warn("Capture evenement livret ignoree (token={}): {}", token, e.getMessage());
        }
    }

    /** Statistiques agregees d'un livret. Vide si le livret n'appartient pas a l'org. */
    @Transactional(readOnly = true)
    public Optional<WelcomeGuideStatsDto> getStats(Long guideId, Long orgId) {
        if (guideRepository.findByIdAndOrganizationId(guideId, orgId).isEmpty()) {
            return Optional.empty();
        }
        Map<WelcomeGuideEventType, Long> counts = new EnumMap<>(WelcomeGuideEventType.class);
        for (Object[] row : eventRepository.countByTypeForGuide(guideId)) {
            counts.put((WelcomeGuideEventType) row[0], ((Number) row[1]).longValue());
        }

        LocalDateTime since = LocalDate.now().minusDays(TREND_DAYS - 1L).atStartOfDay();
        List<DailyCount> dailyOpens = eventRepository
            .dailyCountForGuide(guideId, WelcomeGuideEventType.GUIDE_OPENED.name(), since).stream()
            .map(r -> new DailyCount((String) r[0], ((Number) r[1]).longValue()))
            .toList();

        List<LabeledCount> topActivities = eventRepository
            .topDetailForGuide(guideId, WelcomeGuideEventType.ACTIVITY_CLICK, PageRequest.of(0, TOP_ACTIVITIES)).stream()
            .map(r -> new LabeledCount((String) r[0], ((Number) r[1]).longValue()))
            .toList();

        return Optional.of(new WelcomeGuideStatsDto(
            counts.getOrDefault(WelcomeGuideEventType.GUIDE_OPENED, 0L),
            counts.getOrDefault(WelcomeGuideEventType.CHAT_MESSAGE, 0L),
            counts.getOrDefault(WelcomeGuideEventType.GUESTBOOK_SUBMIT, 0L),
            counts.getOrDefault(WelcomeGuideEventType.ACTIVITY_CLICK, 0L),
            counts.getOrDefault(WelcomeGuideEventType.CHECKIN_CLICK, 0L),
            dailyOpens,
            topActivities));
    }

    private static WelcomeGuideEventType parseType(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return WelcomeGuideEventType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String truncate(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() > 255 ? trimmed.substring(0, 255) : trimmed;
    }

    /** Incremente le compteur journalier du token ; true si le plafond est depasse. Tolere Redis indisponible. */
    private boolean overDailyCap(UUID token) {
        try {
            String key = "guide:evt:" + token + ":cap";
            Long n = redisTemplate.opsForValue().increment(key);
            if (n != null && n == 1L) {
                redisTemplate.expire(key, Duration.ofHours(24));
            }
            return n != null && n > DAILY_CAP_PER_TOKEN;
        } catch (Exception e) {
            return false;
        }
    }
}
