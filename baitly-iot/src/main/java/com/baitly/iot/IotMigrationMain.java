package com.baitly.iot;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import liquibase.integration.spring.SpringLiquibase;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** Separate CI/CD entry point; no HTTP server and no runtime credential reuse. */
public final class IotMigrationMain {
    private IotMigrationMain() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 1) throw new IllegalArgumentException("One private migration configuration file is required");
        Path file = Path.of(args[0]);
        if (!Files.isRegularFile(file) || Files.isSymbolicLink(file) || Files.size(file) > 16384) {
            throw new IllegalArgumentException("Invalid migration configuration file");
        }
        Properties config = new Properties();
        try (var reader = Files.newBufferedReader(file)) { config.load(reader); }
        for (String key : new String[]{"url", "username", "password"}) {
            if (config.getProperty(key, "").isBlank()) throw new IllegalArgumentException("Incomplete migration configuration");
        }
        var source = new DriverManagerDataSource(config.getProperty("url"), config.getProperty("username"), config.getProperty("password"));
        var migration = new SpringLiquibase();
        migration.setDataSource(source);
        migration.setChangeLog("classpath:db/changelog/db.changelog-master.yaml");
        migration.afterPropertiesSet();
    }
}
