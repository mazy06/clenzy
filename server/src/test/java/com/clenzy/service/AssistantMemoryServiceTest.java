package com.clenzy.service;

import com.clenzy.model.AssistantMemory;
import com.clenzy.repository.AssistantMemoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

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
        service = new AssistantMemoryService(repository);
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
}
