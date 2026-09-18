package com.clenzy.service.assignment;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.time.*;

/** Consentement de sollicitation, distinct du calendrier canonique de disponibilité. */
@Service
public class AssignmentContactPreferences {
    public record Preferences(int fromHour,int untilHour,boolean criticalOnCall) {
        public Preferences {
            if (fromHour<0 || untilHour>24 || fromHour>=untilHour) throw new IllegalArgumentException("Plage de contact invalide");
        }
        boolean allows(Instant now,boolean critical,String timezone) {
            if (critical && criticalOnCall) return true;
            int hour=now.atZone(ZoneId.of(timezone)).getHour();
            return hour>=fromHour && hour<untilHour;
        }
    }
    private final JdbcTemplate db;
    public AssignmentContactPreferences(JdbcTemplate db) { this.db=db; }
    private java.util.Optional<Preferences> stored(Long user) {
        return db.query("SELECT from_hour,until_hour,critical_on_call FROM service_assignment_contact_preferences WHERE user_id=?",
                (r,n) -> new Preferences(r.getInt(1),r.getInt(2),r.getBoolean(3)),user).stream().findFirst();
    }
    public boolean isConfigured(Long user) { return stored(user).isPresent(); }
    /** Prochaine minute autorisée, calculée sans requête dans la boucle. */
    public java.util.Optional<Instant> nextAllowed(String kind,Long target,AssignmentPolicyStore.Policy policy,boolean critical,Instant now) {
        var users="user".equals(kind)?java.util.List.of(target):db.queryForList(
                "SELECT user_id FROM team_members WHERE team_id=? ORDER BY user_id",Long.class,target);
        if (users.isEmpty()) return java.util.Optional.empty();
        record Contact(Preferences preferences,String zone) {}
        var contacts=users.stream().map(user -> new Contact(get(user),timezone(user,policy.timezone()))).toList();
        Instant minute=now.truncatedTo(java.time.temporal.ChronoUnit.MINUTES).plusSeconds(60);
        for (int n=0;n<8*24*60;n++,minute=minute.plusSeconds(60)) {
            Instant candidate=minute;
            if (contacts.stream().allMatch(c -> critical && c.preferences().criticalOnCall()
                    || policy.contactAllowed(candidate) && c.preferences().allows(candidate,critical,c.zone())))
                return java.util.Optional.of(candidate);
        }
        return java.util.Optional.empty();
    }
    public Preferences get(Long user) { return stored(user).orElse(new Preferences(8,20,false)); }
    public Preferences save(Long user,Preferences value) {
        db.update("""
            INSERT INTO service_assignment_contact_preferences(user_id,from_hour,until_hour,critical_on_call)
            VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
            from_hour=EXCLUDED.from_hour,until_hour=EXCLUDED.until_hour,critical_on_call=EXCLUDED.critical_on_call
            """,user,value.fromHour(),value.untilHour(),value.criticalOnCall());
        return value;
    }
    private String timezone(Long user,String fallback) {
        return db.queryForList("SELECT p.timezone FROM user_preferences p JOIN users u ON u.keycloak_id=p.keycloak_id WHERE u.id=?",String.class,user)
                .stream().findFirst().orElse(fallback);
    }
    public boolean allowed(String kind,Long target,AssignmentPolicyStore.Policy policy,boolean critical,Instant now) {
        var users="user".equals(kind)?java.util.List.of(target):db.queryForList(
                "SELECT user_id FROM team_members WHERE team_id=? ORDER BY user_id",Long.class,target);
        if (users.isEmpty()) return false;
        return users.stream().allMatch(user -> {
            var p=get(user);
            return critical && p.criticalOnCall()
                    || policy.contactAllowed(now) && p.allows(now,critical,timezone(user,policy.timezone()));
        });
    }
}
