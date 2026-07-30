package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.service.OrganizationInvitationService;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Renvoyer une invitation expirée.
 *
 * <p>Crée une NOUVELLE invitation — l'ancienne est annulée et un email part.
 * C'est pourquoi le verrou anti double-clic de l'orchestrateur compte ici plus
 * qu'ailleurs : deux clics feraient deux invitations et deux emails.</p>
 */
@Component
public class ResendInvitationHandler implements ActionGestureHandler {

    private final OrganizationInvitationService invitationService;

    public ResendInvitationHandler(OrganizationInvitationService invitationService) {
        this.invitationService = invitationService;
    }

    @Override
    public String action() {
        return "resendInvitation";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.INVITATION_EXPIRED);
    }

    @Override
    public void handle(GestureContext context) {
        invitationService.resendInvitation(context.orgId(), context.targetId(), context.jwt());
    }
}
