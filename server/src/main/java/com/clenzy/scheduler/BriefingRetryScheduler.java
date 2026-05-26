package com.clenzy.scheduler;

import com.clenzy.model.AssistantBriefingLog;
import com.clenzy.model.AssistantBriefingPref;
import com.clenzy.repository.AssistantBriefingLogRepository;
import com.clenzy.service.agent.briefing.AssistantBriefingPrefService;
import com.clenzy.service.agent.briefing.BriefingComposer;
import com.clenzy.service.agent.briefing.BriefingDelivery;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Optional;

/**
 * Retry des briefings en echec.
 *
 * <p>Le scheduler principal ({@link AssistantBriefingScheduler}) tourne a l'heure
 * pile. Ce retry tourne 30 minutes apres pour eviter le clash : si un envoi
 * vient d'echouer (mailer KO, WhatsApp 5xx), il a 30 minutes pour se reposer
 * avant qu'on retente.</p>
 *
 * <p>Critere de selection : logs status=FAILED, date = aujourd'hui (timezone UTC),
 * sentAt dans les {@link #RETRY_WINDOW_HOURS} dernieres heures. La fenetre 6h
 * couvre largement la cas typique (l'incident dure < quelques minutes) tout en
 * evitant de re-tenter eternellement (les pannes durables sont remontees a
 * l'admin par d'autres canaux).</p>
 */
@Component
public class BriefingRetryScheduler {

    private static final Logger log = LoggerFactory.getLogger(BriefingRetryScheduler.class);
    private static final int RETRY_WINDOW_HOURS = 6;

    private final AssistantBriefingLogRepository logRepository;
    private final AssistantBriefingPrefService prefService;
    private final BriefingComposer composer;
    private final BriefingDelivery delivery;
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final boolean enabled;

    public BriefingRetryScheduler(AssistantBriefingLogRepository logRepository,
                                    AssistantBriefingPrefService prefService,
                                    BriefingComposer composer,
                                    BriefingDelivery delivery,
                                    ObjectMapper objectMapper,
                                    @Value("${clenzy.assistant.briefing.retry-enabled:true}") boolean enabled) {
        this(logRepository, prefService, composer, delivery, objectMapper,
                Clock.systemUTC(), enabled);
    }

    BriefingRetryScheduler(AssistantBriefingLogRepository logRepository,
                            AssistantBriefingPrefService prefService,
                            BriefingComposer composer,
                            BriefingDelivery delivery,
                            ObjectMapper objectMapper,
                            Clock clock,
                            boolean enabled) {
        this.logRepository = logRepository;
        this.prefService = prefService;
        this.composer = composer;
        this.delivery = delivery;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.enabled = enabled;
    }

    /** Toutes les heures, decale de 30 min. */
    @Scheduled(cron = "0 30 * * * *")
    public void runHourly() {
        runOnce();
    }

    /**
     * Execution effective — separee du cron pour les tests deterministes.
     * @return nombre d'envois reussis a la 2eme tentative
     */
    public int runOnce() {
        if (!enabled) {
            log.debug("BriefingRetryScheduler : disabled, skip");
            return 0;
        }

        LocalDateTime now = LocalDateTime.now(clock.withZone(ZoneId.of("UTC")));
        LocalDateTime since = now.minus(Duration.ofHours(RETRY_WINDOW_HOURS));

        List<AssistantBriefingLog> failed;
        try {
            failed = logRepository.findFailedSince(since);
        } catch (Exception e) {
            log.error("BriefingRetryScheduler : lookup failed", e);
            return 0;
        }
        if (failed.isEmpty()) return 0;
        log.debug("BriefingRetryScheduler tick : {} briefings FAILED a re-tenter", failed.size());

        int recovered = 0;
        for (AssistantBriefingLog entry : failed) {
            try {
                if (retryOne(entry)) recovered++;
            } catch (Exception e) {
                log.warn("BriefingRetryScheduler : retry user {} failed : {}",
                        entry.getKeycloakId(), e.getMessage());
            }
        }
        if (recovered > 0) {
            log.info("BriefingRetryScheduler tick : {} briefings recuperes / {} retentes",
                    recovered, failed.size());
        }
        return recovered;
    }

    /**
     * Re-tente un briefing dans une transaction dediee. Re-utilise la conversation
     * deja composee si dispo (la composition LLM coute, on evite de la refaire);
     * sinon, re-compose entierement.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean retryOne(AssistantBriefingLog entry) {
        Optional<AssistantBriefingPref> prefOpt = prefService.get(entry.getKeycloakId());
        if (prefOpt.isEmpty()) {
            log.debug("BriefingRetryScheduler : user {} n'a plus de pref, skip", entry.getKeycloakId());
            return false;
        }
        AssistantBriefingPref pref = prefOpt.get();

        BriefingComposer.BriefingResult result;
        if (entry.getConversationId() != null) {
            // La conversation a deja ete composee — on retente seulement le dispatch
            String body = ""; // Le body n'est pas re-utilise au dispatch (les canaux le derivent)
            result = new BriefingComposer.BriefingResult(
                    entry.getConversationId(), body, pref.getFrequencyEnum());
        } else {
            result = composer.compose(pref);
            if (result == null) {
                entry.setErrorMessage("retry: compose returned null");
                logRepository.save(entry);
                return false;
            }
        }

        List<String> channels = prefService.parseChannels(pref);
        List<String> delivered = delivery.dispatch(result,
                pref.getKeycloakId(), pref.getOrganizationId(), channels);

        if (delivered.isEmpty()) {
            entry.setErrorMessage("retry: still no channel delivered");
            logRepository.save(entry);
            return false;
        }

        entry.setStatusEnum(AssistantBriefingLog.Status.SENT);
        entry.setErrorMessage(null);
        entry.setChannels(serializeChannelsSafe(delivered));
        logRepository.save(entry);
        return true;
    }

    private String serializeChannelsSafe(List<String> channels) {
        if (channels == null || channels.isEmpty()) return "[]";
        try { return objectMapper.writeValueAsString(channels); }
        catch (JsonProcessingException e) { return "[]"; }
    }
}
