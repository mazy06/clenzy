package com.baitly.iot;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** Private file read by the CI/CD jobs (migration, retention); never by the HTTP runtime. */
final class PrivateDatabaseConfiguration {
    private PrivateDatabaseConfiguration() {}

    static Properties load(String[] args, String purpose) throws IOException {
        if (args.length != 1) throw new IllegalArgumentException("One private " + purpose + " configuration file is required");
        Path file = Path.of(args[0]);
        if (!Files.isRegularFile(file) || Files.isSymbolicLink(file) || Files.size(file) > 16384) {
            throw new IllegalArgumentException("Invalid " + purpose + " configuration file");
        }
        Properties config = new Properties();
        try (var reader = Files.newBufferedReader(file)) { config.load(reader); }
        for (String key : new String[]{"url", "username", "password"}) {
            if (config.getProperty(key, "").isBlank()) throw new IllegalArgumentException("Incomplete " + purpose + " configuration");
        }
        return config;
    }

    static DriverManagerDataSource dataSource(Properties config) {
        return new DriverManagerDataSource(config.getProperty("url"), config.getProperty("username"), config.getProperty("password"));
    }
}
