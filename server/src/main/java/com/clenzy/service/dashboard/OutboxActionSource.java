package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.repository.OutboxEventRepository;
import com.clenzy.service.OutboxRelay;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Messages internes définitivement perdus.
 *
 * <p>Une réservation créée dont le calendrier n'a jamais été prévenu, une
 * synchronisation de canal jamais publiée : le message a échoué autant de fois
 * que le relais l'autorise, puis a cessé d'être retenté. Plus personne ne le
 * reprendra, et rien ne le disait.</p>
 *
 * <p>C'est l'angle mort le plus dangereux du lot, parce qu'il est silencieux et
 * que ses conséquences apparaissent ailleurs — sous forme de double
 * réservation, par exemple.</p>
 */
@Component
public class OutboxActionSource implements ActionItemSource {

    private final OutboxEventRepository outboxEventRepository;

    public OutboxActionSource(OutboxEventRepository outboxEventRepository) {
        this.outboxEventRepository = outboxEventRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.OUTBOX_DEAD_LETTER);
    }

    @Override
    public Scope scope() {
        return Scope.TECHNICAL;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        // Le seuil vient du relais lui-même : deux constantes divergeraient, et
        // on afficherait comme perdus des messages encore à retenter.
        return outboxEventRepository.findExhaustedForOrg(
                        ctx.organizationId(), OutboxRelay.MAX_RETRIES)
                .stream()
                .map(event -> new ActionItemDto(
                        "outbox:" + event.getId(),
                        ActionItemKind.OUTBOX_DEAD_LETTER,
                        "critical",
                        event.getEventType(),
                        ActionItems.truncate(event.getErrorMessage(), ActionItems.EXCERPT_LENGTH),
                        null,
                        event.getId(),
                        null, null, null, null, null, null))
                .toList();
    }
}
