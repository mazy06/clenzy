package com.clenzy.service;

import com.clenzy.model.User;
import com.clenzy.model.UserStatus;
import com.clenzy.repository.OrganizationMemberRepository;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.time.LocalDate;

@Service
@Transactional
public class BaitlyCrmDetails {
    private final JdbcTemplate db;
    private final BaitlyCrmAccess access;
    private final OrganizationMemberRepository members;
    private final PermissionService permissions;
    private final UserAvatarUrlResolver avatars;
    public BaitlyCrmDetails(JdbcTemplate db,BaitlyCrmAccess access,OrganizationMemberRepository members,PermissionService permissions,UserAvatarUrlResolver avatars){this.db=db;this.access=access;this.members=members;this.permissions=permissions;this.avatars=avatars;}
    public record Details(Long assignedUserId,@Size(max=255) String companyName,@Size(max=150) String jobTitle,
        @Size(max=150) String specificRole,@Size(max=150) String region,
        @NotBlank @Pattern(regexp="TO_QUALIFY|QUALIFIED|UNQUALIFIED") String qualification) {}
    public record Assignee(long id,String name,String profilePictureUrl) {}
    public record FollowUp(@PastOrPresent LocalDate lastExchangeOn, @Size(max=400) String nextAction, LocalDate nextActionOn) {}
    @Transactional(readOnly=true)
    public List<Assignee> assignees(String actor){return eligible(access.require(actor)).values().stream().toList();}
    @Transactional(readOnly=true)
    public List<Map<String,Object>> list(String actor){
        long org=access.require(actor);var team=eligible(org);
        var rows=db.queryForList("""
            SELECT p.id AS prospect_id,d.assigned_user_id,d.company_name,d.job_title,d.specific_role,d.region,
              d.last_exchange_on,d.next_action,d.next_action_on,
              coalesce(d.qualification,'TO_QUALIFY') AS qualification,coalesce(d.updated_at,p.updated_at,p.created_at) AS updated_at,
              (CASE WHEN p.normalized_email IS NOT NULL THEN 1 ELSE 0 END
               + CASE WHEN p.normalized_phone IS NOT NULL THEN 1 ELSE 0 END
               + CASE WHEN nullif(btrim(p.city),'') IS NOT NULL THEN 1 ELSE 0 END
               + CASE WHEN p.source_type<>'LEGACY' AND nullif(btrim(p.source_detail),'') IS NOT NULL THEN 1 ELSE 0 END
               + CASE WHEN d.qualification='QUALIFIED' THEN 1 ELSE 0 END) AS score
            FROM prospects p LEFT JOIN baitly_crm_contact_details d ON d.organization_id=p.organization_id AND d.prospect_id=p.id
            WHERE p.organization_id=? AND p.archived=false ORDER BY p.id DESC
            """,org);
        rows.forEach(row->{
            var id=(Number)row.get("assigned_user_id");var member=id==null?null:team.get(id.longValue());
            row.put("assigned_user_name",member==null?null:member.name());row.put("assignee_unavailable",id!=null&&member==null);
            row.put("assigned_user_avatar_url",member==null?null:member.profilePictureUrl());
        });return rows;
    }
    public void saveFollowUp(String actor,long id,FollowUp followUp){
        long org=access.lock(actor);
        if(db.queryForList("SELECT id FROM prospects WHERE organization_id=? AND id=? AND archived=false",org,id).isEmpty())throw new AccessDeniedException("Contact inaccessible");
        String action=BaitlyCrmIdentity.text(followUp.nextAction(),400);
        if((action==null||action.isBlank())!=(followUp.nextActionOn()==null))throw new IllegalArgumentException("Renseignez une action et son échéance ensemble");
        if(followUp.lastExchangeOn()!=null&&followUp.lastExchangeOn().isAfter(LocalDate.now()))throw new IllegalArgumentException("La date du dernier échange ne peut pas être future");
        db.update("""
            INSERT INTO baitly_crm_contact_details(organization_id,prospect_id,last_exchange_on,next_action,next_action_on,recorded_by)
            VALUES(?,?,?,?,?,?) ON CONFLICT(organization_id,prospect_id) DO UPDATE SET
              last_exchange_on=excluded.last_exchange_on,next_action=excluded.next_action,next_action_on=excluded.next_action_on,
              recorded_by=excluded.recorded_by,updated_at=now()
            """,org,id,followUp.lastExchangeOn(),action,followUp.nextActionOn(),actor);
    }
    public void save(String actor,long id,Details details){
        long org=access.lock(actor);
        if(db.queryForList("SELECT id FROM prospects WHERE organization_id=? AND id=? AND archived=false",org,id).isEmpty())throw new AccessDeniedException("Contact inaccessible");
        if(details.assignedUserId()!=null&&!eligible(org).containsKey(details.assignedUserId()))throw new AccessDeniedException("Responsable indisponible dans cette organisation");
        if(!"TO_QUALIFY".equals(details.qualification())&&!"QUALIFIED".equals(details.qualification())&&!"UNQUALIFIED".equals(details.qualification()))throw new IllegalArgumentException("Qualification invalide");
        db.update("""
            INSERT INTO baitly_crm_contact_details(organization_id,prospect_id,assigned_user_id,company_name,job_title,specific_role,region,qualification,recorded_by)
            VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,prospect_id) DO UPDATE SET
              assigned_user_id=excluded.assigned_user_id,company_name=excluded.company_name,job_title=excluded.job_title,
              specific_role=excluded.specific_role,region=excluded.region,qualification=excluded.qualification,
              recorded_by=excluded.recorded_by,updated_at=now()
            """,org,id,details.assignedUserId(),BaitlyCrmIdentity.text(details.companyName(),255),BaitlyCrmIdentity.text(details.jobTitle(),150),
            BaitlyCrmIdentity.text(details.specificRole(),150),BaitlyCrmIdentity.text(details.region(),150),details.qualification(),actor);
    }
    private Map<Long,Assignee> eligible(long org){
        var result=new LinkedHashMap<Long,Assignee>();
        // JPA decrypts names through EncryptedFieldConverter. Never read raw users.first_name via JDBC.
        members.findByOrganizationIdWithUser(org).stream().map(member->member.getUser()).filter(Objects::nonNull)
            .filter(user->user.getStatus()==UserStatus.ACTIVE&&user.getKeycloakId()!=null&&permissions.checkUserPermission(user.getKeycloakId(),"baitly-crm:view"))
            .sorted(Comparator.comparing(User::getFullName,String.CASE_INSENSITIVE_ORDER)).forEach(user->result.put(user.getId(),new Assignee(user.getId(),user.getFullName(),avatars.publicUrl(user.getId(),user.getProfilePictureUrl()))));
        return result;
    }
}
