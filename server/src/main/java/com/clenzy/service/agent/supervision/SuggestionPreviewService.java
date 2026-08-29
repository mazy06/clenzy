package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SuggestionPreviewDto;
import com.clenzy.model.Guest;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ManagementContractRepository;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Aperçu de ce qu'une carte va envoyer, avant de l'envoyer.
 *
 * <p>Les cartes de la famille « relecture » adressent un texte à un voyageur, un
 * propriétaire ou un fournisseur. Le destinataire et le contenu n'étaient résolus
 * qu'au moment de l'envoi : l'écran ne montrait qu'un titre, et une fois le
 * message parti il ne se rattrape pas.</p>
 *
 * <p><b>Ce service ne compose PAS les emails.</b> Il résout le destinataire et
 * rassemble les faits déterminants — le montant dû, l'offre et son prix, les
 * chiffres du mois. Quand le texte exact n'existe qu'à l'envoi, il le dit
 * ({@code bodyRendered = false}) plutôt que d'afficher un texte approchant qui
 * donnerait une fausse assurance.</p>
 *
 * <p>Tout est <b>lu à l'ouverture</b>, jamais repris du scan : une carte peut
 * dater de plusieurs jours, et l'email du voyageur a pu être complété depuis.</p>
 */
@Service
public class SuggestionPreviewService {

    private static final Logger log = LoggerFactory.getLogger(SuggestionPreviewService.class);

    private static final String EMAIL = "Email";
    private static final String WHATSAPP = "WhatsApp, repli email";

    /**
     * Métiers qui peuvent recevoir une mission.
     *
     * <p>Tous les métiers de terrain, y compris blanchisserie et technicien
     * extérieur : c'est un rattrapage, il ne sert à rien d'y rétrécir le vivier
     * qui vient déjà d'échouer à fournir quelqu'un.</p>
     */
    private static final List<com.clenzy.model.UserRole> WORKER_ROLES = List.of(
            com.clenzy.model.UserRole.HOUSEKEEPER,
            com.clenzy.model.UserRole.TECHNICIAN,
            com.clenzy.model.UserRole.EXTERIOR_TECH,
            com.clenzy.model.UserRole.LAUNDRY,
            com.clenzy.model.UserRole.SUPERVISOR);

    private final SupervisionSuggestionRepository suggestionRepository;
    private final ReservationRepository reservationRepository;
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final NoiseAlertRepository noiseAlertRepository;
    private final ManagementContractRepository managementContractRepository;
    private final com.clenzy.repository.ServiceQuoteRepository serviceQuoteRepository;
    private final com.clenzy.repository.AbandonedBookingRepository abandonedBookingRepository;
    private final com.clenzy.repository.PaymentDisputeRepository paymentDisputeRepository;
    private final com.clenzy.booking.repository.SiteRepository siteRepository;
    private final com.clenzy.booking.repository.SitePageRepository sitePageRepository;
    private final com.clenzy.repository.ServiceRequestRepository serviceRequestRepository;
    private final com.clenzy.repository.UserRepository userRepository;
    private final java.time.Clock clock;
    private final ObjectMapper objectMapper;

    public SuggestionPreviewService(SupervisionSuggestionRepository suggestionRepository,
                                    ReservationRepository reservationRepository,
                                    InterventionRepository interventionRepository,
                                    PropertyRepository propertyRepository,
                                    NoiseAlertRepository noiseAlertRepository,
                                    ManagementContractRepository managementContractRepository,
                                    com.clenzy.repository.ServiceQuoteRepository serviceQuoteRepository,
                                    com.clenzy.repository.AbandonedBookingRepository abandonedBookingRepository,
                                    com.clenzy.repository.PaymentDisputeRepository paymentDisputeRepository,
                                    com.clenzy.booking.repository.SiteRepository siteRepository,
                                    com.clenzy.booking.repository.SitePageRepository sitePageRepository,
                                    com.clenzy.repository.ServiceRequestRepository serviceRequestRepository,
                                    com.clenzy.repository.UserRepository userRepository,
                                    java.time.Clock clock,
                                    ObjectMapper objectMapper) {
        this.suggestionRepository = suggestionRepository;
        this.reservationRepository = reservationRepository;
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.noiseAlertRepository = noiseAlertRepository;
        this.managementContractRepository = managementContractRepository;
        this.serviceQuoteRepository = serviceQuoteRepository;
        this.abandonedBookingRepository = abandonedBookingRepository;
        this.paymentDisputeRepository = paymentDisputeRepository;
        this.siteRepository = siteRepository;
        this.sitePageRepository = sitePageRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.userRepository = userRepository;
        this.clock = clock;
        this.objectMapper = objectMapper;
    }

