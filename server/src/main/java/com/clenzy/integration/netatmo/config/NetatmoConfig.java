package com.clenzy.integration.netatmo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Constantes non secretes de l'integration Netatmo (URLs API Connect + scopes OAuth).
 *
 * Les credentials (client_id / client_secret / redirect_uri) ne sont PLUS ici : ils
 * sont saisis depuis l'UI et persistes chiffres en base — cf.
 * {@code NetatmoPlatformConfigService} / {@code NetatmoPlatformConfig}.
 *
 * Scopes par defaut couvrant les 3 familles supportees :
 * read_station (meteo) · read/write_thermostat · read/access_camera + read/access_presence
 * (cameras) · read_smokedetector (fumee).
 */
@Configuration
public class NetatmoConfig {

    @Value("${netatmo.api.base-url:https://api.netatmo.com}")
    private String apiBaseUrl;

    @Value("${netatmo.oauth.authorization-url:https://api.netatmo.com/oauth2/authorize}")
    private String authorizationUrl;

    @Value("${netatmo.oauth.token-url:https://api.netatmo.com/oauth2/token}")
    private String tokenUrl;

    @Value("${netatmo.oauth.scopes:read_station read_thermostat write_thermostat read_camera access_camera read_presence access_presence read_smokedetector}")
    private String scopes;

    public String getApiBaseUrl() { return apiBaseUrl; }
    public String getAuthorizationUrl() { return authorizationUrl; }
    public String getTokenUrl() { return tokenUrl; }
    public String getScopes() { return scopes; }
}
