package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.smartlock.SmartLockCodeProvisioner;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;
@Service
public class BaitlyMissionDoorAccessService {
    private final InterventionRepository missions;private final InterventionAccessPolicy access;private final SmartLockDeviceRepository devices;
    private final BaitlyInterventionDoorCodeRepository codes;private final SmartLockCodeProvisioner provider;private final TransactionTemplate tx;private final Clock clock;
    public BaitlyMissionDoorAccessService(InterventionRepository missions,InterventionAccessPolicy access,SmartLockDeviceRepository devices,BaitlyInterventionDoorCodeRepository codes,SmartLockCodeProvisioner provider,org.springframework.transaction.PlatformTransactionManager manager,Clock clock){this.missions=missions;this.access=access;this.devices=devices;this.codes=codes;this.provider=provider;this.tx=new TransactionTemplate(manager);this.clock=clock;}
    public record Door(Long deviceId,String name,String status,String code,String validFrom,String validUntil){}
    private record Plan(SmartLockDevice device,Long missionId,Long propertyId,Long orgId,BaitlyInterventionDoorCode code,ZoneId zone,boolean create){}
    private Intervention mission(Long id,Jwt jwt){
        var m=missions.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));access.requireAssignee(m,jwt);
        if(m.getProperty()==null || !Set.of(InterventionStatus.PENDING,InterventionStatus.AWAITING_PAYMENT,InterventionStatus.IN_PROGRESS).contains(m.getStatus()) || m.getAssignmentResponse()==InterventionAssignmentResponse.PENDING || m.getAssignmentResponse()==InterventionAssignmentResponse.DECLINED)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Accès indisponible pour cette intervention.");
        return m;
    }
    private ZoneId zone(Property p){try{return ZoneId.of(p.getTimezone());}catch(Exception ignored){return ZoneId.of("Europe/Paris");}}
    public List<Door> list(Long id,Jwt jwt){return tx.execute(s->{var m=mission(id,jwt);var p=m.getProperty();var zone=zone(p);return devices.findBaitlyMissionLocks(p.getId(),p.getOrganizationId()).stream().map(d->door(d,codes.findBound(id,d.getId(),p.getOrganizationId(),p.getId()).orElse(null),zone)).toList();});}
    private Door door(SmartLockDevice d,BaitlyInterventionDoorCode code,ZoneId zone){
        if(code==null)return new Door(d.getId(),d.getName(),"NOT_PREPARED",null,null,null);
        var now=LocalDateTime.ofInstant(clock.instant(),zone);String status=code.getStatus();
        if("ACTIVE".equals(status)){if(now.isBefore(code.getValidFrom()))status="SCHEDULED";else if(!now.isBefore(code.getValidUntil()))status="EXPIRED";}
        return new Door(d.getId(),d.getName(),status,"ACTIVE".equals(status)?code.getCode():null,code.getValidFrom().atZone(zone).toOffsetDateTime().toString(),code.getValidUntil().atZone(zone).toOffsetDateTime().toString());
    }
    public List<Door> prepare(Long id,Jwt jwt){
        var plans=tx.execute(s->{var m=mission(id,jwt);missions.findForReview(id,m.getOrganizationId()).orElseThrow();var p=m.getProperty();var zone=zone(p);
            var start=m.getStatus()==InterventionStatus.IN_PROGRESS?m.getStartTime():m.getScheduledDate();
            if(start==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Créneau de mission absent.");
            // Lifecycle startTime is recorded in the server zone; lock windows use the property zone.
            if(m.getStatus()==InterventionStatus.IN_PROGRESS)start=start.atZone(ZoneId.systemDefault()).withZoneSameInstant(zone).toLocalDateTime();
            double hours=m.getEstimatedDurationHours()==null?1:m.getEstimatedDurationHours();
            var from=start.minusMinutes(30);var until=start.plusMinutes((long)Math.ceil(Math.max(0.25,Math.min(24,hours))*60)+30);
            var now=LocalDateTime.ofInstant(clock.instant(),zone);
            if(!now.isBefore(until))throw new ResponseStatusException(HttpStatus.CONFLICT,"Créneau d’accès expiré.");
            return devices.findBaitlyMissionLocks(p.getId(),p.getOrganizationId()).stream().map(d->{
                var existing=codes.findBound(id,d.getId(),p.getOrganizationId(),p.getId());if(existing.isPresent())return new Plan(d,id,p.getId(),p.getOrganizationId(),existing.get(),zone,false);
                var code=codes.saveAndFlush(new BaitlyInterventionDoorCode(p.getOrganizationId(),id,p.getId(),d.getId(),from,until,jwt.getSubject(),now));return new Plan(d,id,p.getId(),p.getOrganizationId(),code,zone,true);
            }).toList();
        });
        for(var plan:plans){if(!plan.create())continue;
            try{
                var placed=provider.place(plan.device(),"Baitly-intervention-"+id,plan.code().getValidFrom(),plan.code().getValidUntil(),plan.zone());
                if(placed.pin()==null||!placed.pin().matches("[0-9]{4,12}"))throw new IllegalStateException("Code non confirmé.");
                tx.execute(s->{var row=codes.findBound(plan.missionId(),plan.device().getId(),plan.orgId(),plan.propertyId()).orElseThrow();row.activate(placed.pin(),placed.externalCodeId());codes.save(row);return null;});
            }catch(RuntimeException failure){
                // Do not retry an uncertain physical write or expose a guessed PIN.
                tx.execute(s->{var row=codes.findBound(plan.missionId(),plan.device().getId(),plan.orgId(),plan.propertyId()).orElseThrow();row.fail();codes.save(row);return null;});
            }
        }
        return list(id,jwt);
    }
}
