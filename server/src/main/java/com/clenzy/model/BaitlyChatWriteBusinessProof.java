package com.clenzy.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Baitly committed effect receipt; no payload or user-entered text. Scoped JDBC only. */
@Entity
@Table(name="baitly_chat_write_business_proofs")
public class BaitlyChatWriteBusinessProof {
    @Id private UUID id;
    @Column(name="tool_evidence_id",nullable=false,unique=true) private UUID toolEvidenceId;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="conversation_id",nullable=false) private Long conversationId;
    @Column(name="proof_kind",nullable=false,length=32) private String proofKind;
    @Column(name="resource_id",nullable=false) private Long resourceId;
    @Column(name="target_state",length=32) private String targetState;
    @Column(name="committed_at",nullable=false) private Instant committedAt;
    protected BaitlyChatWriteBusinessProof() {}
}
