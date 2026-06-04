package com.clenzy.integration.tuya.config;

import com.clenzy.integration.tuya.service.TuyaPlatformConfigService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Credentials du projet Tuya Cloud. Resolution <b>DB-first</b> : si une config est enregistree en
 * base (editable depuis l'UI via {@link TuyaPlatformConfigService}), elle prime ; sinon repli sur les
 * variables d'environnement. Permet de configurer Tuya sans redeploiement.
 *
 * <p>L'injection se fait via {@link ObjectProvider} (resolution paresseuse) pour eviter tout cycle ou
 * initialisation precoce du service (qui depend de la base) lors du bootstrap du contexte.
 */
@Configuration
public class TuyaConfig {

    @Value("${tuya.api.base-url:https://openapi.tuyaeu.com}")
    private String apiBaseUrlEnv;

    @Value("${tuya.api.region:eu}")
    private String regionEnv;

    @Value("${tuya.auth.access-id:}")
    private String accessIdEnv;

    @Value("${tuya.auth.access-secret:}")
    private String accessSecretEnv;

    @Value("${tuya.app.schema:}")
    private String appSchemaEnv;

    @Value("${tuya.app.key:}")
    private String appKeyEnv;

    @Value("${tuya.app.secret:}")
    private String appSecretEnv;

    @Value("${tuya.app.android-key:}")
    private String androidAppKeyEnv;

    @Value("${tuya.app.android-secret:}")
    private String androidAppSecretEnv;

    private final ObjectProvider<TuyaPlatformConfigService> dbConfigProvider;

    public TuyaConfig(ObjectProvider<TuyaPlatformConfigService> dbConfigProvider) {
        this.dbConfigProvider = dbConfigProvider;
    }

    private TuyaPlatformConfigService db() {
        return dbConfigProvider.getIfAvailable();
    }

    // ─── Getters (DB-first, fallback variables d'environnement) ──

    public String getApiBaseUrl() {
        TuyaPlatformConfigService db = db();
        String v = db != null ? db.getApiBaseUrl() : null;
        return isBlank(v) ? apiBaseUrlEnv : v;
    }

    public String getRegion() {
        TuyaPlatformConfigService db = db();
        String v = db != null ? db.getRegion() : null;
        return isBlank(v) ? regionEnv : v;
    }

    public String getAccessId() {
        TuyaPlatformConfigService db = db();
        String v = db != null ? db.getAccessId() : null;
        return isBlank(v) ? accessIdEnv : v;
    }

    public String getAccessSecret() {
        TuyaPlatformConfigService db = db();
        String v = db != null ? db.getAccessSecret() : null;
        return isBlank(v) ? accessSecretEnv : v;
    }

    public String getAppSchema() {
        TuyaPlatformConfigService db = db();
        String v = db != null ? db.getAppSchema() : null;
        return isBlank(v) ? appSchemaEnv : v;
    }

    public String getAppKey() {
        TuyaPlatformConfigService db = db();
        String v = db != null ? db.getAppKey() : null;
        return isBlank(v) ? appKeyEnv : v;
    }

    public String getAppSecret() {
        TuyaPlatformConfigService db = db();
        String v = db != null ? db.getAppSecret() : null;
        return isBlank(v) ? appSecretEnv : v;
    }

    public String getAndroidAppKey() {
        TuyaPlatformConfigService db = db();
        String v = db != null ? db.getAndroidAppKey() : null;
        return isBlank(v) ? androidAppKeyEnv : v;
    }

    public String getAndroidAppSecret() {
        TuyaPlatformConfigService db = db();
        String v = db != null ? db.getAndroidAppSecret() : null;
        return isBlank(v) ? androidAppSecretEnv : v;
    }

    public boolean isConfigured() {
        return !isBlank(getAccessId()) && !isBlank(getAccessSecret());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