    /**
     * Aperçu d'une carte de l'organisation.
     *
     * <p>Best-effort : un aperçu qui échoue ne doit pas empêcher d'agir. On rend
     * alors un aperçu « indisponible » avec sa raison, et la modale se rabat sur
     * une confirmation — dégradée, mais honnête.</p>
     */
    @Transactional(readOnly = true)
    public SuggestionPreviewDto preview(Long orgId, Long suggestionId,
                                        com.clenzy.dto.ApplySuggestionRequest draft) {
        final SupervisionSuggestion suggestion = suggestionRepository
                .findByIdAndOrganizationId(suggestionId, orgId)
                .orElse(null);
        if (suggestion == null || suggestion.getActionType() == null) {
            return SuggestionPreviewDto.unavailable("Carte introuvable ou non actionnable");
        }
        // Simulation : on regarde l'effet des valeurs en cours de saisie. La
        // superposition se fait sur l'instance chargée en lecture seule — rien
        // n'est écrit, et la carte garde ses propres paramètres.
        overlayDraft(suggestion, draft);
        try {
            return switch (suggestion.getActionType()) {
                case SupervisionActionType.PAYMENT_REMINDER -> paymentReminder(suggestion, orgId);
                case SupervisionActionType.GUIDE_SEND -> guestEmail(suggestion, orgId,
                        "Lien du livret d'accueil",
                        "Le voyageur reçoit le lien de son livret, valable pour son séjour.");
                case SupervisionActionType.REVIEW_REQUEST_SEND -> guestEmail(suggestion, orgId,
                        "Demande d'avis",
                        "Le voyageur reçoit un lien pour déposer son avis.");
                case SupervisionActionType.UPSELL_OFFER -> upsellOffer(suggestion, orgId);
                case SupervisionActionType.NOISE_WARNING_SEND -> noiseWarning(suggestion, orgId);
                case SupervisionActionType.OWNER_WORKS_APPROVAL -> ownerWorks(suggestion, orgId);
                case SupervisionActionType.MANDATE_SIGN_SEND -> mandateSign(suggestion, orgId);
                case SupervisionActionType.CALENDAR_BLOCK -> calendarBlock(suggestion);
                case SupervisionActionType.GOODWILL_REFUND -> goodwillRefund(suggestion, orgId);
                case SupervisionActionType.OWNER_REVENUE_NOTE -> ownerRevenueNote(suggestion, orgId);
                case SupervisionActionType.CART_RECOVERY_SEND -> cartRecovery(suggestion, orgId);
                case SupervisionActionType.SITE_TRANSLATION_DRAFT -> siteTranslation(suggestion, orgId);
                case SupervisionActionType.CHARGEBACK_SUBMIT -> chargeback(suggestion, orgId);
                case SupervisionActionType.QUOTE_APPROVAL -> quoteChoice(suggestion, orgId);
                case SupervisionActionType.OVERBOOKING_RESOLVE -> overbookingChoice(suggestion, orgId);
                case SupervisionActionType.RELODGE_TRANSFER -> relodgeChoice(suggestion, orgId);
                case SupervisionActionType.REASSIGN_MANUAL -> reassignChoice(suggestion, orgId);
                case SupervisionActionType.ASSIGNMENT_RECAP -> assignmentRecap(suggestion, orgId);
                default -> SuggestionPreviewDto.unavailable(
                        "Aucun aperçu pour ce type d'action");
            };
        } catch (Exception e) {
            log.warn("Aperçu indisponible (carte {}) : {}", suggestionId, e.getMessage());
            return SuggestionPreviewDto.unavailable("Aperçu indisponible");
        }
    }

    // ── Résolveurs par type ──────────────────────────────────────────────────

