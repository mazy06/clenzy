package com.clenzy.integration.pennylane.service;

import com.clenzy.util.BaitlyExternalIds;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;
import java.util.function.Supplier;

/** Intentions indépendamment commises avant HTTP. Aucun délai ne réarme un résultat incertain. */
@Service
public class BaitlyAccountingExportJournal {
    public enum Kind {INVOICE, EXPENSE}
    public record Key(Long organizationId, Kind kind, Long documentId) {
        public Key {
            if (organizationId==null || organizationId<=0 || kind==null || documentId==null || documentId<=0) throw unconfirmed();
        }
    }
    public record Ticket(Key key, UUID generation, UUID attempt, String fingerprint, String confirmedId) {
        @Override public String toString() {return "BaitlyAccountingExportTicket";}
    }
    private final JdbcTemplate db;
    private final TransactionTemplate transaction;
    public BaitlyAccountingExportJournal(JdbcTemplate db, PlatformTransactionManager manager) {
        this.db=db; transaction=new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setTimeout(10);
    }
    public Ticket prepare(Key key, UUID generation, String fingerprint, String sourceVersion) {
        if (generation==null || fingerprint==null || !fingerprint.matches("[a-f0-9]{64}")) throw unconfirmed();
        return committed(() -> {
            db.execute("SET LOCAL lock_timeout = '2s'");
            requireGeneration(key.organizationId(), generation);
            requireDocumentVersion(key,sourceVersion);
            UUID attempt=UUID.randomUUID();
            int inserted=db.update("""
                INSERT INTO baitly_accounting_exports (organization_id,document_kind,document_id,generation,attempt,fingerprint,source_version,state)
                VALUES (?,?,?,?,?,?,?,'SENDING') ON CONFLICT (organization_id,document_kind,document_id) DO NOTHING
                """, key.organizationId(),key.kind().name(),key.documentId(),generation,attempt,fingerprint,sourceVersion);
            var row=db.queryForMap("SELECT * FROM baitly_accounting_exports WHERE organization_id=? AND document_kind=? AND document_id=? FOR UPDATE",
                    key.organizationId(),key.kind().name(),key.documentId());
            if (!generation.equals(row.get("generation")) || !fingerprint.equals(row.get("fingerprint"))) throw unconfirmed();
            if ("CONFIRMED".equals(row.get("state"))) {
                return new Ticket(key,generation,(UUID)row.get("attempt"),fingerprint,BaitlyExternalIds.require(row.get("remote_id"),50));
            }
            if (inserted!=1 || !attempt.equals(row.get("attempt"))) throw unconfirmed();
            return new Ticket(key,generation,attempt,fingerprint,null);
        });
    }
    public void confirm(Ticket ticket, String remoteId) {
        String valid=BaitlyExternalIds.require(remoteId,50);
        committed(() -> {
            requireGeneration(ticket.key().organizationId(),ticket.generation());
            int changed=db.update("""
                UPDATE baitly_accounting_exports SET state='CONFIRMED',remote_id=?,confirmed_at=CURRENT_TIMESTAMP
                WHERE organization_id=? AND document_kind=? AND document_id=? AND generation=? AND attempt=? AND fingerprint=? AND state='SENDING'
                """,valid,ticket.key().organizationId(),ticket.key().kind().name(),ticket.key().documentId(),ticket.generation(),ticket.attempt(),ticket.fingerprint());
            if (changed!=1) throw unconfirmed();
            return null;
        });
    }
    public void uncertain(Ticket ticket) {
        committed(() -> {
            db.update("""
                UPDATE baitly_accounting_exports SET state='UNKNOWN',uncertain_at=COALESCE(uncertain_at,CURRENT_TIMESTAMP)
                WHERE organization_id=? AND document_kind=? AND document_id=? AND attempt=? AND state='SENDING'
                """,ticket.key().organizationId(),ticket.key().kind().name(),ticket.key().documentId(),ticket.attempt());
            return null;
        });
    }
    /** Réconciliation locale depuis une preuve durable, sans aucune nouvelle création distante. */
    public java.time.Instant applyLocal(Ticket ticket, String remoteId) {
        String valid=BaitlyExternalIds.require(remoteId,50);
        return committed(() -> {
            requireGeneration(ticket.key().organizationId(),ticket.generation());
            String version=db.queryForObject("""
                SELECT source_version FROM baitly_accounting_exports WHERE organization_id=? AND document_kind=? AND document_id=?
                AND generation=? AND fingerprint=? AND state='CONFIRMED' AND remote_id=?
                """,String.class,ticket.key().organizationId(),ticket.key().kind().name(),ticket.key().documentId(),ticket.generation(),ticket.fingerprint(),valid);
            var confirmed=db.queryForObject("SELECT confirmed_at FROM baitly_accounting_exports WHERE organization_id=? AND document_kind=? AND document_id=? AND state='CONFIRMED'",
                    java.sql.Timestamp.class,ticket.key().organizationId(),ticket.key().kind().name(),ticket.key().documentId());
            if (confirmed==null) throw unconfirmed();
            String table=ticket.key().kind()==Kind.INVOICE ? "invoices" : "provider_expenses";
            int changed=db.update("UPDATE " + table + " SET pennylane_invoice_id=?,pennylane_synced_at=?"
                    + " WHERE organization_id=? AND id=? AND (pennylane_invoice_id IS NULL OR pennylane_invoice_id=?) AND updated_at IS NOT DISTINCT FROM CAST(? AS " + versionType(ticket.key()) + ")",
                    valid,confirmed,ticket.key().organizationId(),ticket.key().documentId(),valid,version);
            if (changed!=1) throw unconfirmed();
            return confirmed.toInstant();
        });
    }
    public long countUnconfirmed(Long organizationId) {
        if (organizationId==null || organizationId<=0) throw unconfirmed();
        return committed(() -> db.queryForObject("SELECT count(*) FROM baitly_accounting_exports WHERE organization_id=? AND state IN ('SENDING','UNKNOWN')",Long.class,organizationId));
    }
    private String versionType(Key key) {return key.kind()==Kind.INVOICE ? "timestamp" : "timestamp with time zone";}
    private void requireDocumentVersion(Key key, String version) {
        if (version!=null && version.length()>64) throw unconfirmed();
        String table=key.kind()==Kind.INVOICE ? "invoices" : "provider_expenses";
        Integer count=db.queryForObject("SELECT count(*) FROM " + table
                + " WHERE organization_id=? AND id=? AND updated_at IS NOT DISTINCT FROM CAST(? AS " + versionType(key) + ") AND pennylane_invoice_id IS NULL",
                Integer.class,key.organizationId(),key.documentId(),version);
        if (!Integer.valueOf(1).equals(count)) throw unconfirmed();
    }
    private void requireGeneration(Long organizationId, UUID generation) {
        UUID current=db.queryForObject("SELECT accounting_generation FROM pennylane_connections WHERE organization_id=? AND status='ACTIVE' FOR SHARE",UUID.class,organizationId);
        if (!generation.equals(current)) throw unconfirmed();
    }
    private <T> T committed(Supplier<T> work) {
        try {return transaction.execute(status -> work.get());}
        catch (RuntimeException ignored) {throw unconfirmed();}
    }
    static BaitlyPennylaneDiagnostics.Failure unconfirmed() {
        return BaitlyPennylaneDiagnostics.failure(BaitlyPennylaneDiagnostics.Reason.UNCONFIRMED);
    }
}
