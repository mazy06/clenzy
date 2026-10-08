package com.clenzy.model;

import jakarta.persistence.*;

/** Compteur transactionnel isolé par émetteur fiscal et année. */
@Entity
@Table(name="baitly_invoice_issuer_sequences",uniqueConstraints=@UniqueConstraint(columnNames={"organization_id","issuer_key","current_year"}))
public class BaitlyInvoiceIssuerSequence {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="issuer_key",nullable=false,length=64) private String issuerKey;
    @Column(name="current_year",nullable=false) private int currentYear;
    @Column(name="last_number",nullable=false) private long lastNumber;
    public Long getId(){return id;}
    public long next(){return ++lastNumber;}
}
