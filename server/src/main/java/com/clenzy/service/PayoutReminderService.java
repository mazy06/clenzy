package com.clenzy.service;

import com.clenzy.dto.PayoutReminderDto;
import com.clenzy.dto.PayoutScheduleConfigDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Optional;

/**
 * Rappel « J-1 » de génération d'un lot de reversement propriétaire.
 *
 * <p>Calculé à la volée (pas de scheduler) quand la constellation charge :
 * si la génération automatique est activée et que <b>demain</b> est un jour de
 * reversement configuré (Paramètres &gt; Reversements), on expose une carte de
 * rappel dans le Superviseur (module Finance).</p>
 *
 * <p>Purement informatif : la carte ne déclenche ni ne valide aucun virement —
 * l'approbation reste dans Facturation &gt; Reversements. Deux actions par
 * utilisateur, persistées dans {@code user_ui_preferences} (clé
 * {@value #PREF_KEY}) : « Info reçue » (accusé de l'échéance courante) et
 * « Ne plus afficher » (opt-out définitif du rappel J-1).</p>
 *
 * <p>Le jour-1 est géré nativement : le rappel se déclenche quand
 * {@code demain.getDayOfMonth()} est dans les jours configurés — pour un jour 1,
 * « demain » tombe le 1er donc le rappel s'affiche le dernier jour du mois précédent.
 * Les jours sont bornés 1-28 par la config, donc pas de dérive de fin de mois.</p>
 */
@Service
public class PayoutReminderService {

    private static final Logger log = LoggerFactory.getLogger(PayoutReminderService.class);

    /** Clé de préférence utilisateur : {@code {"optOut": bool, "ackedDate": "YYYY-MM-DD"}}. */
    static final String PREF_KEY = "payout_reminder";

    private static final DateTimeFormatter FR_DATE =
            DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.FRENCH);

    private final PayoutScheduleService payoutScheduleService;
    private final UserUiPreferencesService userPreferences;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public PayoutReminderService(PayoutScheduleService payoutScheduleService,
                                 UserUiPreferencesService userPreferences,
                                 ObjectMapper objectMapper,
                                 Clock clock) {
        this.payoutScheduleService = payoutScheduleService;
        this.userPreferences = userPreferences;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /**
     * Rappel J-1 à afficher pour l'utilisateur courant, ou vide si aucune condition
     * n'est réunie (pas de config / auto-gen off / demain n'est pas un jour de
     * reversement / opt-out / déjà accusé pour cette échéance).
     */
    public Optional<PayoutReminderDto> currentReminder(String keycloakId) {
        Optional<PayoutScheduleConfigDto> configOpt = payoutScheduleService.getScheduleConfig();
        if (configOpt.isEmpty()) {
            return Optional.empty();
        }
        PayoutScheduleConfigDto config = configOpt.get();
        if (!config.autoGenerateEnabled()
                || config.payoutDaysOfMonth() == null
                || config.payoutDaysOfMonth().isEmpty()) {
            return Optional.empty();
        }

        LocalDate tomorrow = LocalDate.now(clock).plusDays(1);
        if (!config.payoutDaysOfMonth().contains(tomorrow.getDayOfMonth())) {
            return Optional.empty();
        }

        Pref pref = readPref(keycloakId);
        if (pref.optOut() || tomorrow.equals(pref.ackedDate())) {
            return Optional.empty();
        }

        String id = "payout-reminder-" + tomorrow;
        String title = "Un reversement sera généré demain";
        String motif = "Génération automatique planifiée le " + tomorrow.format(FR_DATE);
        String reasoning = "Selon ta planification (Paramètres > Reversements), un lot de "
                + "reversement propriétaire sera généré demain et attendra ton approbation dans "
                + "Facturation > Reversements. Ce rappel est purement informatif : il ne déclenche "
                + "ni ne valide aucun virement.";
        return Optional.of(new PayoutReminderDto(id, title, motif, reasoning, tomorrow));
    }

    /** « Info reçue » : accuse l'échéance courante (demain) → la carte disparaît jusqu'à la prochaine. */
    public void acknowledge(String keycloakId) {
        Pref current = readPref(keycloakId);
        writePref(keycloakId, current.optOut(), LocalDate.now(clock).plusDays(1));
    }

    /** « Ne plus afficher » : opt-out définitif du rappel J-1 pour cet utilisateur. */
    public void optOut(String keycloakId) {
        Pref current = readPref(keycloakId);
        writePref(keycloakId, true, current.ackedDate());
    }

    // ─── Préférence utilisateur (JSONB user_ui_preferences) ──────────────────

    private record Pref(boolean optOut, LocalDate ackedDate) {}

    private Pref readPref(String keycloakId) {
        JsonNode node = userPreferences.getAllForUser(keycloakId).get(PREF_KEY);
        if (node == null || node.isNull()) {
            return new Pref(false, null);
        }
        boolean optOut = node.path("optOut").asBoolean(false);
        LocalDate acked = null;
        String ackedStr = node.path("ackedDate").asText(null);
        if (ackedStr != null && !ackedStr.isBlank()) {
            try {
                acked = LocalDate.parse(ackedStr);
            } catch (Exception e) {
                log.debug("payout_reminder.ackedDate invalide '{}' — ignore", ackedStr);
            }
        }
        return new Pref(optOut, acked);
    }

    private void writePref(String keycloakId, boolean optOut, LocalDate ackedDate) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("optOut", optOut);
        if (ackedDate != null) {
            node.put("ackedDate", ackedDate.toString());
        }
        try {
            userPreferences.upsert(keycloakId, PREF_KEY, objectMapper.writeValueAsString(node));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Sérialisation préférence payout_reminder impossible", e);
        }
    }
}
