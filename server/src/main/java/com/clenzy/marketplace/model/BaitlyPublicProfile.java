package com.clenzy.marketplace.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.*;

/** Explicit, revocable publication. No private property/address snapshot. */
@Entity @Table(name="baitly_public_profiles", uniqueConstraints=@UniqueConstraint(columnNames={"organization_id","author_user_id"}))
public class BaitlyPublicProfile {
    @Id public UUID id;
    @Column(name="organization_id", nullable=false) public Long organizationId;
    @Column(name="author_user_id", nullable=false) public Long authorUserId;
    @Column(nullable=false) public boolean published;
    @Column(nullable=false, length=20) public String role;
    @Column(nullable=false, length=150) public String name;
    @Column(name="hide_last_name", nullable=false) public boolean hideLastName;
    @Column(name="publish_financial_performance", nullable=false) public boolean publishFinancialPerformance;
    @Column(length=150) public String organization;
    @Column(length=150) public String city;
    @Column(length=1000) public String bio;
    @Column(name="booking_url", length=2048) public String bookingUrl;
    @Column(name="avatar_url", length=2048) public String avatarUrl;
    @Column(name="property_ids", nullable=false, columnDefinition="jsonb") @JdbcTypeCode(SqlTypes.JSON) public List<Long> propertyIds = new ArrayList<>();
    @Column(name="management_services", nullable=false, columnDefinition="jsonb") @JdbcTypeCode(SqlTypes.JSON) public List<String> managementServices = new ArrayList<>();
    @Column(name="management_fee_pct",precision=5,scale=2) public java.math.BigDecimal managementFeePct;
    @Column(name="seeking_management", nullable=false) public boolean seekingManagement;
    @Column(name="updated_at", nullable=false) public Instant updatedAt;
}