    private SuggestionPreviewDto paymentReminder(SupervisionSuggestion suggestion, Long orgId) {
        final Reservation reservation = requireReservation(suggestion, orgId);
        final String email = paymentEmail(reservation);
        final List<String> facts = new ArrayList<>();
        facts.add("Séjour de " + nullSafe(reservation.getGuestName(), "ce voyageur")
                + " du " + reservation.getCheckIn() + " au " + reservation.getCheckOut());
        if (reservation.getTotalPrice() != null) {
            facts.add("Total du séjour : " + reservation.getTotalPrice() + " EUR");
        }
        facts.add("Un lien de paiement neuf est généré à l'envoi : le solde exact est"
                + " recalculé à ce moment-là.");
        return new SuggestionPreviewDto(
                EMAIL,
                email == null ? List.of() : List.of(email),
                "Relance de paiement",
                null, false, facts,
                email == null ? "Aucune adresse de paiement connue pour cette réservation" : null);
    }

    private SuggestionPreviewDto guestEmail(SupervisionSuggestion suggestion, Long orgId,
                                            String subject, String whatIsSent) {
        final Reservation reservation = requireReservation(suggestion, orgId);
        final String email = paymentEmail(reservation);
        return new SuggestionPreviewDto(
                EMAIL,
                email == null ? List.of() : List.of(email),
                subject,
                null, false,
                List.of(nullSafe(reservation.getGuestName(), "Voyageur")
                                + ", séjour du " + reservation.getCheckIn()
                                + " au " + reservation.getCheckOut(),
                        whatIsSent),
                email == null ? "Aucune adresse connue pour ce voyageur" : null);
    }

    private SuggestionPreviewDto upsellOffer(SupervisionSuggestion suggestion, Long orgId) {
        final Reservation reservation = requireReservation(suggestion, orgId);
        final String email = paymentEmail(reservation);
        return new SuggestionPreviewDto(
                EMAIL,
                email == null ? List.of() : List.of(email),
                "Proposition de service",
                null, false,
                List.of(nullSafe(reservation.getGuestName(), "Voyageur")
                                + ", arrivée le " + reservation.getCheckIn(),
                        "L'offre et son prix sont joints au message, avec le lien du livret.",
                        "Aucun débit : l'achat reste un geste du voyageur."),
                email == null ? "Aucune adresse connue pour ce voyageur" : null);
    }

    private SuggestionPreviewDto noiseWarning(SupervisionSuggestion suggestion, Long orgId) {
        final long alertId = requiredLong(suggestion, "alertId");
        final var alert = noiseAlertRepository.findById(alertId).orElse(null);
        if (alert == null) {
            return SuggestionPreviewDto.unavailable("Alerte de bruit introuvable");
        }
        return new SuggestionPreviewDto(
                WHATSAPP, List.of("Voyageur du séjour en cours"),
                "Avertissement de bruit",
                null, false,
                List.of("L'avertissement part sur le canal du voyageur, avec repli email.",
                        "Un seul avertissement par séjour et par tranche de 24 h."),
                null);
    }

    private SuggestionPreviewDto ownerWorks(SupervisionSuggestion suggestion, Long orgId) {
        final long interventionId = requiredLong(suggestion, "interventionId");
        final Intervention intervention = interventionRepository.findById(interventionId)
                .filter(i -> orgId.equals(i.getOrganizationId()))
                .orElse(null);
        if (intervention == null) {
            return SuggestionPreviewDto.unavailable("Intervention introuvable");
        }
        final Property property = intervention.getProperty();
        final String ownerEmail = property != null && property.getOwner() != null
                ? property.getOwner().getEmail() : null;
        final List<String> facts = new ArrayList<>();
        facts.add("Travaux : " + nullSafe(intervention.getTitle(), "sans intitulé"));
        final BigDecimal cost = intervention.getEstimatedCost();
        facts.add(cost != null
                ? "Coût estimé annoncé au propriétaire : " + cost + " EUR"
                : "Aucun coût estimé : le message partira sans montant.");
        return new SuggestionPreviewDto(
                EMAIL,
                ownerEmail == null ? List.of() : List.of(ownerEmail),
                "Demande d'accord pour des travaux",
                null, false, facts,
                ownerEmail == null ? "Le logement n'a pas de propriétaire joignable" : null);
    }

    private SuggestionPreviewDto mandateSign(SupervisionSuggestion suggestion, Long orgId) {
        final long contractId = requiredLong(suggestion, "contractId");
        final var contract = managementContractRepository.findById(contractId)
                .filter(ct -> orgId.equals(ct.getOrganizationId()))
                .orElse(null);
        if (contract == null) {
            return SuggestionPreviewDto.unavailable("Mandat introuvable");
        }
        return new SuggestionPreviewDto(
                EMAIL, List.of("Propriétaire signataire du mandat"),
                "Mandat de gestion à signer",
                null, false,
                List.of("Le propriétaire reçoit un lien de signature électronique.",
                        "Le document est généré s'il n'existe pas encore."),
                null);
    }

