package com.clenzy.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI api() {
        Info info = new Info()
                .title("Clenzy API")
                .description("API de gestion pour hôtes Airbnb: utilisateurs, logements, demandes de service et interventions")
                .version("1.0.0")
                .contact(new Contact().name("Clenzy").email("support@clenzy.com"))
                .license(new License().name("MIT"));

        Server local = new Server().url("http://localhost:8080").description("Local");

        return new OpenAPI()
                .info(info)
                .servers(List.of(local));
    }
}


