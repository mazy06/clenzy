package com.clenzy.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/test")
public class TestController {

    @GetMapping("/health")
    public String health() {
        return "Service de test actif - " + System.currentTimeMillis();
    }

    @GetMapping("/keycloak-sync")
    public String keycloakSyncStatus() {
        return "Service de synchronisation Keycloak disponible";
    }
}
