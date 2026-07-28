package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.GuestMessageLogRepository;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Le silence, dans les deux sens.
 *
 * <p>Une conversation dont le dernier mot revient au voyageur, et un message
 * que nous n'avons pas réussi à lui délivrer. Les deux se ressemblent à
 * l'écran — personne ne se parle — mais l'une est un oubli et l'autre une
 * panne. Aucune n'est rattachée à un logement : le périmètre de l'hôte ne
 * s'applique pas ici.</p>
 */
@Component
public class MessagingActionSource implements ActionItemSource {

    /** Au-delà, l'absence de réponse pendant un séjour se paie en avis. */
    private static final int REPLY_GRACE_HOURS = 4;

    /** Un échec plus ancien n'est plus rattrapable auprès du voyageur. */
    private static final int FAILURE_LOOKBACK_DAYS = 7;

    private final ConversationRepository conversationRepository;
    private final GuestMessageLogRepository guestMessageLogRepository;

    public MessagingActionSource(ConversationRepository conversationRepository,
                                 GuestMessageLogRepository guestMessageLogRepository) {
        this.conversationRepository = conversationRepository;
        this.guestMessageLogRepository = guestMessageLogRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.CONVERSATION_UNANSWERED, ActionItemKind.GUEST_MESSAGE_FAILED);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        final List<ActionItemDto> items = new ArrayList<>();

        conversationRepository.findAwaitingHostReply(
                        ctx.organizationId(), ctx.nowDateTime().minusHours(REPLY_GRACE_HOURS))
                .stream()
                .map(c -> new ActionItemDto(
                        "conversation:" + c.getId(),
                        ActionItemKind.CONVERSATION_UNANSWERED,
                        "warning",
                        ActionItems.firstNonBlank(c.getSubject(), "Conversation"),
                        ActionItems.truncate(c.getLastMessagePreview(), ActionItems.EXCERPT_LENGTH),
                        null,
                        c.getId(),
                        null, null, null, null, null, null))
                .forEach(items::add);

        guestMessageLogRepository.findFailedWithoutRetry(
                        ctx.organizationId(), ctx.nowDateTime().minusDays(FAILURE_LOOKBACK_DAYS))
                .stream()
                .map(log -> new ActionItemDto(
                        "message:" + log.getId(),
                        ActionItemKind.GUEST_MESSAGE_FAILED,
                        "warning",
                        ActionItems.firstNonBlank(log.getSubject(), "Message voyageur"),
                        log.getRecipient(),
                        null,
                        log.getReservationId(),
                        null, null, null, null, null, null))
                .forEach(items::add);

        return items;
    }
}
