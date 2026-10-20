package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.HexFormat;

/** Public source artifact, shared by deployments; never exports application or tenant databases. */
@Component
public class BaitlyDirectoryOsmStock {
    static final String ORIGIN="https://baitly-cartes.s3.gra.io.cloud.ovh.net/maps/directory/";
    private static final long MAX_BYTES=512L*1024*1024;
    private final ObjectMapper mapper;
    private long nextCheck;
    private Path cached;
    public BaitlyDirectoryOsmStock(ObjectMapper mapper){this.mapper=mapper;}

    /** Keep the verified local copy while a new immutable source is being transferred. */
    public synchronized Path refresh(Path fallback)throws Exception {
        if(System.currentTimeMillis()<nextCheck)return cached!=null?cached:fallback;
        nextCheck=System.currentTimeMillis()+3_600_000;
        JsonNode manifest;
        var connection=open("latest.json");
        try(var stream=connection.getInputStream()){
            byte[] bytes=stream.readNBytes(65537);if(bytes.length>65536)throw new IOException("OSM source manifest size exceeded");
            manifest=mapper.readTree(bytes);
        }finally{connection.disconnect();}
        String hash=manifest.path("sha256").asText();long size=manifest.path("bytes").asLong();
        validate(hash,size,manifest.path("licence").asText());
        Path target=fallback.resolveSibling("osm-"+hash+".jsonl");
        Files.createDirectories(target.toAbsolutePath().getParent());
        if(Files.isRegularFile(target)&&Files.size(target)==size&&digest(target).equals(hash)){cached=target;return target;}
        Path temporary=Files.createTempFile(target.toAbsolutePath().getParent(),"osm-stock-",".partial");
        try {
            connection=open("osm-"+hash+".jsonl");
            try(var input=connection.getInputStream();var output=Files.newOutputStream(temporary)){
                byte[] buffer=new byte[65536];long total=0;
                for(int n;(n=input.read(buffer))>=0;){total+=n;if(total>size)throw new IOException("OSM source exceeded declared size");output.write(buffer,0,n);}
                if(total!=size)throw new IOException("Incomplete OSM source");
            }finally{connection.disconnect();}
            if(!digest(temporary).equals(hash))throw new IOException("OSM source fingerprint mismatch");
            Files.move(temporary,target,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
            cached=target;return target;
        }finally{Files.deleteIfExists(temporary);}
    }
    static void validate(String hash,long size,String licence)throws IOException {
        if(!hash.matches("[0-9a-f]{64}")||size<=0||size>MAX_BYTES||!licence.equals("ODbL 1.0"))throw new IOException("Invalid OSM source manifest");
    }
    static String digest(Path path)throws Exception {
        var digest=MessageDigest.getInstance("SHA-256");
        try(var input=Files.newInputStream(path)){byte[] buffer=new byte[65536];for(int n;(n=input.read(buffer))>=0;)digest.update(buffer,0,n);}
        return HexFormat.of().formatHex(digest.digest());
    }
    protected HttpURLConnection open(String filename)throws IOException {
        // Only internally constructed names on the fixed public-data origin; no redirects or caller URLs.
        if(!filename.equals("latest.json")&&!filename.matches("osm-[0-9a-f]{64}\\.jsonl"))throw new IOException("Invalid source name");
        var connection=(HttpURLConnection)URI.create(ORIGIN+filename).toURL().openConnection();
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(60000);
        connection.setRequestProperty("User-Agent","Baitly-Directory/1.0");
        int status=connection.getResponseCode();
        if(status!=200){connection.disconnect();throw new IOException("OSM shared source unavailable (HTTP "+status+", "+filename+")");}
        return connection;
    }
}
