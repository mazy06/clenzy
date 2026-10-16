package com.clenzy.marketplace.service;
import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.service.TokenEncryptionService;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.core.*;
import org.springframework.security.access.AccessDeniedException;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyReelsTest {
    final BaitlySocialProfileRepository profiles=mock(BaitlySocialProfileRepository.class);
    final BaitlyReelRepository reels=mock(BaitlyReelRepository.class);
    final ProviderAccountResolver accounts=mock(ProviderAccountResolver.class);
    final TenantContext tenant=mock(TenantContext.class);
    final BaitlyInstagramClient instagram=mock(BaitlyInstagramClient.class);
    final StringRedisTemplate redis=mock(StringRedisTemplate.class);
    final ValueOperations<String,String> values=mock(ValueOperations.class);
    final TokenEncryptionService encryption=mock(TokenEncryptionService.class);
    final Instant now=Instant.parse("2026-10-12T12:00:00Z");
    final ObjectMapper json=new ObjectMapper().findAndRegisterModules();
    final BaitlyReelAuthors authors=mock(BaitlyReelAuthors.class);
    final BaitlyReels service=new BaitlyReels(profiles,reels,accounts,tenant,Clock.fixed(now,ZoneOffset.UTC),instagram,redis,encryption,json,authors);
    BaitlySocialProfile profile;
    @BeforeEach void setup() {
        profile=new BaitlySocialProfile(); profile.id=UUID.randomUUID(); profile.organizationId=2L; profile.authorUserId=1L;
        profile.displayName="Toufik M."; profile.instagramUserId="123";
        profile.instagramTokenEncrypted="encrypted"; profile.instagramTokenExpiresAt=now.plusSeconds(3600);
        when(accounts.userIdOf("subject")).thenReturn(1L); when(tenant.getRequiredOrganizationId()).thenReturn(2L);
        when(profiles.findByOrganizationIdAndAuthorUserId(2L,1L)).thenReturn(Optional.of(profile));
        when(redis.opsForValue()).thenReturn(values);
    }
    @Test void rejectsAnonymousAndScopesSettingsToCurrentOrganization() {
        when(accounts.userIdOf("unknown")).thenReturn(null);
        assertThatThrownBy(() -> service.settings("unknown")).isInstanceOf(AccessDeniedException.class);
        service.settings("subject"); verify(profiles).findByOrganizationIdAndAuthorUserId(2L,1L);
    }
    @Test void firstVisitReturnsConnectionAvailabilityWithoutCreatingAPublicProfile() {
        when(profiles.findByOrganizationIdAndAuthorUserId(2L,1L)).thenReturn(Optional.empty());
        when(instagram.configured()).thenReturn(true);
        var settings=service.settings("subject");
        assertThat(settings.id()).isNull();
        assertThat(settings.displayName()).isEmpty();
        assertThat(settings.instagramConfigured()).isTrue();
        assertThat(settings.instagramConnected()).isFalse();
        assertThat(settings.published()).isFalse();
        verify(profiles,never()).saveAndFlush(any());
    }
    @Test void rejectsForgedMediaNotReturnedByTheConnectedAccount() {
        assertThatThrownBy(() -> service.share("subject",new BaitlyReels.ShareVideo("789","",true))).isInstanceOf(AccessDeniedException.class);
        verify(reels,never()).saveAndFlush(any());
    }
    @Test void rejectsDeletionOfAnotherAuthorsVideo() {
        var reel=new BaitlyReel(); reel.id=UUID.randomUUID(); reel.socialProfileId=UUID.randomUUID();
        when(reels.findById(reel.id)).thenReturn(Optional.of(reel));
        assertThatThrownBy(() -> service.delete("subject",reel.id)).isInstanceOf(AccessDeniedException.class);
        verify(reels,never()).delete(any());
    }
    @Test void acceptsOnlyOwnedVideoMetadataAndNeverStoresVideoBinary() throws Exception {
        when(values.get("baitly:instagram:owned:"+profile.id+":123:789")).thenReturn("{\"media_type\":\"VIDEO\",\"permalink\":\"https://www.instagram.com/reel/ABC/\",\"thumbnail_url\":\"https://image.cdninstagram.com/a.jpg\"}");
        when(reels.findBySocialProfileIdAndInstagramMediaId(profile.id,"789")).thenReturn(Optional.empty());
        when(reels.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        var result=service.share("subject",new BaitlyReels.ShareVideo("789","Bienvenue",true));
        assertThat(result.videoUrl()).isNull(); assertThat(result.instagramMediaId()).isEqualTo("789");
        assertThat(json.writeValueAsString(result)).doesNotContain("encrypted","organizationId","authorUserId");
    }
    @Test void oauthStateIsConsumedOnceAndTokenIsEncrypted() {
        String state=UUID.randomUUID().toString();
        when(values.getAndDelete("baitly:instagram:state:"+state)).thenReturn(profile.id.toString(),null);
        when(profiles.findLockedById(profile.id)).thenReturn(Optional.of(profile));
        when(instagram.exchange("code")).thenReturn(new BaitlyInstagramClient.Grant("secret-token",3600,"123","host"));
        when(encryption.encrypt("secret-token")).thenReturn("ciphertext");
        service.callback(state,"code");
        assertThat(profile.instagramTokenEncrypted).isEqualTo("ciphertext");
        assertThatThrownBy(() -> service.callback(state,"code")).isInstanceOf(AccessDeniedException.class);
        verify(instagram,times(1)).exchange("code");
    }
    @Test void disconnectRemovesAllPublicReferencesAndConnection() {
        service.disconnect("subject");
        assertThat(profile.instagramTokenEncrypted).isNull(); assertThat(profile.published).isFalse();
        verify(reels).deleteBySocialProfileId(profile.id);
    }
    @Test void metaErasurePurgesOnlyProfilesForVerifiedInstagramIdentity() {
        when(profiles.findByInstagramUserId("123")).thenReturn(List.of(profile));
        when(redis.scan(any())).thenAnswer(call -> {
            var cursor=mock(org.springframework.data.redis.core.Cursor.class);
            when(cursor.hasNext()).thenReturn(false);
            return cursor;
        });
        service.eraseInstagramData("123");
        verify(reels).deleteBySocialProfileId(profile.id);
        verify(profiles).delete(profile);
        verify(profiles).flush();
        verifyNoInteractions(accounts,tenant);
    }
    @Test void blockedAndUnavailableMediaNeverAppearsInPublicFeed() {
        var reel=new BaitlyReel(); reel.id=UUID.randomUUID(); reel.socialProfileId=profile.id; reel.instagramMediaId="789";
        when(reels.publicFeed(any())).thenReturn(List.of(reel)); when(profiles.findById(profile.id)).thenReturn(Optional.of(profile));
        when(values.get("baitly:instagram:play:"+profile.id+":123:789")).thenReturn("{\"media_type\":\"VIDEO\",\"media_url\":\"https://localhost/private\"}");
        assertThat(service.feed(0)).isEmpty();
    }
    @Test void mediaDomainValidationRejectsSpoofedHosts() {
        assertThat(BaitlyReels.safeMediaUrl("https://video.fbcdn.net/a.mp4")).isTrue();
        assertThat(BaitlyReels.safeMediaUrl("https://video.fbcdn.net.evil.test/a.mp4")).isFalse();
        assertThat(BaitlyReels.safeMediaUrl("https://user@video.fbcdn.net/a.mp4")).isFalse();
    }
    @Test void selectionPreservesOwnedVideosOutsideTheLoadedGalleryPage() {
        var reel=new BaitlyReel(); reel.id=UUID.randomUUID(); reel.socialProfileId=profile.id;
        reel.instagramMediaId="789"; reel.published=true;
        when(reels.findTop100BySocialProfileIdOrderByCreatedAtDesc(profile.id)).thenReturn(List.of(reel));
        service.select("subject",new BaitlyReels.Selection(List.of("789")));
        verify(reels,never()).delete(any()); verify(reels,never()).saveAndFlush(any());
    }
    @Test void selectionRejectsIdsThatWereNotOfferedByTheConnectedAccount() {
        when(reels.findTop100BySocialProfileIdOrderByCreatedAtDesc(profile.id)).thenReturn(List.of());
        assertThatThrownBy(() -> service.select("subject",new BaitlyReels.Selection(List.of("789")))).isInstanceOf(AccessDeniedException.class);
        verify(reels,never()).saveAndFlush(any());
    }
}
