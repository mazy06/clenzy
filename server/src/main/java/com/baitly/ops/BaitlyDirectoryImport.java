package com.baitly.ops;

import com.clenzy.marketplace.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.jdbc.*;
import org.springframework.context.annotation.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.Map;
import java.util.zip.ZipInputStream;

/** Explicit operator entrypoint, outside the application scan; starts no web server or schedulers. */
public final class BaitlyDirectoryImport {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(BaitlyDirectoryImport.class);
    @Configuration(proxyBeanMethods=false)
    @Import({DataSourceAutoConfiguration.class,JdbcTemplateAutoConfiguration.class,DataSourceTransactionManagerAutoConfiguration.class,
        BaitlyNationalDirectorySync.class,BaitlyNationalOsmEnrichment.class})
    public static class Config {
        @Bean ObjectMapper objectMapper(){return new ObjectMapper();}
        @Bean BaitlyNationalDirectorySource source()throws IOException {
            Path directory=Path.of(System.getenv().getOrDefault("BAITLY_DIRECTORY_CACHE","/app/tmp/baitly-directory"));
            var metadata=new ObjectMapper().readTree(directory.resolve("sirene.json").toFile());
            var resources=new BaitlyNationalDirectorySource.Resources(metadata.path("establishments").asText(),metadata.path("units").asText(),metadata.path("establishmentsEtag").asText(),metadata.path("unitsEtag").asText());
            return new BaitlyNationalDirectorySource(){
                @Override public Resources resolve()throws IOException {
                    var actual=super.resolve();if(!actual.equals(resources))throw new IOException("Cached Sirene edition no longer current");return resources;
                }
                @Override public CSVParser open(String url)throws IOException{return open(url,null);}
                @Override public CSVParser open(String url,String etag)throws IOException {
                    String name,expected;
                    if(url.equals(resources.establishments())){name="establishments.zip";expected=resources.establishmentsEtag();}
                    else if(url.equals(resources.units())){name="units.zip";expected=resources.unitsEtag();}
                    else throw new SourceChangedException();
                    if(etag!=null&&!etag.equals(expected))throw new SourceChangedException();
                    var zip=new ZipInputStream(new BufferedInputStream(Files.newInputStream(directory.resolve(name)),65536));
                    try {
                        var entry=zip.getNextEntry();if(entry==null||entry.isDirectory()||!entry.getName().endsWith(".csv"))throw new IOException("Invalid cached Sirene archive");
                        var bounded=new FilterInputStream(zip){
                            long remaining=80L*1024*1024*1024;
                            @Override public int read(byte[] b,int off,int len)throws IOException{if(remaining<=0)throw new IOException("Sirene stock size limit");int n=in.read(b,off,(int)Math.min(len,remaining));if(n>0)remaining-=n;return n;}
                            @Override public int read()throws IOException{if(remaining<=0)throw new IOException("Sirene stock size limit");int n=in.read();if(n>=0)remaining--;return n;}
                        };
                        return CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).build().parse(new InputStreamReader(bounded,StandardCharsets.UTF_8));
                    }catch(Exception e){zip.close();throw e;}
                }
            };
        }
    }
    public static void main(String[] args)throws Exception {
        var app=new SpringApplication(Config.class);app.setWebApplicationType(WebApplicationType.NONE);
        app.setDefaultProperties(Map.of("spring.main.banner-mode","off","logging.level.root","WARN","logging.level.com.baitly.ops","INFO","baitly.directory.national.enabled","true"));
        try(var context=app.run(args)){
            var sync=context.getBean(BaitlyNationalDirectorySync.class);
            if(context.getEnvironment().getProperty("baitly.directory.operator.status-only",Boolean.class,false)){log.info("SIRENE {}",sync.status());return;}
            int replacements=0;
            do {
                try{sync.synchronize();}catch(BaitlyNationalDirectorySource.SourceChangedException e){if(++replacements>1)throw e;continue;}
                log.info("SIRENE {}",sync.status());
                if(!Boolean.TRUE.equals(sync.status().get("enabled")))throw new IllegalStateException("National feed is disabled");
                if(!"COMPLETED".equals(sync.status().get("phase")))Thread.sleep(30_000);
            }while(!"COMPLETED".equals(sync.status().get("phase")));
            if(context.getEnvironment().getProperty("baitly.directory.operator.sirene-only",Boolean.class,false))return;
            var snapshot=Path.of(System.getenv().getOrDefault("BAITLY_DIRECTORY_CACHE","/app/tmp/baitly-directory")).resolve("osm.jsonl");
            log.info("OSM {}",context.getBean(BaitlyNationalOsmEnrichment.class).enrich(snapshot));
            log.info("BAITLY_DIRECTORY_IMPORT_COMPLETED");
        }
    }
}
