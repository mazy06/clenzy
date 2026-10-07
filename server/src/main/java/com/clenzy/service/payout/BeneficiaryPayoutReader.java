package com.clenzy.service.payout;

import com.clenzy.dto.BeneficiaryTransferDto;
import com.clenzy.dto.PayoutTransferDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Lecture transverse strictement bornée à un destinataire préalablement autorisé par le serveur. */
@Service @Transactional(readOnly=true, propagation=Propagation.REQUIRES_NEW)
public class BeneficiaryPayoutReader {
    private final PayoutTransferRepository transfers;
    private final PayoutTransferEventRepository events;
    private final BankPayoutObservationRepository bank;
    private final BaitlyTransferRecoveryRepository recoveries;
    public BeneficiaryPayoutReader(PayoutTransferRepository transfers,PayoutTransferEventRepository events,BankPayoutObservationRepository bank,
            BaitlyTransferRecoveryRepository recoveries) {
        this.transfers=transfers;this.events=events;this.bank=bank;
        this.recoveries=recoveries;
    }
    public Page<BeneficiaryTransferDto> list(Long userId,Long organizationId,int page) {
        requireBeneficiary(userId,organizationId);
        if(page<0 || page>100000) throw new IllegalArgumentException("Page invalide.");
        return transfers.findForBeneficiary(userId,organizationId,PageRequest.of(page,12)).map(BeneficiaryTransferDto::from);
    }
    public BeneficiaryTransferDto.Detail detail(Long userId,Long organizationId,Long id) {
        requireBeneficiary(userId,organizationId);
        var transfer=transfers.findBeneficiaryTransfer(id,userId,organizationId)
                .orElseThrow(() -> new NotFoundException("Versement introuvable."));
        // Ownership vérifié avant toute lecture bancaire ou d'historique.
        return new BeneficiaryTransferDto.Detail(BeneficiaryTransferDto.from(transfer),
                events.findRecipientHistory(transfer.getOrganizationId(),id).stream()
                        .map(BeneficiaryTransferDto.Event::from).toList(),
                bank.findForTransfer(transfer.getOrganizationId(),id).stream().map(PayoutTransferDto.BankPayout::from).toList(),
                recoveries.findHistory(transfer.getOrganizationId(),id).stream().map(BeneficiaryTransferDto.Recovery::from).toList());
    }
    private static void requireBeneficiary(Long user,Long org) {
        if ((user==null)==(org==null) || (user!=null && user<=0) || (org!=null && org<=0))
            throw new IllegalArgumentException("Un bénéficiaire unique est requis.");
    }
}
