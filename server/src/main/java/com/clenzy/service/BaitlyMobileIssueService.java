package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.exception.NotFoundException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
@Service @Transactional
public class BaitlyMobileIssueService {
    private final InterventionRepository missions;private final IssueRepository issues;
    private final InterventionAccessPolicy access;private final UserRepository users;
    private final NotificationService notifications;
    public BaitlyMobileIssueService(InterventionRepository missions,IssueRepository issues,InterventionAccessPolicy access,UserRepository users,NotificationService notifications){
        this.missions=missions;this.issues=issues;this.access=access;this.users=users;this.notifications=notifications;
    }
    public Map<String,Long> report(Long id,String title,String description,Jwt jwt) {
        var mission=missions.findById(id).orElseThrow(()->new NotFoundException("Mission indisponible."));
        access.requireAssignee(mission,jwt);
        if(mission.getProperty()==null || mission.getStatus()!=InterventionStatus.IN_PROGRESS)throw new IllegalArgumentException("Le signalement nécessite une mission sur site en cours.");
        if(title==null || title.isBlank() || title.length()>150 || description==null || description.length()>4000)throw new IllegalArgumentException("Signalement invalide.");
        var actor=users.findByKeycloakId(jwt.getSubject()).orElseThrow();
        var issue=new Issue();issue.setOrganizationId(mission.getOrganizationId());issue.setPropertyId(mission.getProperty().getId());
        issue.setSourceInterventionId(id);issue.setReportedBy(actor.getId());issue.setTitle(title.strip());issue.setDescription(description.strip());
        issue.setSeverity(Issue.IssueSeverity.MEDIUM);issue.setStatus(Issue.IssueStatus.OPEN);issue=issues.saveAndFlush(issue);
        notifications.notifyAdminsAndManagersByOrgId(mission.getOrganizationId(),NotificationKey.ISSUE_REPORTED,
            "Anomalie signalée","Une anomalie a été signalée sur une mission.","/interventions/"+id,Map.of("interventionId",id));
        return Map.of("id",issue.getId());
    }
}
