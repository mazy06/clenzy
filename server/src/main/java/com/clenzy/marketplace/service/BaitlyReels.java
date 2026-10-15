package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.service.ICalUrlValidator;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.constraints.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import java.time.*;
import java.util.*;
import com.fasterxml.jackson.databind.*;
import com.clenzy.service.TokenEncryptionService;
import org.springframework.data.redis.core.StringRedisTemplate;

@Service @Transactional
public class BaitlyReels {
    private final BaitlySocialProfileRepository profiles;
    private final BaitlyReelRepository reels;
    private final ProviderAccountResolver accounts;
    private final TenantContext tenant;
    private final Clock clock;
    private final BaitlyInstagramClient instagram;
    private final StringRedisTemplate redis;
    private final TokenEncryptionService encryption;
    private final ObjectMapper json;
    private final BaitlyReelAuthors authors;
    public BaitlyReels(BaitlySocialProfileRepository profiles,BaitlyReelRepository reels,
            ProviderAccountResolver accounts,TenantContext tenant,Clock clock,BaitlyInstagramClient instagram,
            StringRedisTemplate redis,TokenEncryptionService encryption,ObjectMapper json,BaitlyReelAuthors authors) {
        this.profiles=profiles; this.reels=reels; this.accounts=accounts; this.tenant=tenant; this.clock=clock;
        this.instagram=instagram; this.redis=redis; this.encryption=encryption; this.json=json;
        this.authors=authors;
    }
    public record SocialSettings(@NotBlank @Size(max=150) String displayName,
        @Size(max=2048) String instagramUrl,@Size(max=2048) String tiktokUrl,@Size(max=2048) String youtubeUrl,boolean published) {}
    public record ShareVideo(@NotBlank @Pattern(regexp="[0-9]+") @Size(max=100) String instagramMediaId,@NotNull @Size(max=500) String caption,boolean published) {}
    public record SocialView(String id,String displayName,String instagramUrl,String tiktokUrl,String youtubeUrl,boolean published,
        boolean instagramConfigured,boolean instagramConnected,String instagramUsername) {}
    public record ReelView(String id,String instagramMediaId,String videoUrl,String thumbnailUrl,String permalink,String caption,boolean published,Instant createdAt,SocialView author,BaitlyReelAuthors.Author creator) {}
    public record InstagramVideo(String id,String caption,String thumbnailUrl,String permalink) {}
    public record VideoPage(List<InstagramVideo> items,String after) {}
    public record Selection(@NotNull @Size(max=100) List<@NotNull @Pattern(regexp="[0-9]+") @Size(max=100) String> mediaIds) {}

