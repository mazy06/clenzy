package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.repository.OwnerPayoutConfigRepository;
import com.clenzy.repository.OwnerPayoutRepository;
import org.springframework.stereotype.Component;

import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * L'argent qui devrait être parti chez le propriétaire, et qui ne part pas.
 *
 * <p><b>Reversement en attente</b> — préparé, jamais approuvé. Le propriétaire
 * attend son virement et personne ne sait que la décision manque.</p>
 *
 * <p><b>Inscription inachevée</b> — un compte de paiement raccordé mais dont la
 * vérification n'a jamais été menée à son terme. C'est le pire des cas : tout
 * paraît configuré, et aucun versement ne partira jamais. Rien ne le signalait,
 * et cela ne se découvrait qu'au moment où le propriétaire réclamait.</p>
 */
@Component
public class PayoutActionSource implements ActionItemSource {

    /** Une semaine d'attente d'approbation n'est plus un délai de traitement. */
    private static final int APPROVAL_GRACE_DAYS = 7;

    private final OwnerPayoutRepository ownerPayoutRepository;
    private final OwnerPayoutConfigRepository ownerPayoutConfigRepository;

    public PayoutActionSource(OwnerPayoutRepository ownerPayoutRepository,
                              OwnerPayoutConfigRepository ownerPayoutConfigRepository) {
        this.ownerPayoutRepository = ownerPayoutRepository;
        this.ownerPayoutConfigRepository = ownerPayoutConfigRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.OWNER_PAYOUT_PENDING,
                ActionItemKind.PAYOUT_ONBOARDING_INCOMPLETE);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        final List<ActionItemDto> items = new ArrayList<>();

        ownerPayoutRepository.findPendingOlderThan(
                        ctx.organizationId(),
                        ctx.now().minus(APPROVAL_GRACE_DAYS, ChronoUnit.DAYS))
                .stream()
                .map(payout -> new ActionItemDto(
                        "payout:" + payout.getId(),
                        ActionItemKind.OWNER_PAYOUT_PENDING,
                        "warning",
                        "Reversement à approuver",
                        payout.getPeriodStart() + " → " + payout.getPeriodEnd(),
                        null,
                        payout.getId(),
                        null, null,
                        payout.getNetAmount(),
                        null, null,
                        payout.getCurrency()))
                .forEach(items::add);

        ownerPayoutConfigRepository.findIncompleteOnboarding(ctx.organizationId()).stream()
                .map(config -> new ActionItemDto(
                        "payout-onboarding:" + config.getId(),
                        ActionItemKind.PAYOUT_ONBOARDING_INCOMPLETE,
                        "critical",
                        "Compte de paiement non finalisé",
                        "Aucun versement ne partira tant que la vérification n'est pas terminée.",
                        null,
                        config.getId(),
                        null, null, null, null, null, null))
                .forEach(items::add);

        return items;
    }
}
