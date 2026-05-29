package com.clenzy.service.voucher;

import com.clenzy.model.BookingVoucher;
import com.clenzy.model.VoucherPropertyScope;
import com.clenzy.model.VoucherUsage;
import com.clenzy.model.voucher.VoucherChannelScope;
import com.clenzy.model.voucher.VoucherDiscountType;
import com.clenzy.model.voucher.VoucherStatus;
import com.clenzy.model.voucher.VoucherType;
import com.clenzy.repository.BookingVoucherRepository;
import com.clenzy.repository.VoucherPropertyScopeRepository;
import com.clenzy.repository.VoucherUsageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Moteur pur de validation + calcul + enregistrement d'application des
 * {@link BookingVoucher}.
 *
 * <h3>Responsabilites</h3>
 * <ul>
 *   <li>{@link #validate} : verifier qu'un code (saisi par un guest) est
 *       applicable a un contexte de booking precis (property, dates, montant,
 *       canal, guest_email). Read-only.</li>
 *   <li>{@link #findApplicableAutoCampaigns} : lister les campagnes AUTO_CAMPAIGN
 *       actuellement actives qui matchent un contexte donne, pour application
 *       automatique sans saisie de code.</li>
 *   <li>{@link #apply} : calculer le {@link VoucherApplyResult} (originalTotal,
 *       discountApplied, finalTotal) pour un voucher deja valide.</li>
 *   <li>{@link #recordUsage} : incrementer atomiquement le compteur du voucher
 *       et inserer une row d'audit dans {@link VoucherUsage} a la confirmation
 *       du booking.</li>
 * </ul>
 *
 * <h3>Pipeline type cote BookingService (P3)</h3>
 * <pre>
 * // 1. PriceEngine calcule le prix publie
 * BigDecimal subtotal = priceEngine.resolvePriceRange(propertyId, ...).sum();
 *
 * // 2. Resolution voucher : saisi ou auto-detect
 * BookingVoucher voucher;
 * if (guestProvidedCode != null) {
 *     var validation = voucherEngine.validate(orgId, code, propertyId, ..., subtotal, guestEmail, channel);
 *     if (validation instanceof Valid v) voucher = v.voucher();
 *     else throw new BookingException(((Invalid) validation).reason());
 * } else {
 *     voucher = voucherEngine.findApplicableAutoCampaigns(...).stream()
 *         .max(comparing(v -> voucherEngine.apply(v, subtotal, nights).discountApplied()))
 *         .orElse(null);
 * }
 *
 * // 3. Calcul du final
 * VoucherApplyResult applied = voucher != null
 *     ? voucherEngine.apply(voucher, subtotal, nights)
 *     : VoucherApplyResult.noVoucher(subtotal);
 *
 * // 4. Reservation creee avec applied.finalTotal(), then recordUsage
 * voucherEngine.recordUsage(voucher, reservationId, orgId, propertyId, applied, guestEmail, channel);
 * </pre>
 *
 * <h3>Concurrence</h3>
 * Le {@link #recordUsage} fait un UPDATE conditionnel sur {@code max_uses_total}
 * via {@link BookingVoucherRepository#tryIncrementUsage(Long)} : si 0 row
 * mise a jour, c'est qu'un autre booking simultane a consomme la derniere
 * place — on annule l'application (retourne {@code Optional.empty()}).
 */
@Service
@Transactional(readOnly = true)
public class VoucherEngine {

    private static final Logger logger = LoggerFactory.getLogger(VoucherEngine.class);
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final BookingVoucherRepository voucherRepo;
    private final VoucherPropertyScopeRepository scopeRepo;
    private final VoucherUsageRepository usageRepo;
    private final Clock clock;

    // @Autowired explicite necessaire : 2 constructeurs (prod + tests) =>
    // Spring ne sait pas lequel choisir sans annotation. La regle CLAUDE.md
    // interdit @Autowired sur les CHAMPS, pas sur les constructeurs.
    @Autowired
    public VoucherEngine(
        BookingVoucherRepository voucherRepo,
        VoucherPropertyScopeRepository scopeRepo,
        VoucherUsageRepository usageRepo
    ) {
        this(voucherRepo, scopeRepo, usageRepo, Clock.systemUTC());
    }

    /** Constructeur visible pour les tests (Clock mock). */
    VoucherEngine(
        BookingVoucherRepository voucherRepo,
        VoucherPropertyScopeRepository scopeRepo,
        VoucherUsageRepository usageRepo,
        Clock clock
    ) {
        this.voucherRepo = voucherRepo;
        this.scopeRepo = scopeRepo;
        this.usageRepo = usageRepo;
        this.clock = clock;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VALIDATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Valide un code voucher saisi par un guest dans le contexte d'un booking.
     *
     * <p>Toutes les regles sont verifiees dans l'ordre, retourne {@code Invalid}
     * a la PREMIERE violation (short-circuit) avec le code d'erreur permettant
     * a l'UI de traduire en message i18n approprie.</p>
     *
     * @param orgId         org propriétaire du voucher (= org de la property)
     * @param code          code texte saisi par le guest (case-insensitive)
     * @param propertyId    property cible du booking
     * @param stayNights    nombre de nuits du sejour
     * @param subtotal      montant avant discount (calcule par PriceEngine)
     * @param guestEmail    email du guest (pour {@code max_uses_per_guest}), peut etre null
     * @param channel       canal d'application (BOOKING_ENGINE, DIRECT_LINK, etc)
     * @return {@code Valid(voucher)} ou {@code Invalid(reason, message)}
     */
    public VoucherValidationResult validate(
        Long orgId,
        String code,
        Long propertyId,
        int stayNights,
        BigDecimal subtotal,
        String guestEmail,
        VoucherChannelScope channel
    ) {
        if (orgId == null || code == null || code.isBlank() || propertyId == null
            || stayNights <= 0 || subtotal == null || subtotal.signum() <= 0
            || channel == null) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.INVALID_INPUT, "Inputs manquants ou invalides");
        }

        Optional<BookingVoucher> opt = voucherRepo.findByOrgAndCodeIgnoreCase(orgId, code.trim());
        if (opt.isEmpty()) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.NOT_FOUND, "Code voucher inconnu pour cette org");
        }
        BookingVoucher v = opt.get();

        // Statut
        VoucherStatus s = v.getStatus();
        if (s == VoucherStatus.DRAFT) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.DRAFT_NOT_ACTIVE,
                "Voucher en draft, non encore active par le createur");
        }
        if (s == VoucherStatus.PAUSED) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.PAUSED, "Voucher temporairement pause");
        }
        if (s == VoucherStatus.EXPIRED) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.EXPIRED, "Voucher expire");
        }

        // Periode
        Instant now = Instant.now(clock);
        if (v.getValidFrom() != null && v.getValidFrom().isAfter(now)) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.NOT_YET_ACTIVE,
                "Voucher non encore actif (debut: " + v.getValidFrom() + ")");
        }
        if (v.getValidUntil() != null && v.getValidUntil().isBefore(now)) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.EXPIRED, "Voucher expire le " + v.getValidUntil());
        }

        // Canal autorise
        if (v.getChannelScope() != VoucherChannelScope.ALL
            && v.getChannelScope() != channel) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.CHANNEL_NOT_ALLOWED,
                "Voucher non autorise via " + channel + " (autorise: " + v.getChannelScope() + ")");
        }

        // Scope properties : si vide, applicable a TOUTES les properties de l'org.
        // Sinon, la property doit etre listee.
        long scopeCount = scopeRepo.countByVoucherId(v.getId());
        if (scopeCount > 0 && !scopeRepo.existsByVoucherIdAndPropertyId(v.getId(), propertyId)) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.PROPERTY_NOT_IN_SCOPE,
                "Property " + propertyId + " hors scope du voucher");
        }

        // Contraintes de sejour
        if (v.getMinStayNights() != null && stayNights < v.getMinStayNights()) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.MIN_STAY_NOT_MET,
                "Sejour de " + stayNights + " nuits, minimum " + v.getMinStayNights());
        }
        if (v.getMaxStayNights() != null && stayNights > v.getMaxStayNights()) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.MAX_STAY_EXCEEDED,
                "Sejour de " + stayNights + " nuits, maximum " + v.getMaxStayNights());
        }
        if (v.getMinTotalAmount() != null && subtotal.compareTo(v.getMinTotalAmount()) < 0) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.MIN_TOTAL_NOT_MET,
                "Sous-total " + subtotal + " inferieur au minimum " + v.getMinTotalAmount());
        }

        // Plafonds d'utilisation
        if (v.getMaxUsesTotal() != null && v.getUsageCount() >= v.getMaxUsesTotal()) {
            return new VoucherValidationResult.Invalid(
                VoucherValidationError.USAGE_LIMIT_REACHED,
                "Plafond global atteint (" + v.getUsageCount() + "/" + v.getMaxUsesTotal() + ")");
        }
        if (v.getMaxUsesPerGuest() != null && guestEmail != null && !guestEmail.isBlank()) {
            long used = usageRepo.countByVoucherIdAndGuestEmail(v.getId(), guestEmail);
            if (used >= v.getMaxUsesPerGuest()) {
                return new VoucherValidationResult.Invalid(
                    VoucherValidationError.GUEST_LIMIT_REACHED,
                    "Plafond par-guest atteint (" + used + "/" + v.getMaxUsesPerGuest() + ")");
            }
        }

        return new VoucherValidationResult.Valid(v);
    }

    /**
     * Trouve les campagnes AUTO_CAMPAIGN actuellement actives qui matchent
     * un contexte de booking. Utilise au calcul automatique du quote (le guest
     * n'a pas saisi de code, on lui propose la meilleure offre disponible).
     *
     * <p>Filtre : property scope, dates, statut ACTIVE, validite courante.
     * Les contraintes de sejour/montant ne sont PAS filtrees ici (le caller
     * passe par {@link #apply} qui les verifie via {@link #validate}).</p>
     */
    public List<BookingVoucher> findApplicableAutoCampaigns(Long orgId, Long propertyId) {
        if (orgId == null || propertyId == null) return List.of();
        Instant now = Instant.now(clock);
        List<BookingVoucher> active = voucherRepo.findActiveAutoCampaigns(orgId, now);
        if (active.isEmpty()) return List.of();

        // Fix H4 (N+1) : batch lookup des scopes en 2 queries totales au lieu
        // de 2N queries (countByVoucherId + existsByVoucherIdAndPropertyId
        // pour chaque candidat).
        List<Long> activeIds = active.stream().map(BookingVoucher::getId).toList();

        // Map voucher_id -> nb de rows dans le scope. Si absent de la map = 0.
        // Cast defensif via Number.longValue() : Hibernate peut retourner
        // Integer ou BigInteger selon le driver/dialect au lieu de Long.
        Map<Long, Long> scopeCountByVoucher = scopeRepo.countByVoucherIdIn(activeIds)
            .stream()
            .collect(Collectors.toMap(
                row -> ((Number) row[0]).longValue(),
                row -> ((Number) row[1]).longValue()
            ));

        // Pour les vouchers AVEC scope, recupere ceux qui matchent la property
        // ciblee. On filtre d'abord pour ne pas charger inutilement.
        List<Long> scopedVoucherIds = activeIds.stream()
            .filter(id -> scopeCountByVoucher.getOrDefault(id, 0L) > 0L)
            .toList();
        Set<Long> matchingScopedIds = scopedVoucherIds.isEmpty()
            ? Set.of()
            : scopeRepo.findByVoucherIdIn(scopedVoucherIds).stream()
                .filter(s -> s.getPropertyId().equals(propertyId))
                .map(VoucherPropertyScope::getVoucherId)
                .collect(Collectors.toSet());

        return active.stream()
            .filter(v -> {
                long scopeCount = scopeCountByVoucher.getOrDefault(v.getId(), 0L);
                // scope vide = applicable a toutes les properties
                if (scopeCount == 0L) return true;
                return matchingScopedIds.contains(v.getId());
            })
            .toList();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CALCUL DU DISCOUNT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calcule le {@link VoucherApplyResult} pour un voucher applique a un
     * subtotal donne. Pas de validation refaite ici — le caller DOIT avoir
     * verifie via {@link #validate} ou {@link #findApplicableAutoCampaigns}.
     *
     * <p>Semantique selon {@link VoucherDiscountType} :</p>
     * <ul>
     *   <li>{@code PERCENTAGE} : {@code discount = subtotal * (value/100)}, arrondi HALF_UP a 2 decimales</li>
     *   <li>{@code FIXED_AMOUNT} : {@code discount = min(value, subtotal)}</li>
     *   <li>{@code FREE_NIGHTS} : non implemente en V1 (necessite per-night
     *       breakdown), fallback sur 0 EUR + warning log. Reserve V2.</li>
     * </ul>
     *
     * <p>{@code finalTotal} est garanti >= 0 (clamp si discount > subtotal).</p>
     */
    public VoucherApplyResult apply(BookingVoucher voucher, BigDecimal subtotal, int stayNights) {
        if (voucher == null || subtotal == null || subtotal.signum() < 0) {
            throw new IllegalArgumentException("voucher et subtotal>=0 sont requis");
        }
        BigDecimal discount = computeDiscount(voucher, subtotal, stayNights);
        // Clamp : on ne descend jamais sous 0
        if (discount.compareTo(subtotal) > 0) discount = subtotal;
        BigDecimal finalTotal = subtotal.subtract(discount);
        return new VoucherApplyResult(
            voucher.getId(),
            voucher.getCode(),
            subtotal.setScale(2, RoundingMode.HALF_UP),
            discount.setScale(2, RoundingMode.HALF_UP),
            finalTotal.setScale(2, RoundingMode.HALF_UP)
        );
    }

    private BigDecimal computeDiscount(BookingVoucher v, BigDecimal subtotal, int stayNights) {
        return switch (v.getDiscountType()) {
            case PERCENTAGE -> subtotal.multiply(v.getDiscountValue()).divide(ONE_HUNDRED, 2, RoundingMode.HALF_UP);
            case FIXED_AMOUNT -> v.getDiscountValue();
            case FREE_NIGHTS -> {
                // V1 fallback : pas d'access au per-night breakdown, on degrade
                // gracieusement avec 0 (le caller verra discount=0 et pourra
                // refuser l'application au besoin).
                logger.warn("FREE_NIGHTS pas encore implemente, discount=0 pour voucher id={}", v.getId());
                yield BigDecimal.ZERO;
            }
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENREGISTREMENT (audit + counter)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Enregistre l'application d'un voucher a la confirmation d'un booking.
     *
     * <p>Deux operations atomiques :</p>
     * <ol>
     *   <li>UPDATE conditionnel sur {@code booking_voucher.usage_count} via
     *       {@link BookingVoucherRepository#tryIncrementUsage(Long)}. Si 0
     *       rows mises a jour (race sur {@code max_uses_total}), retourne
     *       {@code Optional.empty()} sans inserer de row d'usage : le caller
     *       doit alors traiter le booking comme s'il n'y avait pas de voucher.</li>
     *   <li>INSERT dans {@code voucher_usage} avec les montants {@code applied}.</li>
     * </ol>
     *
     * @return l'audit row inseree, ou empty si race condition sur le plafond.
     */
    @Transactional
    public Optional<VoucherUsage> recordUsage(
        BookingVoucher voucher,
        Long reservationId,
        Long organizationId,
        Long propertyId,
        VoucherApplyResult applied,
        String guestEmail,
        String appliedVia
    ) {
        // Re-check max_uses_per_guest atomiquement (la validate() initiale a
        // pu etre faite il y a quelques secondes ; un autre booking
        // simultane du meme guest pourrait avoir consomme la place). Le
        // tryIncrementUsage ci-dessous ne couvre que max_uses_total ; ce
        // check supplementaire couvre max_uses_per_guest.
        if (voucher.getMaxUsesPerGuest() != null
            && guestEmail != null && !guestEmail.isBlank()) {
            long alreadyUsed = usageRepo.countByVoucherIdAndGuestEmail(
                voucher.getId(), guestEmail);
            if (alreadyUsed >= voucher.getMaxUsesPerGuest()) {
                logger.warn("recordUsage refused for voucherId={} : plafond "
                    + "max_uses_per_guest atteint pour {} (race), used={}/{}",
                    voucher.getId(), guestEmail, alreadyUsed,
                    voucher.getMaxUsesPerGuest());
                return Optional.empty();
            }
        }

        int updated = voucherRepo.tryIncrementUsage(voucher.getId());
        if (updated == 0) {
            logger.warn("recordUsage refused for voucherId={} : plafond max_uses_total atteint (race)",
                voucher.getId());
            return Optional.empty();
        }

        VoucherUsage usage = new VoucherUsage();
        usage.setVoucherId(voucher.getId());
        usage.setReservationId(reservationId);
        usage.setOrganizationId(organizationId);
        usage.setPropertyId(propertyId);
        usage.setGuestEmail(guestEmail);
        usage.setOriginalTotal(applied.originalTotal());
        usage.setDiscountApplied(applied.discountApplied());
        usage.setFinalTotal(applied.finalTotal());
        usage.setAppliedVia(appliedVia != null ? appliedVia : "BOOKING_ENGINE");
        VoucherUsage saved = usageRepo.save(usage);
        logger.info("Voucher applied : voucherId={}, reservationId={}, discount={}",
            voucher.getId(), reservationId, applied.discountApplied());
        return Optional.of(saved);
    }

    /**
     * Helper pour expire les vouchers passes (declenche par un scheduler
     * quotidien). Passe {@code ACTIVE} -> {@code EXPIRED} pour ceux dont
     * {@code valid_until < now}.
     *
     * <p>Retourne le nombre de vouchers expires (utile pour la metrique
     * de monitoring).</p>
     */
    @Transactional
    public int expireOutdatedVouchers() {
        Instant now = Instant.now(clock);
        List<BookingVoucher> outdated = voucherRepo.findExpiredButStillActive(now);
        for (BookingVoucher v : outdated) {
            v.setStatus(VoucherStatus.EXPIRED);
        }
        voucherRepo.saveAll(outdated);
        if (!outdated.isEmpty()) {
            logger.info("Expired {} vouchers (valid_until passed)", outdated.size());
        }
        return outdated.size();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** Retourne true si le voucher est de type AUTO_CAMPAIGN (no code). */
    public static boolean isAutoCampaign(BookingVoucher v) {
        return v != null && v.getType() == VoucherType.AUTO_CAMPAIGN;
    }

    /** Inverse de {@link #findApplicableAutoCampaigns} : property ids du scope. */
    public Set<Long> resolveScopedPropertyIds(Long voucherId) {
        return scopeRepo.findPropertyIdsByVoucherId(voucherId);
    }
}
