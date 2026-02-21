package com.clenzy.integration.channel;

/**
 * Resultat d'une operation de synchronisation channel.
 * Immutable value object.
 */
public class SyncResult {

    public enum Status {
        SUCCESS,
        FAILED,
        SKIPPED,
        UNSUPPORTED
    }

    private final Status status;
    private final String message;
    private final int itemsProcessed;
    private final long durationMs;

    private SyncResult(Status status, String message, int itemsProcessed, long durationMs) {
        this.status = status;
        this.message = message;
        this.itemsProcessed = itemsProcessed;
        this.durationMs = durationMs;
    }

    // ---- Factory methods ----

    public static SyncResult success(int itemsProcessed, long durationMs) {
        return new SyncResult(Status.SUCCESS, null, itemsProcessed, durationMs);
    }

    public static SyncResult success(String message, int itemsProcessed, long durationMs) {
        return new SyncResult(Status.SUCCESS, message, itemsProcessed, durationMs);
    }

    public static SyncResult failed(String message) {
        return new SyncResult(Status.FAILED, message, 0, 0);
    }

    public static SyncResult failed(String message, long durationMs) {
        return new SyncResult(Status.FAILED, message, 0, durationMs);
    }

    public static SyncResult skipped(String message) {
        return new SyncResult(Status.SKIPPED, message, 0, 0);
    }

    public static SyncResult unsupported(String message) {
        return new SyncResult(Status.UNSUPPORTED, message, 0, 0);
    }

    // ---- Getters ----

    public Status getStatus() { return status; }
    public String getMessage() { return message; }
    public int getItemsProcessed() { return itemsProcessed; }
    public long getDurationMs() { return durationMs; }

    public boolean isSuccess() { return status == Status.SUCCESS; }
    public boolean isFailed() { return status == Status.FAILED; }

    @Override
    public String toString() {
        return "SyncResult{status=" + status
                + (message != null ? ", message='" + message + "'" : "")
                + ", items=" + itemsProcessed
                + ", durationMs=" + durationMs + "}";
    }
}
