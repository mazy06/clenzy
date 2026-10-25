package com.clenzy.model;

import jakarta.persistence.*;
import java.util.UUID;

/** Versioned Baitly tool-turn certificate. Scoped JDBC access only. */
@Entity
@Table(name="baitly_chat_tool_turn_proofs")
public class BaitlyChatToolTurnProof {
    @Id @Column(name="turn_id") private UUID turnId;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="conversation_id",nullable=false) private Long conversationId;
    @Column(nullable=false,length=32) private String policy;
    @Column(name="end_message_id",nullable=false) private Long endMessageId;
    @Column(name="covered_message_count",nullable=false) private int coveredMessageCount;
    protected BaitlyChatToolTurnProof() {}
}
