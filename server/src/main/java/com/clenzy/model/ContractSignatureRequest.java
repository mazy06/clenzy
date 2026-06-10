package com.clenzy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Demande de signature électronique interne (SES) d'un contrat de gestion.
 *
 * <p>Le propriétaire reçoit un lien public {@code /sign/{token}} : consultation du
 * mandat PDF + signature simple (nom + consentement). La row porte le dossier de
 * preuve (IP, user-agent, horodatage, SHA-256 du PDF présenté, nom saisi) et le
 * chemin du PDF tamponné après signature.</p>
 *
 * <p>Lecture côté public (sans TenantContext) : toujours dérivée du token, jamais
 * d'un id client. Le filtre org reste actif côté PMS authentifié.</p>
 */
@Entity
@Table(name = "contract_signature_requests")
@org.hibernate.annotations.Filter(name = "organizationFilter", condition = "organization_id = :orgId")
public class ContractSignatureRequest {

    public enum Status { PENDING, SIGNED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "contract_id", nullable = false)
    private Long contractId;

    /** Génération du mandat présentée au signataire (le hash prouvé = ce PDF). */
    @Column(name = "document_generation_id")
    private Long documentGenerationId;

    @Column(nullable = false, unique = true)
    private UUID token = UUID.randomUUID();

    @Column(name = "signer_email", nullable = false, length = 255)
    private String signerEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    // ─── Dossier de preuve (SES eIDAS art. 25) ──────────────────────────────

    @Column(name = "signed_at")
    private LocalDateTime signedAt;

    @Column(name = "signed_by_name", length = 255)
    private String signedByName;

    @Column(name = "signer_ip", length = 64)
    private String signerIp;

    @Column(name = "signer_user_agent", length = 512)
    private String signerUserAgent;

    @Column(name = "document_sha256", length = 64)
    private String documentSha256;

    @Column(name = "consent_text", columnDefinition = "TEXT")
    private String consentText;

    /** PDF tamponné (original + page certificat), servi après signature. */
    @Column(name = "signed_document_path", length = 500)
    private String signedDocumentPath;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }
    public Long getContractId() { return contractId; }
    public void setContractId(Long contractId) { this.contractId = contractId; }
    public Long getDocumentGenerationId() { return documentGenerationId; }
    public void setDocumentGenerationId(Long documentGenerationId) { this.documentGenerationId = documentGenerationId; }
    public UUID getToken() { return token; }
    public void setToken(UUID token) { this.token = token; }
    public String getSignerEmail() { return signerEmail; }
    public void setSignerEmail(String signerEmail) { this.signerEmail = signerEmail; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public LocalDateTime getSignedAt() { return signedAt; }
    public void setSignedAt(LocalDateTime signedAt) { this.signedAt = signedAt; }
    public String getSignedByName() { return signedByName; }
    public void setSignedByName(String signedByName) { this.signedByName = signedByName; }
    public String getSignerIp() { return signerIp; }
    public void setSignerIp(String signerIp) { this.signerIp = signerIp; }
    public String getSignerUserAgent() { return signerUserAgent; }
    public void setSignerUserAgent(String signerUserAgent) { this.signerUserAgent = signerUserAgent; }
    public String getDocumentSha256() { return documentSha256; }
    public void setDocumentSha256(String documentSha256) { this.documentSha256 = documentSha256; }
    public String getConsentText() { return consentText; }
    public void setConsentText(String consentText) { this.consentText = consentText; }
    public String getSignedDocumentPath() { return signedDocumentPath; }
    public void setSignedDocumentPath(String signedDocumentPath) { this.signedDocumentPath = signedDocumentPath; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    /** Demande encore signable : PENDING et non expirée. */
    public boolean isCurrentlyValid() {
        return status == Status.PENDING
                && expiresAt != null
                && expiresAt.isAfter(LocalDateTime.now());
    }

    public boolean isExpired() {
        return status == Status.PENDING
                && expiresAt != null
                && !expiresAt.isAfter(LocalDateTime.now());
    }
}
