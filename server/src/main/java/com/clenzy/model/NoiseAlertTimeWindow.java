package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalTime;

@Entity
@Table(name = "noise_alert_time_windows")
public class NoiseAlertTimeWindow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "config_id", nullable = false)
    private NoiseAlertConfig config;

    @Column(nullable = false, length = 100)
    private String label;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "warning_threshold_db", nullable = false)
    private int warningThresholdDb = 70;

    @Column(name = "critical_threshold_db", nullable = false)
    private int criticalThresholdDb = 85;

    /**
     * Verifie si un instant donne tombe dans ce creneau.
     * Gere les creneaux overnight (ex: 22:00 → 07:00).
     */
    public boolean contains(LocalTime time) {
        if (startTime.isBefore(endTime)) {
            // Creneau normal : 07:00 → 22:00
            return !time.isBefore(startTime) && time.isBefore(endTime);
        }
        // Creneau overnight : 22:00 → 07:00
        return !time.isBefore(startTime) || time.isBefore(endTime);
    }

    // ── Getters / Setters ────────────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public NoiseAlertConfig getConfig() { return config; }
    public void setConfig(NoiseAlertConfig config) { this.config = config; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }

    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }

    public int getWarningThresholdDb() { return warningThresholdDb; }
    public void setWarningThresholdDb(int warningThresholdDb) { this.warningThresholdDb = warningThresholdDb; }

    public int getCriticalThresholdDb() { return criticalThresholdDb; }
    public void setCriticalThresholdDb(int criticalThresholdDb) { this.criticalThresholdDb = criticalThresholdDb; }
}
