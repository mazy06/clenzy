package com.clenzy.service.agent;

import com.clenzy.config.ai.ChatMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests de la file persistée "en attente de validation" (HITL) du
 * {@link PendingToolStore}.
 *
 * <p>Couvre l'index Redis ajouté pour le re-affichage front après reload :</p>
 * <ol>
 *   <li><b>put → listForUser</b> : une action mise en pause apparaît dans la file
 *       du user, avec un {@link PendingActionDto} complet (toolCallId, toolName,
 *       description, argsSummary, conversationId, createdAt).</li>
 *   <li><b>consume → vide</b> : confirmer/refuser (consume) retire l'action de la
 *       file ; le listing redevient vide.</li>
 *   <li><b>isolation cross-user</b> : un user ne voit QUE ses propres actions
 *       (ownership strict garanti par le scope de la clé Redis).</li>
 * </ol>
 *
 * <p>Redis est simulé par un {@code HashOperations} adossé à une vraie {@code Map}
 * en mémoire : on teste le contrat put/list/consume sans embedded Redis, tout en
 * exerçant la vraie sérialisation JSON du DTO.</p>
 */
class PendingToolStorePersistenceTest {

    private static final String USER_A = "kc-user-a";
    private static final String USER_B = "kc-user-b";

    private PendingToolStore store;
    /** Vraie persistance simulée : clé Redis -> (toolCallId -> JSON DTO). */
    private final Map<String, Map<String, String>> redis = new HashMap<>();

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        HashOperations<String, Object, Object> hashOps = mock(HashOperations.class);
        when(redisTemplate.opsForHash()).thenReturn((HashOperations) hashOps);

        // put(key, field, value)
        doAnswer(inv -> {
            String key = inv.getArgument(0);
            String field = inv.getArgument(1).toString();
            String value = inv.getArgument(2).toString();
            redis.computeIfAbsent(key, k -> new HashMap<>()).put(field, value);
            return null;
        }).when(hashOps).put(any(), any(), any());

        // delete(key, field...) — varargs : l'arg #1 peut être l'élément ou l'Object[].
        doAnswer(inv -> {
            String key = inv.getArgument(0);
            Map<String, String> bucket = redis.get(key);
            if (bucket == null) {
                return 0L;
            }
            long removed = 0;
            for (int i = 1; i < inv.getArguments().length; i++) {
                Object arg = inv.getArguments()[i];
                if (arg instanceof Object[] arr) {
                    for (Object field : arr) {
                        if (field != null && bucket.remove(field.toString()) != null) {
                            removed++;
                        }
                    }
                } else if (arg != null && bucket.remove(arg.toString()) != null) {
                    removed++;
                }
            }
            return removed;
        }).when(hashOps).delete(any(), any());

        // entries(key)
        doAnswer(inv -> {
            String key = inv.getArgument(0);
            Map<String, String> bucket = redis.getOrDefault(key, Map.of());
            return new HashMap<Object, Object>(bucket);
        }).when(hashOps).entries(any());

        // expire(key, ttl) — no-op pour le test
        when(redisTemplate.expire(any(), any(Duration.class))).thenReturn(true);
        when(redisTemplate.expire(any(), anyLong(), any(TimeUnit.class))).thenReturn(true);

        // JavaTimeModule requis pour sérialiser le champ Instant du DTO (en prod,
        // l'ObjectMapper Spring l'a déjà enregistré, cf. RedisConfig / Jackson auto-config).
        ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        store = new PendingToolStore(redisTemplate, objectMapper);
    }

    @Test
    void put_then_listForUser_returns_the_pending_action() {
        store.put("call-1", 42L, 1L, USER_A, "cancel_reservation",
                "{\"reservation_id\":42}", List.of(ChatMessage.user("annule 42")),
                null, "Annule une réservation (destructif)");

        List<PendingActionDto> pending = store.listForUser(USER_A);

        assertThat(pending).hasSize(1);
        PendingActionDto dto = pending.get(0);
        assertThat(dto.toolCallId()).isEqualTo("call-1");
        assertThat(dto.toolName()).isEqualTo("cancel_reservation");
        assertThat(dto.description()).isEqualTo("Annule une réservation (destructif)");
        assertThat(dto.argsSummary()).contains("reservation_id");
        assertThat(dto.conversationId()).isEqualTo(42L);
        assertThat(dto.createdAt()).isNotNull();
    }

    @Test
    void consume_removes_action_from_the_pending_list() {
        store.put("call-1", 42L, 1L, USER_A, "block_calendar", "{}",
                List.of(ChatMessage.user("bloque")));
        assertThat(store.listForUser(USER_A)).hasSize(1);

        Optional<PendingToolStore.PendingTool> consumed = store.consume("call-1", USER_A);

        assertThat(consumed).isPresent();
        assertThat(store.listForUser(USER_A)).isEmpty();
    }

    @Test
    void listForUser_only_returns_actions_of_that_user() {
        store.put("call-a", 1L, 1L, USER_A, "block_calendar", "{}",
                List.of(ChatMessage.user("a")));
        store.put("call-b", 2L, 1L, USER_B, "cancel_reservation", "{}",
                List.of(ChatMessage.user("b")));

        assertThat(store.listForUser(USER_A))
                .extracting(PendingActionDto::toolCallId)
                .containsExactly("call-a");
        assertThat(store.listForUser(USER_B))
                .extracting(PendingActionDto::toolCallId)
                .containsExactly("call-b");
    }

    @Test
    void consume_with_wrong_owner_does_not_expose_or_remove_legit_users_entry() {
        store.put("call-1", 42L, 1L, USER_A, "cancel_reservation", "{}",
                List.of(ChatMessage.user("annule")));

        // USER_B tente de consommer l'action de USER_A : ownership mismatch.
        Optional<PendingToolStore.PendingTool> stolen = store.consume("call-1", USER_B);

        assertThat(stolen).isEmpty();
        // L'entrée Redis du propriétaire légitime n'est pas touchée.
        assertThat(store.listForUser(USER_A))
                .extracting(PendingActionDto::toolCallId)
                .containsExactly("call-1");
    }

    @Test
    void multiple_pending_actions_are_listed_oldest_first() {
        store.put("call-1", 1L, 1L, USER_A, "block_calendar", "{}",
                List.of(ChatMessage.user("1")));
        store.put("call-2", 2L, 1L, USER_A, "cancel_reservation", "{}",
                List.of(ChatMessage.user("2")));

        List<PendingActionDto> pending = store.listForUser(USER_A);

        assertThat(pending).extracting(PendingActionDto::toolCallId)
                .containsExactly("call-1", "call-2");
    }

    @Test
    void in_memory_only_constructor_disables_redis_listing_but_keeps_resume() {
        PendingToolStore inMemory = new PendingToolStore();

        inMemory.put("call-1", 42L, 1L, USER_A, "cancel_reservation", "{}",
                List.of(ChatMessage.user("annule")));

        // La file persistée est désactivée (pas de Redis)...
        assertThat(inMemory.listForUser(USER_A)).isEmpty();
        // ...mais la reprise mono/multi-agent (in-memory) fonctionne toujours.
        assertThat(inMemory.consume("call-1", USER_A)).isPresent();
    }
}
