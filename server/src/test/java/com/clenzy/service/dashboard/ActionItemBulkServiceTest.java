package com.clenzy.service.dashboard;

import com.clenzy.dto.BulkGestureResultDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.ActionItem;
import com.clenzy.repository.ActionItemRepository;
import com.clenzy.service.dashboard.gesture.ActionGestureHandler;
import com.clenzy.service.dashboard.gesture.GestureContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Les gardes du geste de masse.
 *
 * <p>Un lot applique le même effet à des dizaines de lignes sur une seule
 * confirmation. Trois choses doivent donc être vraies, et ce sont elles que ces
 * tests figent : une nature dont aucun gestionnaire n'a déclaré son geste
 * répétable refuse le lot ; un échec au milieu du lot ne fait pas tomber les
 * autres lignes et ressort nommé dans le résultat ; et la rubrique est rendue
 * dès la fin du lot, pour que le reliquat annoncé puisse effectivement être
 * relancé.</p>
 */
class ActionItemBulkServiceTest {

    private static final Long ORG = 12L;
    private static final Instant NOW = Instant.parse("2026-09-05T08:00:00Z");

    private ActionItemRepository actionItemRepository;
    private ActionItemActionService actionService;
    private StringRedisTemplate redisTemplate;
    private ValueOperations<String, String> valueOps;
    private Jwt jwt;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        actionItemRepository = mock(ActionItemRepository.class);
        actionService = mock(ActionItemActionService.class);
        redisTemplate = mock(StringRedisTemplate.class);
        valueOps = mock(ValueOperations.class);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.setIfAbsent(any(), any(), any(Duration.class))).thenReturn(true);
        jwt = mock(Jwt.class);
    }

    private ActionItemBulkService service(ActionGestureHandler... handlers) {
        return new ActionItemBulkService(
                actionItemRepository,
                actionService,
                redisTemplate,
                Clock.fixed(NOW, ZoneOffset.UTC),
                List.of(handlers));
    }

    /** Une action de la file, réduite à ce dont le lot a besoin. */
    private static ActionItem item(Long id, String title) {
        final ActionItem item = new ActionItem();
        item.setId(id);
        item.setOrganizationId(ORG);
        item.setKind(ActionItemKind.GUEST_MESSAGE_FAILED.name());
        item.setTitle(title);
        return item;
    }

    private void batchOf(ActionItem... items) {
        when(actionItemRepository.findOpenForOrgAndKind(
                eq(ORG), eq(ActionItemKind.GUEST_MESSAGE_FAILED.name()), eq(NOW), any(Pageable.class)))
                .thenReturn(List.of(items));
    }

    @Test
    void whenKindDeclaresNoBulkGesture_thenTheLotIsRefused() {
        // Arrange — un geste existe pour cette nature, mais il n'est pas répétable.
        final ActionItemBulkService service = service(handler("approve",
                ActionItemKind.OWNER_PAYOUT_PENDING, false));

        // Act + Assert
        assertThatThrownBy(() -> service.apply(ORG, ActionItemKind.OWNER_PAYOUT_PENDING, jwt))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("OWNER_PAYOUT_PENDING");
        verify(actionService, never()).act(anyLong(), anyLong(), any(), any());
    }

    @Test
    void whenOneGestureFails_thenTheOthersStillRunAndTheFailureIsNamed() {
        // Arrange
        final ActionItemBulkService service = service(handler("retry",
                ActionItemKind.GUEST_MESSAGE_FAILED, true));
        batchOf(item(1L, "Message à Claire"), item(2L, "Message à Marcus"), item(3L, "Message à Ana"));
        doThrow(new IllegalStateException("Aucun canal joignable"))
                .when(actionService).act(eq(2L), eq(ORG), eq("retry"), any());
        when(actionItemRepository.countOpenForOrgAndKind(ORG,
                ActionItemKind.GUEST_MESSAGE_FAILED.name(), NOW)).thenReturn(1L);

        // Act
        final BulkGestureResultDto result = service.apply(ORG, ActionItemKind.GUEST_MESSAGE_FAILED, jwt);

        // Assert — la ligne 3 est passée malgré l'échec de la ligne 2.
        verify(actionService).act(3L, ORG, "retry", jwt);
        assertThat(result.requested()).isEqualTo(3);
        assertThat(result.succeeded()).isEqualTo(2);
        assertThat(result.failed()).isEqualTo(1);
        assertThat(result.remaining()).isEqualTo(1L);
        assertThat(result.failures()).singleElement().satisfies(failure -> {
            assertThat(failure.actionItemId()).isEqualTo(2L);
            assertThat(failure.title()).isEqualTo("Message à Marcus");
            assertThat(failure.reason()).isEqualTo("Aucun canal joignable");
        });
    }

    @Test
    void whenAGestureFailsTechnically_thenTheReasonStaysGeneric() {
        // Arrange — un message technique ne doit pas remonter jusqu'à l'écran.
        final ActionItemBulkService service = service(handler("retry",
                ActionItemKind.GUEST_MESSAGE_FAILED, true));
        batchOf(item(1L, "Message à Claire"));
        doThrow(new RuntimeException("could not execute statement [23505] on table guest_message_log"))
                .when(actionService).act(eq(1L), eq(ORG), eq("retry"), any());

        // Act
        final BulkGestureResultDto result = service.apply(ORG, ActionItemKind.GUEST_MESSAGE_FAILED, jwt);

        // Assert
        assertThat(result.failures()).singleElement()
                .extracting(BulkGestureResultDto.Failure::reason)
                .isEqualTo("Echec technique");
    }

    @Test
    void whenTheLotEnds_thenTheRubricIsReleased() {
        // Arrange — le résultat annonce un reliquat, donc un second lot doit passer.
        final ActionItemBulkService service = service(handler("retry",
                ActionItemKind.GUEST_MESSAGE_FAILED, true));
        batchOf(item(1L, "Message à Claire"));

        // Act
        service.apply(ORG, ActionItemKind.GUEST_MESSAGE_FAILED, jwt);

        // Assert
        verify(redisTemplate).delete("action-item:bulk:" + ORG + ":GUEST_MESSAGE_FAILED");
    }

    @Test
    void whenAnotherLotHoldsTheRubric_thenTheSecondIsRefusedWithoutActing() {
        // Arrange
        final ActionItemBulkService service = service(handler("retry",
                ActionItemKind.GUEST_MESSAGE_FAILED, true));
        when(valueOps.setIfAbsent(any(), any(), any(Duration.class))).thenReturn(false);

        // Act + Assert
        assertThatThrownBy(() -> service.apply(ORG, ActionItemKind.GUEST_MESSAGE_FAILED, jwt))
                .isInstanceOf(IllegalStateException.class);
        verify(actionService, never()).act(anyLong(), anyLong(), any(), any());
    }

    @Test
    void whenTwoHandlersClaimTheSameKindInBulk_thenTheApplicationRefusesToStart() {
        // Arrange + Act + Assert — un doublon ferait choisir Spring au hasard.
        assertThatThrownBy(() -> service(
                handler("retry", ActionItemKind.GUEST_MESSAGE_FAILED, true),
                handler("resend", ActionItemKind.GUEST_MESSAGE_FAILED, true)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("GUEST_MESSAGE_FAILED");
    }

    @Test
    void bulkGestures_thenOnlyTheDeclaredOnesAreOffered() {
        // Arrange
        final ActionItemBulkService service = service(
                handler("retry", ActionItemKind.GUEST_MESSAGE_FAILED, true),
                handler("approve", ActionItemKind.OWNER_PAYOUT_PENDING, false));

        // Act + Assert
        assertThat(service.bulkGestures())
                .singleElement()
                .satisfies(gesture -> {
                    assertThat(gesture.kind()).isEqualTo(ActionItemKind.GUEST_MESSAGE_FAILED);
                    assertThat(gesture.action()).isEqualTo("retry");
                });
    }

    /** Un gestionnaire réduit à sa déclaration : le lot ne l'appelle jamais. */
    private static ActionGestureHandler handler(String action, ActionItemKind kind, boolean bulkable) {
        return new ActionGestureHandler() {
            @Override
            public String action() {
                return action;
            }

            @Override
            public Set<ActionItemKind> kinds() {
                return Set.of(kind);
            }

            @Override
            public boolean bulkable() {
                return bulkable;
            }

            @Override
            public void handle(GestureContext context) {
                throw new UnsupportedOperationException("Le lot passe par ActionItemActionService");
            }
        };
    }
}
