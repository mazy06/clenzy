package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.Filter;

import java.time.LocalDateTime;

@Entity
@Table(name = "noise_alerts")
@Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class NoiseAlert {

    public enum AlertSeverity { WARNING, CRITICAL }
    public enum AlertSource { WEBHOOK, SCHEDULER, MANUAL }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Column(name = "device_id")
    private Long deviceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AlertSeverity severity;

    @Column(name = "measured_db", nullable = false)
    private double measuredDb;

    @Column(name = "threshold_db", nullable = false)
    private int thresholdDb;

    @Column(name = "time_window_label", length = 100)
    private String timeWindowLabel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AlertSource source;

    // ── Notification tracking ────────────────────────────────────────────────

    @Column(name = "notified_in_app")
    private boolean notifiedInApp;

    @Column(name = "notified_email")
    private boolean notifiedEmail;

    @Column(name = "notified_guest")
    private boolean notifiedGuest;

    @Column(name = "notified_whatsapp")
    private boolean notifiedWhatsapp;

    @Column(name = "notified_sms")
    private boolean notifiedSms;

    // ── Acknowledgement ──────────────────────────────────────────────────────

    @Column
    private boolean acknowledged;

    @Column(name = "acknowledged_by")
    private String acknowledgedBy;

    @Column(name = "acknowledged_at")
    private LocalDateTime acknowledgedAt;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // ── Relations (read-only) ────────────────────────────────────────────────

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", insertable = false, updatable = false)
    private Property property;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id", insertable = false, updatable = false)
    private NoiseDevice device;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
    }

    // ── Getters / Setters ────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }

    public AlertSeverity getSeverity() { return severity; }
    public void setSeverity(AlertSeverity severity) { this.severity = severity; }

    public double getMeasuredDb() { return measuredDb; }
    public void setMeasuredDb(double measuredDb) { this.measuredDb = measuredDb; }

    public int getThresholdDb() { return thresholdDb; }
    public void setThresholdDb(int thresholdDb) { this.thresholdDb = thresholdDb; }

    public String getTimeWindowLabel() { return timeWindowLabel; }
    public void setTimeWindowLabel(String timeWindowLabel) { this.timeWindowLabel = timeWindowLabel; }

    public AlertSource getSource() { return source; }
    public void setSource(AlertSource source) { this.source = source; }

    public boolean isNotifiedInApp() { return notifiedInApp; }
    public void setNotifiedInApp(boolean notifiedInApp) { this.notifiedInApp = notifiedInApp; }

    public boolean isNotifiedEmail() { return notifiedEmail; }
    public void setNotifiedEmail(boolean notifiedEmail) { this.notifiedEmail = notifiedEmail; }

    public boolean isNotifiedGuest() { return notifiedGuest; }
    public void setNotifiedGuest(boolean notifiedGuest) { this.notifiedGuest = notifiedGuest; }

    public boolean isNotifiedWhatsapp() { return notifiedWhatsapp; }
    public void setNotifiedWhatsapp(boolean notifiedWhatsapp) { this.notifiedWhatsapp = notifiedWhatsapp; }

    public boolean isNotifiedSms() { return notifiedSms; }
    public void setNotifiedSms(boolean notifiedSms) { this.notifiedSms = notifiedSms; }

    public boolean isAcknowledged() { return acknowledged; }
    public void setAcknowledged(boolean acknowledged) { this.acknowledged = acknowledged; }

    public String getAcknowledgedBy() { return acknowledgedBy; }
    public void setAcknowledgedBy(String acknowledgedBy) { this.acknowledgedBy = acknowledgedBy; }

    public LocalDateTime getAcknowledgedAt() { return acknowledgedAt; }
    public void setAcknowledgedAt(LocalDateTime acknowledgedAt) { this.acknowledgedAt = acknowledgedAt; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public Property getProperty() { return property; }
    public NoiseDevice getDevice() { return device; }
}
