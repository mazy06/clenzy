package com.clenzy.dto.noise;

public class NoiseDataPointDto {

    private String time;
    private double decibels;
    private String deviceLabel;

    public NoiseDataPointDto() {}

    public NoiseDataPointDto(String time, double decibels, String deviceLabel) {
        this.time = time;
        this.decibels = decibels;
        this.deviceLabel = deviceLabel;
    }

    // ─── Getters / Setters ──────────────────────────────────────

    public String getTime() { return time; }
    public void setTime(String time) { this.time = time; }

    public double getDecibels() { return decibels; }
    public void setDecibels(double decibels) { this.decibels = decibels; }

    public String getDeviceLabel() { return deviceLabel; }
    public void setDeviceLabel(String deviceLabel) { this.deviceLabel = deviceLabel; }
}
