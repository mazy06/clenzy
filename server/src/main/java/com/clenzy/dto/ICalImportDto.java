package com.clenzy.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs pour l'import iCal.
 */
public class ICalImportDto {

    // ---- Requests ----

    public static class PreviewRequest {
        private String url;
        private Long propertyId;

        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }
        public Long getPropertyId() { return propertyId; }
        public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
    }

    public static class ImportRequest {
        private String url;
        private Long propertyId;
        private String sourceName;
        private boolean autoCreateInterventions;

        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }
        public Long getPropertyId() { return propertyId; }
        public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
        public String getSourceName() { return sourceName; }
        public void setSourceName(String sourceName) { this.sourceName = sourceName; }
        public boolean isAutoCreateInterventions() { return autoCreateInterventions; }
        public void setAutoCreateInterventions(boolean autoCreateInterventions) { this.autoCreateInterventions = autoCreateInterventions; }
    }

    // ---- Responses ----

    public static class ICalEventPreview {
        private String uid;
        private String summary;
        private LocalDate dtStart;
        private LocalDate dtEnd;
        private String description;
        private String type; // "reservation" ou "blocked"
        private String guestName;
        private String confirmationCode;
        private int nights;

        public String getUid() { return uid; }
        public void setUid(String uid) { this.uid = uid; }
        public String getSummary() { return summary; }
        public void setSummary(String summary) { this.summary = summary; }
        public LocalDate getDtStart() { return dtStart; }
        public void setDtStart(LocalDate dtStart) { this.dtStart = dtStart; }
        public LocalDate getDtEnd() { return dtEnd; }
        public void setDtEnd(LocalDate dtEnd) { this.dtEnd = dtEnd; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getGuestName() { return guestName; }
        public void setGuestName(String guestName) { this.guestName = guestName; }
        public String getConfirmationCode() { return confirmationCode; }
        public void setConfirmationCode(String confirmationCode) { this.confirmationCode = confirmationCode; }
        public int getNights() { return nights; }
        public void setNights(int nights) { this.nights = nights; }
    }

    public static class PreviewResponse {
        private List<ICalEventPreview> events;
        private int totalReservations;
        private int totalBlocked;
        private String propertyName;

        public List<ICalEventPreview> getEvents() { return events; }
        public void setEvents(List<ICalEventPreview> events) { this.events = events; }
        public int getTotalReservations() { return totalReservations; }
        public void setTotalReservations(int totalReservations) { this.totalReservations = totalReservations; }
        public int getTotalBlocked() { return totalBlocked; }
        public void setTotalBlocked(int totalBlocked) { this.totalBlocked = totalBlocked; }
        public String getPropertyName() { return propertyName; }
        public void setPropertyName(String propertyName) { this.propertyName = propertyName; }
    }

    public static class ImportResponse {
        private int imported;
        private int skipped;
        private List<String> errors;
        private Long feedId;

        public int getImported() { return imported; }
        public void setImported(int imported) { this.imported = imported; }
        public int getSkipped() { return skipped; }
        public void setSkipped(int skipped) { this.skipped = skipped; }
        public List<String> getErrors() { return errors; }
        public void setErrors(List<String> errors) { this.errors = errors; }
        public Long getFeedId() { return feedId; }
        public void setFeedId(Long feedId) { this.feedId = feedId; }
    }

    public static class FeedDto {
        private Long id;
        private Long propertyId;
        private String propertyName;
        private String url;
        private String sourceName;
        private boolean autoCreateInterventions;
        private boolean syncEnabled;
        private LocalDateTime lastSyncAt;
        private String lastSyncStatus;
        private int eventsImported;

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        public Long getPropertyId() { return propertyId; }
        public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }
        public String getPropertyName() { return propertyName; }
        public void setPropertyName(String propertyName) { this.propertyName = propertyName; }
        public String getUrl() { return url; }
        public void setUrl(String url) { this.url = url; }
        public String getSourceName() { return sourceName; }
        public void setSourceName(String sourceName) { this.sourceName = sourceName; }
        public boolean isAutoCreateInterventions() { return autoCreateInterventions; }
        public void setAutoCreateInterventions(boolean autoCreateInterventions) { this.autoCreateInterventions = autoCreateInterventions; }
        public boolean isSyncEnabled() { return syncEnabled; }
        public void setSyncEnabled(boolean syncEnabled) { this.syncEnabled = syncEnabled; }
        public LocalDateTime getLastSyncAt() { return lastSyncAt; }
        public void setLastSyncAt(LocalDateTime lastSyncAt) { this.lastSyncAt = lastSyncAt; }
        public String getLastSyncStatus() { return lastSyncStatus; }
        public void setLastSyncStatus(String lastSyncStatus) { this.lastSyncStatus = lastSyncStatus; }
        public int getEventsImported() { return eventsImported; }
        public void setEventsImported(int eventsImported) { this.eventsImported = eventsImported; }
    }
}
