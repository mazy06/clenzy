package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "interventions")
public class Intervention {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @NotNull(message = "La date de début est obligatoire")
    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;
    
    @Column(name = "end_time")
    private LocalDateTime endTime;
    
    @Column(name = "estimated_duration_hours")
    private Double estimatedDurationHours;
    
    @Column(name = "actual_duration_hours")
    private Double actualDurationHours;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InterventionStatus status = InterventionStatus.SCHEDULED;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InterventionType type = InterventionType.CLEANING;
    
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    
    @Column(name = "technician_notes", columnDefinition = "TEXT")
    private String technicianNotes;
    
    @Column(name = "customer_feedback", columnDefinition = "TEXT")
    private String customerFeedback;
    
    @Column(name = "customer_rating")
    private Integer customerRating;
    
    @Column(name = "estimated_cost")
    private BigDecimal estimatedCost;
    
    @Column(name = "actual_cost")
    private BigDecimal actualCost;
    
    @Column(name = "materials_used", columnDefinition = "TEXT")
    private String materialsUsed;
    
    @Column(name = "before_photos_urls")
    private String beforePhotosUrls;
    
    @Column(name = "after_photos_urls")
    private String afterPhotosUrls;
    
    @Column(name = "is_urgent")
    private boolean urgent = false;
    
    @Column(name = "requires_follow_up")
    private boolean requiresFollowUp = false;
    
    @Column(name = "follow_up_notes", columnDefinition = "TEXT")
    private String followUpNotes;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    
    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_request_id", nullable = false)
    private ServiceRequest serviceRequest;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_technician_id")
    private User assignedTechnician;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    private Team team;
    
