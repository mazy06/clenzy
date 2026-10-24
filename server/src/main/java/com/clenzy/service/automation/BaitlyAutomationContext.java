package com.clenzy.service.automation;

import com.clenzy.model.AutomationRule;
import com.clenzy.service.TokenEncryptionService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.time.*;
import java.util.*;

/** Encrypted, bounded recovery data; no plaintext payload in the execution journal or DTO. */
@Component
public class BaitlyAutomationContext {
    private final TokenEncryptionService encryption;
    private final ObjectMapper mapper;
    private final Clock clock;
    public BaitlyAutomationContext(TokenEncryptionService encryption, ObjectMapper mapper, Clock clock) {
        this.encryption=encryption; this.mapper=mapper; this.clock=clock;
    }
    public String encode(Long org, String type, Long id, Map<String,Object> data) {
        try {
            String json=mapper.writeValueAsString(Map.of("org",org,"type",type,"id",id,"data",data));
            if(json.length()>8192) throw new IllegalArgumentException();
            return encryption.encrypt(json);
        } catch(Exception failure) { throw new IllegalStateException("AUTOMATION_CONTEXT_UNAVAILABLE"); }
    }
    public Map<String,Object> decode(Long org, String type, Long id, String encrypted) {
        try {
            Map<String,Object> envelope=mapper.readValue(encryption.decrypt(encrypted),new TypeReference<>() {});
            if(!org.toString().equals(envelope.get("org").toString()) || !type.equals(envelope.get("type"))
                    || !id.toString().equals(envelope.get("id").toString())) throw new IllegalArgumentException();
            return mapper.convertValue(envelope.get("data"),new TypeReference<Map<String,Object>>() {});
        } catch(Exception failure) { throw new IllegalStateException("AUTOMATION_CONTEXT_UNAVAILABLE"); }
    }
    /** Freeze recurrence boundaries at admission, not after a restart or month rollover. */
    public Map<String,Object> freeze(AutomationRule rule, Map<String,Object> input) {
        var data=new HashMap<String,Object>(input==null?Map.of():input);
        if(rule.getTriggerType()==com.clenzy.model.AutomationTrigger.OWNER_MONTHLY_STATEMENT) {
            var from=data.get("periodStart")==null ? LocalDate.now(clock.withZone(ZoneId.of("Europe/Paris"))).minusMonths(1).withDayOfMonth(1)
                : LocalDate.parse(data.get("periodStart").toString());
            var to=data.get("periodEnd")==null ? from.plusMonths(1).minusDays(1) : LocalDate.parse(data.get("periodEnd").toString());
            if(to.isBefore(from)) throw new IllegalArgumentException("AUTOMATION_PERIOD_INVALID");
            data.put("periodStart",from.toString());data.put("periodEnd",to.toString());
        }
        return Map.copyOf(data);
    }
    public String key(AutomationRule rule, String type, Long subject, Map<String,Object> data) {
        String occurrence=rule.getTriggerType().isDedupePerSubject()?"once":switch(rule.getTriggerType()) {
            case OWNER_MONTHLY_STATEMENT -> "month:"+LocalDate.parse(data.get("periodStart").toString());
            case IOT_DEVICE_OFFLINE -> "episode:"+offlineEpoch(data);
            default -> "day:"+LocalDate.now(clock.withZone(ZoneId.of("Europe/Paris")));
        };
        return rule.getOrganizationId()+":"+rule.getId()+":"+type+":"+subject+":"+occurrence;
    }
    private static long offlineEpoch(Map<String,Object> data) {
        try {return Instant.parse(String.valueOf(data.get("offlineSince"))).toEpochMilli();}
        catch(Exception failure) {
            try {return LocalDateTime.parse(String.valueOf(data.get("offlineSince"))).toInstant(ZoneOffset.UTC).toEpochMilli();}
            catch(Exception invalid) {throw new IllegalArgumentException("AUTOMATION_EPISODE_REQUIRED");}
        }
    }
}
