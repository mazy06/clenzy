package com.clenzy.integration.channex.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * Spring config pour le client Channex.
 *
 * <p>Active les {@link ChannexProperties} et expose un {@link RestTemplate}
 * dedie ("channexRestTemplate") avec timeout aligne sur la config.</p>
 */
@Configuration
@EnableConfigurationProperties(ChannexProperties.class)
public class ChannexConfig {

    @Bean("channexRestTemplate")
    public RestTemplate channexRestTemplate(ChannexProperties props) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int millis = (int) props.getTimeout().toMillis();
        factory.setConnectTimeout(millis);
        factory.setReadTimeout(millis);
        return new RestTemplate(factory);
    }
}
