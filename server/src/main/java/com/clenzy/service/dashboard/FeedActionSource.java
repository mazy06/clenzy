package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.repository.ICalFeedRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;

/**
 * Calendriers muets ou en échec — première cause de double réservation.
 *
 * <p>L'ancienneté part en {@code amount} plutôt qu'en texte : « 30 h sans
 * succès » fabriqué ici serait du français en dur dans une interface qui parle
 * aussi anglais et arabe. Le serveur donne le nombre, le front la phrase.</p>
 */
@Component
public class FeedActionSource implements ActionItemSource {

    /** Un flux muet depuis plus d'une journée est considéré en dérive. */
    private static final int STALE_HOURS = 24;

    private final ICalFeedRepository iCalFeedRepository;

    public FeedActionSource(ICalFeedRepository iCalFeedRepository) {
        this.iCalFeedRepository = iCalFeedRepository;
    }

    @Override
    public Set<ActionItemKind> kinds() {
        return Set.of(ActionItemKind.FEED_STALE);
    }

    @Override
    public Scope scope() {
        return Scope.BUSINESS;
    }

    @Override
    public List<ActionItemDto> collect(ActionItemContext ctx) {
        return iCalFeedRepository.findStaleOrFailing(
                        ctx.organizationId(), ctx.nowDateTime().minusHours(STALE_HOURS))
                .stream()
                .filter(feed -> ctx.covers(feed.getProperty()))
                .map(feed -> new ActionItemDto(
                        "feed:" + feed.getId(),
                        ActionItemKind.FEED_STALE,
                        "critical",
                        feed.getSourceName(),
                        ActionItems.propertyName(feed.getProperty()),
                        null,
                        feed.getId(),
                        ActionItems.propertyId(feed.getProperty()),
                        ActionItems.propertyName(feed.getProperty()),
                        feed.getLastSyncAt() == null ? null : BigDecimal.valueOf(
                                ChronoUnit.HOURS.between(feed.getLastSyncAt(), ctx.nowDateTime())),
                        null, null, null))
                .toList();
    }
}