    /** Note de revenus : le destinataire est le propriétaire du logement de la carte. */
    private SuggestionPreviewDto ownerRevenueNote(SupervisionSuggestion suggestion, Long orgId) {
        final Property property = suggestion.getPropertyId() == null ? null
                : propertyRepository.findById(suggestion.getPropertyId())
                        .filter(p -> orgId.equals(p.getOrganizationId()))
                        .orElse(null);
        final String ownerEmail = property != null && property.getOwner() != null
                ? property.getOwner().getEmail() : null;
        return new SuggestionPreviewDto(
                EMAIL,
                ownerEmail == null ? List.of() : List.of(ownerEmail),
                "Point sur les revenus du mois",
                null, false,
                List.of("Mois concerné : " + nullSafe(optionalString(suggestion, "month"), "non précisé"),
                        "Les chiffres sont recalculés à l'envoi depuis les réservations,"
                                + " puis comparés au même mois de l'année précédente.",
                        "Message factuel : il devance la question du propriétaire."),
                ownerEmail == null ? "Le logement n'a pas de propriétaire joignable" : null);
    }

    /** Relance de panier : le destinataire est l'adresse laissée par le visiteur. */
    private SuggestionPreviewDto cartRecovery(SupervisionSuggestion suggestion, Long orgId) {
        final long bookingId = requiredLong(suggestion, "abandonedBookingId");
        final var booking = abandonedBookingRepository.findById(bookingId)
                .filter(b -> orgId.equals(b.getOrganizationId()))
                .orElse(null);
        if (booking == null) {
            return SuggestionPreviewDto.unavailable("Panier introuvable");
        }
        final String email = booking.getGuestEmail();
        return new SuggestionPreviewDto(
                EMAIL,
                email == null || email.isBlank() ? List.of() : List.of(email.trim()),
                "Relance de panier",
                null, false,
                List.of("Le consentement est revérifié à l'envoi : sans accord, rien ne part.",
                        "L'étape de relance est recalculée — le visiteur ne reçoit pas deux fois la même."),
                email == null || email.isBlank() ? "Ce panier n'a pas d'adresse" : null);
    }

    /**
     * Traduction de site : rien ne part vers personne.
     *
     * <p>Le « destinataire » est le Studio lui-même. Le dire évite de faire
     * croire qu'un texte serait publié — les variantes restent en brouillon.</p>
     */
    private SuggestionPreviewDto siteTranslation(SupervisionSuggestion suggestion, Long orgId) {
        final long siteId = requiredLong(suggestion, "siteId");
        final var site = siteRepository.findById(siteId)
                .filter(s -> orgId.equals(s.getOrganizationId()))
                .orElse(null);
        if (site == null) {
            return SuggestionPreviewDto.unavailable("Site introuvable");
        }
        final String target = nullSafe(optionalString(suggestion, "targetLocale"), "non précisée");
        final String defaultLocale = nullSafe(site.getDefaultLocale(), "fr");
        final long publishedPages = sitePageRepository.findBySiteIdOrderBySortOrderAsc(siteId).stream()
                .filter(p -> p.getStatus() == com.clenzy.booking.model.SiteStatus.PUBLISHED)
                .filter(p -> p.getLocale() == null || defaultLocale.equals(p.getLocale()))
                .count();
        return new SuggestionPreviewDto(
                "Studio", List.of("Aucun envoi : les traductions restent dans le Studio"),
                null, null, false,
                List.of("Site : " + nullSafe(site.getName(), "sans nom"),
                        "De « " + defaultLocale + " » vers « " + target + " »",
                        publishedPages + " page(s) publiée(s) seront traduites en BROUILLON.",
                        "Rien n'est mis en ligne : la relecture et la publication restent manuelles."),
                publishedPages == 0 ? "Aucune page publiée à traduire" : null);
    }

