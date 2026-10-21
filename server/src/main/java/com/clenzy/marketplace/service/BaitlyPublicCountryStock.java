package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.env.Environment;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.time.Instant;

/** Public, checksummed country OSM/Overture edition. Downloads never hold a database connection. */
public class BaitlyPublicCountryStock {
    public static final class SourceUnavailable extends IOException {
        private final int status;
        public SourceUnavailable(int status,String filename){super("Public country source unavailable (HTTP "+status+", "+filename+")");this.status=status;}
        public int status(){return status;}
    }
    private final String country;
    private final String slug;
    private final Environment config;
    private final ObjectMapper json;
    private BaitlyDirectoryCountryStock.Stock cached;
    private long nextCheck;

    protected BaitlyPublicCountryStock(Environment config,ObjectMapper json,String country){this.config=config;this.json=json;this.country=country;this.slug=country.toLowerCase(java.util.Locale.ROOT);}
    public boolean enabled(){return config.getProperty("baitly.directory."+slug+".osm.enabled",Boolean.class,true);}

    public synchronized BaitlyDirectoryCountryStock.Stock refresh() throws IOException {
        if(cached!=null&&System.currentTimeMillis()<nextCheck)return cached;
        byte[] bytes;
        String local=config.getProperty("baitly.directory."+slug+".osm.local-directory","");
        var connection=local.isBlank()?open("latest.json"):null;
        try(var in=connection==null?Files.newInputStream(Path.of(local).resolve("latest.json")):connection.getInputStream()){
            bytes=in.readNBytes(32001);if(bytes.length>32000)throw new IOException("Public country source manifest too large");
        }finally{if(connection!=null)connection.disconnect();}
        var root=json.readTree(bytes);
        var manifest=json.treeToValue(root.path("manifest"),BaitlyDirectoryCountryStock.Manifest.class);
        boolean combined=manifest!=null&&(country+"_PUBLIC").equals(manifest.source())&&(slug+"-public").equals(manifest.mode())
            &&BaitlyDirectoryCountryStock.PUBLIC_LICENCE.equals(manifest.licence())&&BaitlyDirectoryCountryStock.OVERTURE_URL.equals(manifest.sourceUrl());
        if(manifest==null||!country.equals(manifest.country())||!(combined||"OSM".equals(manifest.source())&&"osm".equals(manifest.mode()))
            ||!manifest.complete()||!manifest.publishable()||manifest.count()<1||manifest.count()>1_000_000
            ||manifest.version()==null||!manifest.version().matches("[a-zA-Z0-9._-]{1,128}")||manifest.sha256()==null
            ||!combined&&!"https://www.openstreetmap.org/copyright".equals(manifest.sourceUrl())
            ||manifest.retrievedAt()==null||manifest.retrievedAt().isAfter(Instant.now().plusSeconds(300)))throw new IOException("Invalid public country manifest");
        long size=root.path("bytes").asLong();
        BaitlyDirectoryOsmStock.validate(manifest.sha256(),size,combined?"ODbL 1.0":manifest.licence());
        Path folder=Path.of(config.getProperty("baitly.directory."+slug+".osm.cache-directory","/app/tmp/baitly-directory/"+slug+"-osm"));
        Files.createDirectories(folder);
        String filename=(combined?"public-":"osm-")+manifest.sha256()+".jsonl";
        Path target=folder.resolve(filename);
        try{
            if(!Files.isRegularFile(target)||Files.size(target)!=size||!BaitlyDirectoryOsmStock.digest(target).equals(manifest.sha256())){
                Path part=Files.createTempFile(folder,slug+"-osm-",".partial");
                try{
                    connection=local.isBlank()?open(filename):null;
                    try(var in=connection==null?Files.newInputStream(Path.of(local).resolve(filename)):connection.getInputStream();var out=Files.newOutputStream(part)){
                        byte[] buffer=new byte[65536];long total=0;
                        for(int n;(n=in.read(buffer))>=0;){
                            if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();
                            total+=n;if(total>size)throw new IOException("Public country source size exceeded");out.write(buffer,0,n);
                        }
                        if(total!=size)throw new IOException("Incomplete public country edition");
                    }finally{if(connection!=null)connection.disconnect();}
                    if(!BaitlyDirectoryOsmStock.digest(part).equals(manifest.sha256()))throw new IOException("Public country source checksum mismatch");
                    Files.move(part,target,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
                }finally{Files.deleteIfExists(part);}
            }
        }catch(IOException failure){throw failure;}catch(Exception failure){throw new IOException("Cannot verify public country edition",failure);}
        cached=new BaitlyDirectoryCountryStock.Stock(target,manifest);
        nextCheck=System.currentTimeMillis()+3_600_000;
        return cached;
    }

    protected HttpURLConnection open(String filename)throws IOException {
        if(!filename.equals("latest.json")&&!filename.matches("(?:osm|public)-[a-f0-9]{64}\\.jsonl"))throw new IOException("Invalid country public filename");
        var connection=(HttpURLConnection)URI.create(BaitlyDirectoryOsmStock.ORIGIN+slug+"/"+filename).toURL().openConnection();
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(60000);
        connection.setRequestProperty("User-Agent","Baitly-Directory/1.0");
        int status=connection.getResponseCode();
        if(status!=200){connection.disconnect();throw new SourceUnavailable(status,filename);}
        return connection;
    }
}
