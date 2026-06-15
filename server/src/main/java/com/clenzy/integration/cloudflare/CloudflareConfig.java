package com.clenzy.integration.cloudflare;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/** RestTemplate dédié au bridge Cloudflare (timeouts courts ; l'appel est hors transaction). */
@Configuration
public class CloudflareConfig {

    @Bean
    public RestTemplate cloudflareRestTemplate(RestTemplateBuilder builder) {
        return builder
            .connectTimeout(Duration.ofSeconds(5))
            .readTimeout(Duration.ofSeconds(10))
            .build();
    }
}