    @OneToMany(mappedBy = "intervention", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<InterventionPhoto> photos = new HashSet<>();
    
    @OneToMany(mappedBy = "intervention", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<InterventionComment> comments = new HashSet<>();
    
    @OneToMany(mappedBy = "intervention", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<InterventionTask> tasks = new HashSet<>();
    
    // Constructeurs
    public Intervention() {}
    
    public Intervention(LocalDateTime startTime, ServiceRequest serviceRequest, Property property) {
        this.startTime = startTime;
        this.serviceRequest = serviceRequest;
        this.property = property;
        this.type = serviceRequest.getServiceType().isCleaningService() ? 
                   InterventionType.CLEANING : InterventionType.MAINTENANCE;
    }
    
    // Getters et Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public LocalDateTime getStartTime() {
        return startTime;
    }
    
    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }
    
    public LocalDateTime getEndTime() {
        return endTime;
    }
    
    public void setEndTime(LocalDateTime endTime) {
        this.endTime = endTime;
    }
    
    public Double getEstimatedDurationHours() {
        return estimatedDurationHours;
    }
    
    public void setEstimatedDurationHours(Double estimatedDurationHours) {
        this.estimatedDurationHours = estimatedDurationHours;
    }
    
    public Double getActualDurationHours() {
        return actualDurationHours;
    }
    
    public void setActualDurationHours(Double actualDurationHours) {
        this.actualDurationHours = actualDurationHours;
    }
    
    public InterventionStatus getStatus() {
        return status;
    }
    
    public void setStatus(InterventionStatus status) {
        this.status = status;
    }
    
    public InterventionType getType() {
        return type;
    }
    
    public void setType(InterventionType type) {
        this.type = type;
    }
    
    public String getNotes() {
        return notes;
    }
    
    public void setNotes(String notes) {
        this.notes = notes;
    }
    
    public String getTechnicianNotes() {
        return technicianNotes;
    }
    
    public void setTechnicianNotes(String technicianNotes) {
        this.technicianNotes = technicianNotes;
    }
    
    public String getCustomerFeedback() {
        return customerFeedback;
    }
    
    public void setCustomerFeedback(String customerFeedback) {
        this.customerFeedback = customerFeedback;
    }
    
    public Integer getCustomerRating() {
        return customerRating;
    }
    
    public void setCustomerRating(Integer customerRating) {
        this.customerRating = customerRating;
    }
    
    public BigDecimal getEstimatedCost() {
        return estimatedCost;
    }
    
    public void setEstimatedCost(BigDecimal estimatedCost) {
        this.estimatedCost = estimatedCost;
    }
    
    public BigDecimal getActualCost() {
        return actualCost;
    }
    
    public void setActualCost(BigDecimal actualCost) {
        this.actualCost = actualCost;
    }
    
    public String getMaterialsUsed() {
        return materialsUsed;
    }
    
    public void setMaterialsUsed(String materialsUsed) {
        this.materialsUsed = materialsUsed;
    }
    
    public String getBeforePhotosUrls() {
        return beforePhotosUrls;
    }
    
    public void setBeforePhotosUrls(String beforePhotosUrls) {
        this.beforePhotosUrls = beforePhotosUrls;
    }
    
    public String getAfterPhotosUrls() {
        return afterPhotosUrls;
    }
    
    public void setAfterPhotosUrls(String afterPhotosUrls) {
        this.afterPhotosUrls = afterPhotosUrls;
    }
    
    public boolean isUrgent() {
        return urgent;
    }
    
    public void setUrgent(boolean urgent) {
        this.urgent = urgent;
    }
    
    public boolean isRequiresFollowUp() {
        return requiresFollowUp;
    }
    
    public void setRequiresFollowUp(boolean requiresFollowUp) {
        this.requiresFollowUp = requiresFollowUp;
    }
    
    public String getFollowUpNotes() {
        return followUpNotes;
    }
    
    public void setFollowUpNotes(String followUpNotes) {
        this.followUpNotes = followUpNotes;
    }
    
    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
    
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    
    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
    
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
    
    public ServiceRequest getServiceRequest() {
        return serviceRequest;
    }
    
    public void setServiceRequest(ServiceRequest serviceRequest) {
        this.serviceRequest = serviceRequest;
    }
    
    public Property getProperty() {
        return property;
    }
    
    public void setProperty(Property property) {
        this.property = property;
    }
    
    public User getAssignedTechnician() {
        return assignedTechnician;
    }
    
    public void setAssignedTechnician(User assignedTechnician) {
        this.assignedTechnician = assignedTechnician;
    }
    
    public Team getTeam() {
        return team;
    }
    
    public void setTeam(Team team) {
        this.team = team;
    }
    
    public Set<InterventionPhoto> getPhotos() {
        return photos;
    }
    
    public void setPhotos(Set<InterventionPhoto> photos) {
        this.photos = photos;
    }
    
    public Set<InterventionComment> getComments() {
        return comments;
    }
    
    public void setComments(Set<InterventionComment> comments) {
        this.comments = comments;
    }
    
    public Set<InterventionTask> getTasks() {
        return tasks;
    }
    
    public void setTasks(Set<InterventionTask> tasks) {
        this.tasks = tasks;
    }
    
    // Méthodes utilitaires
    public boolean isScheduled() {
        return InterventionStatus.SCHEDULED.equals(status);
    }
    
    public boolean isInProgress() {
        return InterventionStatus.IN_PROGRESS.equals(status);
    }
    
    public boolean isCompleted() {
        return InterventionStatus.COMPLETED.equals(status);
    }
    
    public boolean isCancelled() {
        return InterventionStatus.CANCELLED.equals(status);
    }
    
    public boolean hasStarted() {
        return startTime != null && startTime.isBefore(LocalDateTime.now());
    }
    
    public boolean isOverdue() {
        return startTime != null && startTime.isBefore(LocalDateTime.now()) && 
               InterventionStatus.SCHEDULED.equals(status);
    }
    
    public boolean canStart() {
        return InterventionStatus.SCHEDULED.equals(status) && assignedTechnician != null;
    }
    
    public boolean canComplete() {
        return InterventionStatus.IN_PROGRESS.equals(status);
    }
    
    public Double getDurationDifference() {
        if (estimatedDurationHours != null && actualDurationHours != null) {
            return actualDurationHours - estimatedDurationHours;
        }
        return null;
    }
    
    public boolean isCleaningIntervention() {
        return InterventionType.CLEANING.equals(type);
    }
    
    public boolean isMaintenanceIntervention() {
        return InterventionType.MAINTENANCE.equals(type);
    }
    
    @Override
    public String toString() {
        return "Intervention{" +
                "id=" + id +
                ", startTime=" + startTime +
                ", status=" + status +
                ", type=" + type +
                ", property=" + (property != null ? property.getName() : "null") +
                '}';
    }
}
