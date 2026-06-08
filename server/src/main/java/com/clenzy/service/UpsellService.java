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
import com.clenzy.repository.WelcomeGuideTokenRepository;
import com.stripe.model.checkout.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
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

    private final UpsellOfferRepository offerRepository;
    private final UpsellOrderRepository orderRepository;
    private final WelcomeGuideTokenRepository tokenRepository;
    private final ReservationRepository reservationRepository;
    private final StripeService stripeService;
    private final WalletService walletService;
    private final LedgerService ledgerService;
    private final MonetizationConfigService monetizationConfigService;
    private final ManagementContractService managementContractService;

    public UpsellService(UpsellOfferRepository offerRepository,
                         UpsellOrderRepository orderRepository,
                         WelcomeGuideTokenRepository tokenRepository,
                         ReservationRepository reservationRepository,
                         StripeService stripeService,
                         WalletService walletService,
                         LedgerService ledgerService,
                         MonetizationConfigService monetizationConfigService,
                         ManagementContractService managementContractService) {
        this.offerRepository = offerRepository;
        this.orderRepository = orderRepository;
        this.tokenRepository = tokenRepository;
        this.reservationRepository = reservationRepository;
        this.stripeService = stripeService;
        this.walletService = walletService;
        this.ledgerService = ledgerService;
        this.monetizationConfigService = monetizationConfigService;
        this.managementContractService = managementContractService;
    }

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
        return offerRepository.findByOrganizationIdAndActiveTrueOrderBySortOrderAscIdAsc(tok.getOrganizationId())
            .stream()
            .filter(o -> o.getPropertyId() == null || o.getPropertyId().equals(propertyId))
            .filter(o -> selected == null || selected.contains(o.getId()))
            .map(PublicUpsellDto::from)
            .toList();
    }

    /**
     * Crée une commande PENDING + une session Stripe embedded. Renvoie le clientSecret.
     * Échoue si le token est invalide / sans réservation ou l'offre inapplicable.
     */
    @Transactional
    public UpsellCheckoutDto createCheckout(UUID token, Long offerId) {
        WelcomeGuideToken tok = validTokenWithReservation(token)
            .orElseThrow(() -> new IllegalArgumentException("Lien invalide ou expiré"));
        Reservation reservation = tok.getReservation();
        Long propertyId = reservation.getProperty() != null ? reservation.getProperty().getId() : null;

        UpsellOffer offer = offerRepository.findByIdAndOrganizationId(offerId, tok.getOrganizationId())
            .filter(UpsellOffer::isActive)
            .filter(o -> o.getPropertyId() == null || o.getPropertyId().equals(propertyId))
            .orElseThrow(() -> new IllegalArgumentException("Offre indisponible: " + offerId));

        UpsellOrder order = new UpsellOrder();
        order.setOrganizationId(tok.getOrganizationId());
        order.setReservationId(reservation.getId());
        order.setGuideId(tok.getGuide() != null ? tok.getGuide().getId() : null);
        order.setOfferId(offer.getId());
        order.setTitle(offer.getTitle());
        order.setAmount(offer.getPrice());
        order.setCurrency(offer.getCurrency());
        order.setGuestEmail(guestEmail(reservation));
        order.setStatus(UpsellOrderStatus.PENDING);
        order = orderRepository.save(order);

        try {
            Session session = stripeService.createUpsellCheckoutSession(
                order.getId(), offer.getPrice(), offer.getCurrency(), offer.getTitle(), order.getGuestEmail());
            order.setStripeSessionId(session.getId());
            orderRepository.save(order);
            return new UpsellCheckoutDto(session.getClientSecret(), order.getId());
        } catch (Exception e) {
            log.error("Echec creation session Stripe upsell (order={}): {}", order.getId(), e.getMessage());
            throw new RuntimeException("Paiement indisponible pour le moment", e);
        }
    }

    /**
     * Filet de secours appelé par le guest après paiement : re-vérifie la session
     * Stripe côté serveur et marque PAID si payé. Vérifie que la commande appartient
     * bien au token (org + réservation). Idempotent. Retourne le statut final.
     */
    @Transactional
    public String confirmOrder(UUID token, Long orderId) {
        WelcomeGuideToken tok = validTokenWithReservation(token).orElse(null);
        UpsellOrder order = orderRepository.findById(orderId).orElse(null);
        if (tok == null || order == null) {
            return "INVALID";
        }
        if (!order.getOrganizationId().equals(tok.getOrganizationId())
                || tok.getReservation() == null
                || !order.getReservationId().equals(tok.getReservation().getId())) {
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
            Long ownerId = reservationRepository.findById(order.getReservationId())
                .map(Reservation::getProperty)
                .map(p -> p.getOwner() != null ? p.getOwner().getId() : null)
                .orElse(null);
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

    private Optional<WelcomeGuideToken> validTokenWithReservation(UUID token) {
        return tokenRepository.findByToken(token)
            .filter(WelcomeGuideToken::isCurrentlyValid)
            .filter(t -> t.getReservation() != null);
    }

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

    /** Logement de la commande (via la réservation). Défensif : null si non résoluble → défaut org. */
    private Long propertyIdForOrder(UpsellOrder order) {
        try {
            if (order.getReservationId() == null) {
                return null;
            }
            return reservationRepository.findById(order.getReservationId())
                .map(Reservation::getProperty)
                .map(Property::getId)
                .orElse(null);
        } catch (Exception e) {
            return null;
        }
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
