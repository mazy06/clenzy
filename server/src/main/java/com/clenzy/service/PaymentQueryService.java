package com.clenzy.service;

import com.clenzy.dto.PaymentHistoryDto;
import com.clenzy.dto.PaymentSummaryDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Lectures transverses des paiements (historique fusionne interventions /
 * reservations / service requests, resume agrege, statut de session) +
 * mapping vers les DTOs d'historique. Logique deplacee depuis
 * {@code PaymentController} (refactor T-ARCH-01 — controller mince).
 *
 * <h2>Securite</h2>
 * <p>Toutes les requetes d'historique/resume sont parametrees par
 * l'organizationId du {@link TenantContext}. Pour {@link #getSessionStatus},
 * les lookups reservation/SR par stripeSessionId ne passent pas par le filtre
 * Hibernate : l'appartenance a l'organisation du requester est validee
 * explicitement (entite d'une autre org = introuvable, pattern aligne sur le
 * lookup intervention deja org-scope et sur transaction-status).</p>
 */
@Service
public class PaymentQueryService {

    private static final Logger logger = LoggerFactory.getLogger(PaymentQueryService.class);

    private final InterventionRepository interventionRepository;
    private final ReservationRepository reservationRepository;
    private final ServiceRequestRepository serviceRequestRepository;
    private final UserService userService;
    private final StripeService stripeService;
    private final TenantContext tenantContext;

    public PaymentQueryService(InterventionRepository interventionRepository,
                               ReservationRepository reservationRepository,
                               ServiceRequestRepository serviceRequestRepository,
                               UserService userService,
                               StripeService stripeService,
                               TenantContext tenantContext) {
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.userService = userService;
        this.stripeService = stripeService;
        this.tenantContext = tenantContext;
    }

    /**
     * Resout l'utilisateur courant depuis les claims du JWT : lookup par
     * keycloakId, repli par email (hash). Retourne {@code null} si inconnu.
     */
    public User resolveCurrentUser(String keycloakId, String email) {
        User user = null;
        if (keycloakId != null) {
            user = userService.findByKeycloakId(keycloakId);
        }
        if (user == null && email != null) {
            user = userService.findByEmail(email);
        }
        return user;
    }

    /**
     * Statut d'une session de paiement (intervention, reservation ou service
     * request). Si le paiement est encore en attente, interroge directement
     * l'API Stripe pour verifier si la session a ete payee (fallback si le
     * webhook n'a pas ete recu).
     *
     * <p>PAS de {@code @Transactional} : appels HTTP Stripe possibles.</p>
     *
     * @return le corps de reponse, ou {@link Optional#empty()} si aucun
     *         paiement de l'organisation courante ne correspond a la session
     */
    public Optional<Map<String, Object>> getSessionStatus(String sessionId) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        // 1) Chercher dans les interventions (requete deja org-scope)
        var optIntervention = interventionRepository.findByStripeSessionId(sessionId, orgId);
        if (optIntervention.isPresent()) {
            Intervention intervention = optIntervention.get();
            // Si encore en PROCESSING, vérifier directement auprès de Stripe
            if (intervention.getPaymentStatus() == PaymentStatus.PROCESSING
                    && stripeService.isCheckoutSessionPaid(sessionId)) {
                logger.info("Fallback: confirmation manuelle du paiement intervention pour session {}", sessionId);
                stripeService.confirmPayment(sessionId);
                intervention = interventionRepository.findByStripeSessionId(sessionId, orgId)
                    .orElse(intervention);
            }
            return Optional.of(Map.of(
                "paymentStatus", intervention.getPaymentStatus().name(),
                "interventionStatus", intervention.getStatus().name()
            ));
        }

        // 2) Chercher dans les réservations — lookup hors filtre Hibernate →
        //    validation d'org explicite (autre org = introuvable)
        var optReservation = reservationRepository.findByStripeSessionId(sessionId)
            .filter(r -> belongsToCurrentOrg(r.getOrganizationId()));
        if (optReservation.isPresent()) {
            Reservation reservation = optReservation.get();
            // Si pas encore PAID, vérifier directement auprès de Stripe (fallback webhook)
            if (reservation.getPaymentStatus() != PaymentStatus.PAID
                    && stripeService.isCheckoutSessionPaid(sessionId)) {
                logger.info("Fallback: confirmation manuelle du paiement réservation pour session {}", sessionId);
                stripeService.confirmReservationPayment(sessionId);
                reservation = reservationRepository.findByStripeSessionId(sessionId)
                    .orElse(reservation);
            }
            return Optional.of(Map.of(
                "paymentStatus", reservation.getPaymentStatus() != null ? reservation.getPaymentStatus().name() : "PENDING",
                "interventionStatus", reservation.getStatus() != null ? reservation.getStatus() : "N/A"
            ));
        }