    private Optional<BaitlySocialProfile> own(String subject) {
        Long user=accounts.userIdOf(subject);
        if(user==null) throw new AccessDeniedException("Compte indisponible");
        return profiles.findByOrganizationIdAndAuthorUserId(tenant.getRequiredOrganizationId(),user);
    }
    @Transactional(readOnly=true) public SocialView settings(String subject) {
        return own(subject).map(this::view).orElseGet(() ->
            new SocialView(null,"",null,null,null,false,instagram.configured(),false,null));
    }
    public SocialView settings(String subject,SocialSettings command) {
        var p=own(subject).orElseGet(BaitlySocialProfile::new);
        if(p.id==null) { p.id=UUID.randomUUID(); p.organizationId=tenant.getRequiredOrganizationId(); p.authorUserId=accounts.userIdOf(subject); }
        p.displayName=command.displayName().trim(); p.published=command.published();
        p.instagramUrl=socialUrl(command.instagramUrl(),"instagram.com");
        p.tiktokUrl=socialUrl(command.tiktokUrl(),"tiktok.com");
        p.youtubeUrl=socialUrl(command.youtubeUrl(),"youtube.com","youtu.be");
        return view(profiles.saveAndFlush(p));
    }
    public ReelView share(String subject,ShareVideo command) {
        var p=own(subject).orElseThrow(() -> new IllegalArgumentException("Configurez votre profil Réel"));
        if(reels.countBySocialProfileIdAndCreatedAtAfter(p.id,clock.instant().minus(Duration.ofDays(1)))>=20)
            throw new IllegalArgumentException("Limite quotidienne de vidéos atteinte");
        requireConnection(p);
        var media=readCache(ownedKey(p,command.instagramMediaId()));
        if(media==null || !"VIDEO".equals(media.path("media_type").asText())) throw new AccessDeniedException("Sélectionnez une vidéo de votre compte Instagram");
        var reel=reels.findBySocialProfileIdAndInstagramMediaId(p.id,command.instagramMediaId()).orElseGet(BaitlyReel::new);
        if(reel.id==null && reels.countBySocialProfileId(p.id)>=100) throw new IllegalArgumentException("Maximum de 100 vidéos par profil");
        if(reel.id==null) { reel.id=UUID.randomUUID(); reel.socialProfileId=p.id; reel.createdAt=clock.instant(); }
        reel.instagramMediaId=command.instagramMediaId(); reel.permalink=media.path("permalink").asText();
        URI permalink=URI.create(reel.permalink);
        if(!"https".equals(permalink.getScheme()) || !Set.of("www.instagram.com","instagram.com").contains(permalink.getHost()) || permalink.getUserInfo()!=null)
            throw new IllegalArgumentException("Lien Instagram invalide");
        reel.thumbnailUrl=media.path("thumbnail_url").asText(null);
        reel.caption=command.caption().trim(); reel.published=command.published();
        return view(reels.saveAndFlush(reel),p,null);
    }
    public void delete(String subject,UUID id) {
        var p=own(subject).orElseThrow(() -> new AccessDeniedException("Profil indisponible"));
        var reel=reels.findById(id).orElseThrow(() -> new IllegalArgumentException("Vidéo indisponible"));
        if(!reel.socialProfileId.equals(p.id)) throw new AccessDeniedException("Vidéo non autorisée");
        reels.delete(reel);
    }
    /** One transaction: a failed selection never leaves a partly published batch. */
    public List<ReelView> select(String subject,Selection command) {
        var p=own(subject).orElseThrow(() -> new AccessDeniedException("Profil indisponible")); requireConnection(p);
        var selected=new HashSet<>(command.mediaIds());
        var existing=reels.findTop100BySocialProfileIdOrderByCreatedAtDesc(p.id);
        for(var reel:existing) if(!selected.contains(reel.instagramMediaId)) reels.delete(reel);
        reels.flush();
        for(String id:selected) {
            if(existing.stream().anyMatch(r -> r.instagramMediaId.equals(id) && r.published)) continue;
            var media=readCache(ownedKey(p,id));
            if(media==null) throw new AccessDeniedException("Rechargez la galerie Instagram");
            String caption=media.path("caption").asText("");
            share(subject,new ShareVideo(id,caption.substring(0,Math.min(caption.length(),500)),true));
        }
        return ownVideos(subject);
    }
    @Transactional(readOnly=true) public List<ReelView> ownVideos(String subject) {
        return own(subject).map(p -> reels.findTop100BySocialProfileIdOrderByCreatedAtDesc(p.id).stream().map(r -> view(r,p,null)).toList()).orElseGet(List::of);
    }
    @Transactional(readOnly=true) public List<ReelView> feed(int page) {
        if(page<0 || page>1000) throw new IllegalArgumentException("Page invalide");
        var authorViews=new HashMap<UUID,BaitlyReelAuthors.Author>();
        return reels.publicFeed(PageRequest.of(page,20)).stream().map(r -> {
            var p=profiles.findById(r.socialProfileId).orElseThrow();
            try {
                var media=readCache(playKey(p,r.instagramMediaId));
                if(media==null) { media=instagram.video(r.instagramMediaId,encryption.decrypt(p.instagramTokenEncrypted)); cache(playKey(p,r.instagramMediaId),media); }
                if(!"VIDEO".equals(media.path("media_type").asText())) return null;
                String url=media.path("media_url").asText();
                if(!safeMediaUrl(url)) return null;
                return view(r,p,media,authorViews.computeIfAbsent(p.id,id -> authors.resolve(p)));
            } catch(RuntimeException e) { return null; } // Deleted/revoked media is never replaced by a stale download.
        }).filter(Objects::nonNull).toList();
    }
    private SocialView view(BaitlySocialProfile p) { return new SocialView(p.id.toString(),p.displayName,p.instagramUrl,p.tiktokUrl,p.youtubeUrl,p.published,
        instagram.configured(),connected(p),p.instagramUsername); }
    private ReelView view(BaitlyReel r,BaitlySocialProfile p,JsonNode media) { return view(r,p,media,authors.resolve(p)); }
    private ReelView view(BaitlyReel r,BaitlySocialProfile p,JsonNode media,BaitlyReelAuthors.Author creator) { return new ReelView(r.id.toString(),r.instagramMediaId,media==null?null:media.path("media_url").asText(null),
        media==null?r.thumbnailUrl:media.path("thumbnail_url").asText(r.thumbnailUrl),r.permalink,r.caption,r.published,r.createdAt,view(p),creator); }
    public Map<String,String> connect(String subject) {
        var p=own(subject).orElseThrow(() -> new IllegalArgumentException("Configurez votre profil Réel"));
        String state=UUID.randomUUID().toString(); String url=instagram.authorizationUrl(state);
        redis.opsForValue().set("baitly:instagram:state:"+state,p.id.toString(),Duration.ofMinutes(10));
        return Map.of("url",url);
    }
    public void callback(String state,String code) {
        if(state==null || !state.matches("[0-9a-fA-F-]{36}")) throw new AccessDeniedException("Autorisation expirée");
        String id=redis.opsForValue().getAndDelete("baitly:instagram:state:"+state);
        if(id==null) throw new AccessDeniedException("Autorisation expirée");
        var p=profiles.findLockedById(UUID.fromString(id)).orElseThrow();
        var grant=instagram.exchange(code);
        if(p.instagramUserId!=null && !p.instagramUserId.equals(grant.userId()))
            reels.deleteBySocialProfileId(p.id);
        p.instagramUserId=grant.userId(); p.instagramUsername=grant.username();
        p.instagramTokenEncrypted=encryption.encrypt(grant.token());
        p.instagramTokenExpiresAt=clock.instant().plusSeconds(grant.expiresIn()); profiles.saveAndFlush(p);
    }
    public void disconnect(String subject) {
        var p=own(subject).orElseThrow(); p.instagramTokenEncrypted=null; p.instagramTokenExpiresAt=null;
        p.published=false; profiles.saveAndFlush(p);
        reels.deleteBySocialProfileId(p.id);
    }
    /** Called only after verification of Meta's app-specific signed request. */
    public void eraseInstagramData(String instagramUserId) {
        for (var profile : profiles.findByInstagramUserId(instagramUserId)) {
            // Purge only this Réel profile's media caches; never enumerate other tenants.
            for (String type : List.of("owned", "play")) {
                var options = org.springframework.data.redis.core.ScanOptions.scanOptions()
                    .match("baitly:instagram:" + type + ":" + profile.id + ":*").count(100).build();
                try (var keys = redis.scan(options)) {
                    while (keys.hasNext()) redis.delete(keys.next());
                }
            }
            reels.deleteBySocialProfileId(profile.id);
            // A pending OAuth callback can no longer re-create the deleted profile.
            profiles.delete(profile);
        }
        profiles.flush();
    }
    @Transactional(readOnly=true) public VideoPage videos(String subject,String after) {
        var p=own(subject).orElseThrow(() -> new IllegalArgumentException("Configurez votre profil Réel")); requireConnection(p);
        var result=instagram.videos(p.instagramUserId,encryption.decrypt(p.instagramTokenEncrypted),after);
        var items=new ArrayList<InstagramVideo>();
        for(var media:result.path("data")) {
            if(!"VIDEO".equals(media.path("media_type").asText())) continue;
            String id=media.path("id").asText();
            if(!id.matches("[0-9]+")) continue;
            cache(ownedKey(p,id),media); cache(playKey(p,id),media);
            items.add(new InstagramVideo(id,media.path("caption").asText(""),media.path("thumbnail_url").asText(null),media.path("permalink").asText()));
        }
        return new VideoPage(items,result.path("paging").has("next") ? result.path("paging").path("cursors").path("after").asText(null) : null);
    }
    private boolean connected(BaitlySocialProfile p) { return p.instagramTokenEncrypted!=null && p.instagramTokenExpiresAt!=null && p.instagramTokenExpiresAt.isAfter(clock.instant()); }
    private void requireConnection(BaitlySocialProfile p) { if(!connected(p)) throw new IllegalArgumentException("Reconnectez Instagram"); }
    private String ownedKey(BaitlySocialProfile p,String id) { return "baitly:instagram:owned:"+p.id+":"+p.instagramUserId+":"+id; }
    private String playKey(BaitlySocialProfile p,String id) { return "baitly:instagram:play:"+p.id+":"+p.instagramUserId+":"+id; }
    private JsonNode readCache(String key) {
        String raw=redis.opsForValue().get(key); if(raw==null) return null;
        try { return json.readTree(raw); } catch(Exception e) { return null; }
    }
    private void cache(String key,JsonNode media) { redis.opsForValue().set(key,media.toString(),Duration.ofMinutes(10)); }
    static boolean safeMediaUrl(String value) {
        try { var uri=URI.create(value); String host=Objects.toString(uri.getHost(),"").toLowerCase(Locale.ROOT);
            return "https".equals(uri.getScheme()) && uri.getUserInfo()==null && uri.getPort()==-1
                && (host.endsWith(".cdninstagram.com") || host.endsWith(".fbcdn.net")); }
        catch(IllegalArgumentException e) { return false; }
    }
    static String socialUrl(String value,String... domains) {
        if(value==null || value.isBlank()) return null;
        String url=value.trim(); var uri=URI.create(url);
        String host=Objects.toString(uri.getHost(),"").toLowerCase(Locale.ROOT);
        if(!"https".equals(uri.getScheme()) || uri.getUserInfo()!=null || (uri.getPort()!=-1 && uri.getPort()!=443)
            || Arrays.stream(domains).noneMatch(domain -> host.equals(domain) || host.endsWith("."+domain)))
            throw new IllegalArgumentException("Lien social invalide");
        ICalUrlValidator.validateAndResolve(url); // Validate once; the server never fetches remote media.
        return url;
    }
}
