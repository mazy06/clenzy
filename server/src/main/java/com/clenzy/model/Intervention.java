package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.HashSet;

@Entity
@Table(name = "interventions")
@org.hibernate.annotations.DynamicUpdate
@org.hibernate.annotations.Filter(
    name = "organizationFilter",
    condition = "organization_id = :orgId"
)
public class Intervention {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @NotBlank(message = "Le titre de l'intervention est obligatoire")
    @Size(max = 255, message = "Le titre ne peut pas dépasser 255 caractères")
    @Column(nullable = false, length = 255)
    private String title;

    @Size(max = 500, message = "La description ne peut pas dépasser 500 caractères")
    @Column(columnDefinition = "TEXT")
    private String description;
    
    @Column(nullable = false, length = 50)
    private String type;
    
        @Column(nullable = false, length = 50)
    @Enumerated(EnumType.STRING)
    private InterventionStatus status;

    @Column(nullable = false, length = 50)
    private String priority;

    @Column(name = "assigned_technician_id")
    private Long assignedTechnicianId;

    @Column(name = "team_id")
    private Long teamId;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "is_urgent")
    private Boolean isUrgent;

    @Column(name = "requires_follow_up")
    private Boolean requiresFollowUp;

    @Column(name = "materials_used")
    private String materialsUsed;

    @Column(name = "technician_notes")
    private String technicianNotes;

    @Column(name = "customer_feedback")
    private String customerFeedback;

    @Column(name = "customer_rating")
    private Integer customerRating;

    @Column(name = "follow_up_notes")
    private String followUpNotes;

    @Column(name = "after_photos_urls", columnDefinition = "TEXT")
    private String afterPhotosUrls;

    @Column(name = "before_photos_urls", columnDefinition = "TEXT")
    private String beforePhotosUrls;
    
    @Column(name = "validated_rooms", columnDefinition = "TEXT")
    private String validatedRooms; // JSON array des indices des pièces validées (ex: "[0,1,2]")
    
    @Column(name = "completed_steps", columnDefinition = "TEXT")
    private String completedSteps; // JSON array des étapes complétées (ex: "[\"inspection\",\"rooms\",\"after_photos\"]")
    
    @Column(columnDefinition = "TEXT")
    private String notes;
    
    // Ancien champ photos (déprécié, utiliser interventionPhotos à la place)
    // Ne plus mettre à jour ce champ lors des sauvegardes
    @Column(columnDefinition = "TEXT", updatable = false, insertable = false)
    @Deprecated
    private String photos;
    
    @OneToMany(mappedBy = "intervention", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private Set<InterventionPhoto> interventionPhotos = new HashSet<>();
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requestor_id", nullable = false)
    private User requestor;
    
        @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_user_id")
    private User assignedUser;



    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_request_id", nullable = false)
    private ServiceRequest serviceRequest;


    
    @Column(name = "scheduled_date", nullable = false)
    private LocalDateTime scheduledDate;
    
    @Column(name = "estimated_duration_hours")
    private Integer estimatedDurationHours;
    
    @Column(name = "actual_duration_minutes")
    private Integer actualDurationMinutes;
    
    @Column(name = "estimated_cost", precision = 10, scale = 2)
    private BigDecimal estimatedCost;
    
    @Column(name = "actual_cost", precision = 10, scale = 2)
    private BigDecimal actualCost;

    // Multi-currency (V84)
    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "EUR";

    @Column(name = "special_instructions", columnDefinition = "TEXT")
    private String specialInstructions;
    
    @Column(name = "access_notes", columnDefinition = "TEXT")
    private String accessNotes;
    
    @Column(name = "preferred_time_slot")
    private String preferredTimeSlot;
    
    @Column(name = "progress_percentage")
    private Integer progressPercentage;
    
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @Column(name = "completed_at")
    private LocalDateTime completedAt;
    
    @Column(name = "guest_checkout_time")
    private LocalDateTime guestCheckoutTime;
    
    @Column(name = "guest_checkin_time")
    private LocalDateTime guestCheckinTime;
    
    // Champs de paiement Stripe
    @Column(name = "payment_status", length = 50)
    @Enumerated(EnumType.STRING)
    private PaymentStatus paymentStatus;
    
    @Column(name = "stripe_payment_intent_id", length = 255)
    private String stripePaymentIntentId;
    
    @Column(name = "stripe_session_id", length = 255)
    private String stripeSessionId;
    
    @Column(name = "paid_at")
    private LocalDateTime paidAt;
    

    
    // Constructeurs
    public Intervention() {
        this.createdAt = LocalDateTime.now();
        this.startTime = LocalDateTime.now();
        this.status = InterventionStatus.PENDING;
        this.priority = "NORMAL";
        this.progressPercentage = 0;
        this.isUrgent = false;
        this.requiresFollowUp = false;
        this.paymentStatus = PaymentStatus.PENDING;
    }
    
    public Intervention(String title, String description, String type, Property property, User requestor, ServiceRequest serviceRequest) {
        this();
        this.title = title;
        this.description = description;
        this.type = type;
        this.property = property;
        this.requestor = requestor;
        this.serviceRequest = serviceRequest;
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
    
    public String getType() {
        return type;
    }
    
    public void setType(String type) {
        this.type = type;
    }
    
    public InterventionStatus getStatus() {
        return status;
    }
    
    public void setStatus(InterventionStatus status) {
        this.status = status;
    }
    
    public String getPriority() {
        return priority;
    }
    
    public void setPriority(String priority) {
        this.priority = priority;
    }
    
    public Property getProperty() {
        return property;
    }
    
    public void setProperty(Property property) {
        this.property = property;
    }
    
    public User getRequestor() {
        return requestor;
    }
    
    public void setRequestor(User requestor) {
        this.requestor = requestor;
    }
    
    public User getAssignedUser() {
        return assignedUser;
    }
    
    public void setAssignedUser(User assignedUser) {
        this.assignedUser = assignedUser;
    }
    

    
    public LocalDateTime getScheduledDate() {
        return scheduledDate;
    }
    
    public void setScheduledDate(LocalDateTime scheduledDate) {
        this.scheduledDate = scheduledDate;
    }
    
    public Integer getEstimatedDurationHours() {
        return estimatedDurationHours;
    }
    
    public void setEstimatedDurationHours(Integer estimatedDurationHours) {
        this.estimatedDurationHours = estimatedDurationHours;
    }
    
    public Integer getActualDurationMinutes() {
        return actualDurationMinutes;
    }
    
    public void setActualDurationMinutes(Integer actualDurationMinutes) {
        this.actualDurationMinutes = actualDurationMinutes;
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

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency;
    }
    
    public String getNotes() {
        return notes;
    }
    
    public void setNotes(String notes) {
        this.notes = notes;
    }
    
    @Deprecated
    public String getPhotos() {
        return photos;
    }
    
    @Deprecated
    public void setPhotos(String photos) {
        this.photos = photos;
    }
    
    public Set<InterventionPhoto> getInterventionPhotos() {
        return interventionPhotos;
    }
    
    public void setInterventionPhotos(Set<InterventionPhoto> interventionPhotos) {
        this.interventionPhotos = interventionPhotos;
    }
    
    public void addPhoto(InterventionPhoto photo) {
        this.interventionPhotos.add(photo);
        photo.setIntervention(this);
    }
    
    public void removePhoto(InterventionPhoto photo) {
        this.interventionPhotos.remove(photo);
        photo.setIntervention(null);
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
    
    public String getPreferredTimeSlot() {
        return preferredTimeSlot;
    }

    public void setPreferredTimeSlot(String preferredTimeSlot) {
        this.preferredTimeSlot = preferredTimeSlot;
    }
    
    public Integer getProgressPercentage() {
        return progressPercentage;
    }
    
    public void setProgressPercentage(Integer progressPercentage) {
        this.progressPercentage = progressPercentage;
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
    
    public LocalDateTime getCompletedAt() {
        return completedAt;
    }
    
    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
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
    
    public ServiceRequest getServiceRequest() {
        return serviceRequest;
    }
    
        public void setServiceRequest(ServiceRequest serviceRequest) {
        this.serviceRequest = serviceRequest;
    }

    // Getters et setters pour les nouveaux champs
    public Long getAssignedTechnicianId() {
        return assignedTechnicianId;
    }

    public void setAssignedTechnicianId(Long assignedTechnicianId) {
        this.assignedTechnicianId = assignedTechnicianId;
    }

    public Long getTeamId() {
        return teamId;
    }

    public void setTeamId(Long teamId) {
        this.teamId = teamId;
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

    public Boolean getIsUrgent() {
        return isUrgent;
    }

    public void setIsUrgent(Boolean isUrgent) {
        this.isUrgent = isUrgent;
    }

    public Boolean getRequiresFollowUp() {
        return requiresFollowUp;
    }

    public void setRequiresFollowUp(Boolean requiresFollowUp) {
        this.requiresFollowUp = requiresFollowUp;
    }

    public String getMaterialsUsed() {
        return materialsUsed;
    }

    public void setMaterialsUsed(String materialsUsed) {
        this.materialsUsed = materialsUsed;
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

    public String getFollowUpNotes() {
        return followUpNotes;
    }

    public void setFollowUpNotes(String followUpNotes) {
        this.followUpNotes = followUpNotes;
    }

    public String getAfterPhotosUrls() {
        return afterPhotosUrls;
    }

    public void setAfterPhotosUrls(String afterPhotosUrls) {
        this.afterPhotosUrls = afterPhotosUrls;
    }

    public String getBeforePhotosUrls() {
        return beforePhotosUrls;
    }

    public void setBeforePhotosUrls(String beforePhotosUrls) {
        this.beforePhotosUrls = beforePhotosUrls;
    }

    public String getValidatedRooms() {
        return validatedRooms;
    }

    public void setValidatedRooms(String validatedRooms) {
        this.validatedRooms = validatedRooms;
    }

    public String getCompletedSteps() {
        return completedSteps;
    }

    public void setCompletedSteps(String completedSteps) {
        this.completedSteps = completedSteps;
    }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    // Méthodes utilitaires
    public String getAssignedToType() {
        if (assignedUser != null) return "user";
        if (teamId != null) return "team";
        return null;
    }
    
    public Long getAssignedToId() {
        if (assignedUser != null) return assignedUser.getId();
        if (teamId != null) return teamId;
        return null;
    }
    
    public String getAssignedToName() {
        if (assignedUser != null) return assignedUser.getFirstName() + " " + assignedUser.getLastName();
        if (teamId != null) return "Équipe " + teamId; // TODO: Récupérer le nom de l'équipe depuis le service
        return null;
    }
    
    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
        
        // Mettre à jour la date de completion si le statut est "COMPLETED"
        if (InterventionStatus.COMPLETED.equals(this.status) && this.completedAt == null) {
            this.completedAt = LocalDateTime.now();
        }
    }
    
    // Getters et Setters pour les champs de paiement
    public PaymentStatus getPaymentStatus() {
        return paymentStatus;
    }
    
    public void setPaymentStatus(PaymentStatus paymentStatus) {
        this.paymentStatus = paymentStatus;
    }
    
    public String getStripePaymentIntentId() {
        return stripePaymentIntentId;
    }
    
    public void setStripePaymentIntentId(String stripePaymentIntentId) {
        this.stripePaymentIntentId = stripePaymentIntentId;
    }
    
    public String getStripeSessionId() {
        return stripeSessionId;
    }
    
    public void setStripeSessionId(String stripeSessionId) {
        this.stripeSessionId = stripeSessionId;
    }
    
    public LocalDateTime getPaidAt() {
        return paidAt;
    }
    
    public void setPaidAt(LocalDateTime paidAt) {
        this.paidAt = paidAt;
    }
}
