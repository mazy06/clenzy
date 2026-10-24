package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.service.SecurityDepositPaymentService;
import com.clenzy.service.OrganizationService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Libérer une caution retenue.
 *
 * <p>Passe par la couche qui parle au fournisseur de paiement, et non par la
 * seule mise à jour en base : sans elle, la caution serait dite « libérée »
 * alors que l'argent resterait bloqué sur la carte du voyageur.</p>
 */
@Component
public class ReleaseDepositHandler implements ActionGestureHandler {

    private final SecurityDepositPaymentService securityDepositPaymentService;
    private final OrganizationService organizationAccess;

    public ReleaseDepositHandler(SecurityDepositPaymentService securityDepositPaymentService, OrganizationService organizationAccess) {
        this.securityDepositPaymentService = securityDepositPaymentService;
        this.organizationAccess = organizationAccess;
    }

    @Override
    public String action() {
        return "release";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.DEPOSIT_STUCK);
    }

    @Override
    public void handle(GestureContext context) {
        organizationAccess.validateOrgManagement(context.actorId(), context.orgId());
        securityDepositPaymentService.releaseHold(context.orgId(), context.targetId());
    }
}
