package com.clenzy.scheduler;

import com.clenzy.model.AssistantBriefingLog;
import com.clenzy.model.AssistantBriefingPref;
import com.clenzy.model.NotificationKey;
import com.clenzy.repository.AssistantBriefingLogRepository;
import com.clenzy.service.NotificationPreferenceService;
import com.clenzy.service.agent.briefing.AssistantBriefingPrefService;
import com.clenzy.service.agent.briefing.BriefingComposer;
import com.clenzy.service.agent.briefing.BriefingDelivery;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.List;

/**
 * Scheduler horaire des briefings proactifs.
 *
 * <p>Cron : toutes les heures pile ({@code "0 0 * * * *"}). Pour chaque user
 * dont la pref EFFECTIVE est activee — enregistree, ou issue de la politique par
 * defaut appliquee aux proprietaires de logement (cf.
 * {@code BriefingDefaultPolicy}) — on resout l'heure locale dans sa timezone et
 * on declenche le briefing si :
 * <ul>
 *   <li>L'instant cible de la periode est PASSE : {@code timeLocal} du jour pour
 *       une frequence quotidienne, {@code timeLocal} du dimanche ecoule pour la
 *       synthese hebdomadaire</li>
 *   <li>Aucun log d'envoi n'existe sur cette periode (idempotence : 1 par
 *       periode, pas 1 par tick)</li>
 * </ul>
 *
 * <p>La periode, et non l'heure pile : un tick manque — serveur arrete, deploiement,
 * poste de dev eteint le dimanche matin — se rattrape au tick suivant au lieu de
 * perdre la semaine en silence.</p>
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
    /** Preferences de notification — porte le desabonnement. Nullable (tests legacy). */
    private final NotificationPreferenceService preferenceService;

    @org.springframework.beans.factory.annotation.Autowired
    public AssistantBriefingScheduler(AssistantBriefingPrefService prefService,
                                        BriefingComposer composer,
                                        BriefingDelivery delivery,
                                        AssistantBriefingLogRepository logRepository,
                                        ObjectMapper objectMapper,
                                        NotificationPreferenceService preferenceService) {
        this.prefService = prefService;
        this.composer = composer;
        this.delivery = delivery;
        this.logRepository = logRepository;
        this.objectMapper = objectMapper;
        this.preferenceService = preferenceService;
    }

    /** Constructeur historique — sans garde de desabonnement. */
    public AssistantBriefingScheduler(AssistantBriefingPrefService prefService,
                                        BriefingComposer composer,
                                        BriefingDelivery delivery,
                                        AssistantBriefingLogRepository logRepository,
                                        ObjectMapper objectMapper) {
        this(prefService, composer, delivery, logRepository, objectMapper, null);
    }

    /**
     * Cron horaire : examine toutes les prefs activees et lance les briefings
     * dont l'heure locale matche l'heure courante.
     */
    @Scheduled(cron = "0 0 * * * *")
    @SchedulerLock(name = "assistant-briefing-hourly", lockAtMostFor = "PT30M")
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
            all = prefService.listEffectivePrefs();
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
                processOne(pref, utcNow);
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
     * L'instant cible de la periode courante est-il passe ?
     *
     * <p>Convertit {@code utcNow} dans la timezone de l'user, puis le compare a
     * {@code timeLocal} pose sur le debut de periode : le jour meme pour une
     * frequence quotidienne, le dimanche ecoule pour la synthese hebdomadaire.
     * Pour {@link AssistantBriefingPref.Frequency#ONLY_ALERTS}, meme cadence
     * quotidienne — c'est le contenu qui decide si on envoie (le prompt retourne
     * "Aucune alerte" si rien a remonter).</p>
     *
     * <p><b>Au moins, et non exactement.</b> La comparaison etait une egalite
     * d'heure : le briefing ne partait que si le tick tombait PILE sur l'heure
     * cible. Un serveur arrete a ce moment-la — un deploiement, un poste de dev
     * eteint le dimanche matin — perdait la periode entiere en silence : le
     * retry ne reprend que les logs {@code FAILED}, et un tick qui n'a jamais eu
     * lieu n'en laisse aucun. On declenche donc des que l'instant cible est
     * passe ; c'est {@link #processOne} qui refuse le second envoi d'une meme
     * periode.</p>
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
        LocalTime targetHour = pref.getTimeLocal() != null
                ? pref.getTimeLocal().truncatedTo(ChronoUnit.HOURS)
                : LocalTime.of(8, 0);
        LocalDateTime periodTarget =
                periodStart(pref.getFrequencyEnum(), local.toLocalDate()).atTime(targetHour);
        return !local.isBefore(periodTarget);
    }

    /**
     * Debut de la periode couverte par une frequence, dans le calendrier local :
     * le dimanche ecoule (ou le jour meme s'il EST dimanche) pour l'hebdomadaire,
     * le jour meme pour les frequences quotidiennes.
     *
     * <p>C'est la borne d'idempotence du briefing : un envoi par periode, pas un
     * par tick. Package-private pour les tests.</p>
     */
    static LocalDate periodStart(AssistantBriefingPref.Frequency frequency, LocalDate localDate) {
        if (frequency == AssistantBriefingPref.Frequency.WEEKLY_SUNDAY) {
            return localDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.SUNDAY));
        }
        return localDate;
    }

    /**
     * Traite un user dans une transaction dediee (REQUIRES_NEW) :
     * <ol>
     *   <li>Insert un log (avec status SENT par defaut) — la contrainte unique
     *       fait office de mutex naturel. Si insert echoue, c'est qu'on a deja
     *       envoye sur la periode.</li>
     *   <li>Compose le briefing via l'orchestrateur</li>
     *   <li>Dispatch sur les canaux configures</li>
     *   <li>Met a jour le log avec conversation_id + canaux delivres + status</li>
     * </ol>
     */
    /**
     * <b>Limitation connue</b> : la transaction reste ouverte pendant
     * {@code composer.compose(pref)} qui appelle le LLM (10-30s) et
     * {@code delivery.dispatch(...)} (emails / WhatsApp). Sur un pool Hikari
     * par defaut de 10 connexions, 10 users au meme tick peuvent saturer le
     * pool. Acceptable au volume actuel (~quelques users a la fois), a revoir
     * si la base d'utilisateurs avec briefing depasse plusieurs centaines :
     * le refactor consiste a sortir compose + dispatch HORS tx et entourer
     * uniquement les INSERT/UPDATE du log dans des REQUIRES_NEW dedies via
     * TransactionTemplate ou self-reference Spring.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void processOne(AssistantBriefingPref pref, LocalDateTime utcNow) {
        // La date vient de l'instant du tick, pas de l'horloge : sans quoi la
        // periode evaluee ici pourrait differer de celle qu'a vue shouldTrigger
        // — un tick de 23h qui bascule de jour entre les deux appels.
        LocalDate today = utcNow.atZone(ZoneId.of("UTC"))
                .withZoneSameInstant(ZoneId.of(pref.getTimezone() != null
                        ? pref.getTimezone() : "Europe/Paris"))
                .toLocalDate();

        // Garde-fou applicatif AVANT l'insert (evite le bruit dans les logs si
        // l'insert leve une violation de contrainte). La borne est la PERIODE, pas
        // la journee : un rattrapage du mardi ne doit pas re-partir le mercredi
        // sous pretexte que la date a change.
        LocalDate periodStart = periodStart(pref.getFrequencyEnum(), today);
        if (logRepository.existsByKeycloakIdAndBriefingDateGreaterThanEqual(
                pref.getKeycloakId(), periodStart)) {
            log.debug("Briefing deja envoye sur la periode ouverte le {} pour user {}",
                    periodStart, pref.getKeycloakId());
            return;
        }

        // Desabonnement : si AUCUN canal demande n'est encore ecoute par
        // l'utilisateur, on s'arrete AVANT de composer. Sans cette garde,
        // NotificationService jetait bien la notification desactivee, mais le
        // briefing avait deja ete genere : appel LLM facture et conversation
        // « Weekly review » empilee dans un historique que personne ne lit. Le
        // desabonnement n'aurait masque que la partie visible.
        List<String> channels = prefService.parseChannels(pref);
        if (isFullyMuted(pref.getKeycloakId(), channels)) {
            log.debug("Briefing {} : tous les canaux sont coupes — aucun run declenche",
                    pref.getKeycloakId());
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

    /**
     * L'utilisateur a-t-il coupe TOUS les canaux demandes ?
     *
     * <p>Seul {@code in_app} est reellement debrayable par l'utilisateur, via la
     * cle {@link com.clenzy.model.NotificationKey#BRIEFING_READY} de ses
     * preferences de notification. Email et WhatsApp n'ont pas d'interrupteur
     * dedie : leur presence dans les canaux suffit a maintenir le briefing —
     * on ne coupe donc que si {@code in_app} est le seul canal ET qu'il est
     * desactive.</p>
     *
     * <p>En cas d'erreur de lecture des preferences, on repond {@code false} :
     * mieux vaut un briefing de trop qu'un desabonnement silencieux provoque
     * par une panne de base.</p>
     */
    boolean isFullyMuted(String keycloakId, List<String> channels) {
        if (preferenceService == null || channels == null || channels.isEmpty()) return false;
        boolean onlyInApp = channels.stream().allMatch(BriefingDelivery.CHANNEL_IN_APP::equals);
        if (!onlyInApp) return false;
        try {
            return !preferenceService.isEnabled(keycloakId, NotificationKey.BRIEFING_READY);
        } catch (Exception e) {
            log.warn("Preferences de notification illisibles pour {} : {} — briefing maintenu",
                    keycloakId, e.getMessage());
            return false;
        }
    }

    private String serializeChannelsSafe(List<String> channels) {
        if (channels == null || channels.isEmpty()) return "[]";
        try { return objectMapper.writeValueAsString(channels); }
        catch (JsonProcessingException e) { return "[]"; }
    }
}
