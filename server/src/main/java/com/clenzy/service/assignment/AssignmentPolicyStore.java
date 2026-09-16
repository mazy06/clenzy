package com.clenzy.service.assignment;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.time.*;

@Service
public class AssignmentPolicyStore {
    public record Policy(boolean enabled, boolean publicSearch, String timezone, int contactFromHour,
                         int contactUntilHour, AssignmentDeadlinePolicy.Settings deadlines) {
        public Policy {
            ZoneId.of(timezone);
            if (contactFromHour < 0 || contactUntilHour > 24 || contactFromHour >= contactUntilHour || deadlines == null)
                throw new IllegalArgumentException("Plage de sollicitation invalide");
        }
        public static Policy defaults() {
            return new Policy(true, true, "Europe/Paris", 8, 20, AssignmentDeadlinePolicy.Settings.defaults());
        }
        public boolean contactAllowed(Instant now) {
            int hour = now.atZone(ZoneId.of(timezone)).getHour();
            return hour >= contactFromHour && hour < contactUntilHour;
        }
    }
    private final JdbcTemplate db;
    private final ObjectMapper json;
    public AssignmentPolicyStore(JdbcTemplate db, ObjectMapper json) { this.db=db; this.json=json; }
    public Policy get(Long org) {
        return db.queryForList("SELECT settings FROM service_assignment_policies WHERE organization_id=?", String.class, org)
            .stream().findFirst().map(this::read).orElseGet(Policy::defaults);
    }
    public Policy save(Long org, Policy policy) {
        db.update("INSERT INTO service_assignment_policies(organization_id,settings) VALUES (?,?) ON CONFLICT(organization_id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=CURRENT_TIMESTAMP",org,snapshot(policy));
        return policy;
    }
    public String snapshot(Policy policy) {
        try { return json.writeValueAsString(policy); }
        catch (Exception ex) { throw new IllegalStateException("Politique d'attribution illisible", ex); }
    }
    private Policy read(String value) {
        try { return json.readValue(value, Policy.class); }
        catch (Exception ex) { throw new IllegalStateException("Politique d'attribution invalide", ex); }
    }
}
