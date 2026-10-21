package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.net.*;
import java.time.*;
import java.util.*;

/** Official single-ID lookup. Every attempt reserves its possible cost, including retries. */
@Component
public class BaitlyWathqClient {
    private final Environment config;private final StringRedisTemplate redis;private final ObjectMapper json;
    public BaitlyWathqClient(Environment config,StringRedisTemplate redis,ObjectMapper json){this.config=config;this.redis=redis;this.json=json;}
    public record Reply(JsonNode body,Instant retrievedAt,String endpoint,String environment) {}
    public static final class SourceFailure extends IOException {
        private final int status;private final long retrySeconds;
        public SourceFailure(int status,long retrySeconds){super("Wathq HTTP "+status);this.status=status;this.retrySeconds=retrySeconds;}
        public int status(){return status;}public long retrySeconds(){return retrySeconds;}
    }
    public Reply lookup(BaitlyDirectoryCountry.Identity id)throws IOException {
        if(!id.country().equals("SA"))throw new IllegalArgumentException("Wathq: pays invalide");
        if(!config.getProperty("baitly.directory.sa.wathq.enabled",Boolean.class,false)
            ||!config.getProperty("baitly.directory.sa.reuse-authorized",Boolean.class,false))throw new IOException("Wathq access disabled");
        String mode=config.getProperty("baitly.directory.sa.wathq.environment","sandbox");
        boolean production=mode.equals("production");
        if(!production&&!mode.equals("sandbox"))throw new IOException("Invalid Wathq environment");
        if(production&&!config.getProperty("baitly.directory.sa.wathq.production-authorized",Boolean.class,false))throw new IOException("Wathq production disabled");
        String base=production?config.getProperty("baitly.directory.sa.wathq.production-url",""):"https://api.wathq.sa/sandbox/commercial-registration";
        try{URI origin=URI.create(base);if(!"https".equals(origin.getScheme())||!"api.wathq.sa".equals(origin.getHost())||origin.getPort()!=-1||origin.getUserInfo()!=null||origin.getQuery()!=null||origin.getFragment()!=null||!origin.getPath().matches("/[a-zA-Z0-9/-]+"))throw new IllegalArgumentException();}
        catch(IllegalArgumentException invalid){throw new IOException("Invalid official Wathq origin");}
        if(production&&URI.create(base).getPath().toLowerCase(Locale.ROOT).contains("sandbox"))throw new IOException("Sandbox origin cannot be used for production publication");
        String key=config.getProperty("baitly.directory.sa.wathq."+mode+"-api-key","");
        if(key.isBlank())throw new IOException("Missing Wathq credentials");
        String detail=config.getProperty("baitly.directory.sa.wathq.detail","info");
        if(!Set.of("info","fullinfo").contains(detail))throw new IOException("Invalid Wathq detail level");
        long cost=production?config.getProperty("baitly.directory.sa.wathq.cost-halala."+detail,Long.class,0L):0;
        if(production&&cost<(detail.equals("fullinfo")?1200:500))throw new IOException("Configure the actual Wathq request cost, including tax");
        long budget=config.getProperty("baitly.directory.sa.wathq.daily-budget-halala",Long.class,0L);
        long quota=config.getProperty("baitly.directory.sa.wathq.daily-request-limit",Long.class,0L);
        String prefix="baitly:directory:wathq:"+mode+":"+LocalDate.now(ZoneOffset.UTC);
        var reserve=new DefaultRedisScript<Long>("""
            local calls=tonumber(redis.call('GET',KEYS[1]) or '0')
            local spent=tonumber(redis.call('GET',KEYS[2]) or '0')
            if calls>=tonumber(ARGV[1]) or spent+tonumber(ARGV[2])>tonumber(ARGV[3]) then return 0 end
            if redis.call('EXISTS',KEYS[3])==1 then return -1 end
            redis.call('INCR',KEYS[1]);redis.call('INCRBY',KEYS[2],ARGV[2])
            redis.call('EXPIRE',KEYS[1],172800);redis.call('EXPIRE',KEYS[2],172800)
            redis.call('SET',KEYS[3],'1','PX',ARGV[4]);return 1
            """,Long.class);
        long spacing=Math.max(250,config.getProperty("baitly.directory.sa.wathq.min-interval-ms",Long.class,1000L));
        Long reserved=redis.execute(reserve,List.of(prefix+":calls",prefix+":spent","baitly:directory:wathq:"+mode+":rate"),String.valueOf(quota),String.valueOf(cost),String.valueOf(budget),String.valueOf(spacing));
        if(!Objects.equals(reserved,1L))throw new SourceFailure(429,Objects.equals(reserved,-1L)?1:86400);
        String endpoint=base+"/"+detail+"/"+id.value();
        return new Reply(fetch(endpoint,key),Instant.now(),endpoint,mode);
    }
    protected JsonNode fetch(String url,String key)throws IOException {
        var c=(HttpURLConnection)URI.create(url).toURL().openConnection();
        c.setInstanceFollowRedirects(false);c.setConnectTimeout(10000);c.setReadTimeout(25000);
        c.setRequestProperty("apiKey",key);c.setRequestProperty("Accept","application/json");c.setRequestProperty("User-Agent","Baitly-Directory/1.0");
        try{
            int status=c.getResponseCode();if(status!=200)throw new SourceFailure(status,retryAfter(c.getHeaderField("Retry-After"),Instant.now()));
            try(var input=c.getInputStream()){
                byte[] bytes=input.readNBytes(2_000_001);if(bytes.length>2_000_000)throw new IOException("Wathq response size exceeded");
                JsonNode body=json.readTree(bytes);if(body==null||!body.isObject())throw new IOException("Invalid Wathq response");return body;
            }
        }finally{c.disconnect();}
    }
    static long retryAfter(String value,Instant now){
        try{return Math.max(1,Math.min(86400,Long.parseLong(value)));}catch(Exception ignored){}
        try{return Math.max(1,Math.min(86400,Duration.between(now,ZonedDateTime.parse(value,java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()).toSeconds()));}catch(Exception ignored){return 60;}
    }
}
