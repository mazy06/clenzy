package com.clenzy.service;

import com.clenzy.model.AssistantMemory;
import com.clenzy.repository.AssistantMemoryRepository;
import com.clenzy.service.agent.kb.EmbeddingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AssistantMemoryServiceTest {

    private AssistantMemoryRepository repository;
    private AssistantMemoryService service;

    @BeforeEach
    void setUp() {
        repository = mock(AssistantMemoryRepository.class);
        // Pas d'embedding service ici : on teste le contrat business
        // (la branche embedding est couverte par les tests de relevance).
        service = new AssistantMemoryService(repository, Optional.empty(), true);
        when(repository.save(any(AssistantMemory.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void upsert_newKey_persistsNewEntity() {
        when(repository.findByUserAndKey("user-1", "briefing_time"))
                .thenReturn(Optional.empty());

        AssistantMemory saved = service.upsert(1L, "user-1",
                "briefing_time", "08:00", AssistantMemory.Scope.PREFERENCE);

        assertEquals("briefing_time", saved.getMemoryKey());
        assertEquals("08:00", saved.getMemoryValue());
        assertEquals(AssistantMemory.Scope.PREFERENCE, saved.getScopeEnum());
        assertEquals(1L, saved.getOrganizationId());
        verify(repository).save(any(AssistantMemory.class));
    }

    @Test
    void upsert_existingKey_updatesValueAndScope() {
        AssistantMemory existing = new AssistantMemory(1L, "user-1",
                "briefing_time", "07:00", AssistantMemory.Scope.PREFERENCE);
        when(repository.findByUserAndKey("user-1", "briefing_time"))
                .thenReturn(Optional.of(existing));

        AssistantMemory updated = service.upsert(1L, "user-1",
                "briefing_time", "09:00", AssistantMemory.Scope.PREFERENCE);

        assertEquals("09:00", updated.getMemoryValue());
        verify(repository).save(existing);
    }

    @Test
    void upsert_crossOrgConflict_refuses() {
        AssistantMemory belongsToOtherOrg = new AssistantMemory(2L, "user-1",
                "key", "v", AssistantMemory.Scope.FACT);
        when(repository.findByUserAndKey("user-1", "key"))
                .thenReturn(Optional.of(belongsToOtherOrg));

        assertThrows(IllegalStateException.class,
                () -> service.upsert(1L, "user-1", "key", "v2", AssistantMemory.Scope.FACT));
    }

    @Test
    void upsert_normalizesKey_trimsAndTruncates() {
        when(repository.findByUserAndKey(any(), any())).thenReturn(Optional.empty());

        String longKey = "  " + "a".repeat(200) + "  ";
        service.upsert(1L, "user-1", longKey, "v", AssistantMemory.Scope.FACT);

        ArgumentCaptor<String> keyCap = ArgumentCaptor.forClass(String.class);
        verify(repository).findByUserAndKey(eq("user-1"), keyCap.capture());
        // Trim + max 120 chars
        assertEquals(120, keyCap.getValue().length());
        assertFalse(keyCap.getValue().startsWith(" "));
    }

    @Test
    void upsert_rejectsBlankKey() {
        assertThrows(IllegalArgumentException.class,
                () -> service.upsert(1L, "user-1", "", "v", AssistantMemory.Scope.FACT));
        assertThrows(IllegalArgumentException.class,
                () -> service.upsert(1L, "user-1", "   ", "v", AssistantMemory.Scope.FACT));
    }

    @Test
    void upsert_rejectsBlankValue() {
        assertThrows(IllegalArgumentException.class,
                () -> service.upsert(1L, "user-1", "k", "", AssistantMemory.Scope.FACT));
    }

    @Test
    void upsert_rejectsValueTooLong() {
        String huge = "x".repeat(2001);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.upsert(1L, "user-1", "k", huge, AssistantMemory.Scope.FACT));
        assertTrue(ex.getMessage().contains("2000"));
    }

    @Test
    void upsert_rejectsNullScope() {
        assertThrows(IllegalArgumentException.class,
                () -> service.upsert(1L, "user-1", "k", "v", null));
    }

    @Test
    void forget_existingKey_returnsTrue() {
        when(repository.deleteByUserAndKey("user-1", "k")).thenReturn(1);

        assertTrue(service.forget(1L, "user-1", "k"));
    }

    @Test
    void forget_unknownKey_returnsFalse() {
        when(repository.deleteByUserAndKey("user-1", "k")).thenReturn(0);

        assertFalse(service.forget(1L, "user-1", "k"));
    }

    @Test
    void forget_blankKey_returnsFalse_withoutDbCall() {
        assertFalse(service.forget(1L, "user-1", ""));
        assertFalse(service.forget(1L, "user-1", null));
        verify(repository, never()).deleteByUserAndKey(any(), any());
    }

    @Test
    void listForUser_clampsLimit_andDelegatesToPaginatedQuery() {
        when(repository.findRecentByUser(eq("user-1"), any(Pageable.class)))
                .thenReturn(List.of());

        service.listForUser("user-1", 200);

        ArgumentCaptor<Pageable> cap = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findRecentByUser(eq("user-1"), cap.capture());
        // Clamp a 100
        assertEquals(100, cap.getValue().getPageSize());
    }

    @Test
    void listForUser_blankUserId_returnsEmpty() {
        assertTrue(service.listForUser("", 10).isEmpty());
        assertTrue(service.listForUser(null, 10).isEmpty());
        verify(repository, never()).findRecentByUser(any(), any(Pageable.class));
    }

    @Test
    void listForUser_clampsNegativeOrZeroLimit_toAtLeast1() {
        when(repository.findRecentByUser(any(), any(Pageable.class))).thenReturn(List.of());

        service.listForUser("user-1", 0);
        service.listForUser("user-1", -5);

        ArgumentCaptor<Pageable> cap = ArgumentCaptor.forClass(Pageable.class);
        verify(repository, times(2)).findRecentByUser(any(), cap.capture());
        for (Pageable p : cap.getAllValues()) {
            assertEquals(1, p.getPageSize());
        }
        // anti-warning : ensure PageRequest is used
        assertSame(PageRequest.class, cap.getValue().getClass());
    }

    @Test
    void listForUser_touchesLastAccessed_inBatch() {
        AssistantMemory m1 = newMemory(11L);
        AssistantMemory m2 = newMemory(12L);
        when(repository.findRecentByUser(eq("user-1"), any(Pageable.class)))
                .thenReturn(List.of(m1, m2));

        service.listForUser("user-1", 30);

        ArgumentCaptor<List<Long>> ids = ArgumentCaptor.forClass(List.class);
        verify(repository).touchLastAccessed(ids.capture(), any(LocalDateTime.class));
        assertEquals(List.of(11L, 12L), ids.getValue());
    }

    @Test
    void listMostRelevant_withEmbeddingService_routesToCosineSearch() {
        EmbeddingService embed = mock(EmbeddingService.class);
        when(embed.embedQueryAsVectorString("comment baisser mes prix"))
                .thenReturn("[0.1,0.2]");
        AssistantMemoryService relevanceService = new AssistantMemoryService(
                repository, Optional.of(embed), true);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Cosine query renvoie 2 ids dans un ordre specifique (pas par id)
        List<Object[]> rows = new ArrayList<>();
        rows.add(new Object[]{42L, 0.1});
        rows.add(new Object[]{17L, 0.3});
        when(repository.searchByCosineSimilarity("[0.1,0.2]", "user-1", 99L, 30))
                .thenReturn(rows);

        AssistantMemory m42 = newMemory(42L);
        AssistantMemory m17 = newMemory(17L);
        // findAllById ne garantit pas l'ordre — on renvoie volontairement inverse
        when(repository.findAllById(List.of(42L, 17L)))
                .thenReturn(List.of(m17, m42));

        List<AssistantMemory> result = relevanceService.listMostRelevant(
                99L, "user-1", "comment baisser mes prix", 30);

        assertEquals(2, result.size());
        // L'ordre cosine (42 puis 17) DOIT etre preserve malgre le re-shuffle
        assertEquals(42L, result.get(0).getId());
        assertEquals(17L, result.get(1).getId());
        verify(repository, never()).findRecentByUser(any(), any(Pageable.class));
    }

    @Test
    void listMostRelevant_disabledByConfig_fallsBackToRecency() {
        EmbeddingService embed = mock(EmbeddingService.class);
        AssistantMemoryService disabled = new AssistantMemoryService(
                repository, Optional.of(embed), false);
        when(repository.findRecentByUser(eq("user-1"), any(Pageable.class)))
                .thenReturn(List.of());

        disabled.listMostRelevant(1L, "user-1", "Hello", 10);

        verify(embed, never()).embedQueryAsVectorString(any());
        verify(repository).findRecentByUser(eq("user-1"), any(Pageable.class));
    }

    @Test
    void listMostRelevant_blankMessage_fallsBackToRecency() {
        EmbeddingService embed = mock(EmbeddingService.class);
        AssistantMemoryService relevanceService = new AssistantMemoryService(
                repository, Optional.of(embed), true);
        when(repository.findRecentByUser(eq("user-1"), any(Pageable.class)))
                .thenReturn(List.of());

        relevanceService.listMostRelevant(1L, "user-1", "  ", 10);

        verify(embed, never()).embedQueryAsVectorString(any());
        verify(repository).findRecentByUser(eq("user-1"), any(Pageable.class));
    }

    @Test
    void listMostRelevant_nullOrganizationId_fallsBackToRecency() {
        // Cas defense en profondeur : si l'orchestrateur appelle sans orgId,
        // on tombe sur recency-only — pas de query native sans filtre tenant.
        EmbeddingService embed = mock(EmbeddingService.class);
        AssistantMemoryService relevanceService = new AssistantMemoryService(
                repository, Optional.of(embed), true);
        when(repository.findRecentByUser(eq("user-1"), any(Pageable.class)))
                .thenReturn(List.of());

        relevanceService.listMostRelevant(null, "user-1", "Hello", 10);

        verify(embed, never()).embedQueryAsVectorString(any());
        verify(repository, never()).searchByCosineSimilarity(any(), any(), any(), anyInt());
        verify(repository).findRecentByUser(eq("user-1"), any(Pageable.class));
    }

    @Test
    void listMostRelevant_embeddingFailure_fallsBackToRecency() {
        EmbeddingService embed = mock(EmbeddingService.class);
        when(embed.embedQueryAsVectorString(any())).thenThrow(new RuntimeException("API down"));
        AssistantMemoryService relevanceService = new AssistantMemoryService(
                repository, Optional.of(embed), true);
        when(repository.findRecentByUser(eq("user-1"), any(Pageable.class)))
                .thenReturn(List.of());

        relevanceService.listMostRelevant(1L, "user-1", "Hello", 10);

        verify(repository).findRecentByUser(eq("user-1"), any(Pageable.class));
        verify(repository, never()).searchByCosineSimilarity(any(), any(), any(), anyInt());
    }

    @Test
    void listMostRelevant_emptySearchResult_fallsBackToRecency() {
        EmbeddingService embed = mock(EmbeddingService.class);
        when(embed.embedQueryAsVectorString("Hello")).thenReturn("[0.1]");
        AssistantMemoryService relevanceService = new AssistantMemoryService(
                repository, Optional.of(embed), true);
        when(repository.searchByCosineSimilarity(any(), any(), any(), anyInt()))
                .thenReturn(List.of());
        when(repository.findRecentByUser(eq("user-1"), any(Pageable.class)))
                .thenReturn(List.of());

        relevanceService.listMostRelevant(1L, "user-1", "Hello", 10);

        // Pas de match → fallback recency (cas migration : aucune entree avec embedding)
        verify(repository).findRecentByUser(eq("user-1"), any(Pageable.class));
    }

    @Test
    void listMostRelevant_filtersByOrgId_inNativeQuery() {
        EmbeddingService embed = mock(EmbeddingService.class);
        when(embed.embedQueryAsVectorString(any())).thenReturn("[0.1]");
        AssistantMemoryService relevanceService = new AssistantMemoryService(
                repository, Optional.of(embed), true);
        when(repository.searchByCosineSimilarity(any(), any(), any(), anyInt()))
                .thenReturn(List.of());
        when(repository.findRecentByUser(any(), any(Pageable.class))).thenReturn(List.of());

        relevanceService.listMostRelevant(42L, "user-1", "msg", 10);

        // L'orgId doit etre propage en parametre de la native query (defense
        // en profondeur cross-tenant)
        verify(repository).searchByCosineSimilarity(eq("[0.1]"), eq("user-1"), eq(42L), eq(10));
    }

    @Test
    void upsert_withEmbeddingService_persistsEmbedding() {
        EmbeddingService embed = mock(EmbeddingService.class);
        when(embed.embedDocumentAsVectorString("briefing_time: 08:00")).thenReturn("[0.5]");
        AssistantMemoryService relevanceService = new AssistantMemoryService(
                repository, Optional.of(embed), true);
        when(repository.findByUserAndKey("user-1", "briefing_time"))
                .thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AssistantMemory saved = relevanceService.upsert(1L, "user-1",
                "briefing_time", "08:00", AssistantMemory.Scope.PREFERENCE);

        assertEquals("[0.5]", saved.getEmbedding());
        verify(embed).embedDocumentAsVectorString("briefing_time: 08:00");
    }

    @Test
    void upsert_embeddingFailure_persistsWithoutEmbedding() {
        EmbeddingService embed = mock(EmbeddingService.class);
        when(embed.embedDocumentAsVectorString(any())).thenThrow(new RuntimeException("provider down"));
        AssistantMemoryService relevanceService = new AssistantMemoryService(
                repository, Optional.of(embed), true);
        when(repository.findByUserAndKey(any(), any())).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AssistantMemory saved = relevanceService.upsert(1L, "user-1",
                "k", "v", AssistantMemory.Scope.FACT);

        assertNull(saved.getEmbedding());
        // L'entree doit etre persistee meme sans embedding
        verify(repository).save(any(AssistantMemory.class));
    }

    private AssistantMemory newMemory(Long id) {
        AssistantMemory m = new AssistantMemory(1L, "user-1", "k" + id, "v",
                AssistantMemory.Scope.FACT);
        m.setId(id);
        return m;
    }
}
