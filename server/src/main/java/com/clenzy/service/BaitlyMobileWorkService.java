package com.clenzy.service;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.exception.NotFoundException;
import com.clenzy.marketplace.repository.MarketplaceServiceItemRepository;
import com.clenzy.marketplace.service.*;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.data.domain.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
public class BaitlyMobileWorkService {
    private final InterventionRepository missions;
    private final InterventionAccessPolicy access;
    private final InterventionMapper mapper;
    private final InterventionLifecycleService lifecycle;
    private final InterventionProgressService progress;
    private final ProviderAccountResolver accounts;
    private final BaitlyNetworkService network;
    private final UserService users;
    private final MarketplaceServiceItemRepository items;
    private final com.clenzy.repository.InterventionPhotoRepository missionPhotos;
    private final PhotoStorageService photoStorage;
    private final BaitlyMissionWorkflow workflow;
    public BaitlyMobileWorkService(InterventionRepository missions,InterventionAccessPolicy access,InterventionMapper mapper,
        InterventionLifecycleService lifecycle,InterventionProgressService progress,ProviderAccountResolver accounts,
        BaitlyNetworkService network,UserService users,MarketplaceServiceItemRepository items,com.clenzy.repository.InterventionPhotoRepository missionPhotos,PhotoStorageService photoStorage,BaitlyMissionWorkflow workflow) {
        this.missions=missions;this.access=access;this.mapper=mapper;this.lifecycle=lifecycle;this.progress=progress;
        this.accounts=accounts;this.network=network;this.users=users;this.items=items;
        this.missionPhotos=missionPhotos;
        this.photoStorage=photoStorage;this.workflow=workflow;
    }
    public record Capabilities(boolean canViewOwnerSpace,boolean canQuote,boolean canExecuteAssignedMission,boolean canManagePrivateNetwork){}
    public record Room(String id,String type,int number){}
    public record Work(InterventionResponse mission,boolean canExecute,String executionMode,Long version,String accessInstructions,java.util.List<String> propertyPhotos,java.util.Map<String,Integer> stepPhotoCounts,java.util.List<Room> rooms,
        java.util.List<String> requiredSteps,String cleaningInstructions,String startedAt,String endedAt,String pausedAt,long pauseSeconds,java.util.List<String> validatedRoomIds,boolean canReview,
        String signatureStatus,String signerName,String technicianNotes,String materialsUsed){}
    @Transactional(readOnly=true)
    public Capabilities capabilities(Jwt jwt) {
        var user=users.findByKeycloakId(jwt.getSubject());
        if(user==null)throw new org.springframework.security.access.AccessDeniedException("Compte introuvable.");
        boolean manage=network.canManage(jwt.getSubject());
        boolean owner=manage || user.getRole()!=null && (user.getRole().isOwnerScoped() || user.getRole().isPlatformStaff());
        boolean provider=accounts.providerIdOrNull(jwt.getSubject())!=null;
        boolean field=provider || user.getRole()==UserRole.HOUSEKEEPER || user.getRole()==UserRole.TECHNICIAN
            || user.getRole()==UserRole.LAUNDRY || user.getRole()==UserRole.EXTERIOR_TECH || user.getRole()==UserRole.SUPERVISOR;
        return new Capabilities(owner,provider,field,manage);
    }
    @Transactional(readOnly=true)
    public Page<InterventionResponse> assigned(Jwt jwt,int page) {
        Long user=accounts.userIdOf(jwt.getSubject());
        if(user==null)throw new org.springframework.security.access.AccessDeniedException("Compte introuvable.");
        // Native query already scopes individual and team assignments across tenants.
        return missions.findByAssignedUserOrTeamWithFilters(user,null,null,null,null,
            PageRequest.of(Math.max(0,page),20),null,null,null).map(m -> {
                access.requireAssignee(m,jwt);return mapper.convertToListResponse(m,java.util.Map.of());
            });
    }
    @Transactional(readOnly=true)
    public Page<InterventionResponse> ownerMissions(Jwt jwt,int page,String status,Long org) {
        Long user=accounts.userIdOf(jwt.getSubject());
        if(user==null)throw new org.springframework.security.access.AccessDeniedException("Compte introuvable.");
        return missions.findBaitlyOwnerMissions(org,user,status==null?null:InterventionStatus.fromString(status),
            network.canManage(jwt.getSubject()),
            PageRequest.of(Math.max(0,page),20,Sort.by("scheduledDate").descending()))
            .map(m -> { access.assertCanAccess(m,jwt);return mapper.convertToListResponse(m,java.util.Map.of()); });
    }
    @Transactional(readOnly=true)
    public Work detail(Long id,Jwt jwt) {
        var mission=load(id);access.assertCanAccess(mission,jwt);
        boolean canExecute;
        try{access.requireAssignee(mission,jwt);canExecute=true;}catch(com.clenzy.exception.UnauthorizedException denied){canExecute=false;}
        String mode=mission.getServiceItemCode()==null ? "ON_SITE" : items.findByCode(mission.getServiceItemCode()).map(i->i.getExecutionMode()).orElse("ON_SITE");
        String instructions = canExecute && mission.getProperty()!=null ? mission.getProperty().getAccessInstructions() : null;
        var photos = mission.getProperty()==null ? java.util.List.<String>of() : mission.getProperty().getPhotos().stream()
            .sorted(java.util.Comparator.comparingInt(PropertyPhoto::getSortOrder))
            .limit(6).map(photo -> {
                if(photo.getExternalUrl()!=null && photo.getExternalUrl().startsWith("https://")) return photo.getExternalUrl();
                byte[] bytes=photo.getStorageKey()!=null?photoStorage.retrieve(photo.getStorageKey()):photo.getData();
                if(bytes==null || bytes.length==0) return null;
                String type=photo.getContentType();
                if(!java.util.Set.of("image/jpeg","image/png","image/webp").contains(type)) return null;
                return "data:"+type+";base64,"+java.util.Base64.getEncoder().encodeToString(bytes);
            }).filter(java.util.Objects::nonNull).toList();
        var counts = new java.util.HashMap<String,Integer>();
        for(var photo : missionPhotos.findAllByInterventionId(id,mission.getOrganizationId())) {
            String filename=photo.getOriginalFilename();
            String prefix="baitly-"+id+"-step-";
            if(filename!=null && filename.startsWith(prefix)) {
                String step=filename.substring(prefix.length()).split("-",2)[0];
                if(step.matches("[a-zA-Z_0-9]{1,40}") && (!step.startsWith("inspection") || photo.getPhase()==InterventionPhoto.PhotoPhase.BEFORE)) counts.merge(step,1,Integer::sum);
            } else if(photo.getPhase()==InterventionPhoto.PhotoPhase.BEFORE) counts.merge("inspection",1,Integer::sum);
            else if(photo.getPhase()==InterventionPhoto.PhotoPhase.AFTER) counts.merge("after_photos",1,Integer::sum);
        }
        String cleaning=mission.getProperty()==null?null:mission.getProperty().getCleaningNotes();
        return new Work(mapper.convertToResponse(mission),canExecute,mode,mission.getVersion(),instructions,photos,counts,inspectionRooms(mission.getProperty()),workflow.steps(mission,mode),cleaning,
            instant(mission.getStatus()==InterventionStatus.PENDING||mission.getStatus()==InterventionStatus.AWAITING_PAYMENT?null:mission.getStartTime()),instant(mission.getEndTime()),instant(mission.getBaitlyPausedAt()),mission.getBaitlyPauseSeconds(),workflow.validatedRoomIds(mission,inspectionRooms(mission.getProperty())),access.canReview(mission,jwt),
            mission.getBaitlySignatureStatus(),mission.getBaitlySignerName(),mission.getTechnicianNotes(),mission.getMaterialsUsed());
    }
    public InterventionResponse action(Long id,String action,Jwt jwt) {
        var mission=load(id);access.requireAssignee(mission,jwt);
        if("submit".equals(action))workflow.validate(mission,executionMode(mission),mission.getCompletedSteps(),true,inspectionRooms(mission.getProperty()));
        if(mission.getBaitlyPausedAt()!=null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Reprenez l’intervention avant de continuer.");
        return switch(action){
            case "accept" -> lifecycle.acceptAssignment(id,jwt);
            case "decline" -> lifecycle.declineAssignment(id,null,jwt);
            case "start" -> lifecycle.startIntervention(id,jwt);
            case "submit" -> lifecycle.submitForValidation(id,null,jwt);
            default -> throw new IllegalArgumentException("Action inconnue.");
        };
    }
    public InterventionResponse report(Long id,String notes,String completedSteps,Long expectedVersion,Jwt jwt) {
        var mission=load(id);access.requireAssignee(mission,jwt);
        if(mission.getBaitlyPausedAt()!=null) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Intervention en pause.");
        if(expectedVersion==null || !java.util.Objects.equals(expectedVersion,mission.getVersion()))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"Le rapport a changé. Relisez la version serveur.");
        workflow.validate(mission,executionMode(mission),completedSteps,false,inspectionRooms(mission.getProperty()));
        workflow.synchronizeRooms(mission,completedSteps,inspectionRooms(mission.getProperty()));
        progress.updateCompletedSteps(id,completedSteps,jwt);
        return progress.updateNotes(id,notes,jwt);
    }
    private Intervention load(Long id){return missions.findById(id).orElseThrow(()->new NotFoundException("Mission indisponible."));}
    private String executionMode(Intervention mission){return mission.getServiceItemCode()==null?"ON_SITE":items.findByCode(mission.getServiceItemCode()).map(i->i.getExecutionMode()).orElse("ON_SITE");}
    private String instant(java.time.LocalDateTime value){return value==null?null:value.atZone(java.time.ZoneId.systemDefault()).toInstant().toString();}
    private java.util.List<Room> inspectionRooms(Property property) {
        if(property==null) return java.util.List.of();
        var rooms=new java.util.ArrayList<Room>();
        for(int n=1;n<=(property.getBedroomCount()==null?0:property.getBedroomCount());n++) rooms.add(new Room("bedroom_"+n,"bedroom",n));
        for(int n=1;n<=(property.getBathroomCount()==null?0:property.getBathroomCount());n++) rooms.add(new Room("bathroom_"+n,"bathroom",n));
        // Same default composition as the PMS room-validation flow.
        rooms.add(new Room("living_1","living",1)); rooms.add(new Room("kitchen_1","kitchen",1));
        return rooms;
    }
}