    /** Litige bancaire : le dossier part chez Stripe, avec le montant en jeu. */
    private SuggestionPreviewDto chargeback(SupervisionSuggestion suggestion, Long orgId) {
        final long disputeId = requiredLong(suggestion, "disputeId");
        final var dispute = paymentDisputeRepository.findById(disputeId)
                .filter(d -> orgId.equals(d.getOrganizationId()))
                .orElse(null);
        if (dispute == null) {
            return SuggestionPreviewDto.unavailable("Litige introuvable");
        }
        final List<String> facts = new ArrayList<>();
        facts.add("Montant contesté : " + dispute.getAmount() + " "
                + nullSafe(dispute.getCurrency(), "EUR"));
        if (dispute.getDueBy() != null) {
            facts.add("À déposer avant le " + dispute.getDueBy());
        }
        facts.add("Le dossier est assemblé depuis NOS données : séjour, fiche voyageur,"
                + " livret transmis.");
        facts.add("Un seul dépôt : re-déposer retente sans créer de doublon.");
        return new SuggestionPreviewDto(
                "Stripe", List.of("Dossier de preuves déposé auprès de Stripe"),
                null, null, false, facts, null);
    }

    /**
     * Blocage calendrier : traduire un nombre de nuits en dates réelles.
     *
     * <p>« 7 » ne dit rien de ce qui va se passer. Les dates, si — et c'est là
     * qu'on voit qu'on allait bloquer un week-end de forte demande.</p>
     */
    private SuggestionPreviewDto calendarBlock(SupervisionSuggestion suggestion) {
        final int days = Math.max(1, Math.min(30, optionalInt(suggestion, "days", 7)));
        final java.time.LocalDate today = java.time.LocalDate.now(clock);
        final java.time.LocalDate last = today.plusDays(days - 1L);
        return new SuggestionPreviewDto(
                null, List.of(), null, null, false,
                List.of(days + " nuit(s) bloquée(s), du " + today + " au " + last + " inclus.",
                        "Ces nuits cessent d'être vendables sur tous les canaux.",
                        "Refusé si l'une d'elles est déjà réservée — vérifié au moment d'appliquer."),
                null);
    }

    /**
     * Geste commercial : traduire un pourcentage en euros.
     *
     * <p>Un opérateur ne rembourse pas « 15 % » : il rembourse une somme. La
     * montrer avant est la moindre des choses.</p>
     */
    private SuggestionPreviewDto goodwillRefund(SupervisionSuggestion suggestion, Long orgId) {
        final Reservation reservation = requireReservation(suggestion, orgId);
        final int percent = Math.max(1, Math.min(50, optionalInt(suggestion, "percent", 15)));
        final List<String> facts = new ArrayList<>();
        facts.add("Séjour de " + nullSafe(reservation.getGuestName(), "ce voyageur")
                + " du " + reservation.getCheckIn() + " au " + reservation.getCheckOut());
        final BigDecimal total = reservation.getTotalPrice();
        if (total != null) {
            final BigDecimal amount = total
                    .multiply(BigDecimal.valueOf(percent))
                    .divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
            facts.add(percent + " % de " + total + " EUR, soit environ " + amount + " EUR remboursés.");
        } else {
            facts.add(percent + " % du total du séjour — total inconnu, montant calculé à l'exécution.");
        }
        facts.add("Le montant définitif est recalculé et borné par le serveur.");
        return new SuggestionPreviewDto(EMAIL, List.of("Voyageur du séjour"),
                null, null, false, facts, null);
    }

    /** Entier facultatif d'un paramètre, avec repli. */
    private int optionalInt(SupervisionSuggestion suggestion, String field, int fallback) {
        try {
            final JsonNode node = objectMapper.readTree(suggestion.getActionParams()).get(field);
            return node != null && node.canConvertToInt() ? node.asInt() : fallback;
        } catch (Exception e) {
            return fallback;
        }
    }

    // ── Résolveurs de candidats ──────────────────────────────────────────────

