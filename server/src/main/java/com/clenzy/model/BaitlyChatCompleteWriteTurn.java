package com.clenzy.model;

import jakarta.persistence.*;
import java.util.UUID;

/** Baitly complete write-turn evidence. Scoped JDBC access; never a replay permit. */
@Entity
@Table(name="baitly_chat_complete_write_turns")
public class BaitlyChatCompleteWriteTurn {
    @Id @Column(name="turn_id") private UUID turnId;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="conversation_id",nullable=false) private Long conversationId;
    @Column(name="root_turn_id",nullable=false) private UUID rootTurnId;
    @Column(name="end_message_id",nullable=false) private Long endMessageId;
    @Column(name="covered_message_count",nullable=false) private int coveredMessageCount;
    @Column(nullable=false,length=32) private String policy;
    protected BaitlyChatCompleteWriteTurn() {}
}
