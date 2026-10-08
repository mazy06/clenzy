package com.clenzy.service;

import com.clenzy.dto.ActivityCommissionDto;
import com.clenzy.dto.ActivityCommissionSummaryDto;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

/** Affiliation : conversion attendue, commission reçue et virement hôte sont distincts. */
@Service
public class ActivityCommissionService {
    private final ActivityCommissionRepository commissions;
    private final ActivityAffiliateConfigRepository configs;
    private final PropertyRepository properties;
    private final WalletService wallets;
    private final LedgerService ledger;
    private final OrganizationRepository organizations;
    public ActivityCommissionService(ActivityCommissionRepository commissions, ActivityAffiliateConfigRepository configs,
            PropertyRepository properties, WalletService wallets, LedgerService ledger, OrganizationRepository organizations) {
        this.commissions=commissions; this.configs=configs; this.properties=properties;
        this.wallets=wallets; this.ledger=ledger; this.organizations=organizations;
    }

    /** L'import ne crée aucune écriture. Un doublon divergent exige une correction explicite. */
    @Transactional
    public ActivityCommissionDto recordAffiliateEarning(Long orgId, ActivityProvider provider, String reference,
            BigDecimal gross, String currency, Long propertyId) {
        require(orgId != null && provider != null && reference != null && !reference.isBlank() && reference.length()<=255,
                "Référence de conversion requise");
        require(gross != null && gross.signum()>0, "Commission positive requise");
        gross=gross.setScale(2,RoundingMode.UNNECESSARY);
        require(currency != null && currency.matches("(?i)[A-Z]{3}"), "Devise du rapport requise");
        currency=Currency.getInstance(currency.toUpperCase(Locale.ROOT)).getCurrencyCode();
        organizations.lockById(orgId).orElseThrow(() -> new IllegalArgumentException("Organisation introuvable"));
        var existing=commissions.findByOrganizationIdAndProviderAndExternalBookingId(orgId,provider,reference.trim());
        if(existing.isPresent()) {
            var row=existing.get();
            require(gross.compareTo(row.getGrossCommission())==0 && currency.equals(row.getCurrency())
                    && Objects.equals(propertyId,row.getPropertyId()), "Rapport différent : rapprochement manuel requis");
            return ActivityCommissionDto.from(row);
        }
        BigDecimal rate=configs.findByOrganizationIdAndProvider(orgId,provider)
                .map(ActivityAffiliateConfig::getPlatformCommissionPct).orElse(BigDecimal.ZERO);
        require(rate.signum()>=0 && rate.compareTo(BigDecimal.valueOf(100))<=0,"Commission Baitly invalide");
        var row=new ActivityCommission(); row.setOrganizationId(orgId); row.setProvider(provider);
        row.setExternalBookingId(reference.trim()); row.setGrossCommission(gross); row.setCurrency(currency);
        row.setPlatformShare(gross.multiply(rate).divide(BigDecimal.valueOf(100),2,RoundingMode.HALF_UP));
        row.setHostShare(gross.subtract(row.getPlatformShare())); row.setPropertyId(propertyId);
        if(propertyId!=null) row.setBeneficiaryOwnerId(owner(orgId,propertyId));
        row.setStatus(ActivityCommissionStatus.PENDING); commissions.save(row);
        return ActivityCommissionDto.from(row);
    }

