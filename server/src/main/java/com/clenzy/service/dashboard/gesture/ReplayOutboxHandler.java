package com.clenzy.service.dashboard.gesture;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.OutboxEvent;
import com.clenzy.repository.OutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Remettre un message perdu en file d'attente, <b>pour cette organisation</b>.
 *
 * <p>Le rejeu en masse existant ({@code SyncAdminService.bulkRetryOutbox}) ne
 * filtre pas par organisation : il ne tient que par le {@code @PreAuthorize}
 * SUPER_ADMIN de son controller. L'appeler depuis un tableau de bord
 * d'organisation aurait permis de rejouer les messages d'une autre.</p>
 */
@Component
public class ReplayOutboxHandler implements ActionGestureHandler {

    private static final Logger log = LoggerFactory.getLogger(ReplayOutboxHandler.class);

    private final OutboxEventRepository outboxEventRepository;

    public ReplayOutboxHandler(OutboxEventRepository outboxEventRepository) {
        this.outboxEventRepository = outboxEventRepository;
    }

    @Override
    public String action() {
        return "replay";
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.OUTBOX_DEAD_LETTER);
    }

    @Override
    public void handle(GestureContext context) {
        final Long orgId = context.orgId();
        final OutboxEvent event = outboxEventRepository.findById(context.targetId())
                .filter(e -> orgId.equals(e.getOrganizationId()))
                .orElseThrow(() -> new IllegalArgumentException("Message introuvable"));
        event.setStatus("PENDING");
        event.setRetryCount(0);
        outboxEventRepository.save(event);
        log.info("Message outbox {} remis en file pour org={}", event.getId(), orgId);
    }
}
