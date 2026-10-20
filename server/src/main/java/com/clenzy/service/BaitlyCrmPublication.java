package com.clenzy.service;

import com.clenzy.marketplace.service.BaitlyPublicProfiles;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;

/** CRM publication reuses the existing profile and property visibility controls. */
@Service
@Transactional
public class BaitlyCrmPublication {
    private final BaitlyCrmAccess access;
    private final BaitlyPublicProfiles profiles;
    private final JdbcTemplate db;
    public BaitlyCrmPublication(BaitlyCrmAccess access,BaitlyPublicProfiles profiles,JdbcTemplate db) {
        this.access=access;this.profiles=profiles;this.db=db;
    }
    @Transactional(readOnly=true)
    public Map<String,Object> own(String subject) {
        long org=access.require(subject);
        boolean available=isConcierge(org);
        return Map.of("available",available,"profile",available?profiles.own(subject).orElseGet(Map::of):Map.of());
    }
    public Map<String,Object> publish(BaitlyPublicProfiles.Publish command,String subject) {
        long org=access.lock(subject);
        if(!isConcierge(org))throw new AccessDeniedException("Organisation conciergerie requise");
        return profiles.publish(command,subject);
    }
    private boolean isConcierge(long org) {
        return BaitlyCrmOrganizationRules.concierge(db.queryForObject("SELECT type FROM organizations WHERE id=?",String.class,org),access.isPlatformStaff());
    }
}
