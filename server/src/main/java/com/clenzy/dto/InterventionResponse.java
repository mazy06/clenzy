package com.clenzy.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record InterventionResponse(
    Long id,
    String title,
    String description,
    String type,
    String priority,
    String status,
    Long propertyId,
    String propertyName,
    String propertyAddress,
    String propertyType,
    Double propertyLatitude,
    Double propertyLongitude,
    Long requestorId,
    String requestorName,
    String assignedToType,
    Long assignedToId,
    String assignedToName,
    String assignedUserRole,
    Integer estimatedDurationHours,
    Integer actualDurationMinutes,
    BigDecimal estimatedCost,
    BigDecimal actualCost,
    String scheduledDate,
    LocalDateTime startTime,
    LocalDateTime endTime,
    LocalDateTime completedAt,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    String notes,
    Integer progressPercentage,
    String validatedRooms,
    String completedSteps,
    String photos,
    String beforePhotosUrls,
    String afterPhotosUrls,
    String beforePhotoIds,
    String afterPhotoIds,
    String paymentStatus,
    String stripePaymentIntentId,
    String stripeSessionId,
    LocalDateTime paidAt,
    String preferredTimeSlot
) {
    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private Long id;
        private String title;
        private String description;
        private String type;
        private String priority;
        private String status;
        private Long propertyId;
        private String propertyName;
        private String propertyAddress;
        private String propertyType;
        private Double propertyLatitude;
        private Double propertyLongitude;
        private Long requestorId;
        private String requestorName;
        private String assignedToType;
        private Long assignedToId;
        private String assignedToName;
        private String assignedUserRole;
        private Integer estimatedDurationHours;
        private Integer actualDurationMinutes;
        private BigDecimal estimatedCost;
        private BigDecimal actualCost;
        private String scheduledDate;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private LocalDateTime completedAt;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private String notes;
        private Integer progressPercentage;
        private String validatedRooms;
        private String completedSteps;
        private String photos;
        private String beforePhotosUrls;
        private String afterPhotosUrls;
        private String beforePhotoIds;
        private String afterPhotoIds;
        private String paymentStatus;
        private String stripePaymentIntentId;
        private String stripeSessionId;
        private LocalDateTime paidAt;
        private String preferredTimeSlot;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder title(String title) { this.title = title; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder type(String type) { this.type = type; return this; }
        public Builder priority(String priority) { this.priority = priority; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder propertyId(Long propertyId) { this.propertyId = propertyId; return this; }
        public Builder propertyName(String propertyName) { this.propertyName = propertyName; return this; }
        public Builder propertyAddress(String propertyAddress) { this.propertyAddress = propertyAddress; return this; }
        public Builder propertyType(String propertyType) { this.propertyType = propertyType; return this; }
        public Builder propertyLatitude(Double propertyLatitude) { this.propertyLatitude = propertyLatitude; return this; }
        public Builder propertyLongitude(Double propertyLongitude) { this.propertyLongitude = propertyLongitude; return this; }
        public Builder requestorId(Long requestorId) { this.requestorId = requestorId; return this; }
        public Builder requestorName(String requestorName) { this.requestorName = requestorName; return this; }
        public Builder assignedToType(String assignedToType) { this.assignedToType = assignedToType; return this; }
        public Builder assignedToId(Long assignedToId) { this.assignedToId = assignedToId; return this; }
        public Builder assignedToName(String assignedToName) { this.assignedToName = assignedToName; return this; }
        public Builder assignedUserRole(String assignedUserRole) { this.assignedUserRole = assignedUserRole; return this; }
        public Builder estimatedDurationHours(Integer estimatedDurationHours) { this.estimatedDurationHours = estimatedDurationHours; return this; }
        public Builder actualDurationMinutes(Integer actualDurationMinutes) { this.actualDurationMinutes = actualDurationMinutes; return this; }
        public Builder estimatedCost(BigDecimal estimatedCost) { this.estimatedCost = estimatedCost; return this; }
        public Builder actualCost(BigDecimal actualCost) { this.actualCost = actualCost; return this; }
        public Builder scheduledDate(String scheduledDate) { this.scheduledDate = scheduledDate; return this; }
        public Builder startTime(LocalDateTime startTime) { this.startTime = startTime; return this; }
        public Builder endTime(LocalDateTime endTime) { this.endTime = endTime; return this; }
        public Builder completedAt(LocalDateTime completedAt) { this.completedAt = completedAt; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }
        public Builder notes(String notes) { this.notes = notes; return this; }
        public Builder progressPercentage(Integer progressPercentage) { this.progressPercentage = progressPercentage; return this; }
        public Builder validatedRooms(String validatedRooms) { this.validatedRooms = validatedRooms; return this; }
        public Builder completedSteps(String completedSteps) { this.completedSteps = completedSteps; return this; }
        public Builder photos(String photos) { this.photos = photos; return this; }
        public Builder beforePhotosUrls(String beforePhotosUrls) { this.beforePhotosUrls = beforePhotosUrls; return this; }
        public Builder afterPhotosUrls(String afterPhotosUrls) { this.afterPhotosUrls = afterPhotosUrls; return this; }
        public Builder beforePhotoIds(String beforePhotoIds) { this.beforePhotoIds = beforePhotoIds; return this; }
        public Builder afterPhotoIds(String afterPhotoIds) { this.afterPhotoIds = afterPhotoIds; return this; }
        public Builder paymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; return this; }
        public Builder stripePaymentIntentId(String stripePaymentIntentId) { this.stripePaymentIntentId = stripePaymentIntentId; return this; }
        public Builder stripeSessionId(String stripeSessionId) { this.stripeSessionId = stripeSessionId; return this; }
        public Builder paidAt(LocalDateTime paidAt) { this.paidAt = paidAt; return this; }
        public Builder preferredTimeSlot(String preferredTimeSlot) { this.preferredTimeSlot = preferredTimeSlot; return this; }

        public InterventionResponse build() {
            return new InterventionResponse(
                id, title, description, type, priority, status,
                propertyId, propertyName, propertyAddress, propertyType,
                propertyLatitude, propertyLongitude,
                requestorId, requestorName,
                assignedToType, assignedToId, assignedToName, assignedUserRole,
                estimatedDurationHours, actualDurationMinutes,
                estimatedCost, actualCost,
                scheduledDate, startTime, endTime, completedAt,
                createdAt, updatedAt,
                notes, progressPercentage, validatedRooms, completedSteps,
                photos, beforePhotosUrls, afterPhotosUrls,
                beforePhotoIds, afterPhotoIds,
                paymentStatus, stripePaymentIntentId, stripeSessionId,
                paidAt, preferredTimeSlot
            );
        }
    }
}
