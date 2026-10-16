package com.clenzy.marketplace.model;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="baitly_reels", uniqueConstraints=@UniqueConstraint(columnNames={"social_profile_id","instagram_media_id"}))
public class BaitlyReel {
    @Id public UUID id;
    @Column(name="social_profile_id", nullable=false) public UUID socialProfileId;
    @Column(name="instagram_media_id", nullable=false, length=100) public String instagramMediaId;
    @Column(name="permalink", nullable=false, length=2048) public String permalink;
    @Column(name="thumbnail_url", length=4096) public String thumbnailUrl;
    @Column(nullable=false, length=500) public String caption;
    @Column(nullable=false) public boolean published;
    @Column(name="created_at", nullable=false) public Instant createdAt;
}
