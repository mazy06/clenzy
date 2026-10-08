package com.clenzy.service;

import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;

/** Rapprochement déclaré par un opérateur sur deux pièces. Aucun crédit de solde Stripe. */
@Service
@Transactional(readOnly = true)
public class BaitlyOtaSettlementService {
    public record Line(Long reservationId, BigDecimal gross, BigDecimal fees, BigDecimal refunds, BigDecimal net) {}
    public record Request(UUID requestId, String otaReference, String bankReference, LocalDate receivedOn,
            String currency, Long beneficiaryUserId, List<Line> lines) {}
    private final NamedParameterJdbcTemplate jdbc;
    private final UserRepository users;
    private final TenantContext tenant;
    private final com.fasterxml.jackson.databind.ObjectMapper json;
    public BaitlyOtaSettlementService(NamedParameterJdbcTemplate jdbc, UserRepository users, TenantContext tenant,
            com.fasterxml.jackson.databind.ObjectMapper json) {
        this.jdbc=jdbc; this.users=users; this.tenant=tenant; this.json=json;
    }
    private long actor(String subject) {
        var user=users.findByKeycloakId(subject).orElseThrow(() -> new AccessDeniedException("Utilisateur inconnu."));
        if(user.getRole()==null || !user.getRole().isPlatformStaff()) throw new AccessDeniedException("Revue financière réservée à la plateforme.");
        return user.getId();
    }
    private Map<String,Object> scope() { return new HashMap<>(Map.of("org",tenant.getRequiredOrganizationId())); }
    public Map<String,Object> context(long reservationId,String subject) {
        actor(subject); var p=scope();p.put("reservation",reservationId);
        var rows=jdbc.queryForList("""
            SELECT r.total_price,r.currency,r.source,r.payment_collection,p.owner_id,o.name AS organization_name
            FROM reservations r JOIN properties p ON p.id=r.property_id AND p.organization_id=r.organization_id
            JOIN organizations o ON o.id=r.organization_id WHERE r.id=:reservation AND r.organization_id=:org
            """,p);
        require(rows.size()==1,"Réservation inaccessible.");var result=rows.getFirst();
        result.put("owner_name",result.get("owner_id") instanceof Number owner
                ?users.findById(owner.longValue()).map(com.clenzy.model.User::getFullName).orElse("Propriétaire") : null);
        return result;
    }
    public List<Map<String,Object>> candidates(long reservationId,String subject) {
        var context=context(reservationId,subject);require("CHANNEL".equals(context.get("payment_collection")),"Collecte OTA requise.");
        var p=scope();p.put("channel",context.get("source"));p.put("currency",context.get("currency"));
        return jdbc.queryForList("""
            SELECT r.id,r.total_price,p.name AS property_name,p.owner_id,
              r.total_price-COALESCE((SELECT sum(l.gross) FROM baitly_ota_settlement_lines l
                WHERE l.organization_id=r.organization_id AND l.reservation_id=r.id AND NOT EXISTS
                  (SELECT 1 FROM baitly_ota_settlement_voids v WHERE v.settlement_id=l.settlement_id)),0) AS remaining
            FROM reservations r JOIN properties p ON p.id=r.property_id AND p.organization_id=r.organization_id
            WHERE r.organization_id=:org AND r.payment_collection='CHANNEL' AND r.source=:channel AND r.currency=:currency
            ORDER BY r.id DESC
            """,p);
    }
    public List<Map<String,Object>> list(long reservationId,String subject) {
        actor(subject); var p=scope();p.put("reservation",reservationId);
        require(jdbc.queryForObject("SELECT count(*) FROM reservations WHERE id=:reservation AND organization_id=:org",p,Long.class)==1,
                "Réservation inaccessible.");
        return jdbc.queryForList("""
            SELECT s.id,s.ota_reference,s.bank_reference,s.beneficiary_name,s.currency,s.received_on,
                   l.gross,l.fees,l.refunds,l.net,v.reason AS void_reason,s.recorded_at
            FROM baitly_ota_settlements s JOIN baitly_ota_settlement_lines l ON l.settlement_id=s.id AND l.organization_id=s.organization_id
            LEFT JOIN baitly_ota_settlement_voids v ON v.settlement_id=s.id AND v.organization_id=s.organization_id
            WHERE s.organization_id=:org AND l.reservation_id=:reservation ORDER BY s.id DESC
            """,p);
    }
    @Transactional
    public long record(Request request,BaitlyFinancialDocument statement,BaitlyFinancialDocument bank,String subject) {
        long actor=actor(subject); var lines=validate(request);
        require(statement!=null && bank!=null && !statement.sha256().equals(bank.sha256()),"Deux justificatifs distincts sont requis : relevé OTA et réception bancaire.");
        var p=scope();p.put("ids",lines.stream().map(Line::reservationId).toList());
        // Ordre commun avec les autres opérations financières : les réservations sont figées avant les preuves.
        var stays=jdbc.queryForList("""
            SELECT r.id,r.source,r.total_price,r.currency,r.payment_collection,p.owner_id
            FROM reservations r JOIN properties p ON p.id=r.property_id AND p.organization_id=r.organization_id
            WHERE r.organization_id=:org AND r.id IN (:ids) ORDER BY r.id FOR UPDATE OF r
            """,p);
        require(stays.size()==lines.size(),"Une réservation est inaccessible.");
        String channel=Objects.toString(stays.getFirst().get("source"),"");
        require(!channel.isBlank() && channel.length()<=100,"Canal OTA absent.");
        String name;
        if(request.beneficiaryUserId()==null) {
            name=jdbc.queryForObject("SELECT name FROM organizations WHERE id=:org",p,String.class);
        } else {
            var recipient=users.findById(request.beneficiaryUserId()).orElseThrow(() -> new IllegalArgumentException("Bénéficiaire inconnu."));
            name=recipient.getFullName();
        }
        for(int i=0;i<stays.size();i++) {
            var stay=stays.get(i);var line=lines.get(i);
            require("CHANNEL".equals(stay.get("payment_collection")) && request.currency().equals(stay.get("currency"))
                    && channel.equals(stay.get("source")) && (request.beneficiaryUserId()==null
                        || (stay.get("owner_id") instanceof Number owner && Objects.equals(request.beneficiaryUserId(),owner.longValue()))),
                    "Canal, devise ou bénéficiaire incompatibles avec la réservation.");
        }
        p.put("request",request.requestId());p.put("ota",request.otaReference().trim());p.put("bankRef",request.bankReference().trim());
        p.put("channel",channel);p.put("currency",request.currency());p.put("recipient",request.beneficiaryUserId());p.put("name",name);
        p.put("received",request.receivedOn());p.put("net",lines.stream().map(Line::net).reduce(BigDecimal.ZERO,BigDecimal::add));
        p.put("actor",actor);p.put("statement",statement.bytes());p.put("statementMime",statement.mime());p.put("statementHash",statement.sha256());
        p.put("bank",bank.bytes());p.put("bankMime",bank.mime());p.put("bankHash",bank.sha256());
        p.put("fingerprint",fingerprint(request,lines,statement.sha256(),bank.sha256()));
        var existing=jdbc.queryForList("SELECT id,fingerprint FROM baitly_ota_settlements WHERE organization_id=:org AND request_id=:request",p);
        if(!existing.isEmpty()) {
            require(existing.getFirst().get("fingerprint").equals(p.get("fingerprint")),"Cette demande existe avec un contenu différent.");
            return ((Number)existing.getFirst().get("id")).longValue();
        }
        for(int i=0;i<lines.size();i++) {
            var line=lines.get(i);p.put("reservation",line.reservationId());
            BigDecimal used=jdbc.queryForObject("""
                SELECT COALESCE(sum(l.gross),0) FROM baitly_ota_settlement_lines l
                WHERE l.organization_id=:org AND l.reservation_id=:reservation
                  AND NOT EXISTS(SELECT 1 FROM baitly_ota_settlement_voids v WHERE v.settlement_id=l.settlement_id)
                """,p,BigDecimal.class);
            require(stays.get(i).get("total_price") instanceof BigDecimal total && used.add(line.gross()).compareTo(total)<=0,
                    "Le cumul rapproché dépasse le séjour. Vérifiez les versements précédents.");
        }
        long id=jdbc.queryForObject("""
            INSERT INTO baitly_ota_settlements(organization_id,request_id,channel,ota_reference,bank_reference,beneficiary_user_id,
              beneficiary_name,currency,received_on,net,statement,statement_mime,statement_sha256,bank_receipt,bank_mime,bank_sha256,recorded_by,fingerprint)
            VALUES(:org,:request,:channel,:ota,:bankRef,:recipient,:name,:currency,:received,:net,:statement,:statementMime,:statementHash,
              :bank,:bankMime,:bankHash,:actor,:fingerprint) RETURNING id
            """,p,Long.class);
        p.put("id",id);
        for(var line:lines) {
            p.put("reservation",line.reservationId());p.put("gross",line.gross());p.put("fees",line.fees());p.put("refunds",line.refunds());p.put("net",line.net());
            jdbc.update("INSERT INTO baitly_ota_settlement_lines VALUES(:id,:org,:reservation,:gross,:fees,:refunds,:net)",p);
        }
        return id;
    }
    @Transactional
    public void voidRecord(long id,String reason,String subject) {
        long actor=actor(subject);require(reason!=null && reason.trim().length()>=10 && reason.length()<=500,"Expliquez la correction en 10 à 500 caractères.");
        var p=scope();p.put("id",id);p.put("reason",reason.trim());p.put("actor",actor);
        var rows=jdbc.queryForList("SELECT id FROM baitly_ota_settlements WHERE id=:id AND organization_id=:org FOR UPDATE",p);
        require(rows.size()==1,"Rapprochement inaccessible.");
        jdbc.update("INSERT INTO baitly_ota_settlement_voids(settlement_id,organization_id,reason,recorded_by) VALUES(:id,:org,:reason,:actor) ON CONFLICT DO NOTHING",p);
    }
    public BaitlyFinancialDocument document(long id,boolean bank,String subject) {
        actor(subject);var p=scope();p.put("id",id);
        var rows=jdbc.queryForList("SELECT statement,bank_receipt FROM baitly_ota_settlements WHERE id=:id AND organization_id=:org",p);
        require(rows.size()==1,"Justificatif inaccessible.");
        return BaitlyFinancialDocument.checked((byte[])rows.getFirst().get(bank?"bank_receipt":"statement"));
    }
    static List<Line> validate(Request r) {
        require(r!=null && r.requestId()!=null && r.currency()!=null && r.currency().matches("[A-Z]{3}")
                && r.otaReference()!=null && !r.otaReference().isBlank() && r.otaReference().length()<=160
                && r.bankReference()!=null && !r.bankReference().isBlank() && r.bankReference().length()<=160
                && r.receivedOn()!=null && !r.receivedOn().isAfter(LocalDate.now()) && r.lines()!=null
                && !r.lines().isEmpty() && r.lines().size()<=100,"Versement incomplet ou date future.");
        require(Currency.getInstance(r.currency()).getDefaultFractionDigits()>=0,"Devise inconnue.");
        int decimals=Currency.getInstance(r.currency()).getDefaultFractionDigits();
        require(r.lines().stream().allMatch(l -> l!=null && l.reservationId()!=null && l.reservationId()>0
                && money(l.gross()) && money(l.fees()) && money(l.refunds()) && money(l.net()) && l.net().signum()>0
                && l.gross().subtract(l.fees()).subtract(l.refunds()).compareTo(l.net())==0),"La ventilation brut, frais, remboursements et net doit être exacte au centime.");
        require(r.lines().stream().flatMap(l -> java.util.stream.Stream.of(l.gross(),l.fees(),l.refunds(),l.net()))
                .allMatch(a -> a.stripTrailingZeros().scale()<=decimals),"Précision incompatible avec la devise.");
        require(r.lines().stream().map(Line::reservationId).distinct().count()==r.lines().size(),"Réservation en double.");
        return r.lines().stream().sorted(Comparator.comparing(Line::reservationId)).map(l -> new Line(l.reservationId(),
                l.gross().setScale(2),l.fees().setScale(2),l.refunds().setScale(2),l.net().setScale(2))).toList();
    }
    private static boolean money(BigDecimal amount) { return amount!=null && amount.signum()>=0 && amount.stripTrailingZeros().scale()<=2 && amount.precision()<=14; }
    private String fingerprint(Request r,List<Line> lines,String statement,String bank) {
        try {
            var canonical=new Request(r.requestId(),r.otaReference().trim(),r.bankReference().trim(),r.receivedOn(),r.currency(),r.beneficiaryUserId(),lines);
            return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(List.of(canonical,statement,bank))));
        } catch(java.io.IOException|java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private static void require(boolean value,String message) { if(!value) throw new IllegalArgumentException(message); }
}
