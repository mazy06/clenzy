package com.clenzy.integration.airbnb.dto;

import java.time.LocalDateTime;

/**
 * DTO for the Airbnb connection status response returned to clients.
 */
public class AirbnbConnectionStatusDto {

    private boolean connected;
    private String airbnbUserId;
    private String status;
    private LocalDateTime connectedAt;
    private LocalDateTime lastSyncAt;
    private String scopes;
    private int linkedListingsCount;
    private String errorMessage;

    public AirbnbConnectionStatusDto() {
    }

    public boolean isConnected() {
        return connected;
    }

    public void setConnected(boolean connected) {
        this.connected = connected;
    }

    public String getAirbnbUserId() {
        return airbnbUserId;
    }

    public void setAirbnbUserId(String airbnbUserId) {
        this.airbnbUserId = airbnbUserId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getConnectedAt() {
        return connectedAt;
    }

    public void setConnectedAt(LocalDateTime connectedAt) {
        this.connectedAt = connectedAt;
    }

    public LocalDateTime getLastSyncAt() {
        return lastSyncAt;
    }

    public void setLastSyncAt(LocalDateTime lastSyncAt) {
        this.lastSyncAt = lastSyncAt;
    }

    public String getScopes() {
        return scopes;
    }

    public void setScopes(String scopes) {
        this.scopes = scopes;
    }

    public int getLinkedListingsCount() {
        return linkedListingsCount;
    }

    public void setLinkedListingsCount(int linkedListingsCount) {
        this.linkedListingsCount = linkedListingsCount;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
}
