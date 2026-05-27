package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Message individuel d'une conversation assistant.
 *
 * <p>Le {@link #role} suit la convention {@code user | assistant | tool} :
 * <ul>
 *   <li>{@code user} : message texte envoye par l'utilisateur</li>
 *   <li>{@code assistant} : reponse du LLM (peut contenir {@link #toolCalls} en parallele du texte)</li>
 *   <li>{@code tool} : resultat d'execution d'un outil ({@link #toolCallId} reference le tool_call)</li>
 * </ul>
 *
 * <p>Le filtre Hibernate {@code organizationFilter} garantit que les requetes
 * derivees ne fuient pas entre organisations.</p>
 */
@Entity
@Table(name = "assistant_message")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class AssistantMessage {

    public static final String ROLE_USER = "user";
    public static final String ROLE_ASSISTANT = "assistant";
    public static final String ROLE_TOOL = "tool";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "conversation_id", nullable = false)
    private Long conversationId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(nullable = false, length = 20)
    private String role;

    @Column(columnDefinition = "TEXT")
    private String content;

    /** Tool calls emis par le LLM, serialises en JSON (array). Null sauf si role=assistant emet un tool_use. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tool_calls", columnDefinition = "jsonb")
    private String toolCalls;

    /**
     * Pieces jointes (images) du message user, serialisees en JSON array.
     * Format : {@code [{"storageKey":"...","mediaType":"image/jpeg","url":"..."}]}.
     * Null sauf si role=user et que l'user a uploade des images.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attachments", columnDefinition = "jsonb")
    private String attachments;

    /** Reference au tool_call.id quand role=tool. */
    @Column(name = "tool_call_id", length = 120)
    private String toolCallId;

    @Column(name = "prompt_tokens")
    private Integer promptTokens;

    @Column(name = "completion_tokens")
    private Integer completionTokens;

    @Column(name = "finish_reason", length = 40)
    private String finishReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public AssistantMessage() {}

    public static AssistantMessage user(Long conversationId, Long orgId, String content) {
        AssistantMessage m = new AssistantMessage();
        m.conversationId = conversationId;
        m.organizationId = orgId;
        m.role = ROLE_USER;
        m.content = content;
        return m;
    }

    /** User message avec pieces jointes JSON (peut etre null si pas d'attachments). */
    public static AssistantMessage user(Long conversationId, Long orgId,
                                          String content, String attachmentsJson) {
        AssistantMessage m = user(conversationId, orgId, content);
        m.attachments = attachmentsJson;
        return m;
    }

    public static AssistantMessage assistant(Long conversationId, Long orgId, String content,
                                              String toolCallsJson) {
        AssistantMessage m = new AssistantMessage();
        m.conversationId = conversationId;
        m.organizationId = orgId;
        m.role = ROLE_ASSISTANT;
        m.content = content;
        m.toolCalls = toolCallsJson;
        return m;
    }

    public static AssistantMessage tool(Long conversationId, Long orgId,
                                         String toolCallId, String resultContent) {
        AssistantMessage m = new AssistantMessage();
        m.conversationId = conversationId;
        m.organizationId = orgId;
        m.role = ROLE_TOOL;
        m.toolCallId = toolCallId;
        m.content = resultContent;
        return m;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getConversationId() { return conversationId; }
    public void setConversationId(Long conversationId) { this.conversationId = conversationId; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getToolCalls() { return toolCalls; }
    public void setToolCalls(String toolCalls) { this.toolCalls = toolCalls; }
    public String getAttachments() { return attachments; }
    public void setAttachments(String attachments) { this.attachments = attachments; }
    public String getToolCallId() { return toolCallId; }
    public void setToolCallId(String toolCallId) { this.toolCallId = toolCallId; }
    public Integer getPromptTokens() { return promptTokens; }
    public void setPromptTokens(Integer promptTokens) { this.promptTokens = promptTokens; }
    public Integer getCompletionTokens() { return completionTokens; }
    public void setCompletionTokens(Integer completionTokens) { this.completionTokens = completionTokens; }
    public String getFinishReason() { return finishReason; }
    public void setFinishReason(String finishReason) { this.finishReason = finishReason; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
