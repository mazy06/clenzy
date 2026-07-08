package com.clenzy.service.agent.concierge;

import com.clenzy.dto.ConversationAnalysisDto;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

/**
 * Classe le message guest pour décider si une réponse peut partir en AUTOMATIQUE
 * (C2). <b>Conservateur par conception</b> : un faux négatif (escalader un message
 * sûr) est sans conséquence ; un faux positif (auto-envoyer sur un sujet sensible)
 * est un risque de marque. On n'auto-envoie donc QUE sur une intention FAQ claire,
 * en l'absence de tout signal de risque — tout le reste est escaladé à l'humain.
 *
 * <p>Rules-based (déterministe, gratuit, testable). Un classifieur LLM plus fin
 * pourra le remplacer/compléter plus tard (C4) sans changer les appelants.</p>
 */
@Service
public class ConciergeIntentClassifier {

    /** Signaux de RISQUE → hard-stop, jamais d'auto-envoi (multilingue basique). */
    private static final List<String> RISK_KEYWORDS = List.of(
            "rembours", "refund", "chargeback", "annul", "cancel", "litige", "dispute",
            "plainte", "complaint", "avocat", "lawyer", "legal", "police", "urgent",
            "emergency", "cassé", "broken", "fuite", "leak", "insatisfait", "unhappy",
            "scandale", "arnaque", "scam", "dangereux", "danger");

    /**
     * Demandes à impact CROSS-DOMAINE (ops / revenue) : prolongation, nuit sup,
     * late checkout, early check-in. Jamais auto-envoyées — elles engageraient le
     * calendrier / un prestataire ; l'humain coordonne (C3). Testé AVANT la
     * whitelist FAQ (un « late checkout » contient « checkout » — sans ce
     * hard-stop il serait pris pour une simple question d'horaire).
     */
    private static final List<String> CROSS_DOMAIN_KEYWORDS = List.of(
            "nuit supplémentaire", "nuit de plus", "une nuit en plus", "extra night",
            "one more night", "another night", "prolonger", "prolongation", "extend",
            "rester plus", "stay longer", "late checkout", "late check-out",
            "départ tardif", "checkout tardif", "check-out tardif", "partir plus tard",
            "early check-in", "early checkin", "arrivée anticipée", "arriver plus tôt");

    /** Intentions FAQ whitelistées → auto-envoi possible (question d'info simple). */
    private static final List<String> FAQ_KEYWORDS = List.of(
            "wifi", "wi-fi", "code", "check-in", "checkin", "arrivée", "arrival",
            "check-out", "checkout", "départ", "heure", "what time", "quelle heure",
            "adresse", "address", "parking", "direction", "où se trouve", "where is",
            "comment aller", "how to get", "digicode", "clé", "key");

    /**
     * @param guestMessage dernier message du guest (déjà résolu par l'appelant)
     * @param analysis     sentiment + urgence (peut être {@code null})
     */
    public ConciergeDecision classify(String guestMessage, ConversationAnalysisDto analysis) {
        final String msg = guestMessage == null ? "" : guestMessage.toLowerCase(Locale.ROOT);

        final boolean risky = RISK_KEYWORDS.stream().anyMatch(msg::contains)
                || (analysis != null && (analysis.urgent() || isNegative(analysis)));
        if (risky) {
            return new ConciergeDecision(false, "risk_or_negative");
        }
        // Hard-stop cross-domaine AVANT la whitelist : jamais d'auto-envoi, coordination humaine.
        if (CROSS_DOMAIN_KEYWORDS.stream().anyMatch(msg::contains)) {
            return new ConciergeDecision(false, "cross_domain");
        }
        final boolean faq = FAQ_KEYWORDS.stream().anyMatch(msg::contains);
        return faq
                ? new ConciergeDecision(true, "faq")
                : new ConciergeDecision(false, "not_whitelisted");
    }

    private static boolean isNegative(ConversationAnalysisDto analysis) {
        return analysis.sentiment() != null
                && analysis.sentiment().toUpperCase(Locale.ROOT).contains("NEG");
    }
}
