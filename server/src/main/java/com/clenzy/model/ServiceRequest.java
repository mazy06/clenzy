package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "service_requests")
public class ServiceRequest {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @NotBlank(message = "Le titre de la demande est obligatoire")
    @Size(min = 5, max = 100, message = "Le titre doit contenir entre 5 et 100 caractères")
    @Column(nullable = false)
    private String title;
    
    @Size(max = 1000, message = "La description ne peut pas dépasser 1000 caractères")
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @NotNull(message = "Le type de service est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(name = "service_type", nullable = false)
    private ServiceType serviceType;
    
    @NotNull(message = "La priorité est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Priority priority = Priority.NORMAL;
    
    @NotNull(message = "Le statut est obligatoire")
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RequestStatus status = RequestStatus.PENDING;
    
    @NotNull(message = "La date souhaitée est obligatoire")
    @Column(name = "desired_date", nullable = false)
    private LocalDateTime desiredDate;
    
    @Column(name = "preferred_time_slot")
    private String preferredTimeSlot;
    
    @Column(name = "estimated_duration_hours")
    private Integer estimatedDurationHours;
    
    @Column(name = "estimated_cost")
    private BigDecimal estimatedCost;
    
    @Column(name = "actual_cost")
    private BigDecimal actualCost;
    
    @Column(name = "special_instructions", columnDefinition = "TEXT")
    private String specialInstructions;
    
    @Column(name = "access_notes", columnDefinition = "TEXT")
    private String accessNotes;
    
    @Column(name = "guest_checkout_time")
    private LocalDateTime guestCheckoutTime;
    
    @Column(name = "guest_checkin_time")
    private LocalDateTime guestCheckinTime;
    
    @Column(name = "is_urgent")
    private boolean urgent = false;
    
    @Column(name = "requires_approval")
    private boolean requiresApproval = false;
    
    @Column(name = "approved_by")
    private String approvedBy;
    
    @Column(name = "approved_at")
    private LocalDateTime approvedAt;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    @CreationTimestamp
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    
    // Relations
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;
    
    @OneToMany(mappedBy = "serviceRequest", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<Intervention> interventions = new HashSet<>();
    
    @OneToMany(mappedBy = "serviceRequest", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<RequestPhoto> photos = new HashSet<>();
    
    @OneToMany(mappedBy = "serviceRequest", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<RequestComment> comments = new HashSet<>();
    
    // Constructeurs
    public ServiceRequest() {}
    
    public ServiceRequest(String title, ServiceType serviceType, LocalDateTime desiredDate, User user, Property property) {
        this.title = title;
        this.serviceType = serviceType;
        this.desiredDate = desiredDate;
        this.user = user;
        this.property = property;
    }
    
    // Getters et Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getTitle() {
        return title;
    }
    
    public void setTitle(String title) {
        this.title = title;
    }
    
    public String getDescription() {
        return description;
    }
    
    public void setDescription(String description) {
        this.description = description;
    }
    
    public ServiceType getServiceType() {
        return serviceType;
    }
    
    public void setServiceType(ServiceType serviceType) {
        this.serviceType = serviceType;
    }
    
    public Priority getPriority() {
        return priority;
    }
    
    public void setPriority(Priority priority) {
        this.priority = priority;
    }
    
    public RequestStatus getStatus() {
        return status;
    }
    
    public void setStatus(RequestStatus status) {
        this.status = status;
    }
    
    public LocalDateTime getDesiredDate() {
        return desiredDate;
    }
    
    public void setDesiredDate(LocalDateTime desiredDate) {
        this.desiredDate = desiredDate;
    }
    
    public String getPreferredTimeSlot() {
        return preferredTimeSlot;
    }
    
    public void setPreferredTimeSlot(String preferredTimeSlot) {
        this.preferredTimeSlot = preferredTimeSlot;
    }
    
    public Integer getEstimatedDurationHours() {
        return estimatedDurationHours;
    }
    
    public void setEstimatedDurationHours(Integer estimatedDurationHours) {
        this.estimatedDurationHours = estimatedDurationHours;
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
    
    public String getSpecialInstructions() {
        return specialInstructions;
    }
    
    public void setSpecialInstructions(String specialInstructions) {
        this.specialInstructions = specialInstructions;
    }
    
    public String getAccessNotes() {
        return accessNotes;
    }
    
    public void setAccessNotes(String accessNotes) {
        this.accessNotes = accessNotes;
    }
    
    public LocalDateTime getGuestCheckoutTime() {
        return guestCheckoutTime;
    }
    
    public void setGuestCheckoutTime(LocalDateTime guestCheckoutTime) {
        this.guestCheckoutTime = guestCheckoutTime;
    }
    
    public LocalDateTime getGuestCheckinTime() {
        return guestCheckinTime;
    }
    
    public void setGuestCheckinTime(LocalDateTime guestCheckinTime) {
        this.guestCheckinTime = guestCheckinTime;
    }
    
    public boolean isUrgent() {
        return urgent;
    }
    
    public void setUrgent(boolean urgent) {
        this.urgent = urgent;
    }
    
    public boolean isRequiresApproval() {
        return requiresApproval;
    }
    
    public void setRequiresApproval(boolean requiresApproval) {
        this.requiresApproval = requiresApproval;
    }
    
    public String getApprovedBy() {
        return approvedBy;
    }
    
    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }
    
    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }
    
    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
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
    
    public User getUser() {
        return user;
    }
    
    public void setUser(User user) {
        this.user = user;
    }
    
    public Property getProperty() {
        return property;
    }
    
    public void setProperty(Property property) {
        this.property = property;
    }
    
    public Set<Intervention> getInterventions() {
        return interventions;
    }
    
    public void setInterventions(Set<Intervention> interventions) {
        this.interventions = interventions;
    }
    
    public Set<RequestPhoto> getPhotos() {
        return photos;
    }
    
    public void setPhotos(Set<RequestPhoto> photos) {
        this.photos = photos;
    }
    
    public Set<RequestComment> getComments() {
        return comments;
    }
    
    public void setComments(Set<RequestComment> comments) {
        this.comments = comments;
    }
    
    // Méthodes utilitaires
    public boolean isPending() {
        return RequestStatus.PENDING.equals(status);
    }
    
    public boolean isInProgress() {
        return RequestStatus.IN_PROGRESS.equals(status);
    }
    
    public boolean isCompleted() {
        return RequestStatus.COMPLETED.equals(status);
    }
    
    public boolean isCancelled() {
        return RequestStatus.CANCELLED.equals(status);
    }
    
    public boolean isHighPriority() {
        return Priority.HIGH.equals(priority) || urgent;
    }
    
    public boolean needsApproval() {
        return requiresApproval && !RequestStatus.APPROVED.equals(status);
    }
    
    public boolean canBeScheduled() {
        return RequestStatus.APPROVED.equals(status) || !requiresApproval;
    }
    
    @Override
    public String toString() {
        return "ServiceRequest{" +
                "id=" + id +
                ", title='" + title + '\'' +
                ", serviceType=" + serviceType +
                ", priority=" + priority +
                ", status=" + status +
                ", desiredDate=" + desiredDate +
                '}';
    }
}
