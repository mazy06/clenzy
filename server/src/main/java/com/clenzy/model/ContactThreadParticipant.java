package com.clenzy.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Participation a un fil de contact.
 *
 * <p>C'est elle qui porte la visibilite : un message de fil n'a pas de
 * destinataire, il est lu par ceux qui participent. L'archivage et l'etat de
 * lecture sont PAR participant — archiver le fil de son cote ne le retire pas
 * aux autres.</p>
 */
@Entity
@Table(name = "contact_thread_participants")
public class ContactThreadParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "thread_id", nullable = false)
    private Long threadId;

    @Column(name = "keycloak_id", nullable = false, length = 100)
    private String keycloakId;

    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    @Column(length = 255)
    private String email;

    @Column(nullable = false)
    private boolean archived;

    @Column(name = "last_read_at")
    private LocalDateTime lastReadAt;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt = LocalDateTime.now();

    public Long getId() { return id; }

    public Long getThreadId() { return threadId; }
    public void setThreadId(Long threadId) { this.threadId = threadId; }

    public String getKeycloakId() { return keycloakId; }
    public void setKeycloakId(String keycloakId) { this.keycloakId = keycloakId; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }

    public LocalDateTime getLastReadAt() { return lastReadAt; }
    public void setLastReadAt(LocalDateTime lastReadAt) { this.lastReadAt = lastReadAt; }

    public LocalDateTime getJoinedAt() { return joinedAt; }

    /** Nom affichable, repli sur l'email puis sur l'identifiant. */
    public String displayName() {
        String name = ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
        if (!name.isBlank()) return name;
        return email != null && !email.isBlank() ? email : keycloakId;
    }
}
