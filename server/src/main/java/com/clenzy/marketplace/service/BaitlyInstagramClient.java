package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;
import java.net.URI;
import java.util.Map;

/** Fixed Meta endpoints only. No downloading, uploading or proxying video binaries. */
@Service
public class BaitlyInstagramClient {
    private final RestClient http;
    private final String appId, secret, redirect, version;
    public BaitlyInstagramClient(@Value("${baitly.instagram.app-id:${BAITLY_INSTAGRAM_APP_ID:}}") String appId,
            @Value("${baitly.instagram.app-secret:${BAITLY_INSTAGRAM_APP_SECRET:}}") String secret,
            @Value("${baitly.instagram.redirect-uri:${BAITLY_INSTAGRAM_REDIRECT_URI:}}") String redirect,
            @Value("${baitly.instagram.api-version:${BAITLY_INSTAGRAM_API_VERSION:v25.0}}") String version) {
        this.appId=appId; this.secret=secret; this.redirect=redirect; this.version=version;
        var factory=new SimpleClientHttpRequestFactory(); factory.setConnectTimeout(5000); factory.setReadTimeout(10000);
        http=RestClient.builder().requestFactory(factory).build();
    }
    public boolean configured() {
        try { var uri=URI.create(redirect); return appId.matches("[0-9]+") && !secret.isBlank()
            && "https".equals(uri.getScheme()) && uri.getHost()!=null && version.matches("v[0-9]+\\.0")
            && "/api/public/baitly-catalog/instagram/callback".equals(uri.getPath()); }
        catch(IllegalArgumentException e) { return false; }
    }
    public String authorizationUrl(String state) {
        if(!configured()) throw new IllegalStateException("Connexion Instagram non configurée");
        return UriComponentsBuilder.fromHttpUrl("https://www.instagram.com/oauth/authorize")
            .queryParam("client_id",appId).queryParam("redirect_uri",redirect).queryParam("response_type","code")
            .queryParam("scope","instagram_business_basic").queryParam("state",state).queryParam("enable_fb_login",0)
            .build().encode().toUriString();
    }
    public record Grant(String token,long expiresIn,String userId,String username) {}
    public Grant exchange(String code) {
        if(!configured() || code==null || code.isBlank() || code.length()>4096) throw new IllegalArgumentException("Autorisation Instagram invalide");
        var form=new LinkedMultiValueMap<String,String>();
        form.set("client_id",appId); form.set("client_secret",secret); form.set("grant_type","authorization_code");
        form.set("redirect_uri",redirect); form.set("code",code);
        var shortToken=http.post().uri("https://api.instagram.com/oauth/access_token").contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form).retrieve().body(JsonNode.class);
        String token=required(shortToken,"access_token");
        var uri=UriComponentsBuilder.fromHttpUrl("https://graph.instagram.com/access_token")
            .queryParam("grant_type","ig_exchange_token").queryParam("client_secret",secret).queryParam("access_token",token)
            .build().encode().toUri();
        var longToken=http.get().uri(uri).retrieve().body(JsonNode.class);
        token=required(longToken,"access_token"); long expires=longToken.path("expires_in").asLong(0);
        if(expires<=0) throw new IllegalStateException("Expiration Instagram manquante");
        var me=graph("me",token,Map.of("fields","user_id,username"));
        String userId=required(me,"user_id");
        if(!userId.matches("[0-9]+")) throw new IllegalStateException("Identité Instagram invalide");
        return new Grant(token,expires,userId,required(me,"username"));
    }
    public JsonNode videos(String userId,String token,String after) {
        if(!userId.matches("[0-9]+") || (after!=null && after.length()>1024)) throw new IllegalArgumentException("Pagination Instagram invalide");
        var params=new java.util.LinkedHashMap<String,String>(); params.put("fields","id,caption,media_type,permalink,thumbnail_url,media_url,timestamp");
        params.put("limit","25"); if(after!=null && !after.isBlank()) params.put("after",after);
        return graph(userId+"/media",token,params);
    }
    public JsonNode video(String mediaId,String token) {
        if(!mediaId.matches("[0-9]+")) throw new IllegalArgumentException("Vidéo Instagram invalide");
        return graph(mediaId,token,Map.of("fields","id,media_type,media_url,thumbnail_url,permalink"));
    }
    private JsonNode graph(String path,String token,Map<String,String> params) {
        var uri=UriComponentsBuilder.fromHttpUrl("https://graph.instagram.com/"+version+"/"+path);
        params.forEach(uri::queryParam);
        return http.get().uri(uri.build().encode().toUri()).headers(headers -> headers.setBearerAuth(token)).retrieve().body(JsonNode.class);
    }
    private static String required(JsonNode value,String key) {
        if(value==null || value.path(key).asText().isBlank()) throw new IllegalStateException("Réponse Instagram incomplète");
        return value.path(key).asText();
    }
}
