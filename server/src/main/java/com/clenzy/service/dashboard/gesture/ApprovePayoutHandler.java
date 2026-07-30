package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.service.AccountingService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Approuver un reversement propriétaire.
 *
 * <p>N'exécute pas le virement : il part ensuite, par le circuit de versement.
 * Ce geste lève la décision qui manquait.</p>
 */
@Component
public class ApprovePayoutHandler implements ActionGestureHandler {

    private final AccountingService accountingService;

    public ApprovePayoutHandler(AccountingService accountingService) {
        this.accountingService = accountingService;
    }

    @Override
    public String action() {
        return "approve";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.OWNER_PAYOUT_PENDING);
    }

    @Override
    public void handle(GestureContext context) {
        accountingService.approvePayout(context.targetId(), context.orgId());
    }
}
