package com.clenzy.service;

import com.clenzy.integration.channel.ChannelName;
import com.clenzy.model.*;
import com.clenzy.model.OwnerPayout.PayoutStatus;
import com.clenzy.model.User;
import com.clenzy.repository.ChannelCommissionRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ProviderExpenseRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.commission.ManagementCommissionCalculator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class AccountingService {

    private static final Logger log = LoggerFactory.getLogger(AccountingService.class);


    private final OwnerPayoutRepository payoutRepository;
    private final ChannelCommissionRepository commissionRepository;
    private final ReservationRepository reservationRepository;
    private final PropertyRepository propertyRepository;
    private final ProviderExpenseRepository providerExpenseRepository;
    private final ManagementContractService managementContractService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final ManagementCommissionCalculator commissionCalculator;

    public AccountingService(OwnerPayoutRepository payoutRepository,
                             ChannelCommissionRepository commissionRepository,
                             ReservationRepository reservationRepository,
                             PropertyRepository propertyRepository,
                             ProviderExpenseRepository providerExpenseRepository,
                             ManagementContractService managementContractService,
                             NotificationService notificationService,
                             UserRepository userRepository,
                             ManagementCommissionCalculator commissionCalculator) {
        this.payoutRepository = payoutRepository;
        this.commissionRepository = commissionRepository;
        this.reservationRepository = reservationRepository;
        this.propertyRepository = propertyRepository;
        this.providerExpenseRepository = providerExpenseRepository;
        this.managementContractService = managementContractService;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.commissionCalculator = commissionCalculator;
    }

    // ── Owner Payouts ──────────────────────────────────────────────────────

    public List<OwnerPayout> getPayouts(Long orgId) {
        return payoutRepository.findAllByOrgId(orgId);
    }

    public List<OwnerPayout> getPayoutsByOwner(Long ownerId, Long orgId) {
        return payoutRepository.findByOwnerId(ownerId, orgId);
    }

    public List<OwnerPayout> getPayoutsByStatus(PayoutStatus status, Long orgId) {
        return payoutRepository.findByStatus(status, orgId);
    }

    public OwnerPayout getPayoutById(Long id, Long orgId) {
        return payoutRepository.findByIdAndOrgId(id, orgId)
            .orElseThrow(() -> new IllegalArgumentException("Payout not found: " + id));
    }

    /**
     * Génère le virement d'un propriétaire sur la période.
     *
     * <p>La commission vient de {@link ManagementCommissionCalculator}, partagé avec la
     * facture de commission et le portail propriétaire : elle est calculée séjour par
     * séjour, et honore {@code CommissionBase.NET_OF_OTA_FEE} — sans quoi le virement
     * retiendrait sur le brut ce que la facture calcule sur le net des frais OTA. C'est
     * la facture qui fait foi : en {@code CONCIERGE_COLLECTS} elle est émise PAID avec la
     * mention « retenue reversement », elle affirme donc le montant prélevé ici.</p>
     *
     * <p><b>Le contrat se résout par LOGEMENT.</b> Un propriétaire peut détenir plusieurs
     * biens sous des taux ou des assiettes différents, et ses factures sont émises avec
     * le contrat de chacun : appliquer celui du premier séjour à toute la période
     * romprait l'égalité « retenue = somme des factures » que ce calcul existe pour
     * garantir.</p>
     *
     * <p>{@link OwnerPayout} ne porte qu'UNE colonne de taux : celle-ci n'est donc
     * qu'indicative quand les contrats divergent (cf. {@code resolveCommissionRate}),
     * seul {@code commissionAmount} fait foi.</p>
     *
     * <p>Pas de contrat actif = pas de commission, et aucun frais OTA imputé.</p>
     */
    @Transactional
    public OwnerPayout generatePayout(Long ownerId, Long orgId, LocalDate from, LocalDate to) {
        // Check for existing payout
        Optional<OwnerPayout> existing = payoutRepository.findByOwnerAndPeriod(ownerId, from, to, orgId);
        if (existing.isPresent()) {
            return existing.get();
        }

        List<Reservation> reservations = reservationRepository.findByOwnerIdAndDateRange(ownerId, from, to, orgId);

        // Un contrat par logement, resolu une seule fois : un proprietaire a souvent
        // plusieurs sejours sur le meme bien.
        Map<Long, Optional<ManagementContract>> contractsByProperty = new HashMap<>();

        BigDecimal grossRevenue = reservations.stream()
            .map(Reservation::getTotalPrice)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        ManagementCommissionCalculator.Commission commission = commissionCalculator.ofAll(
            reservations, r -> resolveContract(r, orgId, contractsByProperty));
        BigDecimal commissionAmount = commission.amount();
        BigDecimal otaFees = commission.otaFeeBorneByOwner();
        BigDecimal commissionRate = resolveCommissionRate(ownerId, orgId, reservations, contractsByProperty);

        // Aggregate APPROVED provider expenses for the owner's properties in this period
        List<ProviderExpense> approvedExpenses = providerExpenseRepository
                .findApprovedByPropertyOwnerAndPeriod(ownerId, from, to, orgId);
        BigDecimal totalExpenses = approvedExpenses.stream()
                .map(ProviderExpense::getAmountTtc)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal netAmount = grossRevenue
            .subtract(otaFees)
            .subtract(commissionAmount)
            .subtract(totalExpenses);

        OwnerPayout payout = new OwnerPayout();
        payout.setOrganizationId(orgId);
        payout.setOwnerId(ownerId);
        payout.setPeriodStart(from);
        payout.setPeriodEnd(to);
        payout.setGrossRevenue(grossRevenue);
        payout.setCommissionRate(commissionRate);
        payout.setCommissionAmount(commissionAmount);
        payout.setOtaFees(otaFees);
        payout.setExpenses(totalExpenses);
        payout.setNetAmount(netAmount);
        payout.setStatus(PayoutStatus.PENDING);

        OwnerPayout savedPayout = payoutRepository.save(payout);

        // Mark expenses as INCLUDED and link to this payout
        for (ProviderExpense expense : approvedExpenses) {
            expense.setStatus(ExpenseStatus.INCLUDED);
            expense.setOwnerPayout(savedPayout);
        }
        if (!approvedExpenses.isEmpty()) {
            providerExpenseRepository.saveAll(approvedExpenses);
        }

        log.info("Reversement genere pour le proprietaire {} periode {}-{}: brut={} commission={} ({}%) fraisOTA={} depenses={} net={}",
            ownerId, from, to, grossRevenue, commissionAmount,
            commissionRate.multiply(BigDecimal.valueOf(100)), otaFees, totalExpenses, netAmount);
        return savedPayout;
    }

    /**
     * Generate payouts for ALL eligible owners of the organization on a given period.
     *
     * <p>Idempotent : un proprietaire qui a deja un payout sur la periode voit son
     * payout existant retourne (pas de doublon). Un proprietaire sans reservation
     * payee sur la periode obtient un payout a 0 € (filtre cote frontend si non desire).</p>
     *
     * <p>Critique pour le workflow fin de mois des conciergeries : un seul appel API
     * pour generer 5 a 50 reversements simultanement, au lieu de N appels manuels.</p>
     *
     * @return La liste des payouts crees ou existants, dans l'ordre des owner IDs.
     */
    @Transactional
    public List<OwnerPayout> generatePayoutsBatch(Long orgId, LocalDate from, LocalDate to) {
        List<Long> ownerIds = propertyRepository.findDistinctOwnerIdsByOrgId(orgId);
        if (ownerIds.isEmpty()) {
            log.info("Batch payout generation: no eligible owners for org {} period {}-{}", orgId, from, to);
            return List.of();
        }

        log.info("Batch payout generation starting: org={}, period={}-{}, ownersCount={}",
            orgId, from, to, ownerIds.size());

        List<OwnerPayout> result = new ArrayList<>(ownerIds.size());
        int created = 0;
        int existing = 0;
        for (Long ownerId : ownerIds) {
            try {
                // generatePayout est idempotent : retourne l'existant ou cree.
                // On compte les creations vs deja-existants via la presence d'un ID anterieur.
                Optional<OwnerPayout> alreadyExists = payoutRepository.findByOwnerAndPeriod(ownerId, from, to, orgId);
                OwnerPayout payout = generatePayout(ownerId, orgId, from, to);
                result.add(payout);
                if (alreadyExists.isPresent()) {
                    existing++;
                } else {
                    created++;
                }
            } catch (Exception e) {
                // Log mais continue — un proprietaire en erreur ne doit pas bloquer les autres.
                log.error("Batch payout generation failed for owner {} (org={}): {}", ownerId, orgId, e.getMessage());
            }
        }

        log.info("Batch payout generation done: org={}, created={}, existing={}, totalResult={}",
            orgId, created, existing, result.size());
        return result;
    }

    @Transactional
    public OwnerPayout approvePayout(Long id, Long orgId) {
        OwnerPayout payout = getPayoutById(id, orgId);
        payout.setStatus(PayoutStatus.APPROVED);
        OwnerPayout saved = payoutRepository.save(payout);

        String amount = saved.getNetAmount() + " " + saved.getCurrency();

        notificationService.notifyAdminsAndManagersByOrgId(
                orgId,
                NotificationKey.PAYOUT_APPROVED,
                "Reversement approuve",
                "Le reversement #" + saved.getId() + " (" + amount + ") a ete approuve.",
                "/billing?tab=payouts&highlight=" + saved.getId()
        );

        notifyOwner(saved, NotificationKey.PAYOUT_APPROVED,
                "Reversement approuve",
                "Votre reversement de " + amount + " (periode " + saved.getPeriodStart() + " - " + saved.getPeriodEnd() + ") a ete approuve.");

        return saved;
    }

    @Transactional
    public OwnerPayout markAsPaid(Long id, Long orgId, String paymentReference) {
        OwnerPayout payout = getPayoutById(id, orgId);
        payout.setStatus(PayoutStatus.PAID);
        payout.setPaymentReference(paymentReference);
        payout.setPaidAt(Instant.now());
        OwnerPayout saved = payoutRepository.save(payout);

        String amount = saved.getNetAmount() + " " + saved.getCurrency();

        notificationService.notifyAdminsAndManagersByOrgId(
                orgId,
                NotificationKey.PAYOUT_EXECUTED,
                "Reversement execute",
                "Le reversement #" + saved.getId() + " (" + amount + ") a ete paye. Ref: " + paymentReference,
                "/billing?tab=payouts&highlight=" + saved.getId()
        );

        notifyOwner(saved, NotificationKey.PAYOUT_EXECUTED,
                "Reversement effectue",
                "Votre reversement de " + amount + " a ete effectue. Reference: " + paymentReference);

        return saved;
    }

    // ── Channel Commissions ────────────────────────────────────────────────

    public List<ChannelCommission> getChannelCommissions(Long orgId) {
        return commissionRepository.findByOrganizationId(orgId);
    }

    public Optional<ChannelCommission> getChannelCommission(ChannelName channel, Long orgId) {
        return commissionRepository.findByChannelAndOrgId(channel, orgId);
    }

    /**
     * Upsert de la commission d'un canal pour une organisation.
     *
     * <p>La ligne existante est resolue par {@code (channel, orgId)} — jamais
     * par l'id fourni par le client (durcissement : empeche l'ecrasement d'une
     * commission d'une autre organisation via un id arbitraire, et les doublons
     * par canal).</p>
     */
    @Transactional
    public ChannelCommission saveChannelCommission(ChannelName channel, Long orgId,
                                                   com.clenzy.dto.ChannelCommissionDto dto) {
        ChannelCommission commission = commissionRepository.findByChannelAndOrgId(channel, orgId)
            .orElseGet(ChannelCommission::new);
        commission.setOrganizationId(orgId);
        commission.setChannelName(channel);
        commission.setCommissionRate(dto.commissionRate());
        commission.setVatRate(dto.vatRate());
        commission.setIsGuestFacing(dto.isGuestFacing() != null ? dto.isGuestFacing() : Boolean.FALSE);
        commission.setNotes(dto.notes());
        return commissionRepository.save(commission);
    }

    // ── Private Helpers ────────────────────────────────────────────────────

    /**
     * Sends an in-app notification to the owner of a payout.
     * Silently skipped if the owner user is not found (defensive).
     */
    private void notifyOwner(OwnerPayout payout, NotificationKey key, String title, String message) {
        userRepository.findById(payout.getOwnerId()).ifPresent(owner -> {
            if (owner.getKeycloakId() != null) {
                notificationService.sendByOrgId(
                        owner.getKeycloakId(), key, title, message,
                        "/billing?tab=payouts&highlight=" + payout.getId(), payout.getOrganizationId()
                );
            }
        });
    }

    /** Le contrat actif du logement d'une reservation, resolu une fois par logement. */
    private ManagementContract resolveContract(Reservation reservation, Long orgId,
                                               Map<Long, Optional<ManagementContract>> cache) {
        if (reservation.getProperty() == null || reservation.getProperty().getId() == null) {
            return null;
        }
        Long propertyId = reservation.getProperty().getId();
        return cache.computeIfAbsent(propertyId,
            id -> managementContractService.getActiveContract(id, orgId)).orElse(null);
    }

    /**
     * Le taux <b>affiché</b> sur le virement.
     *
     * <p>Ce taux ne sert plus à calculer quoi que ce soit — le montant vient de
     * {@link ManagementCommissionCalculator}, appliqué séjour par séjour avec le contrat
     * de chaque logement. {@link OwnerPayout} ne porte qu'un scalaire ; quand les
     * logements d'un propriétaire relèvent de contrats à taux différents, aucun scalaire
     * n'est juste. On retient alors le premier et on le signale, plutôt que d'inventer un
     * taux moyen qui ne figurerait sur aucun contrat.</p>
     *
     * <p>Pas de contrat = pas de commission.</p>
     */
    private BigDecimal resolveCommissionRate(Long ownerId, Long orgId, List<Reservation> reservations,
                                             Map<Long, Optional<ManagementContract>> cache) {
        BigDecimal firstRate = null;
        for (Reservation reservation : reservations) {
            ManagementContract contract = resolveContract(reservation, orgId, cache);
            if (contract == null || contract.getCommissionRate() == null) {
                continue;
            }
            BigDecimal contractRate = contract.getCommissionRate();
            if (firstRate == null) {
                firstRate = contractRate;
            } else if (firstRate.compareTo(contractRate) != 0) {
                log.warn("Proprietaire {} (org {}) : taux de commission divergents sur la periode "
                        + "({} vs {}). Le reversement affiche {} ; les montants restent calcules "
                        + "contrat par contrat.",
                    ownerId, orgId, firstRate, contractRate, firstRate);
                return firstRate;
            }
        }

        if (firstRate == null) {
            log.debug("Aucun contrat de gestion actif pour le proprietaire {}, taux de commission = 0", ownerId);
            return BigDecimal.ZERO;
        }
        return firstRate;
    }
}
