package com.clenzy.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Vocabulaire des faits attaches a une notification, et le petit constructeur
 * qui va avec.
 *
 * <p>Les cles sont declarees ICI et nulle part ailleurs : l'interface ne sait
 * afficher que celles qu'elle connait (cf. {@code notificationMeta.tsx} cote
 * client), et une cle inventee au fil de l'eau serait simplement ignoree a
 * l'ecran. Ajouter un fait, c'est donc trois gestes : une constante ici, une
 * entree dans la table du client, un libelle dans les trois locales.</p>
 *
 * <p>Regle d'emission : n'y mettre que ce que l'emetteur a DEJA sous la main.
 * Une metadonnee ne vaut pas une requete supplementaire — surtout dans les
 * boucles de scan, ou elle se paierait une fois par ligne.</p>
 *
 * <p>Deux natures cohabitent : les faits d'AFFICHAGE (logement, voyageur,
 * montant...) et les reperes de NAVIGATION (identifiants de logement, de
 * reservation, type d'action proposee) qui permettent a la fiche de mener au
 * bon endroit — meme nature que l'{@code actionUrl}, dont l'ecran d'arrivee
 * re-autorise l'acces.</p>
 *
 * <p>Ce que ces faits ne sont PAS : une source d'autorisation, une facon de
 * designer un tenant, un endroit ou deposer un secret ou une donnee de contact.
 * Aucun code serveur ne decide de quoi que ce soit d'apres eux.</p>
 */
public final class NotificationMetadata {

    /** Nom du logement concerne. */
    public static final String PROPERTY = "property";
    /** Nom du voyageur concerne. */
    public static final String GUEST = "guest";
    /** Reference lisible de la reservation (code de confirmation). */
    public static final String RESERVATION_REFERENCE = "reservationReference";
    /** Date d'arrivee, au format ISO (yyyy-MM-dd). */
    public static final String CHECK_IN = "checkIn";
    /** Date de depart, au format ISO (yyyy-MM-dd). */
    public static final String CHECK_OUT = "checkOut";
    /** Montant, en unite majeure (euros, pas centimes). Va de pair avec {@link #CURRENCY}. */
    public static final String AMOUNT = "amount";
    /** Code ISO de la devise du montant (EUR, MAD...). */
    public static final String CURRENCY = "currency";
    /** Canal d'origine ou d'envoi (Airbnb, Booking.com, EMAIL, WHATSAPP...). */
    public static final String CHANNEL = "channel";
    /** Intitule du modele de message utilise. */
    public static final String TEMPLATE = "template";
    /** Intitule de l'intervention concernee. */
    public static final String INTERVENTION = "intervention";
    /** Motif d'echec, tel que rendu par le fournisseur. */
    public static final String ERROR = "error";
    /** Intitule de la demande de service concernee. */
    public static final String REQUEST = "request";
    /** Personne a qui la mission est confiee. */
    public static final String ASSIGNEE = "assignee";
    /** Echeance, au format ISO (yyyy-MM-dd). */
    public static final String DUE_DATE = "dueDate";
    /** Intitule du document concerne. */
    public static final String DOCUMENT = "document";
    /** Note d'un avis voyageur, sur 5. */
    public static final String RATING = "rating";
    /** Niveau sonore mesure, en decibels. Va de pair avec {@link #NOISE_THRESHOLD_DB}. */
    public static final String NOISE_DB = "noiseDb";
    /** Seuil de declenchement de l'alerte bruit, en decibels. */
    public static final String NOISE_THRESHOLD_DB = "noiseThresholdDb";

    // ─── Reperes de navigation (memes garanties que l'actionUrl) ─────────────

    /** Logement concerne — cible des liens de la fiche. */
    public static final String PROPERTY_ID = "propertyId";
    /** Reservation concernee. */
    public static final String RESERVATION_ID = "reservationId";
    /** Intervention concernee. */
    public static final String INTERVENTION_ID = "interventionId";
    /** Demande de service concernee — la fiche va y lire le devis et l'echeance. */
    public static final String SERVICE_REQUEST_ID = "serviceRequestId";
    /** Signalement terrain concerne — la fiche va y lire la gravite et les photos. */
    public static final String ISSUE_ID = "issueId";
    /** Carte HITL a l'origine de la notification. */
    public static final String SUGGESTION_ID = "suggestionId";
    /** Agent de la constellation ayant produit la carte (ops, fin, rev...). */
    public static final String MODULE = "module";
    /** Type d'action proposee par la carte — nomme le geste dans la fiche. */
    public static final String ACTION_TYPE = "actionType";
    /** Avis voyageur concerne — la fiche va y lire la note, le canal et le texte. */
    public static final String REVIEW_ID = "reviewId";
    /** Objet connecte concerne (serrure, capteur) — la fiche va y lire son etat. */
    public static final String DEVICE_ID = "deviceId";

    private NotificationMetadata() {}

    public static Builder of() {
        return new Builder();
    }

    /**
     * Assemble les faits en ignorant les valeurs absentes — un emetteur ecrit
     * la meme chaine d'appels qu'il connaisse ou non le voyageur.
     */
    public static final class Builder {
        private final Map<String, Object> facts = new LinkedHashMap<>();

        private Builder put(String key, Object value) {
            if (value != null && !(value instanceof String s && s.isBlank())) {
                facts.put(key, value);
            }
            return this;
        }

        public Builder property(String name) { return put(PROPERTY, name); }
        public Builder guest(String name) { return put(GUEST, name); }
        public Builder reservationReference(String reference) { return put(RESERVATION_REFERENCE, reference); }
        public Builder stay(LocalDate checkIn, LocalDate checkOut) {
            put(CHECK_IN, checkIn != null ? checkIn.toString() : null);
            return put(CHECK_OUT, checkOut != null ? checkOut.toString() : null);
        }
        public Builder amount(BigDecimal value, String currency) {
            put(AMOUNT, value);
            return put(CURRENCY, value != null ? currency : null);
        }
        public Builder channel(String channel) { return put(CHANNEL, channel); }
        public Builder template(String template) { return put(TEMPLATE, template); }
        public Builder intervention(String title) { return put(INTERVENTION, title); }
        public Builder error(String message) { return put(ERROR, message); }
        public Builder request(String title) { return put(REQUEST, title); }
        public Builder assignee(String name) { return put(ASSIGNEE, name); }
        public Builder dueDate(LocalDate date) { return put(DUE_DATE, date != null ? date.toString() : null); }
        public Builder document(String name) { return put(DOCUMENT, name); }
        public Builder rating(Integer stars) { return put(RATING, stars); }

        /**
         * Mesure et seuil d'une alerte bruit. Les deux ensemble : « 78 dB » ne
         * dit rien sans le seuil qu'il depasse, et un seuil seul n'est pas un
         * evenement.
         */
        public Builder noise(Double measuredDb, Integer thresholdDb) {
            put(NOISE_DB, measuredDb);
            return put(NOISE_THRESHOLD_DB, thresholdDb);
        }

        public Builder propertyId(Long id) { return put(PROPERTY_ID, id); }
        public Builder reservationId(Long id) { return put(RESERVATION_ID, id); }
        public Builder interventionId(Long id) { return put(INTERVENTION_ID, id); }
        public Builder serviceRequestId(Long id) { return put(SERVICE_REQUEST_ID, id); }
        public Builder issueId(Long id) { return put(ISSUE_ID, id); }
        public Builder reviewId(Long id) { return put(REVIEW_ID, id); }
        public Builder deviceId(Long id) { return put(DEVICE_ID, id); }

        /** Repere d'une carte HITL : d'ou elle vient, et quel geste elle propose. */
        public Builder supervision(Long suggestionId, String module, String actionType) {
            put(SUGGESTION_ID, suggestionId);
            put(MODULE, module);
            return put(ACTION_TYPE, actionType);
        }

        /** {@code null} quand rien n'a ete renseigne : pas de colonne remplie pour rien. */
        public Map<String, Object> build() {
            return facts.isEmpty() ? null : facts;
        }
    }
}
