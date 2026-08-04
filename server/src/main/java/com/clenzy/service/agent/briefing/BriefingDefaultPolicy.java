package com.clenzy.service.agent.briefing;

import com.clenzy.model.AssistantBriefingPref;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;

/**
 * Politique de briefing appliquee aux utilisateurs qui n'ont AUCUNE preference
 * enregistree.
 *
 * <p><b>Pourquoi elle existe.</b> Les reglages IA ne sont pas exposes aux
 * utilisateurs de l'organisation — seule l'equipe plateforme y accede. Sans
 * politique par defaut, la table {@code assistant_briefing_pref} restait vide et
 * le scheduler ne trouvait donc jamais personne : la synthese hebdomadaire
 * existait dans le code sans jamais partir. La politique rend le service
 * fonctionnel sans rien demander a l'utilisateur.</p>
 *
 * <p><b>Ce qu'elle ne fait pas.</b> Elle ne cree aucune ligne en base : elle
 * fabrique un objet {@link AssistantBriefingPref} TRANSIENT, le temps d'un tick
 * de scheduler. Une preference enregistree — meme desactivee — l'emporte
 * toujours : un utilisateur qui a dit non ne se voit pas re-abonner au prochain
 * deploiement.</p>
 *
 * <p>Reglages ({@code application.yml}, prefixe
 * {@code clenzy.assistant.briefing.default}) : {@code enabled}, {@code frequency},
 * {@code time}, {@code channels}, {@code timezone} (repli).</p>
 */
@Component
public class BriefingDefaultPolicy {

    private static final Logger log = LoggerFactory.getLogger(BriefingDefaultPolicy.class);

    private static final LocalTime FALLBACK_TIME = LocalTime.of(8, 0);
    private static final String FALLBACK_TIMEZONE = "Europe/Paris";

    private final boolean enabled;
    private final AssistantBriefingPref.Frequency frequency;
    private final LocalTime timeLocal;
    private final List<String> channels;
    private final String fallbackTimezone;

    public BriefingDefaultPolicy(
            @Value("${clenzy.assistant.briefing.default.enabled:true}") boolean enabled,
            @Value("${clenzy.assistant.briefing.default.frequency:weekly_sunday}") String frequency,
            @Value("${clenzy.assistant.briefing.default.time:08:00}") String time,
            @Value("${clenzy.assistant.briefing.default.channels:in_app}") String channels,
            @Value("${clenzy.assistant.briefing.default.timezone:" + FALLBACK_TIMEZONE + "}") String timezone) {
        this.enabled = enabled;
        this.frequency = AssistantBriefingPref.Frequency.fromString(frequency);
        this.timeLocal = parseTimeOrFallback(time);
        this.channels = parseChannels(channels);
        this.fallbackTimezone = validZoneOrFallback(timezone);
    }

    /** La politique par defaut est-elle active ? Si non, seules les prefs enregistrees comptent. */
    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Fabrique la preference par defaut d'un destinataire eligible.
     *
     * @param keycloakId     utilisateur destinataire
     * @param organizationId organisation de rattachement (portee des donnees du briefing)
     * @param userTimezone   fuseau de l'utilisateur ({@code user_preferences}), null si inconnu
     * @return une preference NON persistee, prete pour le scheduler
     */
    public AssistantBriefingPref buildFor(String keycloakId, Long organizationId, String userTimezone) {
        AssistantBriefingPref pref = new AssistantBriefingPref(organizationId, keycloakId);
        pref.setEnabled(true);
        pref.setFrequencyEnum(frequency);
        pref.setTimeLocal(timeLocal);
        pref.setTimezone(validZoneOrFallback(userTimezone));
        pref.setChannels(serializeChannels());
        return pref;
    }

    /** Canaux de la politique — expose pour le rendu du recapitulatif plateforme. */
    public List<String> channels() {
        return channels;
    }

    public AssistantBriefingPref.Frequency frequency() {
        return frequency;
    }

    public LocalTime timeLocal() {
        return timeLocal;
    }

    private String serializeChannels() {
        // Tableau JSON minimal — la colonne est un jsonb de chaines simples, et
        // AssistantBriefingPrefService.parseChannels re-valide la liste blanche.
        return channels.stream()
                .map(c -> "\"" + c + "\"")
                .reduce((a, b) -> a + "," + b)
                .map(joined -> "[" + joined + "]")
                .orElse("[\"in_app\"]");
    }

    private static LocalTime parseTimeOrFallback(String raw) {
        if (raw == null || raw.isBlank()) return FALLBACK_TIME;
        try {
            return LocalTime.parse(raw.trim());
        } catch (DateTimeParseException e) {
            log.warn("Politique de briefing : heure '{}' invalide — repli sur {}", raw, FALLBACK_TIME);
            return FALLBACK_TIME;
        }
    }

    private static List<String> parseChannels(String raw) {
        if (raw == null || raw.isBlank()) return List.of("in_app");
        List<String> parsed = Arrays.stream(raw.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(c -> !c.isEmpty())
                .toList();
        return parsed.isEmpty() ? List.of("in_app") : parsed;
    }

    private String validZoneOrFallback(String tz) {
        if (tz == null || tz.isBlank()) return fallbackOrParis();
        try {
            ZoneId.of(tz.trim());
            return tz.trim();
        } catch (Exception e) {
            log.debug("Politique de briefing : fuseau '{}' invalide — repli", tz);
            return fallbackOrParis();
        }
    }

    /** Le repli du repli : {@link #fallbackTimezone} n'est pas encore assigne dans le constructeur. */
    private String fallbackOrParis() {
        return fallbackTimezone != null ? fallbackTimezone : FALLBACK_TIMEZONE;
    }
}
