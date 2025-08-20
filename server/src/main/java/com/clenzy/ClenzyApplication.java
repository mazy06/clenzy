package com.clenzy;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling // Activer la planification des tâches pour la synchronisation automatique
public class ClenzyApplication {

    public static void main(String[] args) {
        SpringApplication.run(ClenzyApplication.class, args);
    }
}
