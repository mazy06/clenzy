package com.clenzy.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import java.io.FileInputStream;
import java.io.InputStream;

@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    @Value("${firebase.credentials-path:}")
    private String credentialsPath;

    @PostConstruct
    public void initialize() {
        if (FirebaseApp.getApps().isEmpty()) {
            try {
                InputStream serviceAccount;

                if (credentialsPath != null && !credentialsPath.isBlank()) {
                    // Chemin externe (production)
                    serviceAccount = new FileInputStream(credentialsPath);
                } else {
                    // Classpath fallback (dev)
                    ClassPathResource resource = new ClassPathResource("firebase-service-account.json");
                    if (!resource.exists()) {
                        log.warn("Firebase non configure: firebase-service-account.json introuvable. Push notifications desactivees.");
                        return;
                    }
                    serviceAccount = resource.getInputStream();
                }

                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .build();

                FirebaseApp.initializeApp(options);
                log.info("Firebase initialise avec succes");

            } catch (Exception e) {
                log.warn("Firebase non initialise: {}. Push notifications desactivees.", e.getMessage());
            }
        }
    }
}
