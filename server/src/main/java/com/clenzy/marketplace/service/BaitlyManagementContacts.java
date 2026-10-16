package com.clenzy.marketplace.service;
import com.clenzy.marketplace.model.BaitlyManagementContact;
import com.clenzy.marketplace.repository.*;
import com.clenzy.tenant.TenantContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service @Transactional
public class BaitlyManagementContacts {
    private final BaitlyPublicProfileRepository profiles;
    private final BaitlyManagementContactRepository contacts;
    private final ProviderAccountResolver accounts;
    private final TenantContext tenant;
    private final JdbcTemplate db;
    private final Clock clock;
    public BaitlyManagementContacts(BaitlyPublicProfileRepository profiles, BaitlyManagementContactRepository contacts,
        ProviderAccountResolver accounts, TenantContext tenant, JdbcTemplate db, Clock clock) {
        this.profiles=profiles; this.contacts=contacts; this.accounts=accounts; this.tenant=tenant; this.db=db; this.clock=clock;
    }
    public Map<String,Object> create(UUID target, String message, String subject) {
        Long user=accounts.userIdOf(subject), org=tenant.getRequiredOrganizationId();
        if(user==null) throw new AccessDeniedException("Compte indisponible");
        var profile=profiles.findById(target).filter(p -> p.published && (p.role.equals("CONCIERGE") || p.seekingManagement))
            .orElseThrow(() -> new IllegalArgumentException("Profil de contact indisponible"));
        if(profile.authorUserId.equals(user)) throw new IllegalArgumentException("Vous ne pouvez pas vous contacter");
        if(db.queryForObject("SELECT count(*) FROM baitly_management_contacts WHERE sender_user_id=? AND created_at>?",Long.class,user,java.sql.Timestamp.from(clock.instant().minus(Duration.ofDays(1))))>=20)
            throw new IllegalStateException("Limite quotidienne de demandes atteinte");
        var contact=new BaitlyManagementContact(); contact.id=UUID.randomUUID(); contact.targetProfileId=target;
        contact.senderUserId=user; contact.senderOrganizationId=org; contact.message=message.trim(); contact.createdAt=clock.instant();
        contacts.saveAndFlush(contact);
        return Map.of("id",contact.id,"status","RECORDED");
    }
    @Transactional(readOnly=true)
    public List<Map<String,Object>> own(String subject) {
        Long user=accounts.userIdOf(subject), org=tenant.getRequiredOrganizationId();
        if(user==null) throw new AccessDeniedException("Compte indisponible");
        return db.queryForList("""
            SELECT c.id,c.message,c.created_at,p.name AS profile_name,p.hide_last_name,
                CASE WHEN c.sender_user_id=? THEN 'SENT' ELSE 'RECEIVED' END AS side
            FROM baitly_management_contacts c JOIN baitly_public_profiles p ON p.id=c.target_profile_id
            WHERE (c.sender_user_id=? AND c.sender_organization_id=?) OR (p.author_user_id=? AND p.organization_id=?)
            ORDER BY c.created_at DESC LIMIT 100
            """,user,user,org,user,org).stream().map(row -> {
                row.put("profile_name",BaitlyPublicNames.display((String)row.get("profile_name"),Boolean.TRUE.equals(row.remove("hide_last_name"))));
                return row;
            }).toList();
    }
}