    /** Déclaration staff d'un encaissement externe avec justificatif. Aucun appel Stripe. */
    @Transactional
    public ActivityCommissionDto receive(Long orgId, Long id, BigDecimal amount, String currency,
            Long propertyId, String receipt, LocalDateTime receivedAt, String actor) {
        require(receipt!=null && !receipt.isBlank() && receipt.length()<=255 && actor!=null && !actor.isBlank(),
                "Référence justificative et auteur requis");
        require(receivedAt!=null && !receivedAt.isAfter(LocalDateTime.now(ZoneOffset.UTC).plusMinutes(5)),
                "Date de réception invalide");
        var row=commissions.lockByIdAndOrganizationId(id,orgId)
                .orElseThrow(() -> new IllegalArgumentException("Commission introuvable"));
        require(amount!=null && amount.compareTo(row.getGrossCommission())==0
                && row.getCurrency().equalsIgnoreCase(currency),"Montant ou devise du justificatif incompatible");
        if(row.getStatus()==ActivityCommissionStatus.RECEIVED) {
            require(receipt.trim().equals(row.getReceiptReference()) && Objects.equals(propertyId,row.getPropertyId()),
                    "Encaissement déjà rapproché avec une autre preuve");
            return ActivityCommissionDto.from(row);
        }
        require(row.getStatus()==ActivityCommissionStatus.PENDING || row.getStatus()==ActivityCommissionStatus.CONFIRMED,
                "Historique ou commission annulée : revue requise");
        require(propertyId!=null && (row.getPropertyId()==null || propertyId.equals(row.getPropertyId())),
                "Logement du bénéficiaire requis");
        Long currentOwner=owner(orgId,propertyId);
        Long beneficiary=row.getBeneficiaryOwnerId()!=null ? row.getBeneficiaryOwnerId() : currentOwner;
        require(!ledger.hasEntriesForReference(LedgerReferenceType.COMMISSION,"ACTIVITY-"+id),
                "Écriture historique existante : revue requise");
        if(row.getHostShare().signum()>0) {
            Wallet platform=wallets.getOrCreatePlatformWallet(orgId,row.getCurrency());
            Wallet host=wallets.getOrCreateWallet(orgId,WalletType.OWNER,beneficiary,row.getCurrency());
            ledger.recordTransfer(platform,host,row.getHostShare(),LedgerReferenceType.COMMISSION,"ACTIVITY-"+id,
                    "Commission "+row.getProvider()+" reçue, justificatif "+receipt.trim());
        }
        row.setPropertyId(propertyId); row.setBeneficiaryOwnerId(beneficiary);
        row.setReceiptReference(receipt.trim()); row.setReceivedAt(receivedAt); row.setRecordedBy(actor);
        row.setStatus(ActivityCommissionStatus.RECEIVED); commissions.save(row);
        return ActivityCommissionDto.from(row);
    }

    @Transactional
    public ActivityCommissionDto cancelExpected(Long orgId, Long id) {
        var row=commissions.lockByIdAndOrganizationId(id,orgId).orElseThrow();
        require(row.getStatus()==ActivityCommissionStatus.PENDING || row.getStatus()==ActivityCommissionStatus.CONFIRMED
                || row.getStatus()==ActivityCommissionStatus.CANCELLED,"Commission reçue : justificatif de reprise nécessaire");
        row.setStatus(ActivityCommissionStatus.CANCELLED); commissions.save(row);
        return ActivityCommissionDto.from(row);
    }

    private Long owner(Long orgId,Long propertyId) {
        Property property=properties.findById(propertyId).orElseThrow(() -> new IllegalArgumentException("Logement introuvable"));
        require(orgId.equals(property.getOrganizationId()),"Logement hors organisation");
        require(property.getOwner()!=null && property.getOwner().getId()!=null,"Bénéficiaire du logement manquant");
        return property.getOwner().getId();
    }

    @Transactional(readOnly=true)
    public List<ActivityCommissionDto> listForOrg(Long orgId) {
        return commissions.findByOrganizationIdOrderByCreatedAtDesc(orgId).stream().map(ActivityCommissionDto::from).toList();
    }

    @Transactional(readOnly=true)
    public ActivityCommissionSummaryDto summaryForOrg(Long orgId) {
        var rows=commissions.findByOrganizationIdOrderByCreatedAtDesc(orgId);
        var currencies=new TreeSet<String>(); rows.forEach(row -> currencies.add(row.getCurrency()));
        var totals=new ArrayList<ActivityCommissionSummaryDto.CurrencyTotal>();
        for(String currency:currencies) {
            BigDecimal expected=BigDecimal.ZERO, received=BigDecimal.ZERO, host=BigDecimal.ZERO, platform=BigDecimal.ZERO;
            long count=0;
            for(var row:rows) {
                if(!currency.equals(row.getCurrency()) || row.getStatus()==ActivityCommissionStatus.CANCELLED) continue;
                count++;
                if(row.getStatus()==ActivityCommissionStatus.RECEIVED) {
                    received=received.add(row.getGrossCommission()); host=host.add(row.getHostShare()); platform=platform.add(row.getPlatformShare());
                } else if(row.getStatus()!=ActivityCommissionStatus.PAID) expected=expected.add(row.getGrossCommission());
            }
            totals.add(new ActivityCommissionSummaryDto.CurrencyTotal(currency,expected,received,host,platform,count));
        }
        var single=totals.size()==1 ? totals.get(0) : null;
        return new ActivityCommissionSummaryDto(single==null?null:single.receivedGross(),single==null?null:single.hostShare(),
                single==null?null:single.platformShare(),rows.size(),single==null?null:single.currency(),List.copyOf(totals));
    }
    private static void require(boolean valid,String message) { if(!valid) throw new IllegalArgumentException(message); }
}
