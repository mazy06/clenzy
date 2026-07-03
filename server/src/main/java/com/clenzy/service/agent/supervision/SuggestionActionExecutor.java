package com.clenzy.service.agent.supervision;

import com.clenzy.model.Property;
import com.clenzy.model.RateOverride;
import com.clenzy.model.SecurityDeposit;
import com.clenzy.model.SecurityDepositStatus;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.SecurityDepositRepository;
import com.clenzy.service.CalendarEngine;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.SearchCacheInvalidator;
import com.clenzy.service.SecurityDepositPaymentService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;

/**
 * Exécute l'action portée par une suggestion actionnable (Phase B + vague 3).
 *
 * <p>Deux familles d'actions (cf. {@link #hasExternalEffect}) :</p>
 * <ul>
 *   <li><b>Écritures DB uniquement</b> (PRICE_DROP, CALENDAR_BLOCK) : appelées DANS
 *       la transaction d'application (après la transition atomique
 *       {@code PENDING → APPLIED}) — un échec annule la transition ;</li>
 *   <li><b>Effet externe Stripe</b> (DEPOSIT_REFUND / DEPOSIT_RELEASE) : appelées
 *       HORS transaction par {@link SupervisionSuggestionService#apply} (règle audit
 *       n°2), compensation {@code APPLIED → PENDING} en cas d'échec.</li>
 * </ul>
 *
 * <p>Règle absolue n°1 (argent) : tout ce qui est débité/libéré est RE-résolu au
 * moment de l'apply depuis l'état métier courant — le montant porté par la
 * suggestion n'est qu'indicatif et n'est jamais appliqué aveuglément.</p>
 */
@Service
public class SuggestionActionExecutor {

    private static final Logger log = LoggerFactory.getLogger(SuggestionActionExecutor.class);
    private static final String OVERRIDE_SOURCE = "SUPERVISION_PRICE_DROP";
    /** Garde-fou : une baisse proposée reste bornée (aucun tarif absurde). */
    private static final int MAX_PERCENT = 90;
    /** Source des jours bloqués par une suggestion F6c (visible calendrier). */
    static final String CALENDAR_BLOCK_SOURCE = "SUPERVISION";
    static final int DEFAULT_BLOCK_DAYS = 7;
    static final int MAX_BLOCK_DAYS = 30;