        // 3) Chercher dans les service requests — meme validation d'org explicite
        var optSr = serviceRequestRepository.findByStripeSessionId(sessionId)
            .filter(s -> belongsToCurrentOrg(s.getOrganizationId()));
        if (optSr.isPresent()) {
            ServiceRequest sr = optSr.get();
            if (sr.getPaymentStatus() != PaymentStatus.PAID
                    && stripeService.isCheckoutSessionPaid(sessionId)) {
                logger.info("Fallback: confirmation manuelle du paiement SR pour session {}", sessionId);
                stripeService.confirmServiceRequestPayment(sessionId);
                sr = serviceRequestRepository.findByStripeSessionId(sessionId).orElse(sr);
            }
            return Optional.of(Map.of(
                "paymentStatus", sr.getPaymentStatus() != null ? sr.getPaymentStatus().name() : "PENDING",
                "interventionStatus", sr.getStatus() != null ? sr.getStatus().name() : "N/A"
            ));
        }

        return Optional.empty();
    }

    /**
     * Historique des paiements fusionne (interventions + reservations + SR),
     * trie par date decroissante et pagine manuellement.
     * HOST : voit uniquement ses propres elements.
     * ADMIN/MANAGER : voit tout, optionnellement filtre par hostId.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getPaymentHistory(User currentUser, PaymentStatus paymentStatus,
                                                 Long hostId, int page, int size) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        // ── 1) Charger les interventions ────────────────────────────────────
        // Use a large page to merge with reservations — real pagination is done below
        Pageable largePage = PageRequest.of(0, 10000, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Intervention> interventionPage;

        if (currentUser.getRole() == UserRole.HOST) {
            interventionPage = interventionRepository.findPaymentHistoryByRequestor(
                    currentUser.getId(), paymentStatus, largePage, orgId);
        } else {
            interventionPage = interventionRepository.findPaymentHistory(
                    paymentStatus, hostId, largePage, orgId);
        }

        // ── 2) Charger les reservations ─────────────────────────────────────
        // On charge TOUTES les reservations (paymentStatus=null) puis on filtre sur le statut
        // EFFECTIF du DTO : une reservation OTA s'affiche "PAID" alors que son paymentStatus en
        // base reste PENDING (cf. toReservationPaymentDto / isOtaPaidReservation). Filtrer en
        // base sur paymentStatus rendrait le filtre incoherent avec le statut affiche.
        Page<Reservation> reservationPage = reservationRepository.findPaymentHistory(
                null, largePage, orgId);

        // ── 2b) Charger les SR AWAITING_PAYMENT ──────────────────────────────
        Page<ServiceRequest> srPage;
        boolean isHost = currentUser.getRole() == UserRole.HOST;
        if (isHost) {
            srPage = serviceRequestRepository.findPaymentHistoryByUser(
                    currentUser.getId(), paymentStatus, largePage, orgId);
        } else {
            srPage = serviceRequestRepository.findPaymentHistory(
                    paymentStatus, hostId, largePage, orgId);
        }

        // ── 3) Fusionner en DTOs, trier par date desc, paginer ─────────────
        List<PaymentHistoryDto> merged = new ArrayList<>();
        interventionPage.getContent().forEach(i -> merged.add(toPaymentHistoryDto(i)));
        // Filtre sur le statut EFFECTIF (OTA-aware) : on a charge toutes les reservations,
        // on ne garde que celles dont le statut affiche correspond au filtre demande.
        reservationPage.getContent().forEach(r -> {
            PaymentHistoryDto dto = toReservationPaymentDto(r);
            if (paymentStatus == null || paymentStatus.name().equals(dto.status)) {
                merged.add(dto);
            }
        });
        srPage.getContent().forEach(sr -> merged.add(toServiceRequestPaymentDto(sr)));

        // Trier par transactionDate DESC
        merged.sort(Comparator.comparing(
            (PaymentHistoryDto d) -> d.transactionDate != null ? d.transactionDate : "",
            Comparator.reverseOrder()));

        // Pagination manuelle
        int start = page * size;
        int end = Math.min(start + size, merged.size());
        List<PaymentHistoryDto> pageContent = start < merged.size()
                ? merged.subList(start, end) : List.of();

        return Map.of(
            "content", pageContent,
            "totalElements", merged.size(),
            "totalPages", (int) Math.ceil((double) merged.size() / size),
            "number", page,
            "size", size
        );
    }

    /**
     * Resume agrege des paiements (interventions + reservations + SR en
     * attente). HOST : restreint a ses propres elements.
     */
    @Transactional(readOnly = true)
    public PaymentSummaryDto getPaymentSummary(User currentUser, Long hostId) {
        // HOST : force son propre ID
        Long effectiveHostId = (currentUser.getRole() == UserRole.HOST) ? currentUser.getId() : hostId;
        Long orgId = tenantContext.getRequiredOrganizationId();

        // Requete avec toutes les interventions payantes, paginee large
        Pageable all = PageRequest.of(0, 10000);
        Page<Intervention> interventions;
        if (effectiveHostId != null) {
            interventions = interventionRepository.findPaymentHistoryByRequestor(effectiveHostId, null, all, orgId);
        } else {
            interventions = interventionRepository.findPaymentHistory(null, null, all, orgId);
        }

        PaymentSummaryDto summary = new PaymentSummaryDto();

        // Additionner les interventions
        for (Intervention i : interventions.getContent()) {
            BigDecimal cost = i.getEstimatedCost() != null ? i.getEstimatedCost() : BigDecimal.ZERO;
            PaymentStatus ps = i.getPaymentStatus();
            if (ps == PaymentStatus.PAID) {
                summary.totalPaid = summary.totalPaid.add(cost);
            } else if (ps == PaymentStatus.REFUNDED) {
                summary.totalRefunded = summary.totalRefunded.add(cost);
            } else {
                summary.totalPending = summary.totalPending.add(cost);
            }
        }

        // Additionner les reservations
        List<Reservation> reservations = reservationRepository.findAllWithPayment(orgId);
        for (Reservation r : reservations) {
            BigDecimal cost = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
            PaymentStatus ps = r.getPaymentStatus();
            // Réservation OTA : déjà réglée sur le canal externe → comptée comme payée
            // (cohérent avec le statut "PAID" renvoyé par toReservationPaymentDto). Les résas
            // OTA ont paymentStatus=PENDING (le PMS n'encaisse pas) donc jamais REFUNDED ici.
            if (ps == PaymentStatus.PAID || isOtaPaidReservation(r)) {
                summary.totalPaid = summary.totalPaid.add(cost);
            } else if (ps == PaymentStatus.REFUNDED) {
                summary.totalRefunded = summary.totalRefunded.add(cost);
            } else {
                summary.totalPending = summary.totalPending.add(cost);
            }
        }

        // Additionner les SR AWAITING_PAYMENT au pending
        List<ServiceRequest> awaitingSRs = serviceRequestRepository.findAllAwaitingPayment(orgId);
        for (ServiceRequest sr : awaitingSRs) {
            summary.totalPending = summary.totalPending.add(
                sr.getEstimatedCost() != null ? sr.getEstimatedCost() : BigDecimal.ZERO);
        }

        summary.transactionCount = (int) interventions.getTotalElements() + reservations.size() + awaitingSRs.size();

        return summary;
    }

    /**
     * Liste legere des hosts ayant des interventions payantes ou des SR en
     * attente de paiement (pour le filtre admin).
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getHostsWithPayments() {
        Long orgId = tenantContext.getRequiredOrganizationId();
        // Hosts depuis les interventions
        List<Object[]> rows = interventionRepository.findDistinctHostsWithPayments(orgId);
        Map<Long, Map<String, Object>> hostsMap = new LinkedHashMap<>();
        for (Object[] row : rows) {
            Long id = ((Number) row[0]).longValue();
            hostsMap.put(id, Map.of("id", id, "fullName", row[1] + " " + row[2]));
        }
        // Hosts depuis les SR AWAITING_PAYMENT — dedupliquer par ID
        List<ServiceRequest> awaitingSRs = serviceRequestRepository.findAllAwaitingPayment(orgId);
        for (ServiceRequest sr : awaitingSRs) {
            if (sr.getUser() != null && !hostsMap.containsKey(sr.getUser().getId())) {
                hostsMap.put(sr.getUser().getId(), Map.of(
                    "id", sr.getUser().getId(),
                    "fullName", sr.getUser().getFirstName() + " " + sr.getUser().getLastName()));
            }
        }
        return new ArrayList<>(hostsMap.values());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    /**
     * Variante booleenne de requireSameOrganization (pattern SmartLockService) :
     * memes exemptions platform staff / org SYSTEM que le filtre Hibernate
     * organizationFilter. Utilisee pour FILTRER les lookups par stripeSessionId
     * (entite d'une autre org = introuvable, pas de fuite d'existence).
     */
    private boolean belongsToCurrentOrg(Long entityOrganizationId) {
        if (tenantContext.isSuperAdmin() || tenantContext.isSystemOrg()) {
            return true;
        }
        Long orgId = tenantContext.getOrganizationId();
        return orgId == null || entityOrganizationId == null || orgId.equals(entityOrganizationId);
    }

    private PaymentHistoryDto toPaymentHistoryDto(Intervention i) {
        PaymentHistoryDto dto = new PaymentHistoryDto();
        dto.id = i.getId();
        dto.referenceId = i.getId();
        // description : titre nettoye du suffixe " — <property>" si present
        // (eviter la redondance avec la colonne PROPRIETE).
        String propertyName = i.getProperty() != null ? i.getProperty().getName() : null;
        dto.description = stripPropertySuffix(i.getTitle(), propertyName);
        dto.propertyName = propertyName != null ? propertyName : "N/A";
        dto.amount = i.getEstimatedCost();
        dto.status = i.getPaymentStatus() != null ? i.getPaymentStatus().name() : "PENDING";
        dto.type = "INTERVENTION";
        dto.stripeSessionId = i.getStripeSessionId();
        // transactionDate : paidAt si PAID, sinon startTime ou createdAt
        if (i.getPaidAt() != null) {
            dto.transactionDate = i.getPaidAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } else if (i.getStartTime() != null) {
            dto.transactionDate = i.getStartTime().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } else if (i.getCreatedAt() != null) {
            dto.transactionDate = i.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        }
        dto.createdAt = i.getCreatedAt() != null ? i.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null;
        // Host info
        if (i.getRequestor() != null) {
            dto.hostId = i.getRequestor().getId();
            dto.hostName = i.getRequestor().getFullName();
        }
        return dto;
    }

    private PaymentHistoryDto toServiceRequestPaymentDto(ServiceRequest sr) {
        PaymentHistoryDto dto = new PaymentHistoryDto();
        dto.id = sr.getId();
        dto.referenceId = sr.getId();
        // description : nettoyer le suffixe " — <property>" du titre — eviter
        // la double redondance que produisait `title + " — " + propertyName`
        // (le titre contient deja souvent " — <property>" via AirbnbReservationService).
        String propertyName = sr.getProperty() != null ? sr.getProperty().getName() : null;
        dto.description = stripPropertySuffix(sr.getTitle(), propertyName);
        dto.propertyName = propertyName != null ? propertyName : "N/A";
        dto.amount = sr.getEstimatedCost();
        dto.status = sr.getPaymentStatus() != null ? sr.getPaymentStatus().name() : "PENDING";
        dto.type = "SERVICE_REQUEST";
        dto.stripeSessionId = sr.getStripeSessionId();
        if (sr.getCreatedAt() != null) {
            dto.transactionDate = sr.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        }
        dto.createdAt = dto.transactionDate;
        if (sr.getUser() != null) {
            dto.hostId = sr.getUser().getId();
            dto.hostName = sr.getUser().getFirstName() + " " + sr.getUser().getLastName();
        }
        return dto;
    }

    /**
     * Réservation OTA (Airbnb, Booking, autres canaux iCal) : déjà réglée sur le canal externe,
     * le PMS n'encaisse rien. Elle doit donc compter comme "payée" dans la facturation et les KPI,
     * en cohérence avec le panneau réservation (PanelFinancial.isOTABooking → reste à payer 0) et
     * la pastille du planning (usePlanningData). Mêmes sources que detectSource (ICalImportService).
     */
    private static boolean isOtaPaidReservation(Reservation r) {
        String src = r.getSource();
        return "airbnb".equals(src) || "booking".equals(src) || "other".equals(src);
    }

    private PaymentHistoryDto toReservationPaymentDto(Reservation r) {
        PaymentHistoryDto dto = new PaymentHistoryDto();
        dto.id = r.getId();
        dto.referenceId = r.getId();
        // description : format riche sans redondance avec la colonne PROPRIETE.
        //   Format : "<Source pretty> · <N> nuit(s)"  (ex: "Airbnb · 4 nuits")
        //   Fallback si source manquante : "Reservation · <N> nuits"
        //   Si pas de nuits calculables : "Reservation #<id>"
        // subDescription : dates de sejour formatees (ex: "10/05 → 15/05")
        dto.description = buildReservationDescription(r);
        dto.subDescription = buildReservationSubDescription(r);
        dto.propertyName = r.getProperty() != null ? r.getProperty().getName() : "N/A";
        dto.amount = r.getTotalPrice();
        dto.currency = r.getCurrency() != null ? r.getCurrency() : "EUR";
        // Réservation OTA (Airbnb/Booking/iCal) : déjà payée sur le canal → "PAID" (sinon le statut
        // brut resterait "PENDING" alors que le PMS n'a rien à encaisser).
        dto.status = isOtaPaidReservation(r) ? "PAID"
                : (r.getPaymentStatus() != null ? r.getPaymentStatus().name() : "PENDING");
        dto.type = "RESERVATION";
        dto.stripeSessionId = r.getStripeSessionId();
        // transactionDate : paidAt si PAID, sinon createdAt
        if (r.getPaidAt() != null) {
            dto.transactionDate = r.getPaidAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } else if (r.getCreatedAt() != null) {
            dto.transactionDate = r.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        }
        dto.createdAt = r.getCreatedAt() != null ? r.getCreatedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null;
        // Guest name as hostName for display
        dto.hostName = r.getGuestName();
        dto.hostId = null; // reservations don't have a host user
        // Guest email : priorite paymentLinkEmail (deja utilise), sinon guest.email
        if (r.getPaymentLinkEmail() != null && !r.getPaymentLinkEmail().isBlank()) {
            dto.guestEmail = r.getPaymentLinkEmail();
        } else if (r.getGuest() != null && r.getGuest().getEmail() != null) {
            dto.guestEmail = r.getGuest().getEmail();
        }
        return dto;
    }

    // ─── Helpers de formatage de description ────────────────────────────────

    /**
     * Retire le suffixe {@code " — <propertyName>"} d'un titre si present, pour
     * eviter la redondance avec la colonne PROPRIETE deja affichee a part dans
     * le tableau d'historique des paiements.
     *
     * <p>Cas reels :</p>
     * <ul>
     *   <li>{@code stripPropertySuffix("Menage Airbnb — Duplex Paris", "Duplex Paris")} → {@code "Menage Airbnb"}</li>
     *   <li>{@code stripPropertySuffix("Menage standard", "Duplex Paris")} → {@code "Menage standard"} (pas de suffixe)</li>
     *   <li>{@code stripPropertySuffix(null, ...)} → {@code "—"}</li>
     * </ul>
     */
    private static String stripPropertySuffix(String title, String propertyName) {
        if (title == null || title.isBlank()) return "—";
        if (propertyName == null || propertyName.isBlank()) return title;
        String suffix = " — " + propertyName;
        if (title.endsWith(suffix)) {
            return title.substring(0, title.length() - suffix.length()).trim();
        }
        return title;
    }

    /**
     * Joli libelle pour la source d'une reservation (Airbnb, Booking.com,
     * Vrbo, etc.). Si {@code sourceName} est fourni (libre, ex: "Direct
     * via Whatsapp"), on l'utilise tel quel. Sinon on mappe les sources
     * connues vers leur libelle commercial. Fallback : "Reservation".
     */
    private static String prettySource(Reservation r) {
        if (r.getSourceName() != null && !r.getSourceName().isBlank()) {
            return r.getSourceName();
        }
        String src = r.getSource() != null ? r.getSource().toLowerCase() : "";
        return switch (src) {
            case "airbnb"  -> "Airbnb";
            case "booking" -> "Booking.com";
            case "vrbo"    -> "Vrbo";
            case "direct"  -> "Direct";
            case "ical"    -> "iCal";
            default        -> "Reservation";
        };
    }

    /**
     * Description principale d'une reservation : "Source · N nuit(s)".
     * Si pas de dates calculables : "Source #id".
     */
    private static String buildReservationDescription(Reservation r) {
        String source = prettySource(r);
        java.time.LocalDate in = r.getCheckIn();
        java.time.LocalDate out = r.getCheckOut();
        if (in == null || out == null) {
            return source + " #" + r.getId();
        }
        long nights = java.time.temporal.ChronoUnit.DAYS.between(in, out);
        if (nights <= 0) {
            return source + " #" + r.getId();
        }
        return source + " · " + nights + " nuit" + (nights > 1 ? "s" : "");
    }

    /**
     * Sous-description (caption) : plage de dates "JJ/MM → JJ/MM" si dispo,
     * sinon {@code null} (le frontend masque la ligne caption).
     */
    private static String buildReservationSubDescription(Reservation r) {
        java.time.LocalDate in = r.getCheckIn();
        java.time.LocalDate out = r.getCheckOut();
        if (in == null || out == null) return null;
        java.time.format.DateTimeFormatter fmt = java.time.format.DateTimeFormatter.ofPattern("dd/MM");
        return in.format(fmt) + " → " + out.format(fmt);
    }
}
