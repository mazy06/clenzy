package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.repository.OrganizationInvitationRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Invitations périmées que personne n'a relancées.
 *
 * <p>Le statut n'est jamais repassé à « expirée » : c'est cette divergence
 * entre le statut et la date qui rend l'anomalie détectable — et qui la rendait
 * invisible. Côté personne invitée, le lien ne fonctionne simplement plus, sans
 * que quiconque en soit informé.</p>
 */
@Component
public class InvitationActionSource implements ActionItemSource {

    private final OrganizationInvitationRepository invitationRepository;

    public InvitationActionSource(OrganizationInvitationRepository invitationRepository) {
        this.invitationRepository = invitationRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.INVITATION_EXPIRED);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        return invitationRepository.findExpiredStillPending(
                        ctx.organizationId(), ctx.nowDateTime())
                .stream()
                .map(invitation -> new ActionItemDto(
                        "invitation:" + invitation.getId(),
                        ActionItemKind.INVITATION_EXPIRED,
                        "warning",
                        invitation.getInvitedEmail(),
                        invitation.getRoleInvited() == null
                                ? null : invitation.getRoleInvited().name(),
                        invitation.getInvitedEmail(),
                        invitation.getId(),
                        null, null, null, null, null, null))
                .toList();
    }
}
