package com.clenzy.service.assistant;

import com.clenzy.model.AssistantConversation;
import com.clenzy.model.AssistantMessage;
import com.clenzy.repository.AssistantConversationRepository;
import com.clenzy.repository.AssistantMessageRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Acces aux conversations et messages de l'assistant, avec validation
 * d'ownership systematique.
 *
 * <p><b>Securite</b> : tout chargement par id passe par
 * {@link AssistantConversationRepository#findByIdAndUser} — le scope est le
 * {@code keycloakId} du JWT, plus strict que la simple organisation (un user
 * ne lit jamais la conversation d'un autre user, meme dans la meme org). Le
 * filtre Hibernate {@code organizationFilter} s'applique en plus dans le
 * contexte requete. C'est l'equivalent du pattern
 * {@code requireSameOrganization} au grain utilisateur.</p>
 *
 * <p>Extrait de {@code AssistantController} / {@code AssistantUsageController}
 * (dette T-ARCH-01 : les controllers ne dependent plus des repositories).</p>
 */
@Service
public class AssistantConversationService {

    private final AssistantConversationRepository conversationRepository;
    private final AssistantMessageRepository messageRepository;

    public AssistantConversationService(AssistantConversationRepository conversationRepository,
                                        AssistantMessageRepository messageRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    /** Conversations actives (non archivees) du user, triees par updatedAt DESC. */
    @Transactional(readOnly = true)
    public Page<AssistantConversation> listActiveConversations(String keycloakId, Pageable pageable) {
        return conversationRepository.findActiveByUser(keycloakId, pageable);
    }

    /**
     * Conversation par id si — et seulement si — elle appartient au user.
     * {@code Optional.empty()} sinon (id inconnu OU autre proprietaire,
     * indistinguables volontairement).
     */
    @Transactional(readOnly = true)
    public Optional<AssistantConversation> findOwnedConversation(Long conversationId, String keycloakId) {
        return conversationRepository.findByIdAndUser(conversationId, keycloakId);
    }

    /**
     * Messages d'une conversation du user, ordre chronologique.
     *
     * @throws IllegalArgumentException si la conversation n'existe pas ou
     *         appartient a un autre user (meme message dans les deux cas).
     */
    @Transactional(readOnly = true)
    public List<AssistantMessage> getMessagesForOwner(Long conversationId, String keycloakId) {
        AssistantConversation conv = requireOwnedConversation(conversationId, keycloakId);
        return messageRepository.findByConversation(conv.getId());
    }

    /**
     * Archive (soft-delete) une conversation du user.
     *
     * @throws IllegalArgumentException si la conversation n'existe pas ou
     *         appartient a un autre user.
     */
    @Transactional
    public void archiveConversation(Long conversationId, String keycloakId) {
        AssistantConversation conv = requireOwnedConversation(conversationId, keycloakId);
        conv.setArchivedAt(LocalDateTime.now());
        conversationRepository.save(conv);
    }

    /**
     * JSON {@code attachments} du premier message d'une conversation du user
     * referencant ce {@code storageKey}. {@code null} si la cle n'existe pas
     * OU appartient a un autre user (anti-enumeration de cles).
     */
    @Transactional(readOnly = true)
    public String findAttachmentsJsonForUser(String storageKey, String keycloakId) {
        return messageRepository.findAttachmentsJsonByStorageKeyForUser(storageKey, keycloakId);
    }

    private AssistantConversation requireOwnedConversation(Long conversationId, String keycloakId) {
        return conversationRepository.findByIdAndUser(conversationId, keycloakId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Conversation " + conversationId + " introuvable ou non autorisee"));
    }
}
