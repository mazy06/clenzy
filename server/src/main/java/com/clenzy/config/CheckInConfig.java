package com.clenzy.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "clenzy.checkin")
public class CheckInConfig {

    private String baseUrl = "https://app.clenzy.fr/checkin";
    private int tokenTtlDays = 30;
    private int maxDocumentSizeMb = 10;
    private String storagePath = "/var/clenzy/checkin-documents";

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public int getTokenTtlDays() { return tokenTtlDays; }
    public void setTokenTtlDays(int tokenTtlDays) { this.tokenTtlDays = tokenTtlDays; }
    public int getMaxDocumentSizeMb() { return maxDocumentSizeMb; }
    public void setMaxDocumentSizeMb(int maxDocumentSizeMb) { this.maxDocumentSizeMb = maxDocumentSizeMb; }
    public String getStoragePath() { return storagePath; }
    public void setStoragePath(String storagePath) { this.storagePath = storagePath; }
}
