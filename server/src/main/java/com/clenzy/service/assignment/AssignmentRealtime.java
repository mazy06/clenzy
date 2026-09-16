package com.clenzy.service.assignment;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Invalidation sans données métier, diffusée uniquement aux organisations concernées. */
@Component
public class AssignmentRealtime implements MessageListener {
    public static final String CHANNEL="baitly:assignment:changed";
    private final Map<Long,Set<SseEmitter>> streams=new ConcurrentHashMap<>();
    private final StringRedisTemplate redis;
    private final JdbcTemplate db;
    public AssignmentRealtime(StringRedisTemplate redis,JdbcTemplate db) { this.redis=redis; this.db=db; }
    public SseEmitter subscribe(Long organization) throws java.io.IOException {
        var emitter=new SseEmitter(300_000L);
        streams.compute(organization,(key,set)-> {
            if (set==null) set=ConcurrentHashMap.newKeySet();
            set.add(emitter); return set;
        });
        emitter.onCompletion(()->remove(organization,emitter));
        emitter.onTimeout(()->{ remove(organization,emitter); emitter.complete(); });
        emitter.onError(error->remove(organization,emitter));
        try { emitter.send(SseEmitter.event().name("ready").data("{}")); }
        catch (java.io.IOException error) { remove(organization,emitter); throw error; }
        return emitter;
    }
    private void remove(Long org,SseEmitter emitter) {
        streams.computeIfPresent(org,(key,set)->{ set.remove(emitter); return set.isEmpty()?null:set; });
    }
    public void changed(long requestId) {
        var organizations=db.queryForList("""
            SELECT organization_id FROM service_requests WHERE id=?
            UNION SELECT u.organization_id FROM users u JOIN service_assignment_proposals p
              ON (p.target_type='user' AND p.target_id=u.id)
              OR (p.target_type='team' AND EXISTS
                (SELECT 1 FROM team_members m WHERE m.user_id=u.id AND m.team_id=p.target_id))
            WHERE p.request_id=? AND u.organization_id IS NOT NULL
            """,Long.class,requestId,requestId);
        for (Long org:organizations) redis.convertAndSend(CHANNEL,org.toString());
    }
    @Override public void onMessage(Message message,byte[] pattern) {
        Long org;
        try { org=Long.valueOf(new String(message.getBody(),StandardCharsets.UTF_8)); }
        catch (NumberFormatException invalid) { return; }
        for (var emitter:streams.getOrDefault(org,Set.of())) {
            try { emitter.send(SseEmitter.event().name("assignment").data("{}")); }
            catch (java.io.IOException | IllegalStateException disconnected) { remove(org,emitter); }
        }
    }
}
