package com.clenzy.service;

import com.clenzy.dto.PublicUpsellDto;
import com.clenzy.dto.UpsellCheckoutDto;
import com.clenzy.dto.UpsellOfferDto;
import com.clenzy.dto.UpsellOfferRequest;
import com.clenzy.dto.UpsellOrderDto;
import com.clenzy.model.*;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UpsellOfferRepository;
import com.clenzy.repository.UpsellOrderRepository;
import com.clenzy.repository.WelcomeGuideRepository;
import com.clenzy.repository.WelcomeGuideTokenRepository;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.clenzy.dto.PaymentOrchestrationRequest;
import com.clenzy.dto.PaymentOrchestrationResult;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Upsells payants du livret : catalogue côté hôte + achat guest via Stripe.
 *
 * <p>Le paiement est chargé sur le compte plateforme (comme les réservations). À la
 * confirmation (webhook), la <b>part hôte</b> est créditée via le ledger interne
 * (plateforme → wallet OWNER) et la <b>part plateforme</b> ({@link UpsellConfig#getPlatformFeePct()})
 * reste sur le wallet plateforme — versée à l'hôte par le pipeline de payout existant.</p>
 */
@Service
public class UpsellService {

    private static final Logger log = LoggerFactory.getLogger(UpsellService.class);
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    /** {@code sourceType} de la {@code PaymentTransaction} d'un achat d'upsell (livret ou booking). */
    public static final String SOURCE_TYPE = "UPSELL";

    private final UpsellOfferRepository offerRepository;
    private final UpsellOrderRepository orderRepository;
    private final WelcomeGuideTokenRepository tokenRepository;
    private final WelcomeGuideRepository guideRepository;
    private final ReservationRepository reservationRepository;
    private final StripeService stripeService;
    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final MonetizationConfigService monetizationConfigService;
    private final ManagementContractService managementContractService;
    private final Clock clock;
    private final PaymentOrchestrationService orchestrationService;
    /** Préparation commande + rattachement session en transactions courtes (appel provider hors tx). */
    private final TransactionTemplate writeTx;

    public UpsellService(UpsellOfferRepository offerRepository,
                         UpsellOrderRepository orderRepository,
                         WelcomeGuideTokenRepository tokenRepository,
                         WelcomeGuideRepository guideRepository,
                         ReservationRepository reservationRepository,
                         StripeService stripeService,
                         WalletService walletService,
                         LedgerService ledgerService,
                         MonetizationConfigService monetizationConfigService,
                         ManagementContractService managementContractService,
                         Clock clock,
                         PaymentOrchestrationService orchestrationService,
                         PlatformTransactionManager transactionManager) {
        this.offerRepository = offerRepository;
        this.orderRepository = orderRepository;
        this.tokenRepository = tokenRepository;
        this.guideRepository = guideRepository;
        this.reservationRepository = reservationRepository;
        this.stripeService = stripeService;
        this.walletService = walletService;
        this.ledgerService = ledgerService;
        this.monetizationConfigService = monetizationConfigService;
        this.managementContractService = managementContractService;
        this.clock = clock;
        this.orchestrationService = orchestrationService;
        this.writeTx = new TransactionTemplate(transactionManager);
    }

    /** Primitives d'une commande upsell préparée (extraites en tx pour l'appel provider hors tx). */
    private record UpsellPrep(Long orderId, Long orgId, java.math.BigDecimal amount,
                              String currency, String title, String guestEmail) {}

    // ─── Admin (hôte) ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<UpsellOfferDto> listOffers(Long orgId) {
        return offerRepository.findByOrganizationIdOrderBySortOrderAscIdAsc(orgId)
            .stream().map(UpsellOfferDto::from).toList();
    }

    @Transactional
    public UpsellOfferDto createOffer(Long orgId, UpsellOfferRequest req) {
        UpsellOffer offer = new UpsellOffer();
        offer.setOrganizationId(orgId);
        apply(offer, req);
        return UpsellOfferDto.from(offerRepository.save(offer));
    }

    @Transactional
    public UpsellOfferDto updateOffer(Long orgId, Long id, UpsellOfferRequest req) {
        UpsellOffer offer = offerRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Offre introuvable: " + id));
        apply(offer, req);
        return UpsellOfferDto.from(offerRepository.save(offer));
    }

    @Transactional
    public void deleteOffer(Long orgId, Long id) {
        UpsellOffer offer = offerRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Offre introuvable: " + id));
        offerRepository.delete(offer);
    }

    @Transactional(readOnly = true)
    public List<UpsellOrderDto> listOrders(Long orgId) {
        return orderRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId)
            .stream().map(UpsellOrderDto::from).toList();
    }

    private void apply(UpsellOffer offer, UpsellOfferRequest req) {
        offer.setPropertyId(req.propertyId());
        offer.setType(parseType(req.type()));
        offer.setTitle(req.title());
        offer.setDescription(req.description());
        offer.setPrice(req.price());
        if (req.currency() != null && !req.currency().isBlank()) offer.setCurrency(req.currency().toUpperCase());
        offer.setImageUrl(req.imageUrl());
        if (req.active() != null) offer.setActive(req.active());
        if (req.sortOrder() != null) offer.setSortOrder(req.sortOrder());
        offer.setMinNights(req.minNights());
        offer.setLeadTimeHours(req.leadTimeHours());
        offer.setBundleOfferIds(req.bundleOfferIds());
        // Diffusion par canal : null = inchangé (update) ou défaut true (création, via la valeur d'entité).
        if (req.diffuseOnLivret() != null) offer.setDiffuseOnLivret(req.diffuseOnLivret());
        if (req.diffuseOnBooking() != null) offer.setDiffuseOnBooking(req.diffuseOnBooking());
    }

    /**
     * Conditions de productisation (2.10) : l'offre n'est proposée que si le séjour atteint le nombre
     * de nuits minimal ET si l'arrivée est assez lointaine (fenêtre horaire de commande). Sans contexte
     * de réservation (preview livret), aucune condition n'est appliquée. Dates en timezone de la
     * propriété (repli Europe/Paris — audit #9).
     */
    private boolean matchesStayConditions(UpsellOffer offer, Reservation reservation) {
        if (offer.getMinNights() == null && offer.getLeadTimeHours() == null) {
            return true;
        }
        if (reservation == null || reservation.getCheckIn() == null) {
            return true;
        }
        if (offer.getMinNights() != null && reservation.getCheckOut() != null) {
            long nights = ChronoUnit.DAYS.between(reservation.getCheckIn(), reservation.getCheckOut());
            if (nights < offer.getMinNights()) {
                return false;
            }
        }
        if (offer.getLeadTimeHours() != null) {
            ZoneId zone = resolvePropertyZone(reservation.getProperty());
            ZonedDateTime checkInAt = reservation.getCheckIn().atTime(parseCheckInTime(reservation.getCheckInTime())).atZone(zone);
            long hoursUntil = ChronoUnit.HOURS.between(ZonedDateTime.now(clock.withZone(zone)), checkInAt);
            if (hoursUntil < offer.getLeadTimeHours()) {
                return false;
            }
        }
        return true;
    }

    private ZoneId resolvePropertyZone(Property property) {
        try {
            if (property != null && property.getTimezone() != null && !property.getTimezone().isBlank()) {
                return ZoneId.of(property.getTimezone());
            }
        } catch (DateTimeException ignored) {
            // timezone invalide en base → repli documenté
        }
        return ZoneId.of("Europe/Paris");
    }

    private LocalTime parseCheckInTime(String raw) {
        if (raw != null && raw.trim().length() >= 5) {
            try {
                return LocalTime.parse(raw.trim().substring(0, 5));
            } catch (DateTimeException ignored) {
                // format inattendu → repli 15:00
            }
        }
        return LocalTime.of(15, 0);
    }

    private static UpsellType parseType(String raw) {
        if (raw == null || raw.isBlank()) return UpsellType.OTHER;
        try {
            return UpsellType.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return UpsellType.OTHER;
        }
    }

    // ─── Guest ─────────────────────────────────────────────────────────────────

    /**
     * Offres applicables au livret du token : org-wide ({@code propertyId == null}) + celles du
     * logement du livret. Ne nécessite PAS de réservation (vaut pour un lien manuel / le livret par
     * défaut) — le logement est résolu depuis le livret, avec repli sur la réservation. Vide si
     * token invalide ou livret non publié.
     */
    @Transactional(readOnly = true)
    public List<PublicUpsellDto> listForToken(UUID token) {
        WelcomeGuideToken tok = validToken(token).orElse(null);
        if (tok == null || tok.getGuide() == null || !tok.getGuide().isPublished()) {
            return List.of();
        }
        Long propertyId = resolvePropertyId(tok);
        // Sélection par livret : null = tous les services applicables ; sinon uniquement ces ids.
        java.util.Set<Long> selected = parseOfferIds(tok.getGuide().getUpsellOfferIds());
        Reservation reservation = tok.getReservation();
        List<UpsellOffer> all = offerRepository.findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(tok.getOrganizationId());
        // Map id → titre, pour résoudre les éléments inclus des bundles (2.10).
        java.util.Map<Long, String> titlesById = new java.util.HashMap<>();
        for (UpsellOffer o : all) {
            titlesById.put(o.getId(), o.getTitle());
        }
        return all.stream()
            .filter(UpsellOffer::isDiffuseOnLivret) // canal livret (diffusion par canal)
            .filter(o -> o.getPropertyId() == null || o.getPropertyId().equals(propertyId))
            .filter(o -> selected == null || selected.contains(o.getId()))
            .filter(o -> matchesStayConditions(o, reservation))
            .map(o -> PublicUpsellDto.from(o, resolveBundleItems(o, titlesById)))
            .toList();
    }

    /**
     * Offres applicables au BOOKING ENGINE (diffusion canal `diffuseOnBooking`) : org-wide ou du
     * logement donné. Pas de conditions de séjour (contexte pré-réservation). Org résolue en amont
     * par le contexte public (slug/clé API).
     */
    @Transactional(readOnly = true)
    public List<PublicUpsellDto> listForBooking(Long orgId, Long propertyId) {
        List<UpsellOffer> all = offerRepository.findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(orgId);
        java.util.Map<Long, String> titlesById = new java.util.HashMap<>();
        for (UpsellOffer o : all) {
            titlesById.put(o.getId(), o.getTitle());
        }
        return all.stream()
            .filter(UpsellOffer::isDiffuseOnBooking)
            .filter(o -> o.getPropertyId() == null || o.getPropertyId().equals(propertyId))
            .map(o -> PublicUpsellDto.from(o, resolveBundleItems(o, titlesById)))
            .toList();
    }

    /** Résout les titres des offres incluses dans un bundle (CSV d'ids → titres connus). */
    private List<String> resolveBundleItems(UpsellOffer offer, java.util.Map<Long, String> titlesById) {
        String csv = offer.getBundleOfferIds();
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        List<String> items = new java.util.ArrayList<>();
        for (String token : csv.split(",")) {
            String t = token.trim();
            if (t.isEmpty()) continue;
            try {
                String title = titlesById.get(Long.parseLong(t));
                if (title != null) items.add(title);
            } catch (NumberFormatException ignored) {
                // id corrompu : ignoré
            }
        }
        return items;
    }

    /**
     * Crée une commande PENDING + une session de paiement EMBARQUÉE (orchestrée). Renvoie le clientSecret.
     * Échoue si le token est invalide / sans réservation ou l'offre inapplicable.
     *
     * <p>PAS de {@code @Transactional} au niveau méthode (règle #2) : la préparation
     * (validation + commande) est en transaction courte, l'appel provider est HORS tx,
     * puis la réf de session est rattachée en transaction courte.</p>
     */
    public UpsellCheckoutDto createCheckout(UUID token, Long offerId) {
        UpsellPrep prep = writeTx.execute(status -> prepareLivretOrder(token, offerId));
        PaymentOrchestrationResult result = initiateUpsellPayment(prep, true, null);
        attachProviderSession(prep.orderId(), result.paymentResult().providerTxId());
        return new UpsellCheckoutDto(result.paymentResult().clientSecret(), prep.orderId());
    }

    /** Validation + création de la commande livret (dans une transaction courte : lazy loads token/résa). */
    private UpsellPrep prepareLivretOrder(UUID token, Long offerId) {
        WelcomeGuideToken tok = validToken(token)
            .orElseThrow(() -> new IllegalArgumentException("Lien invalide ou expiré"));
        // Réservation optionnelle : un livret sans réservation (lien « par défaut ») peut vendre des
        // services — le logement est résolu via le livret (comme listForToken).
        Reservation reservation = tok.getReservation();
        Long propertyId = resolvePropertyId(tok);

        UpsellOffer offer = offerRepository.findByIdAndOrganizationId(offerId, tok.getOrganizationId())
            .filter(UpsellOffer::isActive)
            .filter(o -> o.getPropertyId() == null || o.getPropertyId().equals(propertyId))
            .orElseThrow(() -> new IllegalArgumentException("Offre indisponible: " + offerId));

        UpsellOrder order = new UpsellOrder();
        order.setOrganizationId(tok.getOrganizationId());
        order.setReservationId(reservation != null ? reservation.getId() : null);
        order.setGuideId(tok.getGuide() != null ? tok.getGuide().getId() : null);
        order.setOfferId(offer.getId());
        order.setTitle(offer.getTitle());
        order.setAmount(offer.getPrice());
        order.setCurrency(offer.getCurrency());
        order.setGuestEmail(reservation != null ? guestEmail(reservation) : null);
        order.setStatus(UpsellOrderStatus.PENDING);
        order = orderRepository.save(order);
        return new UpsellPrep(order.getId(), order.getOrganizationId(), order.getAmount(),
            order.getCurrency(), order.getTitle(), order.getGuestEmail());
    }

    /**
     * Achat d'un upsell depuis le BOOKING ENGINE : crée une commande PENDING + une session Stripe
     * HÉBERGÉE (redirection, comme le checkout réservation — le SDK n'a pas de Stripe.js embedded).
     * La réservation (résolue par code + org en amont) lie la commande ; {@code successUrl} est déjà
     * validé (anti open-redirect) par l'appelant. Confirmation/répartition via le webhook habituel.
     */
    public com.clenzy.dto.UpsellBookingCheckoutDto createBookingCheckout(
            Long orgId, Reservation reservation, Long offerId, String successUrl) {
        final Long reservationId = reservation.getId();
        UpsellPrep prep = writeTx.execute(status -> prepareBookingOrder(orgId, reservationId, offerId));
        PaymentOrchestrationResult result = initiateUpsellPayment(prep, false, successUrl);
        attachProviderSession(prep.orderId(), result.paymentResult().providerTxId());
        return new com.clenzy.dto.UpsellBookingCheckoutDto(result.paymentResult().redirectUrl(), prep.orderId());
    }

    /** Validation + création de la commande booking (dans une transaction courte : lazy loads résa/property). */
    private UpsellPrep prepareBookingOrder(Long orgId, Long reservationId, Long offerId) {
        Reservation reservation = reservationRepository.findById(reservationId)
            .orElseThrow(() -> new IllegalArgumentException("Réservation introuvable: " + reservationId));
        Long propertyId = reservation.getProperty() != null ? reservation.getProperty().getId() : null;
        UpsellOffer offer = offerRepository.findByIdAndOrganizationId(offerId, orgId)
            .filter(UpsellOffer::isActive)
            .filter(UpsellOffer::isDiffuseOnBooking)
            .filter(o -> o.getPropertyId() == null || o.getPropertyId().equals(propertyId))
            .orElseThrow(() -> new IllegalArgumentException("Offre indisponible: " + offerId));

        UpsellOrder order = new UpsellOrder();
        order.setOrganizationId(orgId);
        order.setReservationId(reservation.getId());
        order.setOfferId(offer.getId());
        order.setTitle(offer.getTitle());
        order.setAmount(offer.getPrice());
        order.setCurrency(offer.getCurrency());
        order.setGuestEmail(guestEmail(reservation));
        order.setStatus(UpsellOrderStatus.PENDING);
        order = orderRepository.save(order);
        return new UpsellPrep(order.getId(), order.getOrganizationId(), order.getAmount(),
            order.getCurrency(), order.getTitle(), order.getGuestEmail());
    }

    /**
     * Initie le paiement d'upsell via l'orchestrateur (multi-provider selon org + devise de l'offre).
     * {@code embedded} → clientSecret (livret) ; sinon hébergé avec {@code successUrl} validé (booking).
     * La réconciliation (PAID + split) est portée par le consumer {@code PAYMENT_COMPLETED}
     * (sourceType {@code UPSELL}) → {@link #markPaidBySession}.
     */
    private PaymentOrchestrationResult initiateUpsellPayment(UpsellPrep prep, boolean embedded, String successUrl) {
        PaymentOrchestrationRequest request = new PaymentOrchestrationRequest(
            prep.amount(),                       // Z3-SEC-01 : montant serveur (prix de l'offre)
            prep.currency(),
            SOURCE_TYPE,
            prep.orderId(),
            prep.title(),
            prep.guestEmail(),
            null,                                 // preferredProvider
            successUrl,                           // hébergé : URL déjà validée ; embedded : ignorée
            null,                                 // cancelUrl : défaut provider
            java.util.Map.of("type", "upsell", "upsell_order_id", String.valueOf(prep.orderId())),
            "UPSELL-" + prep.orderId(),
            embedded,
            null,
            false);
        // Flux public (livret/booking) : org explicite, pas de dépendance au TenantContext.
        PaymentOrchestrationResult result = orchestrationService.initiatePayment(prep.orgId(), null, request);
        if (!result.isSuccess()) {
            String err = result.paymentResult() != null ? result.paymentResult().errorMessage() : "erreur inconnue";
            log.error("Echec orchestration upsell (order={}): {}", prep.orderId(), err);
            throw new RuntimeException("Paiement indisponible pour le moment");
        }
        return result;
    }

    /** Rattache la réf de session provider à la commande (transaction courte). */
    private void attachProviderSession(Long orderId, String providerTxId) {
        writeTx.executeWithoutResult(status -> {
            UpsellOrder order = orderRepository.findById(orderId).orElse(null);
            if (order != null) {
                order.setStripeSessionId(providerTxId);
                orderRepository.save(order);
            }
        });
    }

    /**
     * Filet de secours appelé par le guest après paiement : re-vérifie la session
     * Stripe côté serveur et marque PAID si payé. Vérifie que la commande appartient
     * bien au token (org + réservation). Idempotent. Retourne le statut final.
     */
    @Transactional
    public String confirmOrder(UUID token, Long orderId) {
        WelcomeGuideToken tok = validToken(token).orElse(null);
        UpsellOrder order = orderRepository.findById(orderId).orElse(null);
        if (tok == null || order == null) {
            return "INVALID";
        }
        if (!order.getOrganizationId().equals(tok.getOrganizationId()) || !orderBelongsToToken(order, tok)) {
            return "INVALID";
        }
        if (order.getStatus() == UpsellOrderStatus.PAID) {
            return "PAID";
        }
        if (order.getStripeSessionId() != null && stripeService.isCheckoutSessionPaid(order.getStripeSessionId())) {
            markPaidBySession(order.getStripeSessionId());
            return "PAID";
        }
        return order.getStatus().name();
    }

    // ─── Confirmation paiement (webhook) ────────────────────────────────────────

    /**
     * Confirme une commande à partir de la session Stripe (idempotent) et crédite la
     * part hôte via le ledger ; la part plateforme reste sur le wallet plateforme.
     */
    @Transactional
    public void markPaidBySession(String sessionId) {
        UpsellOrder order = orderRepository.findByStripeSessionId(sessionId).orElse(null);
        if (order == null) {
            log.warn("Upsell payé : aucune commande pour la session {}", sessionId);
            return;
        }
        if (order.getStatus() == UpsellOrderStatus.PAID) {
            return; // idempotent
        }

        Long orgId = order.getOrganizationId();
        BigDecimal amount = order.getAmount();
        // 1) Commission plateforme. 2) Sur le reste, commission org/conciergerie. 3) Solde = hôte.
        BigDecimal platformFeePct = monetizationConfigService.getEffectiveUpsellPlatformFeePct(orgId);
        BigDecimal platformFee = amount.multiply(platformFeePct).divide(HUNDRED, 2, RoundingMode.HALF_UP);
        BigDecimal remainder = amount.subtract(platformFee);
        // Part conciergerie : taux du contrat de gestion du logement s'il existe, sinon défaut org.
        BigDecimal orgPct = resolveUpsellConciergePct(orgId, order);
        BigDecimal orgShare = remainder.multiply(orgPct).divide(HUNDRED, 2, RoundingMode.HALF_UP);
        BigDecimal hostShare = remainder.subtract(orgShare);

        order.setStatus(UpsellOrderStatus.PAID);
        order.setPaidAt(LocalDateTime.now());
        order.setPlatformFeeAmount(platformFee);
        order.setHostAmount(hostShare);
        orderRepository.save(order);

        recordSplit(order, hostShare, orgShare);
        log.info("Upsell payé order={} montant={} {} → hôte={} conciergerie={} plateforme={}",
            order.getId(), amount, order.getCurrency(), hostShare, orgShare, platformFee);
    }

    /** Crédite part hôte (wallet OWNER) + part conciergerie (wallet CONCIERGE) via le ledger. Best-effort. */
    private void recordSplit(UpsellOrder order, BigDecimal hostShare, BigDecimal orgShare) {
        try {
            Long orgId = order.getOrganizationId();
            String currency = order.getCurrency();
            Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, currency);
            String ref = "UPSELL-" + order.getId();

            if (orgShare != null && orgShare.compareTo(BigDecimal.ZERO) > 0) {
                Wallet conciergeWallet = walletService.getOrCreateWallet(orgId, WalletType.CONCIERGE, null, currency);
                ledgerService.recordTransfer(platformWallet, conciergeWallet, orgShare,
                    LedgerReferenceType.UPSELL, ref,
                    "Part conciergerie upsell « " + order.getTitle() + " » (commande #" + order.getId() + ")");
            }

            if (hostShare == null || hostShare.compareTo(BigDecimal.ZERO) <= 0) {
                return;
            }
            Long ownerId = ownerIdForOrder(order);
            if (ownerId == null) {
                log.warn("Upsell order={} : pas d'owner, part hôte non créditée au ledger", order.getId());
                return;
            }
            Wallet ownerWallet = walletService.getOrCreateWallet(orgId, WalletType.OWNER, ownerId, currency);
            ledgerService.recordTransfer(platformWallet, ownerWallet, hostShare,
                LedgerReferenceType.UPSELL, ref,
                "Part hôte upsell « " + order.getTitle() + " » (commande #" + order.getId() + ")");
        } catch (Exception e) {
            log.error("Echec crédit ledger split upsell order={}: {}", order.getId(), e.getMessage());
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    /** Token valide (fenêtre + non révoqué + résa non annulée) — réservation NON requise (lien manuel). */
    private Optional<WelcomeGuideToken> validToken(UUID token) {
        return tokenRepository.findByToken(token).filter(WelcomeGuideToken::isCurrentlyValid);
    }

    /**
     * Parse la sélection de services d'un livret (JSON array d'ids) en Set.
     * {@code null}/vide → {@code null} (= afficher TOUS les services) ; {@code "[]"} → ensemble
     * vide (= n'afficher AUCUN service, l'hôte a tout décoché).
     */
    private static java.util.Set<Long> parseOfferIds(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        java.util.Set<Long> ids = new java.util.HashSet<>();
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\d+").matcher(json);
        while (m.find()) {
            ids.add(Long.parseLong(m.group()));
        }
        return ids;
    }

    /** Part conciergerie (%) sur les upsells : taux du contrat de gestion du logement, sinon défaut org. */
    private BigDecimal resolveUpsellConciergePct(Long orgId, UpsellOrder order) {
        Long propertyId = propertyIdForOrder(order);
        if (propertyId != null) {
            try {
                Optional<ManagementContract> c = managementContractService.getActiveContract(propertyId, orgId);
                if (c != null && c.isPresent() && c.get().getUpsellCommissionRate() != null) {
                    return c.get().getUpsellCommissionRate().multiply(HUNDRED); // fraction (0.17) → pourcentage (17)
                }
            } catch (Exception ignored) {
                // Résolution contrat best-effort → repli sur le défaut org ci-dessous.
            }
        }
        return monetizationConfigService.getEffectiveUpsellOrgCommissionPct(orgId);
    }

    /** Logement de la commande : via la réservation, sinon via le livret. Défensif : null → défaut org. */
    private Long propertyIdForOrder(UpsellOrder order) {
        try {
            if (order.getReservationId() != null) {
                Long viaResa = reservationRepository.findById(order.getReservationId())
                    .map(Reservation::getProperty).map(Property::getId).orElse(null);
                if (viaResa != null) {
                    return viaResa;
                }
            }
            if (order.getGuideId() != null) {
                return guideRepository.findById(order.getGuideId())
                    .map(WelcomeGuide::getProperty).map(Property::getId).orElse(null);
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    /** Propriétaire du logement de la commande : via la réservation, sinon via le livret. Null si non résoluble. */
    private Long ownerIdForOrder(UpsellOrder order) {
        try {
            if (order.getReservationId() != null) {
                Long viaResa = reservationRepository.findById(order.getReservationId())
                    .map(Reservation::getProperty)
                    .map(p -> p.getOwner() != null ? p.getOwner().getId() : null)
                    .orElse(null);
                if (viaResa != null) {
                    return viaResa;
                }
            }
            if (order.getGuideId() != null) {
                return guideRepository.findById(order.getGuideId())
                    .map(WelcomeGuide::getProperty)
                    .map(p -> p.getOwner() != null ? p.getOwner().getId() : null)
                    .orElse(null);
            }
        } catch (Exception e) {
            // best-effort → null
        }
        return null;
    }

    /**
     * Vérifie qu'une commande appartient bien au token : par réservation si la commande en a une,
     * sinon par livret (guideId). Empêche de confirmer la commande d'autrui.
     */
    private boolean orderBelongsToToken(UpsellOrder order, WelcomeGuideToken tok) {
        if (order.getReservationId() != null) {
            return tok.getReservation() != null && order.getReservationId().equals(tok.getReservation().getId());
        }
        return tok.getGuide() != null && order.getGuideId() != null
            && order.getGuideId().equals(tok.getGuide().getId());
    }

    /** Logement applicable aux offres : celui du livret en priorité, sinon celui de la réservation. */
    private Long resolvePropertyId(WelcomeGuideToken tok) {
        if (tok.getGuide() != null && tok.getGuide().getProperty() != null) {
            return tok.getGuide().getProperty().getId();
        }
        if (tok.getReservation() != null && tok.getReservation().getProperty() != null) {
            return tok.getReservation().getProperty().getId();
        }
        return null;
    }

    private static String guestEmail(Reservation reservation) {
        try {
            return reservation.getGuest() != null ? reservation.getGuest().getEmail() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
