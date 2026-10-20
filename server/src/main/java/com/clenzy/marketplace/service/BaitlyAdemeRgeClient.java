package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.time.Instant;
import com.clenzy.service.BaitlyCrmIdentity;

/** Public ADEME feed: fixed HTTPS origin, no caller URLs, redirects, API key or company-by-company crawl. */
@Component
public class BaitlyAdemeRgeClient {
    public static final String BASE="https://data.ademe.fr/data-fair/api/v1/datasets/liste-des-entreprises-rge-2";
    public static final String SOURCE="https://data.ademe.fr/datasets/liste-des-entreprises-rge-2";
    private final ObjectMapper mapper;
    public BaitlyAdemeRgeClient(ObjectMapper mapper){this.mapper=mapper;}
    public record Contact(String siret,String phone,String email,String website) {}
    public record Snapshot(String version,List<Contact> contacts) {}
    /** Multiple qualifications are normal; conflicting contacts are omitted field by field. */
    private static final class Contacts {
        final Set<String> phones=new TreeSet<>(),emails=new TreeSet<>(),websites=new TreeSet<>();
        void add(JsonNode row){
            String phone=phone(row.path("telephone").asText("")),email=email(row.path("email").asText("")),website=website(row.path("site_internet").asText(""));
            if(phone!=null)phones.add(phone);if(email!=null)emails.add(email);if(website!=null)websites.add(website);
        }
        Contact resolve(String siret){return new Contact(siret,only(phones),only(emails),only(websites));}
    }
    public Snapshot download()throws IOException,InterruptedException {
        var before=metadata();validate(before);
        String version=before.path("dataUpdatedAt").asText(),id=before.path("id").asText();long expected=before.path("count").asLong();
        var contacts=new TreeMap<String,Contacts>();var cursors=new HashSet<String>();String after=null;long count=0;
        do {
            if(Thread.currentThread().isInterrupted())throw new InterruptedException();
            if(after!=null)pause();
            var page=page(after);var rows=page.path("results");
            // Data Fair omits total after the first cursor page; final row count remains mandatory.
            if(!rows.isArray()||rows.isEmpty()||rows.size()>10000
                ||((after==null||page.has("total"))&&page.path("total").asLong(-1)!=expected))throw new IOException("Incomplete ADEME page");
            for(var row:rows){
                if(++count>expected)throw new IOException("ADEME row count exceeded");
                String siret=row.path("siret").asText("").strip();
                if(!siret.matches("[0-9]{14}"))throw new IOException("Invalid ADEME SIRET");
                contacts.computeIfAbsent(siret,k->new Contacts()).add(row);
            }
            after=cursor(page,id);
            if(after!=null&&!cursors.add(after))throw new IOException("Repeated ADEME cursor");
        }while(after!=null);
        var end=metadata();validate(end);
        if(count!=expected||!version.equals(end.path("dataUpdatedAt").asText())||expected!=end.path("count").asLong())throw new IOException("ADEME edition changed during download");
        return new Snapshot(version,contacts.entrySet().stream().map(e->e.getValue().resolve(e.getKey())).toList());
    }
    static void validate(JsonNode meta)throws IOException {
        var fields=new HashSet<String>();meta.path("schema").forEach(f->fields.add(f.path("key").asText()));
        if(!fields.containsAll(Set.of("siret","telephone","email","site_internet"))||!meta.path("public").asBoolean()
            ||!meta.path("status").asText().equals("finalized")||!meta.path("license").path("title").asText().startsWith("Licence Ouverte")
            ||!meta.path("id").asText().matches("[a-z0-9_-]{1,100}")||meta.path("count").asLong()<1||meta.path("count").asLong()>1_000_000)
            throw new IOException("Invalid ADEME source contract");
        try{Instant.parse(meta.path("dataUpdatedAt").asText());}catch(Exception invalid){throw new IOException("Invalid ADEME edition",invalid);}
    }
    private static String only(Set<String> values){return values.size()==1?values.iterator().next():null;}
    private static String phone(String value){try{return BaitlyCrmIdentity.phone(value);}catch(IllegalArgumentException invalid){return null;}}
    private static String email(String value){try{return BaitlyCrmIdentity.email(value);}catch(IllegalArgumentException invalid){return null;}}
    private static String website(String value){String safe=BaitlyProfessionalData.website(value.strip());return safe.isEmpty()?null:safe;}

    public JsonNode metadata()throws IOException {return fetch(BASE,512_000);}
    public JsonNode page(String after)throws IOException {
        return fetch(BASE+"/lines?size=10000&select=siret,telephone,email,site_internet&sort=siret"
            +(after==null?"":"&after="+URLEncoder.encode(after,StandardCharsets.UTF_8)),4_000_000);
    }
    /** Use only the cursor from the upstream URL, never fetch its host, path or other query parameters. */
    static String cursor(JsonNode page,String datasetId)throws IOException {
        String value=page.path("next").asText("");if(value.isBlank())return null;
        try {
            URI next=URI.create(value);
            if(!"https".equals(next.getScheme())||!"data.ademe.fr".equals(next.getHost())||next.getPort()!=-1
                ||next.getUserInfo()!=null||next.getFragment()!=null
                ||!List.of(URI.create(BASE).getPath()+"/lines","/data-fair/api/v1/datasets/"+datasetId+"/lines").contains(next.getPath()))throw new IOException("Invalid ADEME pagination origin");
            String cursor=null;
            for(String pair:Objects.toString(next.getRawQuery(),"").split("&")){
                var parts=pair.split("=",2);
                if(URLDecoder.decode(parts[0],StandardCharsets.UTF_8).equals("after")){
                    if(cursor!=null||parts.length!=2)throw new IOException("Invalid ADEME cursor");
                    cursor=URLDecoder.decode(parts[1],StandardCharsets.UTF_8);
                }
            }
            if(cursor==null||cursor.isBlank()||cursor.length()>4096)throw new IOException("Missing ADEME cursor");
            return cursor;
        }catch(IllegalArgumentException invalid){throw new IOException("Invalid ADEME pagination",invalid);}
    }
    protected JsonNode fetch(String url,int maxBytes)throws IOException {
        var connection=(HttpURLConnection)URI.create(url).toURL().openConnection();
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(10000);connection.setReadTimeout(60000);
        connection.setRequestProperty("User-Agent","Baitly-Directory/1.0");connection.setRequestProperty("Accept","application/json");
        try {
            if(connection.getResponseCode()!=200)throw new IOException("ADEME source unavailable (HTTP "+connection.getResponseCode()+")");
            try(var input=connection.getInputStream()){
                byte[] bytes=input.readNBytes(maxBytes+1);if(bytes.length>maxBytes)throw new IOException("ADEME response size exceeded");
                return mapper.readTree(bytes);
            }
        }finally{connection.disconnect();}
    }
    protected void pause()throws InterruptedException {Thread.sleep(1500);}
}
