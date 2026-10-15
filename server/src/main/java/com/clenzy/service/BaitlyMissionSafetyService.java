package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;

@Service @Transactional
public class BaitlyMissionSafetyService {
    private final InterventionRepository missions;
    private final InterventionAccessPolicy access;
    private final TeamRepository teams;
    private final PropertyInventoryItemRepository inventory;
    private final BaitlyMobileIssueService issues;
    private final IssueRepository issueRecords;
    public BaitlyMissionSafetyService(InterventionRepository missions, InterventionAccessPolicy access, TeamRepository teams,
        PropertyInventoryItemRepository inventory, BaitlyMobileIssueService issues,IssueRepository issueRecords) {
        this.missions=missions;this.access=access;this.teams=teams;this.inventory=inventory;this.issues=issues;this.issueRecords=issueRecords;
    }
    public record Contact(String role,String name,String phone) {}
    public record Furniture(Long id,String name,String catalogKey,String photoUrl,String room) {}
    public record Incident(Long id,String title,String description,String status,LocalDateTime date,String cause,String room,Long furnitureId,String elementCategory,String elementCode,String elementName) {}
    public record State(String pausedAt,long pauseSeconds,List<Contact> contacts,List<Furniture> furniture,List<Incident> incidents,Long reportedIssueId) {}
    public record Damage(String cause,String room,Long furnitureId,String detail,String elementCategory,String elementCode,String elementName) {
        public Damage(String cause,String room,Long furnitureId,String detail){this(cause,room,furnitureId,detail,null,null,null);}
    }
    private Intervention load(Long id,Jwt jwt,boolean lock) {
        var mission=missions.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        if(lock) access.requireAssignee(mission,jwt); else access.assertCanAccess(mission,jwt);
        return lock ? missions.findForReview(id,mission.getOrganizationId()).orElseThrow() : mission;
    }
    @Transactional(readOnly=true)
    public State state(Long id,Jwt jwt) {
        var m=load(id,jwt,false);var contacts=new ArrayList<Contact>();var furniture=new ArrayList<Furniture>();
        if(m.getProperty()!=null) {
            var p=m.getProperty();
            if(p.getOwner()!=null) contact(contacts,"owner",p.getOwner().getFirstName(),p.getOwner().getPhoneNumber());
            contact(contacts,"concierge",p.getName(),p.getEmergencyPhone());
            inventory.findBaitlyMissionInventory(p.getId(),p.getOrganizationId()).stream()
                .filter(item->Objects.equals(item.getOrganizationId(),p.getOrganizationId()))
                .forEach(item->furniture.add(new Furniture(item.getId(),item.getName(),item.getCatalogKey(),item.getPhotoUrl(),item.getCategory())));
        }
        if(m.getTeamId()!=null) teams.findById(m.getTeamId()).filter(team->Objects.equals(team.getOrganizationId(),m.getOrganizationId()))
            .ifPresent(team->team.getMembers().stream().map(TeamMember::getUser).filter(Objects::nonNull)
                .filter(user->user.getRole()==UserRole.SUPERVISOR)
                .forEach(user->contact(contacts,"supervisor",user.getFirstName(),user.getPhoneNumber())));
        var incidents=issueRecords.findBySourceInterventionIdAndOrganizationIdOrderByCreatedAtDesc(id,m.getOrganizationId()).stream()
            .map(i->new Incident(i.getId(),i.getTitle(),i.getDescription(),i.getStatus().name(),i.getCreatedAt(),i.getBaitlyDamageCause(),i.getBaitlyDamageRoom(),i.getBaitlyDamageItemId(),i.getBaitlyDamageElementCategory(),i.getBaitlyDamageElementCode(),i.getBaitlyDamageElementName())).toList();
        String paused=m.getBaitlyPausedAt()==null?null:m.getBaitlyPausedAt().atZone(ZoneId.systemDefault()).toInstant().toString();
        return new State(paused,m.getBaitlyPauseSeconds(),contacts,furniture,incidents,null);
    }
    private void contact(List<Contact> list,String role,String name,String phone) {
        if(phone!=null && phone.matches("[+0-9 () .-]{5,30}")) list.add(new Contact(role,name,phone));
    }
    public State pause(Long id,Jwt jwt,boolean resume) {
        var m=load(id,jwt,true);
        if(m.getStatus()!=InterventionStatus.IN_PROGRESS) throw new ResponseStatusException(HttpStatus.CONFLICT,"Mission non démarrée.");
        if(resume && m.getBaitlyPausedAt()!=null) {
            m.setBaitlyPauseSeconds(m.getBaitlyPauseSeconds()+Math.max(0,Duration.between(m.getBaitlyPausedAt(),LocalDateTime.now()).getSeconds()));
            m.setBaitlyPausedAt(null);
        } else if(!resume && m.getBaitlyPausedAt()==null) m.setBaitlyPausedAt(LocalDateTime.now());
        missions.saveAndFlush(m);return state(id,jwt);
    }
    public State damage(Long id,Damage body,Jwt jwt) {
        var m=load(id,jwt,true);
        if(m.getProperty()==null || body==null || !Set.of("unknown","wear","breakage","leak","missing").contains(body.cause()==null?"":body.cause()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Cause invalide.");
        String room=body.room();
        boolean validRoom=room!=null && (room.equals("living_1") || room.equals("kitchen_1") ||
            java.util.stream.IntStream.rangeClosed(1,Optional.ofNullable(m.getProperty().getBedroomCount()).orElse(0)).anyMatch(n->room.equals("bedroom_"+n)) ||
            java.util.stream.IntStream.rangeClosed(1,Optional.ofNullable(m.getProperty().getBathroomCount()).orElse(0)).anyMatch(n->room.equals("bathroom_"+n)));
        if(!validRoom || body.detail()!=null && body.detail().length()>1000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Pièce ou détail invalide.");
        String category=Optional.ofNullable(body.elementCategory()).orElse("other");
        if(!Set.of("inventory","appliance","furniture","electronics","surface","other").contains(category)
            || body.elementCode()!=null && !body.elementCode().matches("[a-zA-Z0-9:_-]{1,80}")
            || body.elementName()!=null && (body.elementName().isBlank() || body.elementName().length()>150)
            || category.equals("surface") && !Set.of("wall","ceiling","floor").contains(body.elementCode()==null?"":body.elementCode()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Élément invalide.");
        String item=Optional.ofNullable(body.elementName()).orElse("Autre élément");
        if(body.furnitureId()!=null) {
            var found=inventory.findBaitlyMissionItem(body.furnitureId(),m.getProperty().getId(),m.getProperty().getOrganizationId()).orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST));
            if(!Objects.equals(found.getOrganizationId(),m.getProperty().getOrganizationId())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
            item=found.getName();
            category="inventory";
        }
        String causeLabel=Map.of("unknown","À déterminer","wear","Usure","breakage","Casse","leak","Fuite","missing","Manquant").get(body.cause());
        String roomLabel=room.startsWith("bedroom_")?"Chambre "+room.substring(8):room.startsWith("bathroom_")?"Salle de bain "+room.substring(9):room.equals("living_1")?"Salon":"Cuisine";
        var saved=issues.report(id,"Dégât : "+item.substring(0,Math.min(item.length(),130)),
            "Cause déclarée : "+causeLabel+"\nPièce : "+roomLabel+"\nÉlément : "+item+"\n"+Optional.ofNullable(body.detail()).orElse(""),jwt);
        var issue=issueRecords.findById(saved.get("id")).orElseThrow();
        issue.setBaitlyDamageCause(body.cause());issue.setBaitlyDamageRoom(room);issue.setBaitlyDamageItemId(body.furnitureId());
        issue.setBaitlyDamageElementCategory(category);issue.setBaitlyDamageElementCode(body.elementCode());issue.setBaitlyDamageElementName(item.substring(0,Math.min(150,item.length())));
        issueRecords.save(issue);
        if(m.getBaitlyPausedAt()==null) m.setBaitlyPausedAt(LocalDateTime.now());
        missions.saveAndFlush(m);var state=state(id,jwt);
        return new State(state.pausedAt(),state.pauseSeconds(),state.contacts(),state.furniture(),state.incidents(),saved.get("id"));
    }
}
