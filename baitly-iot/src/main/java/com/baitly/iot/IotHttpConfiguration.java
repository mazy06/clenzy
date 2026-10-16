package com.baitly.iot;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.StreamReadConstraints;
import org.apache.catalina.connector.Connector;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jackson2.autoconfigure.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class IotHttpConfiguration {
    @Bean
    WebServerFactoryCustomizer<TomcatServletWebServerFactory> internalConnector(
            @Value("${baitly.iot.internal-port:8096}") int port,
            @Value("${server.port:8095}") int ingestionPort,
            @Value("${baitly.iot.internal-address:127.0.0.1}") String address) {
        if (port < 1 || port > 65535 || port == ingestionPort) {
            throw new IllegalStateException("Baitly IoT requires distinct ingestion and internal ports");
        }
        return factory -> {
            Connector connector = new Connector(TomcatServletWebServerFactory.DEFAULT_PROTOCOL);
            connector.setPort(port);
            connector.setProperty("address", address);
            connector.setProperty("connectionTimeout", "5000");
            connector.setProperty("maxConnections", "64");
            connector.setProperty("maxThreads", "16");
            connector.setProperty("acceptCount", "16");
            connector.setMaxPostSize(4096);
            connector.setMaxSavePostSize(0);
            factory.addAdditionalConnectors(connector);
        };
    }

    @Bean
    Jackson2ObjectMapperBuilderCustomizer boundedJson() {
        return builder -> builder.featuresToEnable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
                .postConfigurer(mapper -> mapper.getFactory().setStreamReadConstraints(StreamReadConstraints.builder()
                        .maxNestingDepth(8).maxNumberLength(32).maxStringLength(256).build()));
    }
}
