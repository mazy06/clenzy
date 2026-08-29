package com.clenzy.service;

import com.clenzy.AbstractIntegrationTest;
import com.clenzy.dto.ContactMessageDto;
import com.clenzy.dto.ContactThreadSummaryDto;
import com.clenzy.model.ContactMessageCategory;
import com.clenzy.model.ContactThread;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Fils de groupe, sur une VRAIE base.
 *
 * <p>Les tests unitaires du contact mockent les repositories : ils ne voient ni
 * une requete JPQL que PostgreSQL refuse, ni une colonne devenue nullable qui
 * fait exploser le regroupement un-a-un. Deux pannes reelles sont nees de la —
 * un {@code :param IS NULL} sur un timestamp que Postgres n'arrive pas a typer,
 * et un {@code recipientKeycloakId} null balaye par la liste des conversations.
 * Ce test exerce le chemin complet : ouverture, message, listing, lecture.</p>
 */
class ContactThreadIT extends AbstractIntegrationTest {

    private Long orgId;

    @Autowired private ContactThreadService threadService;
    @Autowired private com.clenzy.repository.OrganizationRepository organizationRepository;
    @Autowired private ContactMessageService messageService;
    @Autowired private UserRepository userRepository;

    @org.junit.jupiter.api.BeforeEach
    void useOrg() {
        com.clenzy.model.Organization org = organizationRepository.save(new com.clenzy.model.Organization(
                "Org fils", com.clenzy.model.OrganizationType.INDIVIDUAL,
                "org-fils-" + System.nanoTime()));
        orgId = org.getId();
        setupTenantContext(orgId, false);
    }

    private User newUser(String suffix, UserRole role) {
        User user = new User();
        user.setKeycloakId("kc-" + suffix);
        user.setEmail(suffix + "@baitly.test");
        user.setFirstName("Prenom" + suffix);
        user.setLastName("Nom" + suffix);
        user.setRole(role);
        user.setOrganizationId(orgId);
        return userRepository.save(user);
    }

    @Test
    @DisplayName("un fil reunit ses participants, et chacun le voit avec ses non-lus")
    void groupThread_isVisibleToEveryParticipant() {
        User provider = newUser("intervenant", UserRole.TECHNICIAN);
        User owner = newUser("proprietaire", UserRole.HOST);

        ContactThread thread = threadService.openThread(
                orgId, "Devis — fuite cuisine",
                ContactMessageCategory.MAINTENANCE, provider.getKeycloakId(),
                "SERVICE_QUOTE_INTERVENTION", 4242L, List.of(owner.getKeycloakId()));

        threadService.post(thread, provider.getKeycloakId(), null,
                "Je propose 320 EUR pour cette intervention.", null,
                "{\"kind\":\"SERVICE_QUOTE\",\"quoteId\":1}");

        // Le proprietaire voit le fil, et le message y est non-lu pour lui :
        // c'est ce comptage qui echouait au niveau SQL.
        List<ContactThreadSummaryDto> ownerThreads =
                threadService.listMyThreads(owner.getKeycloakId(), false);
        assertThat(ownerThreads).hasSize(1);
        assertThat(ownerThreads.get(0).threadId()).isEqualTo(thread.getId());
        assertThat(ownerThreads.get(0).title()).isEqualTo("Devis — fuite cuisine");
        assertThat(ownerThreads.get(0).participantNames()).hasSize(2);
        assertThat(ownerThreads.get(0).unreadCount()).isEqualTo(1);

        // L'auteur voit le meme fil, sans non-lu : il ne s'ecrit pas a lui-meme.
        assertThat(threadService.listMyThreads(provider.getKeycloakId(), false))
                .singleElement()
                .satisfies(summary -> assertThat(summary.unreadCount()).isZero());

        // La carte structuree survit a l'aller-retour.
        List<ContactMessageDto> messages =
                threadService.messages(thread.getId(), owner.getKeycloakId());
        assertThat(messages).singleElement()
                .satisfies(message -> assertThat(message.payload()).isNotNull());

        threadService.markAsRead(thread.getId(), owner.getKeycloakId());
        assertThat(threadService.listMyThreads(owner.getKeycloakId(), false))
                .singleElement()
                .satisfies(summary -> assertThat(summary.unreadCount()).isZero());
    }

    @Test
    @DisplayName("le fil est idempotent par objet metier : un second devis le poursuit")
    void openThread_isIdempotentPerReference() {
        User provider = newUser("intervenant2", UserRole.TECHNICIAN);

        ContactThread first = threadService.openThread(
                orgId, "Devis", ContactMessageCategory.MAINTENANCE,
                provider.getKeycloakId(), "SERVICE_QUOTE_INTERVENTION", 777L, List.of());
        ContactThread second = threadService.openThread(
                orgId, "Devis (bis)", ContactMessageCategory.MAINTENANCE,
                provider.getKeycloakId(), "SERVICE_QUOTE_INTERVENTION", 777L, List.of());

        assertThat(second.getId()).isEqualTo(first.getId());
    }

    @Test
    @DisplayName("un message de fil ne pollue pas les conversations un-a-un")
    void groupMessages_areExcludedFromOneToOneThreads() {
        User provider = newUser("intervenant3", UserRole.TECHNICIAN);
        User owner = newUser("proprietaire3", UserRole.HOST);

        ContactThread thread = threadService.openThread(
                orgId, "Devis", ContactMessageCategory.MAINTENANCE,
                provider.getKeycloakId(), "SERVICE_QUOTE_INTERVENTION", 999L,
                List.of(owner.getKeycloakId()));
        threadService.post(thread, provider.getKeycloakId(), null, "Bonjour", null);

        // Le message de groupe n'a PAS de destinataire : le regroupement par
        // interlocuteur explosait dessus au lieu de l'ignorer.
        assertThat(messageService.getThreads(jwtOf(provider))).isEmpty();
        assertThat(messageService.getThreads(jwtOf(owner))).isEmpty();
    }

    private org.springframework.security.oauth2.jwt.Jwt jwtOf(User user) {
        return org.springframework.security.oauth2.jwt.Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(user.getKeycloakId())
                .claim("email", user.getEmail())
                .build();
    }
}
