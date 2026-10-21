package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;
import java.io.*;
import java.net.HttpURLConnection;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlySaudiOsmStockTest {
    @TempDir Path folder;
    final ObjectMapper json=new ObjectMapper().registerModule(new JavaTimeModule()).disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    @Test void localEditionUsesTheSameChecksumValidationWithoutNetwork()throws Exception {
        byte[] body="local-edition".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body));
        var manifest=new BaitlyDirectoryCountryStock.Manifest("SA","SA_PUBLIC","sa-public","local",hash,1,
            BaitlyDirectoryCountryStock.OVERTURE_URL,BaitlyDirectoryCountryStock.PUBLIC_LICENCE,Instant.now(),true,true);
        java.nio.file.Files.write(folder.resolve("latest.json"),json.writeValueAsBytes(Map.of("manifest",manifest,"bytes",body.length)));
        java.nio.file.Files.write(folder.resolve("public-"+hash+".jsonl"),body);
        var env=new MockEnvironment().withProperty("baitly.directory.sa.osm.local-directory",folder.toString())
            .withProperty("baitly.directory.sa.osm.cache-directory",folder.resolve("verified").toString());
        var source=new BaitlySaudiOsmStock(env,json){
            @Override protected HttpURLConnection open(String filename){throw new AssertionError("Unexpected network call");}
        };
        assertThat(source.refresh().manifest()).isEqualTo(manifest);
        java.nio.file.Files.writeString(folder.resolve("public-"+hash+".jsonl"),"bad");
        java.nio.file.Files.delete(folder.resolve("verified/public-"+hash+".jsonl"));
        assertThatThrownBy(()->new BaitlySaudiOsmStock(env,json).refresh()).isInstanceOf(IOException.class);
    }
    @Test void downloadsChecksummedCombinedEditionWithoutLosingSourceIdentity()throws Exception {
        byte[] body=BaitlySaudiPublicPostgresTest.row("OVERTURE",BaitlySaudiPublicPostgresTest.OVERTURE,"Laundry","contact@example.org").getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body));
        var manifest=new BaitlyDirectoryCountryStock.Manifest("SA","SA_PUBLIC","sa-public","test",hash,1,
            BaitlyDirectoryCountryStock.OVERTURE_URL,BaitlyDirectoryCountryStock.PUBLIC_LICENCE,Instant.now(),true,true);
        var env=new MockEnvironment().withProperty("baitly.directory.sa.osm.cache-directory",folder.toString());
        var calls=new ArrayList<String>();
        var source=new BaitlySaudiOsmStock(env,json){
            @Override protected HttpURLConnection open(String filename)throws IOException {
                calls.add(filename);var reply=mock(HttpURLConnection.class);
                when(reply.getInputStream()).thenReturn(new ByteArrayInputStream(filename.equals("latest.json")?json.writeValueAsBytes(Map.of("manifest",manifest,"bytes",body.length)):body));return reply;
            }
        };
        var stock=new BaitlyDirectoryCountryStock(env,json,mock(BaitlyWathqClient.class));stock.saudiOsm(source);
        var opened=stock.open("SA").orElseThrow();
        assertThat(opened.manifest().source()).isEqualTo("SA_PUBLIC");
        assertThat(stock.entry(manifest,new String(body,java.nio.charset.StandardCharsets.UTF_8)).identity().type()).isEqualTo("OVERTURE");
        stock.open("SA");assertThat(calls).containsExactly("latest.json","public-"+hash+".jsonl");
    }
    @Test void verifiesEditionCachesAndPreservesOnlyOsmIdentities()throws Exception {
        byte[] body="""
            {"active":true,"identifierType":"OSM","identifier":"node/42","name":"مغسلة","city":"","address":"","service":"LAUNDRY","latitude":24.7,"longitude":46.7,"phone":"+966112345678","email":"CONTACT@example.org","website":"https://example.org"}
            """.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body));
        var manifest=new BaitlyDirectoryCountryStock.Manifest("SA","OSM","osm","test",hash,1,"https://www.openstreetmap.org/copyright","ODbL 1.0",Instant.now(),true,true);
        var env=new MockEnvironment().withProperty("baitly.directory.sa.osm.cache-directory",folder.toString());
        var calls=new ArrayList<String>();
        var source=new BaitlySaudiOsmStock(env,json){
            @Override protected HttpURLConnection open(String filename)throws IOException {
                calls.add(filename);var reply=mock(HttpURLConnection.class);
                when(reply.getInputStream()).thenReturn(new ByteArrayInputStream(filename.equals("latest.json")?json.writeValueAsBytes(Map.of("manifest",manifest,"bytes",body.length)):body));return reply;
            }
        };
        var wathq=mock(BaitlyWathqClient.class);var stock=new BaitlyDirectoryCountryStock(env,json,wathq);stock.saudiOsm(source);
        var opened=stock.open("SA").orElseThrow();assertThat(opened.manifest()).isEqualTo(manifest);
        var entry=stock.entry(manifest,new String(body,java.nio.charset.StandardCharsets.UTF_8));
        assertThat(entry.identity().key()).isEqualTo("SA:OSM:node/42");assertThat(entry.address()).isEmpty();
        assertThat(entry.phone()).isEqualTo("+966112345678");assertThat(entry.email()).isEqualTo("contact@example.org");
        stock.open("SA");assertThat(calls).containsExactly("latest.json","osm-"+hash+".jsonl");verifyNoInteractions(wathq);
        env.setProperty("baitly.directory.sa.osm.enabled","false");assertThat(stock.open("SA")).isEmpty();
        assertThatThrownBy(()->stock.entry(manifest,new String(body).replace("46.7","2.3"))).hasMessageContaining("position");
    }
    @Test void corruptSnapshotNeverBecomesACachedEdition()throws Exception {
        var manifest=new BaitlyDirectoryCountryStock.Manifest("SA","OSM","osm","test","a".repeat(64),1,"https://www.openstreetmap.org/copyright","ODbL 1.0",Instant.now(),true,true);
        var source=new BaitlySaudiOsmStock(new MockEnvironment().withProperty("baitly.directory.sa.osm.cache-directory",folder.toString()),json){
            @Override protected HttpURLConnection open(String filename)throws IOException {
                var reply=mock(HttpURLConnection.class);when(reply.getInputStream()).thenReturn(new ByteArrayInputStream(filename.equals("latest.json")?json.writeValueAsBytes(Map.of("manifest",manifest,"bytes",1)):new byte[]{1}));return reply;
            }
        };
        assertThatThrownBy(source::refresh).hasMessageContaining("checksum");
        try(var files=java.nio.file.Files.list(folder)){assertThat(files.toList()).isEmpty();}
    }
}
