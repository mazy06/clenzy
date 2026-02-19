package com.clenzy.dto.noise;

import java.util.List;
import java.util.Map;

public class NoiseChartDataDto {

    private List<DeviceSummary> devices;
    private List<Map<String, Object>> chartData;

    public NoiseChartDataDto() {}

    public NoiseChartDataDto(List<DeviceSummary> devices, List<Map<String, Object>> chartData) {
        this.devices = devices;
        this.chartData = chartData;
    }

    // ─── Nested ─────────────────────────────────────────────────

    public static class DeviceSummary {
        private String label;
        private double currentLevel;
        private double averageLevel;
        private double maxLevel;

        public DeviceSummary() {}

        public DeviceSummary(String label, double currentLevel, double averageLevel, double maxLevel) {
            this.label = label;
            this.currentLevel = currentLevel;
            this.averageLevel = averageLevel;
            this.maxLevel = maxLevel;
        }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public double getCurrentLevel() { return currentLevel; }
        public void setCurrentLevel(double currentLevel) { this.currentLevel = currentLevel; }
        public double getAverageLevel() { return averageLevel; }
        public void setAverageLevel(double averageLevel) { this.averageLevel = averageLevel; }
        public double getMaxLevel() { return maxLevel; }
        public void setMaxLevel(double maxLevel) { this.maxLevel = maxLevel; }
    }

    // ─── Getters / Setters ──────────────────────────────────────

    public List<DeviceSummary> getDevices() { return devices; }
    public void setDevices(List<DeviceSummary> devices) { this.devices = devices; }

    public List<Map<String, Object>> getChartData() { return chartData; }
    public void setChartData(List<Map<String, Object>> chartData) { this.chartData = chartData; }
}
