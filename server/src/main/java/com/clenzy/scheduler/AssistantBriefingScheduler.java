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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

/**
 * Scheduler horaire des briefings proactifs.
 *
 * <p>Cron : toutes les heures pile ({@code "0 0 * * * *"}). Pour chaque user
 * dont la pref est activee, on resout l'heure locale dans sa timezone et on
 * declenche le briefing si :
 * <ul>
 *   <li>L'heure courante (locale) correspond a {@code timeLocal} (precision heure)</li>
 *   <li>La date n'a pas deja un log d'envoi (idempotence stricte : 1 par jour)</li>
 *   <li>La frequence matche le jour (weekly_sunday ne tire que le dimanche)</li>
 * </ul>
 *
 * <p>Chaque user est traite dans sa propre transaction (REQUIRES_NEW) — un
 * echec sur un user ne casse pas la boucle.</p>
 */
@Component
public class AssistantBriefingScheduler {

    private static final Logger log = LoggerFactory.getLogger(AssistantBriefingScheduler.class);

    private final AssistantBriefingPrefService prefService;
    private final BriefingComposer composer;
    private final BriefingDelivery delivery;
    private final AssistantBriefingLogRepository logRepository;
    private final ObjectMapper objectMapper;

    public AssistantBriefingScheduler(AssistantBriefingPrefService prefService,
                                        BriefingComposer composer,
                                        BriefingDelivery delivery,
                                        AssistantBriefingLogRepository logRepository,
                                        ObjectMapper objectMapper) {
        this.prefService = prefService;
        this.composer = composer;
        this.delivery = delivery;
        this.logRepository = logRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Cron horaire : examine toutes les prefs activees et lance les briefings
     * dont l'heure locale matche l'heure courante.
     */
    @Scheduled(cron = "0 0 * * * *")
    public void runHourly() {
        runFor(LocalDateTime.now(ZoneId.of("UTC")));
    }

    /**
     * Variante package-private pour les tests : permet d'injecter un "now"
     * deterministe et de verifier le matching TZ sans Threads.sleep.
     */
    void runFor(LocalDateTime utcNow) {
        List<AssistantBriefingPref> all;
        try {
            all = prefService.listAllEnabled();
        } catch (Exception e) {
            log.error("AssistantBriefingScheduler: lookup prefs failed", e);
            return;
        }
        if (all.isEmpty()) return;
        log.debug("AssistantBriefingScheduler tick : {} prefs activees", all.size());

        int triggered = 0;
        for (AssistantBriefingPref pref : all) {
            try {
                if (!shouldTrigger(pref, utcNow)) continue;
                processOne(pref);
                triggered++;
            } catch (Exception e) {
                log.warn("AssistantBriefingScheduler: erreur user {} : {}",
                        pref.getKeycloakId(), e.getMessage());
            }
        }
        if (triggered > 0) {
            log.info("AssistantBriefingScheduler tick : {} briefings declenches", triggered);
        }
    }

    /**
     * Matching TZ : convertit {@code utcNow} dans la timezone de l'user et
     * compare l'heure (sans minutes) au {@code timeLocal} configure.
     * Pour {@link AssistantBriefingPref.Frequency#WEEKLY_SUNDAY}, n'autorise que
     * le dimanche. Pour {@link AssistantBriefingPref.Frequency#ONLY_ALERTS},
     * meme cadence quotidienne — c'est le contenu qui decide si on envoie
     * (le prompt retourne "Aucune alerte" si rien a remonter).
     */
    boolean shouldTrigger(AssistantBriefingPref pref, LocalDateTime utcNow) {
        if (pref == null || !pref.isEnabled()) return false;
        ZoneId zone;
        try {
            zone = ZoneId.of(pref.getTimezone() != null ? pref.getTimezone() : "Europe/Paris");
        } catch (Exception e) {
            log.warn("Pref {} : timezone invalide '{}' — skip", pref.getId(), pref.getTimezone());
            return false;
        }
        LocalDateTime local = utcNow.atZone(ZoneId.of("UTC"))
                .withZoneSameInstant(zone)
                .toLocalDateTime();
        LocalTime currentLocalHour = local.toLocalTime().truncatedTo(ChronoUnit.HOURS);
        LocalTime targetHour = pref.getTimeLocal() != null
                ? pref.getTimeLocal().truncatedTo(ChronoUnit.HOURS)
                : LocalTime.of(8, 0);
        if (!currentLocalHour.equals(targetHour)) return false;

        // Filtre frequence
        AssistantBriefingPref.Frequency freq = pref.getFrequencyEnum();
        if (freq == AssistantBriefingPref.Frequency.WEEKLY_SUNDAY
                && local.getDayOfWeek() != DayOfWeek.SUNDAY) {
            return false;
        }
        return true;
    }

    /**
     * Traite un user dans une transaction dediee (REQUIRES_NEW) :
     * <ol>
     *   <li>Insert un log (avec status SENT par defaut) — la contrainte unique
     *       fait office de mutex naturel. Si insert echoue, c'est qu'on a deja
     *       envoye aujourd'hui.</li>
     *   <li>Compose le briefing via l'orchestrateur</li>
     *   <li>Dispatch sur les canaux configures</li>
     *   <li>Met a jour le log avec conversation_id + canaux delivres + status</li>
     * </ol>
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void processOne(AssistantBriefingPref pref) {
        LocalDate today = LocalDate.now(ZoneId.of(pref.getTimezone() != null
                ? pref.getTimezone() : "Europe/Paris"));

        // Garde-fou applicatif AVANT l'insert (evite le bruit dans les logs si
        // l'insert leve une violation de contrainte).
        Optional<AssistantBriefingLog> existing =
                logRepository.findByKeycloakIdAndBriefingDate(pref.getKeycloakId(), today);
        if (existing.isPresent()) {
            log.debug("Briefing deja envoye aujourd'hui pour user {} (date {})",
                    pref.getKeycloakId(), today);
            return;
        }

        AssistantBriefingLog logEntry = new AssistantBriefingLog(
                pref.getOrganizationId(),
                pref.getKeycloakId(),
                today,
                pref.getFrequencyEnum().dbValue());
        try {
            logEntry = logRepository.save(logEntry);
        } catch (DataIntegrityViolationException e) {
            // Course gagnee par un autre thread/instance — c'est OK, on skip
            log.debug("Briefing {} / {} race lost : deja en cours d'envoi",
                    pref.getKeycloakId(), today);
            return;
        }

        BriefingComposer.BriefingResult result = composer.compose(pref);
        if (result == null) {
            logEntry.setStatusEnum(AssistantBriefingLog.Status.FAILED);
            logEntry.setErrorMessage("BriefingComposer returned null");
            logRepository.save(logEntry);
            return;
        }

        List<String> channels = prefService.parseChannels(pref);
        List<String> delivered = delivery.dispatch(result, pref.getKeycloakId(),
                pref.getOrganizationId(), channels);

        logEntry.setConversationId(result.conversationId());
        logEntry.setChannels(serializeChannelsSafe(delivered));
        if (delivered.isEmpty()) {
            logEntry.setStatusEnum(AssistantBriefingLog.Status.SKIPPED);
            logEntry.setErrorMessage("Aucun canal delivre");
        } else {
            logEntry.setStatusEnum(AssistantBriefingLog.Status.SENT);
        }
        logRepository.save(logEntry);
    }

    private String serializeChannelsSafe(List<String> channels) {
        if (channels == null || channels.isEmpty()) return "[]";
        try { return objectMapper.writeValueAsString(channels); }
        catch (JsonProcessingException e) { return "[]"; }
    }
}
