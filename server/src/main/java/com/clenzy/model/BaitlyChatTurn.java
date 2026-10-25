package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Durable metadata only. No prompt, tool payload, token or error text. */
@Entity
@Table(name = "baitly_chat_turns")
public class BaitlyChatTurn {
    @Id private UUID id;
    @Column(name="organization_id", nullable=false) private Long organizationId;
    @Column(name="keycloak_user_id", nullable=false, length=255) private String keycloakUserId;
    @Column(name="conversation_id", nullable=false) private Long conversationId;
    @Column(name="request_id", nullable=false) private UUID requestId;
    @Column(name="turn_sequence", nullable=false) private long turnSequence;
    @Column(nullable=false, length=16) private String status;
    @Column(name="baseline_message_id") private Long baselineMessageId;
    @Column(name="end_message_id") private Long endMessageId;
    @Column(name="covered_message_count", nullable=false) private int coveredMessageCount;
    @Column(name="started_at", nullable=false) private Instant startedAt;
    @Column(name="finished_at") private Instant finishedAt;
    protected BaitlyChatTurn() {}
}
