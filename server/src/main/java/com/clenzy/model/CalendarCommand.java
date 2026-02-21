package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Write-ahead log (audit trail) des mutations calendrier.
 * Chaque commande represente une operation atomique sur le calendrier
 * d'une propriete (reservation, blocage, deblocage, mise a jour prix).
 *
 * PAS de @Filter("organizationFilter") : l'audit doit etre
 * consultable cross-org par SUPER_ADMIN.
 */
@Entity
@Table(name = "calendar_commands")
public class CalendarCommand {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "property_id", nullable = false)
    private Long propertyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "command_type", nullable = false, length = 20)
    private CalendarCommandType commandType;

    @Column(name = "date_from", nullable = false)
    private LocalDate dateFrom;

    @Column(name = "date_to", nullable = false)
    private LocalDate dateTo;

    @Column(name = "source", nullable = false, length = 30)
    private String source = "MANUAL";

    @Column(name = "reservation_id")
    private Long reservationId;

    @Column(name = "actor_id", length = 255)
    private String actorId;

    @Column(name = "payload", columnDefinition = "JSONB")
    private String payload;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "EXECUTED";

    @Column(name = "executed_at", nullable = false)
    private LocalDateTime executedAt = LocalDateTime.now();

    // Constructeurs

    public CalendarCommand() {}

    public CalendarCommand(Long organizationId, Long propertyId, CalendarCommandType commandType,
                           LocalDate dateFrom, LocalDate dateTo, String source) {
        this.organizationId = organizationId;
        this.propertyId = propertyId;
        this.commandType = commandType;
        this.dateFrom = dateFrom;
        this.dateTo = dateTo;
        this.source = source;
        this.executedAt = LocalDateTime.now();
    }

    // Getters et Setters

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public Long getPropertyId() { return propertyId; }
    public void setPropertyId(Long propertyId) { this.propertyId = propertyId; }

    public CalendarCommandType getCommandType() { return commandType; }
    public void setCommandType(CalendarCommandType commandType) { this.commandType = commandType; }

    public LocalDate getDateFrom() { return dateFrom; }
    public void setDateFrom(LocalDate dateFrom) { this.dateFrom = dateFrom; }

    public LocalDate getDateTo() { return dateTo; }
    public void setDateTo(LocalDate dateTo) { this.dateTo = dateTo; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public Long getReservationId() { return reservationId; }
    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }

    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }

    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getExecutedAt() { return executedAt; }
    public void setExecutedAt(LocalDateTime executedAt) { this.executedAt = executedAt; }

    @Override
    public String toString() {
        return "CalendarCommand{id=" + id + ", propertyId=" + propertyId
                + ", type=" + commandType + ", from=" + dateFrom + ", to=" + dateTo
                + ", status=" + status + "}";
    }
}
