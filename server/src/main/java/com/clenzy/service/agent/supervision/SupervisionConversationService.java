package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionConversationMessageDto;
import com.clenzy.dto.SupervisionConversationTurnDto;
import com.clenzy.model.SupervisionConversationMessage;
import com.clenzy.repository.SupervisionConversationMessageRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Persistance & historique de la conversation opérateur ↔ orchestrateur de la
 * constellation (B7). Écriture best-effort pilotée par le front (POST après un run) ;
 * lecture org + logement scopée.
 */
@Service
public class SupervisionConversationService {

    private static final int MAX_TURNS_PER_POST = 20;
    private static final int MAX_CONTENT = 8000;
    private static final int HISTORY_MAX = 100;

    private final SupervisionConversationMessageRepository repository;

    public SupervisionConversationService(SupervisionConversationMessageRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void record(Long organizationId, Long propertyId, String keycloakUserId,
                       List<SupervisionConversationTurnDto> turns) {
        if (organizationId == null || turns == null || turns.isEmpty()) {
            return;
        }
        turns.stream().limit(MAX_TURNS_PER_POST).forEach(t -> {
            if (t == null || t.content() == null || t.content().isBlank()) {
                return;
            }
            final String role = SupervisionConversationMessage.ROLE_ORCHESTRATOR.equals(t.role())
                    ? SupervisionConversationMessage.ROLE_ORCHESTRATOR
                    : SupervisionConversationMessage.ROLE_OPERATOR;
            repository.save(new SupervisionConversationMessage(
                    organizationId, propertyId, keycloakUserId, role, truncate(t.content().strip())));
        });
    }

    @Transactional(readOnly = true)
    public List<SupervisionConversationMessageDto> history(Long organizationId, Long propertyId, int limit) {
        final int cap = limit <= 0 || limit > HISTORY_MAX ? HISTORY_MAX : limit;
        return repository
                .findByOrganizationIdAndPropertyIdOrderByCreatedAtDesc(
                        organizationId, propertyId, PageRequest.of(0, cap))
                .stream()
                .map(m -> new SupervisionConversationMessageDto(
                        String.valueOf(m.getId()), m.getRole(), m.getContent(),
                        m.getCreatedAt() != null ? m.getCreatedAt().toString() : null))
                .toList();
    }

    private String truncate(String s) {
        return s.length() <= MAX_CONTENT ? s : s.substring(0, MAX_CONTENT);
    }
}
