package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.dto.PayoutRecapDto;
import com.clenzy.model.ActionItem;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.OwnerPayoutConfig;
import com.clenzy.model.User;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Stream;

/**
 * Ce qu'il faut savoir avant d'approuver un reversement.
 *
 * <p>Bénéficiaire, période, détail du calcul, moyen de versement, séjours
 * couverts et dépenses déduites. Le bouton portait un montant et rien d'autre :
 * approuver plusieurs milliers d'euros sans voir à qui ils vont ni ce qu'ils
 * recouvrent n'est pas une décision.</p>
 *
 * <p>Les montants viennent du reversement <b>tel qu'il a été figé</b>, pas d'un
 * recalcul : un récapitulatif qui recalcule peut afficher un total différent de
 * celui qu'on s'apprête à approuver.</p>
 */
@Service
@Transactional(readOnly = true)
public class PayoutRecapService {

    private final ActionItemLoader loader;
    private final OwnerPayoutRepository ownerPayoutRepository;
    private final UserRepository userRepository;
    private final OwnerPayoutConfigRepository ownerPayoutConfigRepository;
    private final ProviderExpenseRepository providerExpenseRepository;
    private final ReservationRepository reservationRepository;

    public PayoutRecapService(ActionItemLoader loader,
                              OwnerPayoutRepository ownerPayoutRepository,
                              UserRepository userRepository,
                              OwnerPayoutConfigRepository ownerPayoutConfigRepository,
                              ProviderExpenseRepository providerExpenseRepository,
                              ReservationRepository reservationRepository) {
        this.loader = loader;
        this.ownerPayoutRepository = ownerPayoutRepository;
        this.userRepository = userRepository;
        this.ownerPayoutConfigRepository = ownerPayoutConfigRepository;
        this.providerExpenseRepository = providerExpenseRepository;
        this.reservationRepository = reservationRepository;
    }

    public PayoutRecapDto recap(Long actionItemId, Long orgId) {
        final ActionItem item = loader.loadOfKind(actionItemId, orgId,
                ActionItemKind.OWNER_PAYOUT_PENDING, "Cette action n'est pas un reversement");
        final OwnerPayout payout = ownerPayoutRepository.findById(item.getTargetId())
                .filter(p -> orgId.equals(p.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Reversement introuvable"));

        final User beneficiary = userRepository.findById(payout.getOwnerId()).orElse(null);
        final OwnerPayoutConfig config = ownerPayoutConfigRepository
                .findByOwnerIdAndOrgId(payout.getOwnerId(), orgId).orElse(null);

        return new PayoutRecapDto(
                payout.getId(),
                beneficiary == null ? null : fullName(beneficiary),
                beneficiary == null ? null : beneficiary.getEmail(),
                payout.getPeriodStart(),
                payout.getPeriodEnd(),
                payout.getGrossRevenue(),
                payout.getOtaFees(),
                // Le taux est stocké en fraction ; l'écran parle en pourcentage.
                payout.getCommissionRate() == null ? null
                        : payout.getCommissionRate().multiply(BigDecimal.valueOf(100)),
                payout.getCommissionAmount(),
                payout.getExpenses(),
                payout.getNetAmount(),
                payout.getCurrency(),
                config == null || config.getPayoutMethod() == null
                        ? null : config.getPayoutMethod().name(),
                describeDestination(config),
                isDestinationReady(config),
                coveredStays(payout, orgId),
                includedExpenses(payout, orgId));
    }

    /** Les séjours dont le revenu compose ce reversement. */
    private List<PayoutRecapDto.CoveredStay> coveredStays(OwnerPayout payout, Long orgId) {
        return reservationRepository.findByOwnerIdAndDateRange(
                        payout.getOwnerId(), payout.getPeriodStart(), payout.getPeriodEnd(), orgId)
                .stream()
                .map(r -> new PayoutRecapDto.CoveredStay(
                        r.getId(),
                        r.getGuestName(),
                        ActionItems.propertyName(r.getProperty()),
                        r.getCheckIn(),
                        r.getCheckOut(),
                        r.getTotalPrice()))
                .toList();
    }

    /** Les dépenses déduites — liées au reversement lors de sa génération. */
    private List<PayoutRecapDto.IncludedExpense> includedExpenses(OwnerPayout payout, Long orgId) {
        return providerExpenseRepository.findByPayoutIdAndOrgId(payout.getId(), orgId).stream()
                .map(e -> new PayoutRecapDto.IncludedExpense(
                        e.getId(),
                        e.getDescription(),
                        e.getCategory() == null ? null : e.getCategory().name(),
                        e.getExpenseDate(),
                        e.getAmountTtc()))
                .toList();
    }

    /**
     * Le compte de destination, <b>masqué</b>.
     *
     * <p>Un IBAN est chiffré en base : l'afficher en entier sur un tableau de
     * bord n'apporte rien qu'un risque. Les quatre derniers caractères suffisent
     * à reconnaître le bon compte.</p>
     */
    private static String describeDestination(OwnerPayoutConfig config) {
        if (config == null) return null;
        if (config.getStripeConnectedAccountId() != null) {
            return "Compte Stripe " + last4(config.getStripeConnectedAccountId());
        }
        if (config.getIban() != null) return "IBAN ••••" + last4(config.getIban());
        return null;
    }

    /** Vrai si un virement peut réellement partir vers ce compte. */
    private static boolean isDestinationReady(OwnerPayoutConfig config) {
        if (config == null) return false;
        if (config.getStripeConnectedAccountId() != null) {
            return config.isStripeOnboardingComplete();
        }
        return config.getIban() != null;
    }

    private static String last4(String value) {
        return value.length() <= 4 ? value : value.substring(value.length() - 4);
    }

    private static String fullName(User user) {
        return Stream.of(user.getFirstName(), user.getLastName())
                .filter(part -> part != null && !part.isBlank())
                .reduce((a, b) -> a + " " + b)
                .orElse(user.getEmail());
    }
}
