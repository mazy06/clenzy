package com.clenzy.marketplace.model;

import jakarta.persistence.*;
import java.util.UUID;

/** Public identity chosen explicitly by the author, independent of account names. */
@Entity @Table(name="baitly_social_profiles", uniqueConstraints=@UniqueConstraint(columnNames={"organization_id","author_user_id"}))
public class BaitlySocialProfile {
    @Id public UUID id;
    @Column(name="organization_id", nullable=false) public Long organizationId;
    @Column(name="author_user_id", nullable=false) public Long authorUserId;
    @Column(name="display_name", nullable=false, length=150) public String displayName;
    @Column(name="instagram_url", length=2048) public String instagramUrl;
    @Column(name="tiktok_url", length=2048) public String tiktokUrl;
    @Column(name="youtube_url", length=2048) public String youtubeUrl;
    @Column(nullable=false) public boolean published;
    @Column(name="instagram_user_id", length=100) public String instagramUserId;
    @Column(name="instagram_username", length=150) public String instagramUsername;
    @Column(name="instagram_token_encrypted", columnDefinition="text") public String instagramTokenEncrypted;
    @Column(name="instagram_token_expires_at") public java.time.Instant instagramTokenExpiresAt;
}
