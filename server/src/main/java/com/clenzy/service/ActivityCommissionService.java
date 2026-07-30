package com.clenzy.service;

import com.clenzy.dto.ActivityCommissionDto;
import com.clenzy.dto.ActivityCommissionSummaryDto;
import com.clenzy.model.*;
import com.clenzy.repository.ActivityAffiliateConfigRepository;
import com.clenzy.repository.ActivityCommissionRepository;
import com.clenzy.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Commissions d'affiliation des activités : Baitly est l'affilié officiel,
 * encaisse la commission versée par le programme, en retient sa part et
 * reverse le solde à l'hôte via le ledger interne (→ payout).
 *
 * <p><b>La conciergerie ne touche rien sur les activités</b> — contrairement aux
 * upsells. La commission se partage entre Baitly et le propriétaire seulement.</p>
 *
 * <p>La part Baitly se négocie programme par programme :
 * {@code ActivityAffiliateConfig.platformCommissionPct}. Absente = rien retenu,
 * l'intégralité revient à l'hôte : un défaut appliquerait un taux que personne
 * n'a décidé.</p>
 */
@Service
public class ActivityCommissionService {

    private static final Logger log = LoggerFactory.getLogger(ActivityCommissionService.class);
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final ActivityCommissionRepository commissionRepository;
    private final ActivityAffiliateConfigRepository affiliateConfigRepository;
    private final PropertyRepository propertyRepository;
    private final WalletService walletService;
    private final LedgerService ledgerService;

    public ActivityCommissionService(ActivityCommissionRepository commissionRepository,
                                     ActivityAffiliateConfigRepository affiliateConfigRepository,
                                     PropertyRepository propertyRepository,
                                     WalletService walletService,
                                     LedgerService ledgerService) {
        this.commissionRepository = commissionRepository;
        this.affiliateConfigRepository = affiliateConfigRepository;
        this.propertyRepository = propertyRepository;
        this.walletService = walletService;
        this.ledgerService = ledgerService;
    }

    /**
     * Enregistre une commission d'affiliation perçue et crédite la part hôte.
     *
     * <p><b>Idempotent</b> sur {@code (org, provider, externalBookingId)} : les
     * rapports d'affiliation se rejouent — re-téléchargement, périodes qui se
     * chevauchent — et un doublon créditerait l'hôte deux fois. Le
     * ré-enregistrement retourne la ligne existante sans nouvel effet.</p>
     *
     * @param grossCommission commission versée par le programme, telle que reportée
     * @param propertyId      logement rattaché, pour retrouver le propriétaire à créditer
     */
    @Transactional
    public ActivityCommissionDto recordAffiliateEarning(Long orgId,
                                                        ActivityProvider provider,
                                                        String externalBookingId,
                                                        BigDecimal grossCommission,
                                                        String currency,
                                                        Long propertyId) {
        if (grossCommission == null || grossCommission.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                "Commission d'affiliation nulle ou negative pour " + provider + "/" + externalBookingId);
        }
        var existing = commissionRepository
            .findByOrganizationIdAndProviderAndExternalBookingId(orgId, provider, externalBookingId);
        if (existing.isPresent()) {
            log.debug("Commission affiliation deja enregistree provider={} ref={} — ignoree",
                provider, externalBookingId);
            return ActivityCommissionDto.from(existing.get());
        }

        BigDecimal platformPct = affiliateConfigRepository
            .findByOrganizationIdAndProvider(orgId, provider)
            .map(ActivityAffiliateConfig::getPlatformCommissionPct)
            .orElse(null);
        BigDecimal platformShare = platformPct == null
            ? BigDecimal.ZERO
            : grossCommission.multiply(platformPct).divide(HUNDRED, 2, RoundingMode.HALF_UP);
        BigDecimal hostShare = grossCommission.subtract(platformShare);

        ActivityCommission commission = new ActivityCommission();
        commission.setOrganizationId(orgId);
        commission.setProvider(provider);
        commission.setExternalBookingId(externalBookingId);
        commission.setGrossCommission(grossCommission);
        commission.setPlatformShare(platformShare);
        commission.setHostShare(hostShare);
        commission.setCurrency(currency != null ? currency : "EUR");
        commission.setStatus(ActivityCommissionStatus.PAID);
        commissionRepository.save(commission);

        creditHostShare(commission, propertyId);
        log.info("Commission affiliation provider={} ref={} brut={} {} → hote={} baitly={}",
            provider, externalBookingId, grossCommission, commission.getCurrency(),
            hostShare, platformShare);
        return ActivityCommissionDto.from(commission);
    }

    /**
     * Crédite la part hôte (wallet plateforme → wallet OWNER).
     *
     * <p>Sans propriétaire résoluble, la commission reste enregistrée mais non
     * créditée : perdre la ligne serait pire, elle est la trace de ce que le
     * programme a versé. Le warn signale la reprise à faire.</p>
     */
    private void creditHostShare(ActivityCommission commission, Long propertyId) {
        if (commission.getHostShare().compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        Long ownerId = ownerIdForProperty(propertyId);
        if (ownerId == null) {
            log.warn("Commission affiliation id={} : proprietaire introuvable (property={}), "
                + "part hote non creditee au ledger", commission.getId(), propertyId);
            return;
        }
        String currency = commission.getCurrency();
        Long orgId = commission.getOrganizationId();
        Wallet platformWallet = walletService.getOrCreatePlatformWallet(orgId, currency);
        Wallet ownerWallet = walletService.getOrCreateWallet(orgId, WalletType.OWNER, ownerId, currency);
        ledgerService.recordTransfer(platformWallet, ownerWallet, commission.getHostShare(),
            LedgerReferenceType.COMMISSION,
            "ACTIVITY-" + commission.getId(),
            "Part hote commission " + commission.getProvider()
                + " (reservation " + commission.getExternalBookingId() + ")");
    }

    private Long ownerIdForProperty(Long propertyId) {
        if (propertyId == null) {
            return null;
        }
        return propertyRepository.findById(propertyId)
            .map(p -> p.getOwner() != null ? p.getOwner().getId() : null)
            .orElse(null);
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
}
