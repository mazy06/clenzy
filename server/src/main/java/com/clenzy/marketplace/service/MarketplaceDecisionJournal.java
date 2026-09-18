package com.clenzy.marketplace.service;

import com.clenzy.model.*;
import com.clenzy.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.data.domain.*;

@Service
public class MarketplaceDecisionJournal {
    private static final String ENTITY = "MarketplaceProvider";
    private final AuditLogRepository entries;
    public MarketplaceDecisionJournal(AuditLogRepository entries) { this.entries=entries; }

    /** Même transaction que la décision : aucun événement déclaré avant son commit. */
    @Transactional(propagation=Propagation.MANDATORY)
    public void record(Long providerId, String kind, String before, String after, String actor) {
        if (actor==null) {
            var auth=SecurityContextHolder.getContext().getAuthentication();
            if(auth!=null && auth.getPrincipal() instanceof Jwt jwt) actor=jwt.getSubject();
        }
        var entry=new AuditLog(AuditAction.UPDATE,ENTITY,providerId.toString());
        entry.setUserId(actor); entry.setSource(AuditSource.WEB);
        entry.setOldValue(before); entry.setNewValue(after); entry.setDetails(kind);
        // Journal plateforme : pas d'identité candidat, pièce ou secret dans les instantanés.
        entries.save(entry);
    }
    public record Decision(Long id, java.time.Instant at, String actor, String kind, String before, String after) {}
    @Transactional(readOnly=true)
    public Page<Decision> list(Long providerId,int page) {
        return entries.findByEntityTypeAndEntityIdOrderByTimestampDesc(ENTITY,providerId.toString(),PageRequest.of(Math.max(0,page),25))
            .map(e -> new Decision(e.getId(),e.getTimestamp(),e.getUserId(),e.getDetails(),e.getOldValue(),e.getNewValue()));
    }
}

