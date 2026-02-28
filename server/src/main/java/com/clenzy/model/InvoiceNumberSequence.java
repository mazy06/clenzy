package com.clenzy.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Sequence de numerotation des factures par organisation et annee.
 * Garantit une numerotation sequentielle sans rupture (obligation legale).
 * Thread-safe via SELECT ... FOR UPDATE dans le repository.
 */
@Entity
@Table(name = "invoice_number_sequences", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"organization_id", "current_year"})
})
public class InvoiceNumberSequence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @NotNull
    @Size(max = 10)
    @Column(name = "prefix", nullable = false, length = 10)
    private String prefix = "FA-";

    @NotNull
    @Column(name = "current_year", nullable = false)
    private Integer currentYear;

    @NotNull
    @Column(name = "last_number", nullable = false)
    private Integer lastNumber = 0;

    // --- Constructeurs ---

    public InvoiceNumberSequence() {}

    public InvoiceNumberSequence(Long organizationId, String prefix, Integer currentYear) {
        this.organizationId = organizationId;
        this.prefix = prefix;
        this.currentYear = currentYear;
        this.lastNumber = 0;
    }

    // --- Methodes utilitaires ---

    /**
     * Genere le prochain numero de facture et incremente le compteur.
     * Format : PREFIX + YEAR + "-" + NUMBER (ex: FA-2025-00001)
     */
    public String nextNumber() {
        lastNumber++;
        return String.format("%s%d-%05d", prefix, currentYear, lastNumber);
    }

    // --- Getters / Setters ---

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrganizationId() { return organizationId; }
    public void setOrganizationId(Long organizationId) { this.organizationId = organizationId; }

    public String getPrefix() { return prefix; }
    public void setPrefix(String prefix) { this.prefix = prefix; }

    public Integer getCurrentYear() { return currentYear; }
    public void setCurrentYear(Integer currentYear) { this.currentYear = currentYear; }

    public Integer getLastNumber() { return lastNumber; }
    public void setLastNumber(Integer lastNumber) { this.lastNumber = lastNumber; }

    @Override
    public String toString() {
        return "InvoiceNumberSequence{" +
                "organizationId=" + organizationId +
                ", prefix='" + prefix + '\'' +
                ", currentYear=" + currentYear +
                ", lastNumber=" + lastNumber +
                '}';
    }
}