    /**
     * Les devis reçus pour l'intervention, à comparer.
     *
     * <p>La carte retenait le moins-disant et le bouton n'offrait que de
     * l'entériner : les concurrents n'apparaissaient nulle part. Le moins cher
     * n'est pourtant pas toujours le bon — un prestataire connu, une
     * disponibilité, un acompte plus faible pèsent aussi.</p>
     */
    private SuggestionPreviewDto quoteChoice(SupervisionSuggestion suggestion, Long orgId) {
        final long recommendedId = requiredLong(suggestion, "quoteId");
        final var recommended = serviceQuoteRepository.findByIdAndOrganizationId(recommendedId, orgId)
                .orElse(null);
        if (recommended == null || recommended.getInterventionId() == null) {
            return SuggestionPreviewDto.unavailable("Devis introuvable");
        }
        final var candidates = serviceQuoteRepository
                .findByInterventionIdAndOrganizationIdOrderByAmountAsc(
                        recommended.getInterventionId(), orgId)
                .stream()
                .filter(q -> q.getStatus() == com.clenzy.model.ServiceQuote.Status.RECEIVED)
                .map(q -> new SuggestionPreviewDto.PreviewOption(
                        "quoteId",
                        q.getId(),
                        nullSafe(q.getProviderName(), "Prestataire"),
                        q.getAmount() + " " + nullSafe(q.getCurrency(), "EUR")
                                + (q.getDepositAmount() != null
                                    && q.getDepositAmount().compareTo(BigDecimal.ZERO) > 0
                                        ? " · acompte " + q.getDepositAmount() : ""),
                        q.getId().equals(recommendedId)))
                .toList();
        if (candidates.isEmpty()) {
            return SuggestionPreviewDto.unavailable("Plus aucun devis en attente");
        }
        return new SuggestionPreviewDto(
                null, List.of(), null, null, false,
                List.of("Le devis retenu devient le coût de l'intervention.",
                        "Les autres sont écartés — ils restent lisibles dans l'historique."),
                null, candidates);
    }

    /**
     * Les deux réservations en chevauchement, celle à annuler restant à désigner.
     *
     * <p>C'est le cas où le geste direct pesait le plus lourd : la carte
     * choisissait laquelle annuler, et « Appliquer » exécutait ce choix sans
     * jamais montrer l'autre séjour.</p>
     */
    private SuggestionPreviewDto overbookingChoice(SupervisionSuggestion suggestion, Long orgId) {
        final long proposedCancelId = requiredLong(suggestion, "cancelReservationId");
        final long keepId = requiredLong(suggestion, "keepReservationId");
        final List<SuggestionPreviewDto.PreviewOption> options = new ArrayList<>();
        for (long id : new long[] { proposedCancelId, keepId }) {
            final Reservation r = reservationRepository.findById(id)
                    .filter(res -> orgId.equals(res.getOrganizationId()))
                    .orElse(null);
            if (r == null) {
                return SuggestionPreviewDto.unavailable(
                        "Une des deux réservations n'est plus accessible");
            }
            options.add(new SuggestionPreviewDto.PreviewOption(
                    "cancelReservationId",
                    r.getId(),
                    nullSafe(r.getGuestName(), "Voyageur") + " — annuler ce séjour",
                    "du " + r.getCheckIn() + " au " + r.getCheckOut()
                            + " · " + nullSafe(r.getSourceName(), nullSafe(r.getSource(), "direct")),
                    r.getId() == proposedCancelId));
        }
        return new SuggestionPreviewDto(
                null, List.of(), null, null, false,
                List.of("Le séjour annulé libère ses nuits et ses codes d'accès sont révoqués.",
                        "Refusé si le séjour désigné a déjà commencé."),
                null, options);
    }

    /**
     * Logements de repli envisageables pour un relogement.
     *
     * <p>La carte en désignait un ; les autres candidats de l'organisation
     * n'apparaissaient nulle part, alors que la capacité ou la ville peuvent
     * peser autant que la disponibilité.</p>
     *
     * <p><b>La disponibilité n'est PAS revérifiée ici.</b> Elle l'est au moment
     * de la proposition, sous verrou — et le dire évite de laisser croire qu'un
     * candidat listé est forcément libre.</p>
     */
    private SuggestionPreviewDto relodgeChoice(SupervisionSuggestion suggestion, Long orgId) {
        final long proposedId = requiredLong(suggestion, "targetPropertyId");
        final Reservation reservation = requireReservation(suggestion, orgId);
        final List<SuggestionPreviewDto.PreviewOption> options = propertyRepository
                .findByOrganizationId(orgId).stream()
                .filter(p -> !p.getId().equals(reservation.getProperty() == null
                        ? null : reservation.getProperty().getId()))
                .limit(12)
                .map(p -> new SuggestionPreviewDto.PreviewOption(
                        "targetPropertyId",
                        p.getId(),
                        nullSafe(p.getName(), "Logement " + p.getId()),
                        nullSafe(p.getCity(), "ville non renseignée")
                                + (p.getMaxGuests() != null ? " · " + p.getMaxGuests() + " voyageurs" : ""),
                        p.getId() == proposedId))
                .toList();
        if (options.isEmpty()) {
            return SuggestionPreviewDto.unavailable("Aucun logement de repli dans cette organisation");
        }
        return new SuggestionPreviewDto(
                null, List.of(), null, null, false,
                List.of("Le voyageur reçoit une OFFRE, valable 72 h — jamais un déménagement d'office.",
                        "Le transfert ne s'exécute qu'à son accord explicite.",
                        "La disponibilité du logement retenu est revérifiée à ce moment-là."),
                null, options);
    }

