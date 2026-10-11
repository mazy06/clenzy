package com.clenzy.service;

import com.clenzy.dto.PaymentHistoryDto;
import com.clenzy.dto.PaymentSummaryDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.ReservationPaymentState;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.ServiceQuoteRepository;
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
    private final ServiceQuoteRepository serviceQuoteRepository;
    private final InterventionBatchCheckoutService batchCheckout;
    private final BaitlyInterventionCheckoutExpiry checkoutExpiry;
    private final BaitlyMaintenanceDepositCheckout maintenanceDeposit;
    private final com.clenzy.repository.PaymentTransactionRepository transactions;

    public PaymentQueryService(InterventionRepository interventionRepository,
                               ReservationRepository reservationRepository,
                               ServiceRequestRepository serviceRequestRepository,
                               UserService userService,
                               StripeService stripeService,
                               TenantContext tenantContext,
                               ServiceQuoteRepository serviceQuoteRepository, InterventionBatchCheckoutService batchCheckout,
                               com.clenzy.repository.PaymentTransactionRepository transactions, BaitlyInterventionCheckoutExpiry checkoutExpiry,
                               BaitlyMaintenanceDepositCheckout maintenanceDeposit) {
        this.maintenanceDeposit=maintenanceDeposit;
        this.checkoutExpiry = checkoutExpiry;
        this.transactions = transactions;
        this.batchCheckout = batchCheckout;
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.serviceRequestRepository = serviceRequestRepository;
        this.userService = userService;
        this.stripeService = stripeService;
        this.tenantContext = tenantContext;
        this.serviceQuoteRepository = serviceQuoteRepository;
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

        var deposit=maintenanceDeposit.sessionStatus(sessionId,orgId);
        if(deposit.isPresent())return deposit;
        var batch = batchCheckout.sessionStatus(sessionId, orgId);
        if (batch.isPresent()) return batch;
        if (checkoutExpiry.reconcile(sessionId, orgId))
            return Optional.of(Map.of("paymentStatus", "FAILED", "interventionStatus", "CHECKOUT_EXPIRED"));
        // Les anciens lots sans allocation ne passent jamais dans un lookup unitaire.
        if (interventionRepository.findAllByStripeSessionIdAndOrganizationId(sessionId, orgId).size() > 1) {
            return Optional.of(Map.of("paymentStatus", "PROCESSING", "interventionStatus", "RECONCILIATION_REQUIRED"));
        }

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

        if (currentUser.getRole().isOwnerScoped()) {
            interventionPage = interventionRepository.findPaymentHistoryByRequestor(
                    currentUser.getId(), paymentStatus, largePage, orgId);
        } else {
            interventionPage = interventionRepository.findPaymentHistory(
                    paymentStatus, hostId, largePage, orgId);
        }

        // ── 2) Charger les reservations ─────────────────────────────────────
        // Le filtre porte sur le statut vérifié affiché, pas sur les anciens statuts déduits.
        Page<Reservation> reservationPage = reservationRepository.findPaymentHistory(
                null, currentUser.getRole().isOwnerScoped() ? currentUser.getId() : hostId, largePage, orgId);

        // ── 2b) Charger les SR AWAITING_PAYMENT ──────────────────────────────
        Page<ServiceRequest> srPage;
        boolean isHost = currentUser.getRole().isOwnerScoped();
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
        enrichHistory(orgId, pageContent);
        return Map.of("content", pageContent, "totalElements", merged.size(),
                "totalPages", (int) Math.ceil((double) merged.size() / size), "number", page, "size", size);
    }

    /** Les clés sont issues d'une requête déjà filtrée par organisation et propriétaire. */
    @Transactional(readOnly = true)
    public List<PaymentHistoryDto> hydrateBaitlyPaymentPage(List<com.clenzy.repository.BaitlyPaymentHistoryRepository.Key> keys) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        Map<String, PaymentHistoryDto> records = new java.util.HashMap<>();
        var missionIds = keys.stream().filter(k -> k.type().equals("INTERVENTION")).map(com.clenzy.repository.BaitlyPaymentHistoryRepository.Key::id).toList();
        var bookingIds = keys.stream().filter(k -> k.type().equals("RESERVATION")).map(com.clenzy.repository.BaitlyPaymentHistoryRepository.Key::id).toList();
        var requestIds = keys.stream().filter(k -> k.type().equals("SERVICE_REQUEST")).map(com.clenzy.repository.BaitlyPaymentHistoryRepository.Key::id).toList();
        if (!missionIds.isEmpty()) {
            var quotes = serviceQuoteRepository.findBaitlyPaymentPageQuotes(missionIds, orgId).stream()
                    .collect(java.util.stream.Collectors.groupingBy(com.clenzy.model.ServiceQuote::getInterventionId));
            interventionRepository.findBaitlyPaymentPage(missionIds, orgId)
                    .forEach(i -> records.put("INTERVENTION:" + i.getId(), toPaymentHistoryDto(i, quotes.getOrDefault(i.getId(), List.of()))));
        }
        if (!bookingIds.isEmpty()) reservationRepository.findBaitlyPaymentPage(bookingIds, orgId)
                .forEach(r -> records.put("RESERVATION:" + r.getId(), toReservationPaymentDto(r)));
        if (!requestIds.isEmpty()) serviceRequestRepository.findBaitlyPaymentPage(requestIds, orgId)
                .forEach(s -> records.put("SERVICE_REQUEST:" + s.getId(), toServiceRequestPaymentDto(s)));
        var content = keys.stream().map(k -> records.get(k.type() + ":" + k.id())).filter(java.util.Objects::nonNull).toList();
        enrichHistory(orgId, content);
        return content;
    }

    private void enrichHistory(Long orgId, List<PaymentHistoryDto> pageContent) {
        var refundRows = interventionRefunds(orgId, pageContent.stream().filter(d -> "INTERVENTION".equals(d.type))
                .map(d -> d.referenceId).toList());
        var missionIds = pageContent.stream().filter(d -> "INTERVENTION".equals(d.type)).map(d -> d.referenceId).toList();
        var partialRefundIds = missionIds.isEmpty() ? java.util.Set.<Long>of()
                : new java.util.HashSet<>(transactions.findStandaloneRefundableMissionIds(orgId, missionIds));
        if (!missionIds.isEmpty()) partialRefundIds.addAll(transactions.findAllocatedRefundableMissionIds(orgId,missionIds));
        var maintenanceIds=missionIds.isEmpty()?java.util.Set.<Long>of():new java.util.HashSet<>(transactions.findMaintenanceRefundCandidateMissionIds(orgId,missionIds));
        pageContent.forEach(dto -> dto.refundAcrossReceipts="INTERVENTION".equals(dto.type) && maintenanceIds.contains(dto.referenceId));
        pageContent.forEach(dto -> dto.supportsPartialRefund = "INTERVENTION".equals(dto.type)
                && partialRefundIds.contains(dto.referenceId));
        var bookingRefunds = sourceRefunds(orgId, pageContent.stream().filter(d -> "RESERVATION".equals(d.type))
                .map(d -> d.referenceId).toList(), "BOOKING_CANCELLATION");
        var externalStayRefunds = sourceRefunds(orgId, pageContent.stream().filter(d -> "RESERVATION".equals(d.type))
                .map(d -> d.referenceId).toList(), "RESERVATION");
        externalStayRefunds.forEach((id, refunds) -> bookingRefunds.computeIfAbsent(id, ignored -> new java.util.ArrayList<>()).addAll(refunds));
        if (!pageContent.isEmpty()) {
            var disputed = transactions.findDisputedSources(orgId, pageContent.stream().map(d -> d.referenceId).toList())
                    .stream().map(row -> row[0] + ":" + row[1]).collect(java.util.stream.Collectors.toSet());
            pageContent.forEach(dto -> dto.paymentDisputed = disputed.contains(dto.type + ":" + dto.referenceId));
        }
        pageContent.stream().filter(d -> "INTERVENTION".equals(d.type) || "RESERVATION".equals(d.type)).forEach(dto -> {
            var refunds = "RESERVATION".equals(dto.type) ? bookingRefunds : refundRows;
            for (var tx : refunds.getOrDefault(dto.referenceId,List.of())) {
                if (!java.util.Objects.equals(dto.currency,tx.getCurrency())) { dto.refundReviewRequired=true; continue; }
                if (tx.getStatus()==com.clenzy.model.TransactionStatus.COMPLETED) dto.refundedAmount=dto.refundedAmount.add(tx.getAmount());
                else if (tx.getStatus()==com.clenzy.model.TransactionStatus.PROCESSING) dto.refundPendingAmount=dto.refundPendingAmount.add(tx.getAmount());
                dto.refundReviewRequired |= tx.getStatus()==com.clenzy.model.TransactionStatus.PROCESSING
                        || (tx.getMetadata()!=null && Boolean.TRUE.equals(tx.getMetadata().get("reviewRequired")));
            }
        });

    }

    /**
     * Resume agrege des paiements (interventions + reservations + SR en
     * attente). HOST : restreint a ses propres elements.
     */
    @Transactional(readOnly = true)
    public PaymentSummaryDto getPaymentSummary(User currentUser, Long hostId) {
        // HOST : force son propre ID
        Long effectiveHostId = currentUser.getRole().isOwnerScoped() ? currentUser.getId() : hostId;
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

        var interventionRefunds = interventionRefunds(orgId, interventions.getContent().stream().map(Intervention::getId).toList());
        // Additionner les interventions
        for (Intervention i : interventions.getContent()) {
            BigDecimal cost = i.getEstimatedCost() != null ? i.getEstimatedCost() : BigDecimal.ZERO;
            PaymentStatus ps = i.getPaymentStatus();
            if (ps == PaymentStatus.PAID) {
                summary.totalPaid = summary.totalPaid.add(cost);
            } else if (ps == PaymentStatus.REFUNDED) {
                summary.totalRefunded = summary.totalRefunded.add(cost);
            } else if (ps == PaymentStatus.PARTIALLY_REFUNDED) {
                var returned = interventionRefunds.getOrDefault(i.getId(),List.of()).stream()
                        .filter(tx -> tx.getStatus()==com.clenzy.model.TransactionStatus.COMPLETED
                                && java.util.Objects.equals(i.getCurrency()==null?"EUR":i.getCurrency(),tx.getCurrency()))
                        .map(com.clenzy.model.PaymentTransaction::getAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
                if(returned.signum()>0 && returned.compareTo(cost)<0) {
                    summary.totalRefunded=summary.totalRefunded.add(returned);
                    summary.totalPaid=summary.totalPaid.add(cost.subtract(returned));
                } else {
                    summary.totalToVerify=summary.totalToVerify.add(cost);
                    summary.toVerifyByCurrency.merge(i.getCurrency()==null?"EUR":i.getCurrency(),cost,BigDecimal::add);
                }
            } else {
                summary.totalPending = summary.totalPending.add(cost);
            }
        }

        // Additionner les reservations
        List<Reservation> reservations = reservationRepository.findAllWithPayment(orgId, effectiveHostId);
        List<Long> refundedIds = reservations.stream().filter(r -> r.getPaymentStatus() == PaymentStatus.PARTIALLY_REFUNDED
                || r.getPaymentStatus() == PaymentStatus.REFUNDED).map(Reservation::getId).toList();
        Map<Long, BigDecimal> confirmedRefunds = new java.util.HashMap<>();
        if (!refundedIds.isEmpty()) {
            transactions.findReservationFunding(orgId, refundedIds, java.util.Set.of("BOOKING_CANCELLATION", "RESERVATION")).stream()
                    .filter(tx -> tx.getPaymentType() == com.clenzy.model.TransactionType.REFUND
                            && tx.getStatus() == com.clenzy.model.TransactionStatus.COMPLETED)
                    .forEach(tx -> confirmedRefunds.merge(tx.getSourceId(), tx.getAmount(), BigDecimal::add));
        }
        for (Reservation r : reservations) {
            BigDecimal cost = r.getTotalPrice() != null ? r.getTotalPrice() : BigDecimal.ZERO;
            PaymentStatus ps = ReservationPaymentState.effectiveStatus(r);
            BigDecimal cash = cost;
            if (r.getPaymentCollection() == com.clenzy.model.PaymentCollection.PMS) {
                var credit = r.getCreditApplied() == null ? BigDecimal.ZERO : r.getCreditApplied();
                if (credit.signum() < 0 || (credit.signum() > 0 &&
                        (credit.compareTo(cost) >= 0 || !"EUR".equalsIgnoreCase(r.getCurrency())))) ps = PaymentStatus.UNKNOWN;
                else cash = cost.subtract(credit);
            }
            if (ps == PaymentStatus.UNKNOWN) {
                summary.totalToVerify = summary.totalToVerify.add(cost);
                summary.toVerifyByCurrency.merge(r.getCurrency() != null ? r.getCurrency() : "EUR", cost, BigDecimal::add);
            } else if (ps == PaymentStatus.PAID && r.isCollectedByChannel()) {
                summary.totalPaidByOta = summary.totalPaidByOta.add(cost);
                summary.paidByOtaByCurrency.merge(r.getCurrency() != null ? r.getCurrency() : "EUR", cost, BigDecimal::add);
            } else if (ps == PaymentStatus.PAID) {
                summary.totalPaid = summary.totalPaid.add(cash);
            } else if (ps == PaymentStatus.REFUNDED) {
                summary.totalRefunded = summary.totalRefunded.add(confirmedRefunds.getOrDefault(r.getId(), cash));
            } else if (ps == PaymentStatus.PARTIALLY_REFUNDED) {
                BigDecimal returned = confirmedRefunds.get(r.getId());
                if (returned != null && returned.signum() > 0 && returned.compareTo(cash) <= 0) {
                    summary.totalRefunded = summary.totalRefunded.add(returned);
                    summary.totalPaid = summary.totalPaid.add(cash.subtract(returned));
                } else {
                    summary.totalToVerify = summary.totalToVerify.add(cash);
                    summary.toVerifyByCurrency.merge(r.getCurrency() != null ? r.getCurrency() : "EUR", cash, BigDecimal::add);
                }
            } else if (ps != PaymentStatus.CANCELLED && ps != PaymentStatus.NOT_REQUIRED) {
                BigDecimal due = ps == PaymentStatus.PARTIALLY_PAID && r.getAmountDue() != null
                        ? r.getAmountDue().max(BigDecimal.ZERO) : cash;
                summary.totalPending = summary.totalPending.add(due);
            }
        }

        // Additionner les SR AWAITING_PAYMENT au pending
        List<ServiceRequest> awaitingSRs = serviceRequestRepository.findAwaitingPaymentForHost(orgId, effectiveHostId);
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
        return orgId != null && orgId.equals(entityOrganizationId);
    }

    /** Une requête bornée au périmètre déjà autorisé, sans lecture par ligne. */
    private Map<Long,List<com.clenzy.model.PaymentTransaction>> interventionRefunds(Long org, List<Long> ids) {
        return sourceRefunds(org, ids, "INTERVENTION");
    }

    private Map<Long,List<com.clenzy.model.PaymentTransaction>> sourceRefunds(Long org, List<Long> ids, String source) {
        if(ids.isEmpty()) return Map.of();
        return transactions.findReservationFunding(org,ids,java.util.Set.of(source)).stream()
                .filter(tx -> tx.getPaymentType()==com.clenzy.model.TransactionType.REFUND && tx.getAmount()!=null && tx.getAmount().signum()>0)
                .collect(java.util.stream.Collectors.groupingBy(com.clenzy.model.PaymentTransaction::getSourceId));
    }

    private PaymentHistoryDto toPaymentHistoryDto(Intervention i) {
        boolean needsQuote = (i.getPaymentStatus() == null || java.util.Set.of(PaymentStatus.PENDING, PaymentStatus.FAILED).contains(i.getPaymentStatus()))
                && i.getStatus()!=null && i.getStatus()!=com.clenzy.model.InterventionStatus.CANCELLED;
        return toPaymentHistoryDto(i, needsQuote ? serviceQuoteRepository
                .findByInterventionIdAndOrganizationIdOrderByAmountAsc(i.getId(), i.getOrganizationId()) : List.of());
    }

    private PaymentHistoryDto toPaymentHistoryDto(Intervention i, List<com.clenzy.model.ServiceQuote> quotes) {
        PaymentHistoryDto dto = new PaymentHistoryDto();
        dto.id = i.getId();
        dto.referenceId = i.getId();
        // description : titre nettoye du suffixe " — <property>" si present
        // (eviter la redondance avec la colonne PROPRIETE).
        String propertyName = i.getProperty() != null ? i.getProperty().getName() : null;
        dto.description = stripPropertySuffix(i.getTitle(), propertyName);
        dto.propertyName = propertyName != null ? propertyName : "N/A";
        dto.amount = i.getEstimatedCost();
        dto.currency = i.getCurrency() != null ? i.getCurrency() : "EUR";
        dto.status = i.getPaymentStatus() != null ? i.getPaymentStatus().name() : "PENDING";
        dto.canCollect = java.util.Set.of("PENDING", "FAILED").contains(dto.status)
                && i.getStatus() != null && i.getStatus() != com.clenzy.model.InterventionStatus.CANCELLED;
        if (dto.canCollect) {
            dto.payableAmount = InterventionPaymentAmounts.payable(i, quotes, false);
            dto.canCollect = dto.payableAmount != null && dto.payableAmount.signum() > 0;
            dto.individualCheckout = dto.canCollect && i.getEstimatedCost()!=null && dto.payableAmount.compareTo(i.getEstimatedCost())<0;
        }
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
        dto.payableAmount = sr.getEstimatedCost();
        dto.status = sr.getPaymentStatus() != null ? sr.getPaymentStatus().name() : "PENDING";
        dto.canCollect = sr.getStatus() != null && "AWAITING_PAYMENT".equals(sr.getStatus().name())
                && java.util.Set.of("PENDING", "FAILED").contains(dto.status);
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
        dto.creditAppliedAmount = r.getCreditApplied() == null ? BigDecimal.ZERO : r.getCreditApplied();
        dto.currency = r.getCurrency() != null ? r.getCurrency() : "EUR";
        dto.status = ReservationPaymentState.effectiveStatus(r).name();
        dto.paymentCollection = r.getPaymentCollection() == null ? "UNKNOWN" : r.getPaymentCollection().name();
        dto.canCollect = ReservationPaymentState.canCollect(r);
        dto.settlementStatus = r.isCollectedByChannel() ? "EXTERNAL_UNVERIFIED" : null;
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
