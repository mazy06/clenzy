package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyMoroccoPublicStockTest {
    @TempDir Path folder;
    @Test void verifiedLocalEditionSupportsMoroccanContactsAndRejectsCrossCountryManifest()throws Exception {
        var json=new ObjectMapper().registerModule(new JavaTimeModule()).disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        byte[] body=BaitlyMoroccoPublicPostgresTest.row("OVERTURE",BaitlyMoroccoPublicPostgresTest.OVERTURE,"Pressing","contact@example.org").getBytes(java.nio.charset.StandardCharsets.UTF_8);
        String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body));
        var manifest=new BaitlyDirectoryCountryStock.Manifest("MA","MA_PUBLIC","ma-public","test",hash,1,
            BaitlyDirectoryCountryStock.OVERTURE_URL,BaitlyDirectoryCountryStock.PUBLIC_LICENCE,Instant.now(),true,true);
        Files.write(folder.resolve("latest.json"),json.writeValueAsBytes(Map.of("manifest",manifest,"bytes",body.length)));
        Files.write(folder.resolve("public-"+hash+".jsonl"),body);
        var env=new MockEnvironment().withProperty("baitly.directory.ma.osm.local-directory",folder.toString())
            .withProperty("baitly.directory.ma.osm.cache-directory",folder.resolve("cache").toString());
        var source=new BaitlyMoroccoPublicStock(env,json);
        var reader=new BaitlyDirectoryCountryStock(env,json,mock(BaitlyWathqClient.class));reader.morocco(source);
        assertThat(reader.open("MA").orElseThrow().manifest()).isEqualTo(manifest);
        var entry=reader.entry(manifest,new String(body,java.nio.charset.StandardCharsets.UTF_8));
        assertThat(entry.identity().key()).startsWith("MA:OVERTURE:");
        assertThat(entry.email()).isEqualTo("contact@example.org");
        assertThatThrownBy(()->reader.entry(manifest,new String(body).replace("-7.99","46.7"))).hasMessageContaining("position");
        assertThatThrownBy(()->new BaitlySaudiOsmStock(new MockEnvironment()
            .withProperty("baitly.directory.sa.osm.local-directory",folder.toString()),json).refresh()).hasMessageContaining("manifest");
        env.setProperty("baitly.directory.ma.osm.enabled","false");assertThat(reader.open("MA")).isEmpty();
    }
}