    /**
     * Intervenants à qui confier une demande que l'automatique n'a pas placée.
     *
     * <p><b>Le métier ne filtre pas.</b> L'automatique applique ses critères —
     * disponibilité, métier, tarif — et c'est parce qu'ils n'ont trouvé personne
     * que la carte existe. Les répéter ici n'offrirait aucune issue. Les métiers
     * qui correspondent sont donc mis EN TÊTE, pas seuls.</p>
     */
    private SuggestionPreviewDto reassignChoice(SupervisionSuggestion suggestion, Long orgId) {
        final long serviceRequestId = requiredLong(suggestion, "serviceRequestId");
        final var request = serviceRequestRepository.findById(serviceRequestId)
                .filter(sr -> orgId.equals(sr.getOrganizationId()))
                .orElse(null);
        if (request == null) {
            return SuggestionPreviewDto.unavailable("Demande introuvable");
        }
        if (request.getAssignedToId() != null) {
            return SuggestionPreviewDto.unavailable(
                    "Cette demande a trouvé preneur entre-temps : plus rien à reprendre");
        }
        final boolean cleaning = request.getServiceType() != null
                && request.getServiceType().name().contains("CLEANING");
        final List<SuggestionPreviewDto.PreviewOption> options = userRepository
                .findByRoleIn(WORKER_ROLES, orgId).stream()
                .sorted((a, b) -> Boolean.compare(
                        !fitsTrade(b.getRole(), cleaning), !fitsTrade(a.getRole(), cleaning)))
                .limit(20)
                .map(u -> new SuggestionPreviewDto.PreviewOption(
                        "assigneeId",
                        u.getId(),
                        nullSafe((nullSafe(u.getFirstName(), "") + " " + nullSafe(u.getLastName(), "")).trim(),
                                "Intervenant " + u.getId()),
                        String.valueOf(u.getRole())
                                + (fitsTrade(u.getRole(), cleaning) ? " · métier correspondant" : ""),
                        false))
                .toList();
        if (options.isEmpty()) {
            return SuggestionPreviewDto.unavailable("Aucun intervenant dans cette organisation");
        }
        return new SuggestionPreviewDto(
                null, List.of(), null, null, false,
                List.of("La recherche automatique n'a trouvé personne : ce choix est un rattrapage.",
                        "Les métiers qui correspondent sont en tête, mais tous restent sélectionnables.",
                        "L'intervenant retenu sera notifié comme pour toute assignation."),
                null, options);
    }

    /**
     * Récapitulatif d'une assignation déjà faite : la carte rend compte.
     *
     * <p>Aucun candidat, aucun destinataire — rien ne part. Ce que l'opérateur
     * doit lire, c'est QUI a été retenu et POUR QUOI.</p>
     */
    private SuggestionPreviewDto assignmentRecap(SupervisionSuggestion suggestion, Long orgId) {
        final long serviceRequestId = requiredLong(suggestion, "serviceRequestId");
        final var request = serviceRequestRepository.findById(serviceRequestId)
                .filter(sr -> orgId.equals(sr.getOrganizationId()))
                .orElse(null);
        if (request == null) {
            return SuggestionPreviewDto.unavailable("Demande introuvable");
        }
        final List<String> facts = new ArrayList<>();
        facts.add("Demande : " + nullSafe(request.getTitle(), "sans intitulé"));
        if (request.getDesiredDate() != null) {
            facts.add("Date souhaitée : " + request.getDesiredDate());
        }
        final String assignee = request.getAssignedToId() == null ? null
                : userRepository.findById(request.getAssignedToId())
                        .map(u -> (nullSafe(u.getFirstName(), "") + " " + nullSafe(u.getLastName(), "")).trim())
                        .filter(name -> !name.isBlank())
                        .orElse("intervenant #" + request.getAssignedToId());
        facts.add(assignee != null
                ? "Confiée à " + assignee + ", qui en a été notifié."
                : "Plus personne n'est assigné : la situation a changé depuis ce récapitulatif.");
        facts.add("Rien à valider : cette carte rend compte, elle ne propose pas.");
        return new SuggestionPreviewDto(
                null, List.of(), null, null, false, facts, null);
    }

