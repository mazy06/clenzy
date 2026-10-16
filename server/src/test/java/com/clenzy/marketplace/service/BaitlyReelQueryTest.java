package com.clenzy.marketplace.service;
import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.BaitlyReelRepository;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Execute the production JPQL: visibility and connection expiry before pagination. */
class BaitlyReelQueryTest {
    @Test void publicFeedRequiresBothPublicationsAndAValidConnection() {
        var config=new Configuration().addAnnotatedClass(BaitlySocialProfile.class).addAnnotatedClass(BaitlyReel.class)
            .setProperty("hibernate.connection.url","jdbc:h2:mem:"+UUID.randomUUID())
            .setProperty("hibernate.hbm2ddl.auto","create-drop");
        try(var sessions=config.buildSessionFactory(); var em=sessions.createEntityManager()) {
            em.getTransaction().begin();
            UUID expected=null;
            for(int i=0;i<4;i++) {
                var p=new BaitlySocialProfile(); p.id=UUID.randomUUID(); p.authorUserId=(long)i; p.organizationId=1L;
                p.displayName="Baitly test"; p.published=i!=1; p.instagramTokenEncrypted="ciphertext";
                p.instagramTokenExpiresAt=Instant.now().plusSeconds(i==2?-3600:3600); em.persist(p);
                var reel=new BaitlyReel(); reel.id=UUID.randomUUID(); reel.socialProfileId=p.id;
                reel.instagramMediaId=String.valueOf(i); reel.permalink="https://www.instagram.com/reel/test/";
                reel.caption=""; reel.createdAt=Instant.now(); reel.published=i!=3; em.persist(reel);
                if(i==0) expected=reel.id;
            }
            em.flush();
            var repo=new JpaRepositoryFactory(em).getRepository(BaitlyReelRepository.class);
            assertThat(repo.publicFeed(PageRequest.of(0,1))).extracting(r -> r.id).containsExactly(expected);
            em.getTransaction().rollback();
        }
    }
}
