package com.baitly.ops;

import com.clenzy.marketplace.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.jdbc.*;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.context.annotation.*;
import java.time.Duration;
import java.util.Map;

/** One-shot local/CD operator. No web server, application scan or scheduled jobs. */
public final class BaitlyPublicDirectoryImport {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(BaitlyPublicDirectoryImport.class);
    @Configuration(proxyBeanMethods=false)
    @Import({DataSourceAutoConfiguration.class,JdbcTemplateAutoConfiguration.class,
        DataSourceTransactionManagerAutoConfiguration.class,RedisAutoConfiguration.class,
        BaitlyDirectoryCountrySync.class,BaitlyDirectoryCountryStock.class,
        BaitlySaudiOsmStock.class,BaitlyMoroccoPublicStock.class,BaitlyWathqClient.class,BaitlyDirectoryMapIndex.class})
    public static class Config {
        @Bean ObjectMapper objectMapper(){return new ObjectMapper().findAndRegisterModules();}
        @Bean SimpleMeterRegistry meterRegistry(){return new SimpleMeterRegistry();}
        @Bean
        @org.springframework.boot.autoconfigure.condition.ConditionalOnProperty("baitly.directory.operator.changelog")
        liquibase.integration.spring.SpringLiquibase operatorMigration(javax.sql.DataSource dataSource,
                org.springframework.core.env.Environment env){
            var migration=new liquibase.integration.spring.SpringLiquibase();migration.setDataSource(dataSource);
            migration.setChangeLog(env.getRequiredProperty("baitly.directory.operator.changelog"));return migration;
        }
    }
    public static void main(String[] args)throws Exception {
        var app=new SpringApplication(Config.class);app.setWebApplicationType(WebApplicationType.NONE);
        app.setDefaultProperties(Map.ofEntries(
            Map.entry("spring.main.banner-mode","off"), Map.entry("logging.level.root","WARN"),
            Map.entry("logging.level.com.baitly.ops","INFO"),
            Map.entry("spring.datasource.hikari.maximum-pool-size","3"), Map.entry("spring.datasource.hikari.minimum-idle","0"),
            Map.entry("spring.data.redis.host","${spring.redis.host:redis}"),
            Map.entry("spring.data.redis.port","${spring.redis.port:6379}"),
            Map.entry("spring.data.redis.password","${spring.redis.password:}"),
            Map.entry("baitly.directory.sa.enabled","false"), Map.entry("baitly.directory.sa.osm.enabled","true"),
            Map.entry("baitly.directory.ma.enabled","false"), Map.entry("baitly.directory.ma.osm.enabled","true")));

        try(var context=app.run(args)){
            String country=BaitlyDirectoryCountry.country(context.getEnvironment().getProperty("baitly.directory.operator.country","SA"));
            if(!java.util.Set.of("MA","SA").contains(country))throw new IllegalArgumentException("Public country required");
            var source=(country.equals("MA")?context.getBean(BaitlyMoroccoPublicStock.class):context.getBean(BaitlySaudiOsmStock.class)).refresh();
            if(!(country+"_PUBLIC").equals(source.manifest().source()))throw new IllegalStateException("Combined public country edition required");
            var sync=context.getBean(BaitlyDirectoryCountrySync.class);
            long deadline=System.nanoTime()+Duration.ofMinutes(30).toNanos();
            do {
                if(System.nanoTime()>deadline)throw new IllegalStateException("Public country import timeout");
                sync.synchronize(country,true);var state=sync.status(country);
                log.info("BAITLY_PUBLIC_IMPORT {}",state);
                if(((Number)state.getOrDefault("failures",0)).intValue()>0)throw new IllegalStateException("Public country import failed");
                if("COMPLETED".equals(state.get("phase"))&&Boolean.TRUE.equals(context.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
                    .queryForObject("SELECT source_manifest->>'sha256'=? FROM baitly_directory_sync WHERE country_code=?",Boolean.class,source.manifest().sha256(),country)))break;
                Thread.sleep(1000);
            }while(true);
            var index=context.getBean(BaitlyDirectoryMapIndex.class);
            while(!index.state().tiles()){
                if(System.nanoTime()>deadline)throw new IllegalStateException("Public country map indexing timeout");
                index.rebuild();Thread.sleep(2100);
            }
            boolean published=Boolean.TRUE.equals(context.getBean(org.springframework.jdbc.core.JdbcTemplate.class)
                .queryForObject("SELECT phase='COMPLETED' AND source_manifest->>'sha256'=? FROM baitly_directory_sync WHERE country_code=?",Boolean.class,source.manifest().sha256(),country));
            if(!published)throw new IllegalStateException("Public country edition changed during map indexing; rerun the deployment");
            log.info("BAITLY_PUBLIC_IMPORT_COMPLETED {} index={}",sync.status(country),index.state());
        }
    }
}
