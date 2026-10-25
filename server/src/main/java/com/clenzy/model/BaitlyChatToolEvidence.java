package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Schema mapping only; scoped access uses the Baitly completion journal. */
@Entity
@Table(name="baitly_chat_tool_evidence")
public class BaitlyChatToolEvidence {
    @Id private UUID id;
    @Column(name="turn_id",nullable=false) private UUID turnId;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="conversation_id",nullable=false) private Long conversationId;
    @Column(name="tool_call_id",nullable=false,length=96) private String toolCallId;
    @Column(name="proof_kind",nullable=false,length=32) private String proofKind;
    @Column(nullable=false,length=24) private String status;
    @Column(name="result_message_id") private Long resultMessageId;
    @Column(name="started_at",nullable=false) private Instant startedAt;
    @Column(name="finished_at") private Instant finishedAt;
    protected BaitlyChatToolEvidence() {}
}
