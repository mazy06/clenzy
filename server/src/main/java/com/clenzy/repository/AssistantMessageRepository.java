package com.clenzy.repository;

import com.clenzy.model.AssistantMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AssistantMessageRepository extends JpaRepository<AssistantMessage, Long> {

    /**
     * Tous les messages d'une conversation, ordonnes chronologiquement.
     * Le filtre Hibernate filtre par organization_id en plus du conversation_id.
     */
    @Query("SELECT m FROM AssistantMessage m WHERE m.conversationId = :conversationId "
            + "ORDER BY m.createdAt ASC, m.id ASC")
    List<AssistantMessage> findByConversation(@Param("conversationId") Long conversationId);

    /**
     * Somme des prompt_tokens des messages user avec attachments (= vision tokens)
     * pour une org, depuis {@code since}. Utilisee par {@code VisionTokenUsageService}
     * pour mesurer la consommation 30j glissants.
     *
     * <p>Native query : on contourne le filtre Hibernate (job systeme cross-tenant
     * dans le scheduler hebdo).</p>
     */
    @Query(value = "SELECT COALESCE(SUM(prompt_tokens), 0) FROM assistant_message "
            + "WHERE organization_id = :orgId "
            + "AND attachments IS NOT NULL "
            + "AND created_at >= :since "
            + "AND prompt_tokens IS NOT NULL",
            nativeQuery = true)
    Long sumVisionPromptTokensSince(@Param("orgId") Long orgId,
                                      @Param("since") LocalDateTime since);

    /**
     * Retourne le JSON {@code attachments} du premier message d'une conversation
     * du {@code keycloakId} qui reference le {@code storageKey} demande. Renvoie
     * {@code null} si rien ne matche — equivalent securitaire de "pas autorise
     * OU n'existe pas" (on ne distingue pas pour eviter l'enumeration de cles).
     *
     * <p>Use case : autoriser {@code GET /attachments/{storageKey}} en garantissant
     * que la storage key appartient bien a une conversation du user JWT. Defense
     * en profondeur contre la fuite cross-user des attachments.</p>
     *
     * <p>Native query : recherche par sous-chaine dans le champ jsonb cast en
     * texte. Filtre par join sur {@code assistant_conversation.keycloak_id}
     * (ownership remonte la conversation). On garde le JSON brut pour que le
     * caller puisse extraire le mediaType apres validation.</p>
     */
    @Query(value = "SELECT m.attachments FROM assistant_message m "
            + "JOIN assistant_conversation c ON c.id = m.conversation_id "
            + "WHERE c.keycloak_id = :keycloakId "
            + "AND m.attachments IS NOT NULL "
            + "AND m.attachments::text LIKE CONCAT('%\"storageKey\":\"', :storageKey, '\"%') "
            + "LIMIT 1", nativeQuery = true)
    String findAttachmentsJsonByStorageKeyForUser(@Param("storageKey") String storageKey,
                                                    @Param("keycloakId") String keycloakId);
}
