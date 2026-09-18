package com.clenzy.service.assignment;

import com.clenzy.model.NotificationKey;
import com.clenzy.repository.*;
import com.clenzy.service.NotificationService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.*;

/** Les intentions et leur acquittement sont durables, sans envoi depuis la mutation d'attribution. */
@Service
public class AssignmentNotificationDelivery {
    private final JdbcTemplate db;
    private final ServiceRequestRepository needs;
    private final AssignmentProposalStore proposals;
    private final NotificationService notifications;
    private final Clock clock;
    public AssignmentNotificationDelivery(JdbcTemplate db,ServiceRequestRepository needs,AssignmentProposalStore proposals,NotificationService notifications,Clock clock) {
        this.db=db; this.needs=needs; this.proposals=proposals; this.notifications=notifications; this.clock=clock;
    }
    @Transactional
    public void send(Long id) {
        var rows=db.queryForList("SELECT * FROM service_assignment_notifications WHERE id=? AND sent_at IS NULL FOR UPDATE SKIP LOCKED",id);
        if (rows.isEmpty()) return;
        var row=rows.getFirst();
        var need=needs.findById(((Number)row.get("request_id")).longValue()).orElseThrow();
        String kind=(String)row.get("kind");
        Long proposalId=row.get("proposal_id")==null?null:((Number)row.get("proposal_id")).longValue();
        var proposal=proposalId==null?null:proposals.get(proposalId).orElse(null);
        boolean prompt=Set.of("PROPOSED","REMINDER").contains(kind);
        boolean stale=prompt && (proposal==null || !"PENDING".equals(proposal.status()) || !clock.instant().isBefore(proposal.expiresAt()));
        if (!stale) {
            var recipients=new LinkedHashMap<String,Map<String,Object>>();
            if (proposal!=null) {
                var targets="user".equals(proposal.targetType())
                    ? db.queryForList("SELECT keycloak_id,organization_id FROM users WHERE id=? AND keycloak_id IS NOT NULL",proposal.targetId())
                    : db.queryForList("SELECT DISTINCT u.keycloak_id,u.organization_id FROM users u JOIN team_members m ON m.user_id=u.id WHERE m.team_id=? AND u.keycloak_id IS NOT NULL",proposal.targetId());
                for (var recipient:targets) { recipient.put("action_url",need.getConvertedInterventionId()!=null?"/interventions/"+need.getConvertedInterventionId():"/interventions?tab=service-requests&scope=inbox"); recipients.put((String)recipient.get("keycloak_id"),recipient); }
            }
            if (!prompt) {
                var managers=db.queryForList("SELECT keycloak_id,organization_id FROM users WHERE organization_id=? AND role IN ('SUPER_ADMIN','SUPER_MANAGER') AND keycloak_id IS NOT NULL",need.getOrganizationId());
                for (var recipient:managers) { recipient.put("action_url","/service-requests/"+need.getId()); recipients.put((String)recipient.get("keycloak_id"),recipient); }
                if (need.getUser()!=null && need.getUser().getKeycloakId()!=null) {
                    var requester=db.queryForList("SELECT keycloak_id,organization_id FROM users WHERE id=? AND keycloak_id IS NOT NULL",need.getUser().getId());
                    for (var recipient:requester) { recipient.put("action_url","/service-requests/"+need.getId()); recipients.put((String)recipient.get("keycloak_id"),recipient); }
                }
            }
            for (var recipient:recipients.values()) {
                Long recipientOrg=recipient.get("organization_id") instanceof Number value?value.longValue():need.getOrganizationId();
                String language=db.queryForList("SELECT language FROM user_preferences WHERE keycloak_id=?",String.class,recipient.get("keycloak_id"))
                        .stream().findFirst().orElse("fr");
                var copy=ResourceBundle.getBundle("assignment_notifications",Locale.forLanguageTag(
                        Set.of("fr","en","ar").contains(language)?language:"fr"),ResourceBundle.Control.getNoFallbackControl(ResourceBundle.Control.FORMAT_PROPERTIES));
                String title=copy.getString(copy.containsKey(kind)?kind:"ACTION");
                String message=copy.getString(prompt?"PROMPT_MESSAGE":"FOLLOWUP_MESSAGE");
                notifications.sendByOrgIdStrict((String)recipient.get("keycloak_id"),NotificationKey.SERVICE_REQUEST_TEAM_ASSIGNED,
                    title,message,(String)recipient.get("action_url"),recipientOrg,
                    Map.of("serviceRequestId",need.getId()));
            }
        }
        db.update("UPDATE service_assignment_notifications SET sent_at=CURRENT_TIMESTAMP,attempts=attempts+1 WHERE id=?",id);
    }
}
