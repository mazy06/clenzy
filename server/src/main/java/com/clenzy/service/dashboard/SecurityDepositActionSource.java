package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.repository.SecurityDepositRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Cautions encore retenues bien après le départ.
 *
 * <p>L'argent du voyageur reste bloqué sur sa carte sans que rien ne le
 * rappelle : c'est une réclamation qui arrive, puis un avis.</p>
 */
@Component
public class SecurityDepositActionSource implements ActionItemSource {

    /** Passé ce délai, la retenue n'est plus une précaution mais un oubli. */
    private static final int HOLD_GRACE_DAYS = 3;

    private final SecurityDepositRepository securityDepositRepository;

    public SecurityDepositActionSource(SecurityDepositRepository securityDepositRepository) {
        this.securityDepositRepository = securityDepositRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.DEPOSIT_STUCK);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        return securityDepositRepository.findHeldLongAfterCheckout(
                        ctx.organizationId(), ctx.today().minusDays(HOLD_GRACE_DAYS))
                .stream()
                .map(deposit -> new ActionItemDto(
                        "deposit:" + deposit.getId(),
                        ActionItemKind.DEPOSIT_STUCK,
                        "warning",
                        "RES-" + deposit.getReservationId(),
                        null,
                        null,
                        deposit.getReservationId(),
                        null,
                        null,
                        deposit.getAmount(),
                        null, null, null))
                .toList();
    }
}
