package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.io.*;
import java.net.*;
import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;

class BaitlyDirectoryOsmStockTest {
    @TempDir Path directory;
    static final String HASH="0".repeat(64);
    @Test void rejectsInvalidFingerprintsSizesAndLicences(){
        assertThrows(IOException.class,()->BaitlyDirectoryOsmStock.validate("../secret",20,"ODbL 1.0"));
        assertThrows(IOException.class,()->BaitlyDirectoryOsmStock.validate(HASH,0,"ODbL 1.0"));
        assertThrows(IOException.class,()->BaitlyDirectoryOsmStock.validate(HASH,600L*1024*1024,"ODbL 1.0"));
        assertThrows(IOException.class,()->BaitlyDirectoryOsmStock.validate(HASH,20,"unknown"));
    }
    @Test void verifiesBeforePublishingAndReusesTheImmutableFile()throws Exception {
        byte[] bytes="public source\n".getBytes();Path fixture=directory.resolve("fixture");Files.write(fixture,bytes);
        String hash=BaitlyDirectoryOsmStock.digest(fixture);
        var stock=source(bytes,hash);Path output=stock.refresh(directory.resolve("osm.jsonl"));
        assertEquals("osm-"+hash+".jsonl",output.getFileName().toString());assertArrayEquals(bytes,Files.readAllBytes(output));
        assertEquals(output,stock.refresh(directory.resolve("osm.jsonl")));
    }
    @Test void aCorruptDownloadNeverReplacesThePreviousSource()throws Exception {
        Path fallback=directory.resolve("osm.jsonl");Files.writeString(fallback,"previous source");
        assertThrows(IOException.class,()->source("corrupt".getBytes(),HASH).refresh(fallback));
        assertEquals("previous source",Files.readString(fallback));
        try(var files=Files.list(directory)){assertEquals(1,files.count());}
    }
    private BaitlyDirectoryOsmStock source(byte[] bytes,String hash){
        return new BaitlyDirectoryOsmStock(new ObjectMapper()){
            @Override protected HttpURLConnection open(String name)throws IOException {
                byte[] value=name.equals("latest.json")?("{\"sha256\":\""+hash+"\",\"bytes\":"+bytes.length+",\"licence\":\"ODbL 1.0\"}").getBytes():bytes;
                return new HttpURLConnection(URI.create("https://example.invalid").toURL()){
                    public void disconnect(){}public boolean usingProxy(){return false;}public void connect(){}
                    @Override public InputStream getInputStream(){return new ByteArrayInputStream(value);}
                };
            }
        };
    }
}
