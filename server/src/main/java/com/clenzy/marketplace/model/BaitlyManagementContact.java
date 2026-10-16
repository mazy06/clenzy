package com.clenzy.marketplace.model;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="baitly_management_contacts")
public class BaitlyManagementContact {
    @Id public UUID id;
    @Column(name="target_profile_id", nullable=false) public UUID targetProfileId;
    @Column(name="sender_user_id", nullable=false) public Long senderUserId;
    @Column(name="sender_organization_id", nullable=false) public Long senderOrganizationId;
    @Column(nullable=false, length=1500) public String message;
    @Column(name="created_at", nullable=false) public Instant createdAt;
}
