package com.clenzy.service;

import com.clenzy.integration.geo.BanGeocodingClient;
import com.clenzy.integration.geo.BanGeocodingClient.AddressMatch;
import com.clenzy.marketplace.service.BaitlyProfessionalData.Business;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.server.ResponseStatusException;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Duration;
import java.util.*;
import java.util.regex.Pattern;

/** French imported addresses only. Geocoding an address never identifies its occupant in OSM. */
@Service
public class BaitlyCrmAddressGeocoding {
    private static final Pattern ADDRESS=Pattern.compile("^([0-9]+(?:\\s*(?:bis|ter|quater))?)\\s+(.+?)\\s+([0-9]{5})\\s+(.+)$",Pattern.CASE_INSENSITIVE);
    private static final String RATE="baitly:crm:ban:rate";
    private final JdbcTemplate db;
    private final BaitlyCrmAccess access;
    private final BaitlyCrmImportedOsmSearch source;
    private final BaitlyCrmOsmMatching matching;
    private final BanGeocodingClient ban;
    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final TransactionTemplate tx;
    public BaitlyCrmAddressGeocoding(JdbcTemplate db,BaitlyCrmAccess access,BaitlyCrmImportedOsmSearch source,
        BaitlyCrmOsmMatching matching,BanGeocodingClient ban,StringRedisTemplate redis,ObjectMapper mapper,PlatformTransactionManager transactions) {
        this.db=db;this.access=access;this.source=source;this.matching=matching;this.ban=ban;this.redis=redis;this.mapper=mapper;
        this.tx=new TransactionTemplate(transactions);
    }
    /** Null delegates to the existing OSM flow. External reads always precede the transaction. */
    public BaitlyCrmExactOsmEnrichment.Outcome locate(String actor,long id) {
        long org=access.require(actor);Business business=source.business(actor,id);
        if(hasCoordinates(business)||!complete(business))return null;
        var matches=search(business);
        var candidates=matches.stream().map(m->new BaitlyCrmOsmMatching.Candidate(null,0,business.name(),m.label(),m.latitude(),m.longitude(),
            List.of("ADDRESS"),"municipality".equals(m.type())?"CITY":"ADDRESS","BAN",m.id(),m.score())).toList();
        var proposal=matching.proposeImported(actor,id,business.name(),business.city(),candidates);
        if(!reliable(business,matches))return new BaitlyCrmExactOsmEnrichment.Outcome("REVIEW",List.of(),proposal);
        return tx.execute(status->{
            if(access.lock(actor)!=org)throw new org.springframework.security.access.AccessDeniedException("Organisation inaccessible");
            var rows=db.queryForList("SELECT status FROM baitly_crm_location_review WHERE organization_id=? AND actor=? AND prospect_id=?",org,actor,id);
            if(rows.isEmpty())throw new org.springframework.security.access.AccessDeniedException("File inaccessible");
            String state=(String)rows.getFirst().get("status");
            if(!Set.of("PENDING","CONFIRMED").contains(state))return new BaitlyCrmExactOsmEnrichment.Outcome(state,List.of());
            if(!source.business(actor,id).equals(business))throw new ResponseStatusException(HttpStatus.CONFLICT,"L’adresse a changé. Relancez la recherche.");
            matching.confirm(actor,id,new BaitlyCrmOsmMatching.Confirmation(proposal.ticket(),0,false));
            db.update("UPDATE baitly_crm_location_review SET status='CONFIRMED',updated_at=now() WHERE organization_id=? AND actor=? AND prospect_id=?",org,actor,id);
            return new BaitlyCrmExactOsmEnrichment.Outcome("CONFIRMED",List.of());
        });
    }
    private List<AddressMatch> search(Business business) {
        String key="baitly:crm:ban:cache:"+UUID.nameUUIDFromBytes((business.address()+":"+business.postalCode()).getBytes(StandardCharsets.UTF_8));
        try {
            String cached=redis.opsForValue().get(key);
            if(cached!=null)return mapper.readValue(cached,mapper.getTypeFactory().constructCollectionType(List.class,AddressMatch.class));
            if(!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(RATE,"1",Duration.ofSeconds(1))))
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Géocodage en cours. Réessayez dans quelques secondes.");
            var result=ban.searchAddresses(business.address(),business.postalCode());
            redis.opsForValue().set(key,mapper.writeValueAsString(result),Duration.ofHours(24));
            return result;
        } catch(ResponseStatusException e){throw e;}
        catch(HttpStatusCodeException e) {
            if(e.getStatusCode().value()==429) {
                long seconds=60;
                try{seconds=Math.max(5,Math.min(300,Long.parseLong(e.getResponseHeaders().getFirst("Retry-After"))));}catch(Exception ignored){}
                redis.opsForValue().set(RATE,"1",Duration.ofSeconds(seconds));
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Géocodage temporairement limité. Réessayez plus tard.");
            }
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Géocodage indisponible. La localisation reste à traiter.");
        } catch(Exception e){throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Géocodage indisponible. La localisation reste à traiter.");}
    }
    static boolean complete(Business b) {
        if(b.address()==null||b.address().length()>500||b.postalCode()==null||b.city()==null)return false;
        var address=ADDRESS.matcher(b.address().strip());
        return address.matches()&&address.group(3).equals(b.postalCode())&&normalize(address.group(4)).equals(normalize(b.city()));
    }
    static boolean reliable(Business b,List<AddressMatch> matches) {
        if(!complete(b)||matches.isEmpty())return false;
        var address=ADDRESS.matcher(b.address().strip());address.matches();var first=matches.getFirst();
        return first.score()>=0.85&&"housenumber".equals(first.type())&&b.postalCode().equals(first.postcode())
            &&normalize(address.group(1)).equals(normalize(first.housenumber()))
            &&normalize(address.group(2)).equals(normalize(first.street()))&&normalize(b.city()).equals(normalize(first.city()))
            &&(matches.size()==1||first.score()-matches.get(1).score()>=0.10);
    }
    private static boolean hasCoordinates(Business b){return b.latitude()!=null&&b.longitude()!=null&&Double.isFinite(b.latitude())&&Double.isFinite(b.longitude())
        &&Math.abs(b.latitude())<=90&&Math.abs(b.longitude())<=180&&(b.latitude()!=0||b.longitude()!=0);}
    private static String normalize(String value){return Normalizer.normalize(Objects.toString(value,""),Normalizer.Form.NFD).replaceAll("\\p{M}","")
        .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]","");}
}
