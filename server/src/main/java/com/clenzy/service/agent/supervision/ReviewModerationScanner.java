package com.clenzy.service.agent.supervision;

import com.clenzy.model.GuestReview;
import com.clenzy.model.Property;
import com.clenzy.repository.GuestReviewRepository;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Scanner de RÉPUTATION déterministe (module « rep ») : pour un logement donné,
 * détecte les avis reçus avec une note ≤ 2/5 <b>non encore traités</b> (aucune
 * réponse hôte) et pousse une carte HITL « Avis négatif à modérer » dans la file
 * de suggestions de la constellation.
 *
 * <p>Aucun coût token (heuristique pure, pas de LLM). Best-effort : toute erreur
 * est absorbée (jamais sur le chemin critique d'un scan). Dédupliqué par intitulé
 * côté {@link SupervisionSuggestionService} : le titre porte l'identifiant de
 * l'avis → un scan répété ne reduplique pas la même carte, mais chaque avis négatif
 * distinct produit sa propre carte.</p>
 *
 * <p>La date de l'avis affichée dans le motif est formatée dans la timezone de la
 * propriété ({@link Property#getTimezone()}, repli {@code Europe/Paris}).</p>
 */
@Service
public class ReviewModerationScanner {

    private static final Logger log = LoggerFactory.getLogger(ReviewModerationScanner.class);

    /**
     * Note (incluse) en dessous de laquelle un avis est jugé négatif. Ne décide
     * plus de l'ÉLIGIBILITÉ — tout avis sans réponse mérite qu'on lui en propose
     * une — mais seulement du TON de la carte : modérer un mécontentement n'est
     * pas remercier un client satisfait.
     */
    static final int NEGATIVE_RATING_MAX = 2;
    /** Repli de timezone quand la propriété n'en déclare pas (règle projet). */
    private static final ZoneId DEFAULT_ZONE = ZoneId.of("Europe/Paris");
    /** Date de l'avis affichée à l'humain (ex. « 8 juil. 2026 »). */
    private static final DateTimeFormatter REVIEW_DATE_FMT =
            DateTimeFormatter.ofPattern("d MMM yyyy", Locale.FRENCH);

    private final GuestReviewRepository reviewRepository;
    private final PropertyRepository propertyRepository;
    private final SupervisionSuggestionService suggestionService;
    private final AutoApplyGate autoApplyGate;
    private final SupervisionAutoApplyService autoApplyService;

    public ReviewModerationScanner(GuestReviewRepository reviewRepository,
                                   PropertyRepository propertyRepository,
                                   SupervisionSuggestionService suggestionService,
                                   AutoApplyGate autoApplyGate,
                                   SupervisionAutoApplyService autoApplyService) {
        this.reviewRepository = reviewRepository;
        this.propertyRepository = propertyRepository;
        this.suggestionService = suggestionService;
        this.autoApplyGate = autoApplyGate;
        this.autoApplyService = autoApplyService;
    }

    /**
     * Émet une carte HITL par avis non traité du logement, <b>quelle que soit la
     * note</b>. Un avis élogieux laissé sans réponse est une occasion manquée, pas
     * un non-sujet : la carte « À traiter » du tableau de bord les liste tous, et
     * l'agent doit couvrir le même périmètre — sans quoi l'hôte voit une
     * proposition sur certains avis et rien sur les autres, sans comprendre
     * pourquoi.
     *
     * <p>Chaque avis porte un {@code organizationId} + {@code propertyId} (colonnes
     * NOT NULL de {@code guest_reviews}) : la carte est toujours rattachable à une
     * constellation. Le budget d'appels LLM reste plafonné par {@code AutoApplyGate} ;
     * l'ordre de la requête (plus mal notés d'abord) décide de qui est servi
     * lorsqu'il s'épuise.</p>
     */
    public void scanProperty(Long orgId, Long propertyId) {
        try {
            List<GuestReview> untreated = reviewRepository
                    .findUntreatedByPropertyId(propertyId, orgId);
            if (untreated.isEmpty()) {
                return;
            }
            final ZoneId zone = resolveZone(propertyId, orgId);
            for (GuestReview review : untreated) {
                emitModeration(orgId, propertyId, review, zone);
            }
        } catch (Exception e) {
            log.debug("review moderation scan failed org={} property={}: {}",
                    orgId, propertyId, e.getMessage());
        }
    }

    private void emitModeration(Long orgId, Long propertyId, GuestReview review, ZoneId zone) {
        // Un avis sans note connue est traité comme neutre, pas comme négatif :
        // rien ne justifie d'annoncer un mécontentement qu'on n'a pas constaté.
        final boolean negative = review.getRating() != null
                && review.getRating() <= NEGATIVE_RATING_MAX;

        // Titre STABLE incluant l'ID de l'avis → dédup fiable ET une carte par avis
        // distinct (deux avis = deux cartes ; re-scan = pas de doublon).
        final String title = (negative ? "Avis négatif à modérer" : "Avis sans réponse")
                + " — avis #" + review.getId();

        final String reviewDate = review.getReviewDate() != null
                ? REVIEW_DATE_FMT.format(review.getReviewDate())
                : "date inconnue";
        final String channel = review.getChannelName() != null
                ? review.getChannelName().name() : "canal inconnu";
        final String guest = review.getGuestName() != null && !review.getGuestName().isBlank()
                ? review.getGuestName() : "voyageur";

        final StringBuilder motif = new StringBuilder()
                .append("Avis ")
                .append(review.getRating() != null ? review.getRating() + "/5" : "sans note")
                .append(" de ").append(guest)
                .append(" le ").append(reviewDate)
                .append(" (").append(channel).append("), sans réponse hôte. ");
        if (review.getReviewText() != null && !review.getReviewText().isBlank()) {
            motif.append("« ").append(excerpt(review.getReviewText())).append(" » ");
        }
        // L'enjeu n'est pas le même selon la note : on limite un dommage d'un côté,
        // on entretient une relation de l'autre. Annoncer « impact réputationnel »
        // sur un avis élogieux ferait mentir la carte.
        motif.append(negative
                ? "Rédiger une réponse publique pour limiter l'impact réputationnel."
                : "Rédiger une réponse publique : un avis positif sans réponse est une occasion manquée.");

        // Timezone de la propriété résolue (repli Europe/Paris) : conservée pour un
        // usage éventuel d'affichage ; la date de l'avis étant journalière, elle ne
        // change pas l'éligibilité — la note et l'absence de réponse en décident.
        // Carte APPLICABLE (« Générer un brouillon de réponse ») : l'apply génère un brouillon
        // LLM (host_response_draft), jamais publié — l'opérateur valide/édite/publie ensuite.
        final String params = String.format("{\"reviewId\":%d}", review.getId());
        // Vague 1 autonomie : le gate décide HITL vs auto (enveloppe = budget premium OK,
        // vérifié à l'étape 5 du gate — la génération du brouillon consomme des crédits LLM).
        // En AUTO_*, la GÉNÉRATION du brouillon est auto-appliquée via le pipeline d'apply
        // (effet externe hors transaction, compensation si échec) ; la PUBLICATION de la
        // réponse reste manuelle dans tous les cas.
        final AutoApplyGate.AutoDecision decision = autoApplyGate.decide(
                orgId, "rep", SupervisionActionType.REVIEW_DRAFT_REPLY, java.util.Map.of());
        final boolean auto = decision == AutoApplyGate.AutoDecision.AUTO_NOTIFY
                || decision == AutoApplyGate.AutoDecision.AUTO_SILENT;
        if (!auto) {
            suggestionService.recordActionable(orgId, propertyId, "rep", title, motif.toString(),
                    SupervisionActionType.REVIEW_DRAFT_REPLY, params, null, "warning");
            return;
        }
        suggestionService.recordActionableForAutoApply(orgId, propertyId, "rep", null,
                        title, motif.toString(), SupervisionActionType.REVIEW_DRAFT_REPLY,
                        params, null, "warning")
                .ifPresent(suggestionId -> autoApplyService.autoApply(
                        decision, orgId, propertyId, "rep", suggestionId, title, motif.toString(), null));
    }

    /** Timezone de la propriété (repli Europe/Paris) — findById org-validé. */
    private ZoneId resolveZone(Long propertyId, Long orgId) {
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null || !orgId.equals(property.getOrganizationId())) {
            return DEFAULT_ZONE;
        }
        String tz = property.getTimezone();
        if (tz == null || tz.isBlank()) {
            return DEFAULT_ZONE;
        }
        try {
            return ZoneId.of(tz);
        } catch (Exception e) {
            return DEFAULT_ZONE;
        }
    }

    private static String excerpt(String text) {
        String trimmed = text.strip();
        return trimmed.length() <= 140 ? trimmed : trimmed.substring(0, 140) + "…";
    }
}
