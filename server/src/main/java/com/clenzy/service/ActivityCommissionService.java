package com.clenzy.service;

import com.clenzy.config.ActivityCommissionConfig;
import com.clenzy.dto.ActivityCommissionDto;
import com.clenzy.dto.ActivityCommissionSummaryDto;
import com.clenzy.model.*;
import com.clenzy.repository.ActivityCommissionRepository;
import com.clenzy.repository.ReservationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Commissions d'activités affiliées : Clenzy = affilié officiel, répartit chaque
 * commission part hôte / part plateforme ({@link ActivityCommissionConfig}, défaut
 * 70/30). {@link #record} est appelé par le reporting fournisseur (Viator…) quand
 * il sera branché ; la part hôte est créditée au ledger interne → versée par le payout.
 */
@Service
public class ActivityCommissionService {

    private static final Logger log = LoggerFactory.getLogger(ActivityCommissionService.class);
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final ActivityCommissionRepository commissionRepository;
    private final ActivityCommissionConfig commissionConfig;
    private final ReservationRepository reservationRepository;
    private final WalletService walletService;
    private final LedgerService ledgerService;

    public ActivityCommissionService(ActivityCommissionRepository commissionRepository,
                                     ActivityCommissionConfig commissionConfig,
                                     ReservationRepository reservationRepository,
                                     WalletService walletService,
                                     LedgerService ledgerService) {
        this.commissionRepository = commissionRepository;
        this.commissionConfig = commissionConfig;
        this.reservationRepository = reservationRepository;
        this.walletService = walletService;
        this.ledgerService = ledgerService;
    }

    /**
     * Enregistre une commission attribuée + sa répartition. Crédite la part hôte au
     * ledger (plateforme → wallet OWNER) si la réservation/propriétaire est résoluble.
     */
    @Transactional
    public ActivityCommissionDto record(Long orgId, Long reservationId, Long guideId,
                                        ActivityProvider provider, String externalBookingId,
                                        BigDecimal grossCommission, String currency) {
        BigDecimal gross = grossCommission != null ? grossCommission : BigDecimal.ZERO;
        BigDecimal hostPct = commissionConfig.getHostSharePct() != null
            ? commissionConfig.getHostSharePct() : new BigDecimal("70");
        BigDecimal hostShare = gross.multiply(hostPct).divide(HUNDRED, 2, RoundingMode.HALF_UP);
        BigDecimal platformShare = gross.subtract(hostShare);
        String cur = (currency != null && !currency.isBlank()) ? currency.toUpperCase() : "EUR";

        ActivityCommission commission = new ActivityCommission();
        commission.setOrganizationId(orgId);
        commission.setReservationId(reservationId);
        commission.setGuideId(guideId);
        commission.setProvider(provider);
        commission.setExternalBookingId(externalBookingId);
        commission.setGrossCommission(gross);
        commission.setHostShare(hostShare);
        commission.setPlatformShare(platformShare);
        commission.setCurrency(cur);
        commission.setStatus(ActivityCommissionStatus.PENDING);
        commission = commissionRepository.save(commission);

        creditHostShare(orgId, reservationId, hostShare, cur, commission.getId());
        return ActivityCommissionDto.from(commission);
    }

    @Transactional(readOnly = true)
    public List<ActivityCommissionDto> listForOrg(Long orgId) {
        return commissionRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId)
            .stream().map(ActivityCommissionDto::from).toList();
    }

    @Transactional(readOnly = true)
    public ActivityCommissionSummaryDto summaryForOrg(Long orgId) {
        List<ActivityCommission> all = commissionRepository.findByOrganizationIdOrderByCreatedAtDesc(orgId);
        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal host = BigDecimal.ZERO;
        BigDecimal platform = BigDecimal.ZERO;
        String currency = "EUR";
        for (ActivityCommission c : all) {
            gross = gross.add(c.getGrossCommission());
            host = host.add(c.getHostShare());
            platform = platform.add(c.getPlatformShare());
            if (c.getCurrency() != null) currency = c.getCurrency();
        }
        return new ActivityCommissionSummaryDto(gross, host, platform, all.size(), currency);
    }

    private void creditHostShare(Long orgId, Long reservationId, BigDecimal hostShare, String currency, Long commissionId) {
        if (reservationId == null || hostShare == null || hostShare.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        try {
            Long ownerId = reservationRepository.findById(reservationId)
                .map(Reservation::getProperty)
                .map(p -> p.getOwner() != null ? p.getOwner().getId() : null)
                .orElse(null);
            if (ownerId == null) {
                return;
            }
            Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, currency);
            Wallet ownerWallet = walletService.getOrCreateWallet(orgId, WalletType.OWNER, ownerId, currency);
            ledgerService.recordTransfer(platformWallet, ownerWallet, hostShare,
                LedgerReferenceType.COMMISSION, "ACT-COMM-" + commissionId,
                "Part hôte commission activité (#" + commissionId + ")");
        } catch (Exception e) {
            log.error("Echec crédit ledger commission activité #{}: {}", commissionId, e.getMessage());
        }
    }
}
