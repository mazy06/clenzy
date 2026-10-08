package com.clenzy.service.ai;

import com.clenzy.model.AiUsageLedgerEntry;
import com.clenzy.repository.AiUsageLedgerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

/** Le journal, la réserve et les poches sont validés ensemble, ou tous annulés. */
@Service
public class BaitlyCreditDebit {
    private final AiUsageLedgerRepository ledger;
    private final BaitlyCreditWallet wallet;
    private final CreditBalanceService balance;
    public BaitlyCreditDebit(AiUsageLedgerRepository ledger, BaitlyCreditWallet wallet, CreditBalanceService balance) {
        this.ledger = ledger; this.wallet = wallet; this.balance = balance;
    }
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public boolean record(AiUsageLedgerEntry entry, UUID reservation) {
        wallet.lock(entry.getOrganizationId());
        var known=ledger.findByIdempotencyKey(entry.getIdempotencyKey()).orElse(null);
        if (known!=null) {
            if (!java.util.Objects.equals(known.getOrganizationId(),entry.getOrganizationId())
                    || known.getMillicredits()!=entry.getMillicredits()
                    || !java.util.Objects.equals(known.getProvider(),entry.getProvider())
                    || !java.util.Objects.equals(known.getModel(),entry.getModel())
                    || known.getPromptTokens()!=entry.getPromptTokens() || known.getCompletionTokens()!=entry.getCompletionTokens())
                throw new IllegalStateException("Clé de consommation déjà utilisée pour un autre usage");
            return false;
        }
        ledger.saveAndFlush(entry);
        if (entry.getMillicredits() < 0) wallet.consume(entry.getOrganizationId(), reservation, Math.negateExact(entry.getMillicredits()));
        balance.invalidate(entry.getOrganizationId());
        return true;
    }
}