    /** Métiers dont le travail correspond à la nature de la demande. */
    private static boolean fitsTrade(com.clenzy.model.UserRole role, boolean cleaning) {
        if (role == null) {
            return false;
        }
        return cleaning
                ? role == com.clenzy.model.UserRole.HOUSEKEEPER
                : role == com.clenzy.model.UserRole.TECHNICIAN;
    }

    // ── Utilitaires ──────────────────────────────────────────────────────────

    /**
     * Charge la réservation de la carte, org re-validée.
     *
     * <p>{@code findById} contourne le filtre Hibernate : la vérification est
     * explicite (règle d'audit n°3), même pour une simple lecture — un aperçu qui
     * fuiterait le nom et l'email d'un voyageur d'une autre organisation serait
     * une fuite comme une autre.</p>
     */
    private Reservation requireReservation(SupervisionSuggestion suggestion, Long orgId) {
        final long reservationId = requiredLong(suggestion, "reservationId");
        final Reservation reservation = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new IllegalStateException("Réservation introuvable"));
        if (!orgId.equals(reservation.getOrganizationId())) {
            throw new IllegalStateException("Réservation hors organisation");
        }
        return reservation;
    }

    /** Même résolution que l'envoi : lien de paiement d'abord, fiche voyageur ensuite. */
    private String paymentEmail(Reservation reservation) {
        if (reservation.getPaymentLinkEmail() != null && !reservation.getPaymentLinkEmail().isBlank()) {
            return reservation.getPaymentLinkEmail().trim();
        }
        final Guest guest = reservation.getGuest();
        if (guest != null && guest.getEmail() != null && !guest.getEmail().isBlank()) {
            return guest.getEmail().trim();
        }
        return null;
    }

    private long requiredLong(SupervisionSuggestion suggestion, String field) {
        try {
            final JsonNode node = objectMapper.readTree(suggestion.getActionParams()).get(field);
            if (node == null || !node.canConvertToLong()) {
                throw new IllegalStateException("Paramètre « " + field + " » manquant");
            }
            return node.asLong();
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Paramètres d'action illisibles", e);
        }
    }

    /**
     * Superpose les valeurs en cours de saisie, le temps de l'aperçu.
     *
     * <p>Même règle qu'à l'exécution : superposition, jamais remplacement — les
     * clés de ciblage ({@code reservationId}, {@code quoteId}) doivent survivre,
     * sinon l'aperçu perdrait son sujet. La transaction est en lecture seule et
     * l'entité n'est jamais sauvegardée : la carte n'en garde rien.</p>
     */
    private void overlayDraft(SupervisionSuggestion suggestion,
                              com.clenzy.dto.ApplySuggestionRequest draft) {
        if (draft == null || draft.safeParams().isEmpty()) {
            return;
        }
        try {
            final String raw = suggestion.getActionParams();
            final com.fasterxml.jackson.databind.node.ObjectNode merged =
                    raw == null || raw.isBlank()
                            ? objectMapper.createObjectNode()
                            : (com.fasterxml.jackson.databind.node.ObjectNode) objectMapper.readTree(raw);
            draft.safeParams().forEach((key, value) -> merged.set(key, objectMapper.valueToTree(value)));
            suggestion.setActionParams(objectMapper.writeValueAsString(merged));
        } catch (Exception e) {
            log.debug("Simulation ignorée (params de carte illisibles) : {}", e.getMessage());
        }
    }

    /** Paramètre textuel facultatif — absent ou illisible rend {@code null}. */
    private String optionalString(SupervisionSuggestion suggestion, String field) {
        try {
            final JsonNode node = objectMapper.readTree(suggestion.getActionParams()).get(field);
            return node == null || node.isNull() ? null : node.asText();
        } catch (Exception e) {
            return null;
        }
    }

    private static String nullSafe(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
