package com.clenzy.marketplace.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.*;

/** Matching uses published evidence only. A city match does not assert service availability. */
@Service
@Transactional(readOnly=true)
public class BaitlyConciergeMatching {
    public static final Set<String> SERVICES=Set.of("LISTINGS","PRICING","GUESTS","CLEANING","MAINTENANCE","OWNER_REPORTING");
    private static final com.fasterxml.jackson.databind.ObjectMapper JSON=new com.fasterxml.jackson.databind.ObjectMapper();
    private final JdbcTemplate db;
    public BaitlyConciergeMatching(JdbcTemplate db) { this.db=db; }
    public static List<String> services(List<String> values) {
        if(values==null)return List.of();
        if(values.size()>6 || values.stream().anyMatch(v -> v==null || !SERVICES.contains(v)))throw new IllegalArgumentException("Services invalides");
        return values.stream().distinct().sorted().toList();
    }
    public static String servicesJson(List<String> values) {
        var selected=services(values);return selected.isEmpty()?"[]":"[\""+String.join("\",\"",selected)+"\"]";
    }
    public static List<String> readServices(String json) {
        if(json==null || json.equals("[]"))return List.of();
        try { return services(JSON.readValue(json,new com.fasterxml.jackson.core.type.TypeReference<List<String>>(){})); }
        catch(com.fasterxml.jackson.core.JsonProcessingException invalid) {throw new IllegalStateException("Services publiés invalides",invalid);}
    }
    public record Match(UUID id,String name,String organization,String city,String bio,String role,
        List<String> managementServices,BigDecimal managementFeePct,String cityEvidence,boolean countryConfirmed) {}
    public record Results(List<Match> content,long totalElements,int page,int size) {}

    public Results search(String city,String country,List<String> services,BigDecimal maxFee,int page) {
        if(page<0 || page>10000 || city!=null && city.length()>150 || country!=null && !country.isBlank() && !country.matches("[A-Za-z]{2}")
            || maxFee!=null && (maxFee.signum()<0 || maxFee.compareTo(BigDecimal.valueOf(100))>0 || maxFee.scale()>2))
            throw new IllegalArgumentException("Critères invalides");
        String locality=city==null?"":Normalizer.normalize(city.trim(),Normalizer.Form.NFD).replaceAll("\\p{M}","").replaceAll("\\s+"," ").toLowerCase(Locale.ROOT);
        String nation=country==null?"":country.trim().toUpperCase(Locale.ROOT);
        String publicHome=" FROM properties h WHERE h.organization_id=p.organization_id AND h.status='ACTIVE' AND p.property_ids @> to_jsonb(h.id) AND (c.city='' OR "+fold("h.city")+"=c.city)";
        String sql="""
            WITH criteria AS (SELECT CAST(? AS text) city,CAST(? AS text) country), candidates AS (
              SELECT p.id,p.name,p.hide_last_name,p.organization,p.city,p.bio,p.management_services,p.management_fee_pct,p.updated_at,
                c.city search_city,c.country search_country,
            """+" EXISTS(SELECT 1"+publicHome+") home_city,"+
            " EXISTS(SELECT 1"+publicHome+" AND upper(h.country_code)=c.country) country_confirmed,"+
            " EXISTS(SELECT 1"+publicHome+" AND nullif(btrim(h.country_code),'') IS NOT NULL) country_known"+
            " FROM baitly_public_profiles p JOIN organizations o ON o.id=p.organization_id AND o.type IN ('CONCIERGE','SYSTEM') CROSS JOIN criteria c"+
            " WHERE p.published=true AND p.role='CONCIERGE'), matches AS (SELECT * FROM candidates p WHERE"+
            " (search_city='' OR "+fold("p.city")+"=search_city OR home_city)"+
            " AND (search_country='' OR country_confirmed OR NOT country_known) AND management_services @> CAST(? AS jsonb)"+
            (maxFee==null?"":" AND management_fee_pct<=?")+") ";
        var args=new ArrayList<Object>(List.of(locality,nation,servicesJson(services)));if(maxFee!=null)args.add(maxFee);
        Long total=db.queryForObject(sql+"SELECT count(*) FROM matches",Long.class,args.toArray());
        args.add((long)page*25);
        var rows=db.query(sql+"SELECT * FROM matches ORDER BY management_fee_pct ASC NULLS LAST,updated_at DESC,id LIMIT 25 OFFSET ?",(rs,i) ->
            new Match(rs.getObject("id",UUID.class),BaitlyPublicNames.display(rs.getString("name"),rs.getBoolean("hide_last_name")),
                rs.getString("organization"),rs.getString("city"),rs.getString("bio"),"CONCIERGE",readServices(rs.getString("management_services")),
                rs.getBigDecimal("management_fee_pct"),locality.isBlank()?null:rs.getBoolean("home_city")?"PUBLIC_HOME_CITY":"PROFILE_CITY",rs.getBoolean("country_confirmed")),args.toArray());
        return new Results(rows,total,page,25);
    }
    private static String fold(String column) {
        String accents="àáâãäåçèéêëìíîïñòóôõöùúûüýÿ",ascii="aaaaaaceeeeiiiinooooouuuuyy";
        // Uppercase accents must also fold under PostgreSQL's C collation.
        return "regexp_replace(translate(lower(btrim("+column+")), '"+accents+accents.toUpperCase(Locale.ROOT)+"', '"+ascii+ascii+"'), '\\s+', ' ', 'g')";
    }
}
