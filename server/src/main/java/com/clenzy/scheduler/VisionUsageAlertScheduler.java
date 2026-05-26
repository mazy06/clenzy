package com.clenzy.scheduler;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.OrgVisionAlert;
import com.clenzy.repository.OrgVisionAlertRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.agent.vision.VisionTokenUsageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

/**
 * Scheduler hebdomadaire d'alertes vision usage.
 *
 * <p>Cron : lundi 5h UTC (apres le cleanup memory de 3h et avant l'activite
 * de la journee). Pour chaque {@link OrgVisionAlert} configure, compare le
 * usage 30j au {@code thresholdTokens} :
 * <ul>
 *   <li>Si depasse ET pas d'alerte recente (&lt; 7j) : envoie a la fois la
 *       notification in-app aux admins et l'admin update {@code last_alerted_at}.</li>
 *   <li>Sinon : skip.</li>
 * </ul>
 *
 * <p>Le throttling 7j evite le spam : meme si l'admin n'agit pas, on n'envoie
 * pas de notification tous les jours.</p>
 */
@Component
public class VisionUsageAlertScheduler {

    private static final Logger log = LoggerFactory.getLogger(VisionUsageAlertScheduler.class);
    private static final Duration MIN_RE_ALERT_INTERVAL = Duration.ofDays(7);

    private final OrgVisionAlertRepository alertRepository;
    private final VisionTokenUsageService usageService;
    private final NotificationService notificationService;
    private final Clock clock;
    private final boolean enabled;

    @org.springframework.beans.factory.annotation.Autowired
    public VisionUsageAlertScheduler(OrgVisionAlertRepository alertRepository,
                                       VisionTokenUsageService usageService,
                                       NotificationService notificationService,
                                       @Value("${clenzy.assistant.vision.alerts-enabled:true}") boolean enabled) {
        this(alertRepository, usageService, notificationService, Clock.systemUTC(), enabled);
    }

    VisionUsageAlertScheduler(OrgVisionAlertRepository alertRepository,
                                VisionTokenUsageService usageService,
                                NotificationService notificationService,
                                Clock clock,
                                boolean enabled) {
        this.alertRepository = alertRepository;
        this.usageService = usageService;
        this.notificationService = notificationService;
        this.clock = clock;
        this.enabled = enabled;
    }

    /** Lundi 5h UTC. */
    @Scheduled(cron = "0 0 5 * * MON")
    public void runWeekly() {
        runOnce();
    }

    /** @return nombre d'alertes effectivement envoyees */
    public int runOnce() {
        if (!enabled) {
            log.debug("VisionUsageAlertScheduler : disabled, skip");
            return 0;
        }

        List<OrgVisionAlert> all;
        try {
            all = alertRepository.findAll();
        } catch (Exception e) {
            log.error("VisionUsageAlertScheduler : list configs failed", e);
            return 0;
        }
        if (all.isEmpty()) return 0;

        LocalDateTime now = LocalDateTime.now(clock.withZone(ZoneId.of("UTC")));
        int alerted = 0;
        for (OrgVisionAlert cfg : all) {
            try {
                if (processOne(cfg, now)) alerted++;
            } catch (Exception e) {
                log.warn("VisionUsageAlertScheduler : org {} failed : {}",
                        cfg.getOrganizationId(), e.getMessage());
            }
        }
        if (alerted > 0) {
            log.info("VisionUsageAlertScheduler tick : {} alertes envoyees", alerted);
        }
        return alerted;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean processOne(OrgVisionAlert cfg, LocalDateTime now) {
        long usage = usageService.getMonthlyUsage(cfg.getOrganizationId());
        if (usage < cfg.getThresholdTokens()) {
            log.debug("VisionUsageAlertScheduler : org {} sous seuil ({} / {})",
                    cfg.getOrganizationId(), usage, cfg.getThresholdTokens());
            return false;
        }
        if (cfg.getLastAlertedAt() != null
                && Duration.between(cfg.getLastAlertedAt(), now).compareTo(MIN_RE_ALERT_INTERVAL) < 0) {
            log.debug("VisionUsageAlertScheduler : org {} deja alertee recemment ({}), throttle",
                    cfg.getOrganizationId(), cfg.getLastAlertedAt());
            return false;
        }

        // Compare-and-swap atomique : une seule instance HA gagne le droit
        // d'envoyer l'alerte. Si l'UPDATE renvoie 0, une autre instance a deja
        // mis a jour last_alerted_at depuis qu'on l'a lu → on skip.
        int acquired = alertRepository.casLastAlertedAt(
                cfg.getId(), cfg.getLastAlertedAt(), now);
        if (acquired == 0) {
            log.debug("VisionUsageAlertScheduler : org {} CAS perdu, autre instance a alerte",
                    cfg.getOrganizationId());
            return false;
        }

        String title = "Usage vision IA depasse";
        String message = String.format(
                "Ton organisation a consomme %s tokens vision sur les 30 derniers jours, "
                + "au-dessus de ton seuil configure de %s. Verifie l'usage dans "
                + "Settings > IA.",
                formatTokens(usage), formatTokens(cfg.getThresholdTokens()));
        notificationService.notifyAdminsAndManagers(
                NotificationKey.VISION_USAGE_THRESHOLD_REACHED,
                title, message,
                "/settings?tab=ai",
                cfg.getOrganizationId());

        // Refresh in-memory pour les callers (tests qui inspectent cfg.lastAlertedAt)
        cfg.setLastAlertedAt(now);
        return true;
    }

    private static String formatTokens(long n) {
        if (n >= 1_000_000) return String.format("%.1fM", n / 1_000_000.0);
        if (n >= 1_000) return String.format("%.1fk", n / 1_000.0);
        return Long.toString(n);
    }
}
