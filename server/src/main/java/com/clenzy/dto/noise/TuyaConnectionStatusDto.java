package com.clenzy.dto.noise;

import java.time.LocalDateTime;

public class TuyaConnectionStatusDto {

    private boolean connected;
    private String status;
    private String tuyaUid;
    private LocalDateTime connectedAt;
    private LocalDateTime lastSyncAt;
    private String errorMessage;
    private long deviceCount;

    // ─── Getters / Setters ──────────────────────────────────────

    public boolean isConnected() { return connected; }
    public void setConnected(boolean connected) { this.connected = connected; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getTuyaUid() { return tuyaUid; }
    public void setTuyaUid(String tuyaUid) { this.tuyaUid = tuyaUid; }

    public LocalDateTime getConnectedAt() { return connectedAt; }
    public void setConnectedAt(LocalDateTime connectedAt) { this.connectedAt = connectedAt; }

    public LocalDateTime getLastSyncAt() { return lastSyncAt; }
    public void setLastSyncAt(LocalDateTime lastSyncAt) { this.lastSyncAt = lastSyncAt; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public long getDeviceCount() { return deviceCount; }
    public void setDeviceCount(long deviceCount) { this.deviceCount = deviceCount; }
}
