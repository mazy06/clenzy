package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionConversationTurnDto;
import com.clenzy.model.SupervisionConversationMessage;
import com.clenzy.repository.SupervisionConversationMessageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class SupervisionConversationServiceTest {

    @Mock private SupervisionConversationMessageRepository repository;
    private SupervisionConversationService service;

    @BeforeEach
    void setUp() {
        service = new SupervisionConversationService(repository);
    }

    @Test
    void record_persistsOperatorAndOrchestratorTurns() {
        service.record(1L, 10L, "user-1", List.of(
                new SupervisionConversationTurnDto("operator", "Baisser le prix ?"),
                new SupervisionConversationTurnDto("orchestrator", "J'ai baissé de 10 %.")));

        verify(repository, times(2)).save(any(SupervisionConversationMessage.class));
    }

    @Test
    void record_skipsBlankOrNullContent() {
        service.record(1L, 10L, "user-1", java.util.Arrays.asList(
                new SupervisionConversationTurnDto("operator", "   "),
                new SupervisionConversationTurnDto("operator", null)));

        verify(repository, never()).save(any());
    }

    @Test
    void record_noOpWhenEmpty() {
        service.record(1L, 10L, "user-1", List.of());
        verifyNoInteractions(repository);
    }
}