    private final PriceEngine priceEngine;
    private final RateOverrideRepository rateOverrideRepository;
    private final PropertyRepository propertyRepository;
    private final SearchCacheInvalidator searchCacheInvalidator;
    private final SecurityDepositRepository securityDepositRepository;
    private final SecurityDepositPaymentService securityDepositPaymentService;
    private final CalendarEngine calendarEngine;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public SuggestionActionExecutor(PriceEngine priceEngine,
                                    RateOverrideRepository rateOverrideRepository,
                                    PropertyRepository propertyRepository,
                                    SearchCacheInvalidator searchCacheInvalidator,
                                    SecurityDepositRepository securityDepositRepository,
                                    SecurityDepositPaymentService securityDepositPaymentService,
                                    CalendarEngine calendarEngine,
                                    ObjectMapper objectMapper,
                                    Clock clock) {
        this.priceEngine = priceEngine;
        this.rateOverrideRepository = rateOverrideRepository;
        this.propertyRepository = propertyRepository;
        this.searchCacheInvalidator = searchCacheInvalidator;
        this.securityDepositRepository = securityDepositRepository;
        this.securityDepositPaymentService = securityDepositPaymentService;
        this.calendarEngine = calendarEngine;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /**
     * Vrai si l'action fait un appel EXTERNE (Stripe) : elle doit alors être
     * exécutée HORS transaction DB (règle audit n°2) — l'orchestration est portée
     * par {@link SupervisionSuggestionService#apply}.
     */
    public boolean hasExternalEffect(String actionType) {
        return SupervisionActionType.DEPOSIT_REFUND.equals(actionType)
                || SupervisionActionType.DEPOSIT_RELEASE.equals(actionType);
    }

    /** Dispatche l'exécution selon {@code actionType}. Lève si le type est inconnu ou les params invalides. */
    public void execute(SupervisionSuggestion suggestion) {
        final String type = suggestion.getActionType();
        if (type == null) {
            throw new IllegalStateException("Suggestion non actionnable (actionType absent)");
        }
        switch (type) {
            case SupervisionActionType.PRICE_DROP -> applyPriceDrop(suggestion);
            case SupervisionActionType.DEPOSIT_REFUND, SupervisionActionType.DEPOSIT_RELEASE ->
                    releaseDeposit(suggestion);
            case SupervisionActionType.CALENDAR_BLOCK -> applyCalendarBlock(suggestion);
            default -> throw new IllegalStateException("Type d'action non supporté : " + type);
        }
    }

    /**
     * F2b / F4c — libère le hold Stripe de la caution (remboursement : aucun débit).
     *
     * <p>Recalcul à l'apply : la caution est RE-chargée (org de la suggestion) et doit
     * être encore {@code HELD} — un montant/état stocké dans la suggestion n'est jamais
     * appliqué. L'effet réel passe par {@link SecurityDepositPaymentService#releaseHold}
     * (idempotency key Stripe déterministe {@code deposit-release-<id>}, puis transition
     * CAS {@code HELD → RELEASED} dans sa propre transaction courte).</p>
     */
    private void releaseDeposit(SupervisionSuggestion suggestion) {
        final Long reservationId = resolveReservationId(suggestion);
        final SecurityDeposit deposit = securityDepositRepository
                .findByOrganizationIdAndReservationId(suggestion.getOrganizationId(), reservationId)
                .orElseThrow(() -> new IllegalStateException(
                        "Aucune caution pour la réservation " + reservationId));
        if (deposit.getStatus() != SecurityDepositStatus.HELD) {
            throw new IllegalStateException("Caution " + deposit.getId() + " au statut "
                    + deposit.getStatus() + " — plus rien à libérer");
        }
        securityDepositPaymentService.releaseHold(suggestion.getOrganizationId(), deposit.getId());
        log.info("{} appliqué org={} reservation={} deposit={} ({} {})",
                suggestion.getActionType(), suggestion.getOrganizationId(), reservationId,
                deposit.getId(), deposit.getAmount(), deposit.getCurrency());
    }

    /**
     * F6c — bloque le calendrier du logement sur une plage courte à partir
     * d'aujourd'hui. Écritures DB uniquement (CalendarDay + outbox) : exécuté dans
     * la transaction d'application. {@code CalendarEngine.block} refuse si des jours
     * BOOKED existent dans la plage et re-valide l'ownership org du logement.
     */
    private void applyCalendarBlock(SupervisionSuggestion suggestion) {
        int days = DEFAULT_BLOCK_DAYS;
        if (suggestion.getActionParams() != null && !suggestion.getActionParams().isBlank()) {
            JsonNode params = parseParams(suggestion.getActionParams());
            if (params.path("days").isInt()) {
                days = params.path("days").asInt();
            }
        }
        if (days <= 0 || days > MAX_BLOCK_DAYS) {
            throw new IllegalStateException("Durée de blocage hors bornes : " + days);
        }
        final LocalDate from = LocalDate.now(clock);
        calendarEngine.block(suggestion.getPropertyId(), from, from.plusDays(days),
                suggestion.getOrganizationId(), CALENDAR_BLOCK_SOURCE,
                suggestion.getTitle(), "system:supervisor");
        log.info("CALENDAR_BLOCK appliqué org={} property={} [{}, {}+{}j)",
                suggestion.getOrganizationId(), suggestion.getPropertyId(), from, from, days);
    }

    private Long resolveReservationId(SupervisionSuggestion suggestion) {
        if (suggestion.getReservationId() != null) {
            return suggestion.getReservationId();
        }
        JsonNode params = parseParams(suggestion.getActionParams());
        if (params.path("reservationId").isNumber()) {
            return params.path("reservationId").asLong();
        }
        throw new IllegalStateException("Réservation absente de la suggestion caution");
    }

    private void applyPriceDrop(SupervisionSuggestion suggestion) {
        final JsonNode params = parseParams(suggestion.getActionParams());
        final LocalDate from = LocalDate.parse(params.path("from").asText());
        final LocalDate to = LocalDate.parse(params.path("to").asText()); // exclusif
        final int percent = params.path("percent").asInt();
        if (!from.isBefore(to)) {
            throw new IllegalStateException("Plage invalide : from >= to");
        }
        if (percent <= 0 || percent > MAX_PERCENT) {
            throw new IllegalStateException("Pourcentage de baisse hors bornes : " + percent);
        }

        final Long propertyId = suggestion.getPropertyId();
        final Long orgId = suggestion.getOrganizationId();
        final Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalStateException("Logement introuvable : " + propertyId));
        final String currency = property.getDefaultCurrency() != null ? property.getDefaultCurrency() : "EUR";
        final BigDecimal factor = BigDecimal.ONE.subtract(
                BigDecimal.valueOf(percent).divide(BigDecimal.valueOf(100)));

        int applied = 0;
        for (LocalDate date = from; date.isBefore(to); date = date.plusDays(1)) {
            final BigDecimal current = priceEngine.resolvePrice(propertyId, date, orgId);
            if (current == null || current.signum() <= 0) {
                continue; // pas de prix résolu → rien à baisser ce jour
            }
            final BigDecimal newPrice = current.multiply(factor).setScale(2, RoundingMode.HALF_UP);
            final LocalDate d = date;
            final RateOverride override = rateOverrideRepository
                    .findByPropertyIdAndDate(propertyId, d, orgId)
                    .orElseGet(() -> new RateOverride(property, d, newPrice, OVERRIDE_SOURCE, orgId));
            override.setNightlyPrice(newPrice);
            override.setSource(OVERRIDE_SOURCE);
            override.setCurrency(currency);
            override.setCreatedBy("system:supervisor");
            rateOverrideRepository.save(override);
            applied++;
        }
        searchCacheInvalidator.onAvailabilityOrPriceChanged();
        log.info("PRICE_DROP appliqué org={} property={} {}→{} −{}% ({} jour(s))",
                orgId, propertyId, from, to, percent, applied);
    }

    private JsonNode parseParams(String json) {
        if (json == null || json.isBlank()) {
            throw new IllegalStateException("Params d'action absents");
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new IllegalStateException("Params d'action illisibles : " + e.getMessage(), e);
        }
    }
}
