package com.clenzy.integration.pennylane.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Schéma du journal Baitly. Les transitions et lectures sont uniquement SQL, toujours org-scopées. */
@Entity
@Table(name="baitly_accounting_exports", uniqueConstraints=@UniqueConstraint(columnNames={"organization_id","document_kind","document_id"}))
public class BaitlyAccountingExport {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="document_kind",nullable=false,length=16) private String documentKind;
    @Column(name="document_id",nullable=false) private Long documentId;
    @Column(name="generation",nullable=false) private UUID generation;
    @Column(name="attempt",nullable=false) private UUID attempt;
    @Column(name="fingerprint",nullable=false,length=64) private String fingerprint;
    @Column(name="source_version",length=64) private String sourceVersion;
    @Column(name="state",nullable=false,length=16) private String state;
    @Column(name="remote_id",length=50) private String remoteId;
    @Column(name="created_at",nullable=false) private Instant createdAt;
    @Column(name="confirmed_at") private Instant confirmedAt;
    @Column(name="uncertain_at") private Instant uncertainAt;
}
