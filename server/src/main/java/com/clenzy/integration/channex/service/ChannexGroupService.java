package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexOrganizationGroup;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexOrganizationGroupRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Cloisonnement du hub Channex par organisation, via les <b>groups</b> Channex.
 *
 * <h2>Le probleme</h2>
 * <p>La cle API Channex est unique pour toute la plateforme. {@code GET
 * /properties} renvoie donc le compte entier : sans cloisonnement, la
 * decouverte presentait a une organisation les logements d'une autre — titre,
 * devise, prix, capacite — et, avant les garde-fous poses cote import, lui
 * permettait de se les approprier.</p>
 *
 * <h2>La primitive</h2>
 * <p>Channex impose qu'un logement appartienne a au moins un group, et expose
 * le contenu d'un group via {@code GET /groups/:id}. On donne a chaque
 * organisation le sien : tout ce que Baitly cree y atterrit, et la decouverte
 * ne montre plus le contenu des groups des autres.</p>
 *
 * <h2>Deux choix qui meritent d'etre explicites</h2>
 * <ul>
 *   <li><b>Fail-open sur la visibilite, jamais fail-closed sur le travail.</b>
 *       Si le hub refuse de provisionner un group, on cree quand meme le
 *       logement (sans group) : bloquer l'onboarding sur un mecanisme
 *       d'isolation serait pire que l'etat actuel, qui n'est pas aggrave. Le
 *       controle d'appropriation cote import, lui, reste inconditionnel.</li>
 *   <li><b>Un logement sans group Baitly reste visible de tous.</b> Masquer
 *       tout ce qui n'est pas explicitement rattache ferait disparaitre du
 *       jour au lendemain les logements crees hors de ce mecanisme. On masque
 *       ce qui appartient a une AUTRE organisation, pas ce qui n'appartient a
 *       personne.</li>
 * </ul>
 */
@Service
public class ChannexGroupService {

    private static final Logger log = LoggerFactory.getLogger(ChannexGroupService.class);

    /**
     * Titre canonique du group d'une organisation. Deterministe a dessein : si
     * la table de correspondance est perdue, la re-provision retrouve le group
     * existant sur le hub par son titre au lieu d'en creer un doublon.
     */
    static String canonicalTitle(Long orgId) {
        return "Baitly Org " + orgId;
    }

    private final ChannexClient channexClient;
    private final ChannexOrganizationGroupRepository groupRepository;
    private final ChannexPropertyMappingRepository mappingRepository;

    public ChannexGroupService(ChannexClient channexClient,
                                 ChannexOrganizationGroupRepository groupRepository,
                                 ChannexPropertyMappingRepository mappingRepository) {
        this.channexClient = channexClient;
        this.groupRepository = groupRepository;
        this.mappingRepository = mappingRepository;
    }

    // ─── Provision ──────────────────────────────────────────────────────────

    /**
     * Group de l'organisation, cree si absent. Idempotent.
     *
     * <p>Transaction propre ({@code REQUIRES_NEW}) : l'appelant peut etre au
     * milieu d'un flux long qui echouera plus loin, et le group provisionne
     * doit survivre — sinon la ligne locale disparait alors que le group existe
     * bel et bien sur le hub, et l'appel suivant en creerait un second.</p>
     *
     * @return le group id, ou {@link Optional#empty()} si le hub n'a pas pu le
     *         fournir (fail-open : l'appelant continue sans cloisonnement)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<String> resolveGroupId(Long orgId) {
        if (orgId == null) return Optional.empty();

        Optional<ChannexOrganizationGroup> known = groupRepository.findByOrganizationId(orgId);
        if (known.isPresent()) return Optional.of(known.get().getChannexGroupId());

        String title = canonicalTitle(orgId);
        try {
            // Reprise : le group peut deja exister sur le hub sans ligne locale.
            String groupId = channexClient.fetchGroupsByTitle().get(title);
            if (groupId == null) {
                groupId = channexClient.createGroup(title);
            } else {
                log.info("ChannexGroup: group existant '{}' reattache a l'org {}", title, orgId);
            }

            ChannexOrganizationGroup row = new ChannexOrganizationGroup();
            row.setOrganizationId(orgId);
            row.setChannexGroupId(groupId);
            row.setTitle(title);
            groupRepository.save(row);
            return Optional.of(groupId);
        } catch (Exception e) {
            log.warn("ChannexGroup: provision du group de l'org {} impossible ({}). "
                + "Le logement sera cree SANS cloisonnement — il restera visible des autres "
                + "organisations tant qu'un backfill n'aura pas ete relance.", orgId, e.getMessage());
            return Optional.empty();
        }
    }

    // ─── Lecture cloisonnee ─────────────────────────────────────────────────

    /**
     * Properties du hub appartenant a une AUTRE organisation que celle passee.
     *
     * <p>C'est la liste que la decouverte doit masquer. On interroge chaque
     * group plutot que de filtrer les properties : {@code GET /properties}
     * n'accepte pas de filtre par group (filtres documentes : {@code id},
     * {@code title}, {@code is_active}).</p>
     *
     * <p>Best-effort par group : si l'un est injoignable, on masque quand meme
     * ce que les autres ont revele. Retourner un ensemble vide sur echec
     * rouvrirait silencieusement la fuite qu'on ferme ici.</p>
     */
    public Set<String> propertyIdsOwnedByOtherOrgs(Long orgId) {
        Set<String> foreign = new HashSet<>();
        for (ChannexOrganizationGroup group : groupRepository.findAllBy()) {
            if (orgId != null && orgId.equals(group.getOrganizationId())) continue;
            try {
                foreign.addAll(channexClient.fetchPropertyIdsInGroup(group.getChannexGroupId()));
            } catch (Exception e) {
                log.warn("ChannexGroup: contenu du group {} (org {}) illisible : {} — "
                    + "ses logements peuvent rester visibles a tort",
                    group.getChannexGroupId(), group.getOrganizationId(), e.getMessage());
            }
        }
        return foreign;
    }

    // ─── Rattachement ───────────────────────────────────────────────────────

    /**
     * Place une property dans le group de son organisation, et l'en retire de
     * tous les autres.
     *
     * <p>L'ordre rattacher-puis-detacher est impose par Channex, qui refuse de
     * retirer une property de son unique group.</p>
     *
     * @return true si la property est desormais cloisonnee
     */
    public boolean assignPropertyToOrgGroup(Long orgId, String channexPropertyId) {
        Optional<String> targetGroup = resolveGroupId(orgId);
        if (targetGroup.isEmpty()) return false;
        String groupId = targetGroup.get();

        List<String> currentGroups;
        try {
            currentGroups = channexClient.fetchPropertyGroupIds(channexPropertyId);
        } catch (Exception e) {
            log.warn("ChannexGroup: groups de la property {} illisibles : {}",
                channexPropertyId, e.getMessage());
            currentGroups = List.of();
        }

        if (!currentGroups.contains(groupId)) {
            try {
                channexClient.addPropertyToGroup(groupId, channexPropertyId);
            } catch (Exception e) {
                log.warn("ChannexGroup: rattachement de {} au group {} KO : {}",
                    channexPropertyId, groupId, e.getMessage());
                return false;
            }
        }

        // Un logement dans deux groups reste visible depuis les deux : le
        // cloisonnement n'existe que si les autres appartenances tombent.
        for (String other : currentGroups) {
            if (other.equals(groupId)) continue;
            try {
                channexClient.removePropertyFromGroup(other, channexPropertyId);
            } catch (Exception e) {
                log.warn("ChannexGroup: detachement de {} du group {} KO : {} — "
                    + "le logement reste visible via ce group",
                    channexPropertyId, other, e.getMessage());
            }
        }
        return true;
    }

    // ─── Reprise de l'existant ──────────────────────────────────────────────

    /** Compte-rendu d'un backfill, une ligne par organisation touchee. */
    public record BackfillReport(
        int organizationsProvisioned,
        int propertiesAssigned,
        int propertiesAlreadyIsolated,
        int failures,
        List<String> messages
    ) {}

    /**
     * Rattache au group de leur organisation toutes les properties du hub deja
     * mappees dans Baitly. Idempotent : re-jouable sans effet de bord.
     *
     * <p>C'est la reprise de l'existant : avant ce chantier, toutes les
     * properties vivaient dans le group par defaut du compte, donc visibles de
     * tous. Tant que ce backfill n'a pas tourne, le cloisonnement ne couvre que
     * ce qui a ete cree apres.</p>
     *
     * <p>Ne touche PAS les properties non mappees : sans mapping, rien ne dit a
     * quelle organisation elles appartiennent — les rattacher arbitrairement
     * serait une attribution inventee.</p>
     */
    public BackfillReport backfillExistingProperties() {
        List<ChannexPropertyMapping> all = mappingRepository.findAllAcrossOrgs();
        Map<Long, String> groupByOrg = new HashMap<>();
        Map<String, Set<String>> membersByGroup = new HashMap<>();
        List<String> messages = new ArrayList<>();
        int provisioned = 0;
        int assigned = 0;
        int already = 0;
        int failures = 0;

        for (ChannexPropertyMapping mapping : all) {
            Long orgId = mapping.getOrganizationId();
            String propertyId = mapping.getChannexPropertyId();

            String groupId = groupByOrg.get(orgId);
            if (groupId == null) {
                boolean isNew = groupRepository.findByOrganizationId(orgId).isEmpty();
                Optional<String> resolved = resolveGroupId(orgId);
                if (resolved.isEmpty()) {
                    failures++;
                    messages.add("Org " + orgId + " : provision du group impossible");
                    continue;
                }
                groupId = resolved.get();
                groupByOrg.put(orgId, groupId);
                if (isNew) provisioned++;
            }

            // Un seul GET par group, pas un par logement : le contenu du group
            // ne bouge que par nos propres ecritures, qu'on reporte en memoire.
            Set<String> members = membersByGroup.computeIfAbsent(groupId, gid -> {
                try {
                    return new HashSet<>(channexClient.fetchPropertyIdsInGroup(gid));
                } catch (Exception e) {
                    log.warn("ChannexGroup[BACKFILL]: contenu du group {} illisible : {}",
                        gid, e.getMessage());
                    return new HashSet<>();
                }
            });

            if (members.contains(propertyId)) {
                already++;
                continue;
            }
            if (assignPropertyToOrgGroup(orgId, propertyId)) {
                members.add(propertyId);
                assigned++;
            } else {
                failures++;
                messages.add("Property " + propertyId + " (org " + orgId + ") : rattachement KO");
            }
        }

        log.info("ChannexGroup[BACKFILL]: {} group(s) provisionne(s), {} logement(s) rattache(s), "
            + "{} deja cloisonne(s), {} echec(s)", provisioned, assigned, already, failures);
        return new BackfillReport(provisioned, assigned, already, failures, messages);
    }

    // ─── Purge des logements sans organisation ──────────────────────────────

    /** Titre de la pivot OAuth active — voir {@code ChannexImportService.setupGlobalOauth}. */
    private static final String ACTIVE_PIVOT_TITLE = "[Clenzy Hub] OAuth Bridge";

    /** Sort d'un logement du hub au regard de la purge. */
    public record UngroupedProperty(
        String channexPropertyId,
        String title,
        /** PURGE (candidat), DELETED, FAILED, ou KEPT. */
        String decision,
        String reason
    ) {}

    /**
     * Compte-rendu de purge.
     *
     * @param blockedByPendingBackfill vrai si des logements MAPPES ne sont pas
     *        encore cloisonnes : dans cet etat, « sans group » ne veut pas dire
     *        « sans proprietaire », et la purge est refusee
     */
    public record UngroupedPurgeReport(
        boolean dryRun,
        boolean blockedByPendingBackfill,
        int totalInHub,
        int candidates,
        int deleted,
        int failures,
        List<UngroupedProperty> items
    ) {}

    /**
     * Supprime du hub les logements qui n'appartiennent a aucune organisation
     * Baitly : ni dans un group, ni mappes, ni relies a une plateforme.
     *
     * <h2>Le verrou</h2>
     * <p>Tant qu'un logement <b>mappe</b> n'est pas cloisonne, l'absence de
     * group ne prouve rien : elle peut signifier « ne nous appartient pas »
     * comme « cree avant les groups ». La purge est alors <b>refusee en bloc</b>
     * et renvoie {@code blockedByPendingBackfill} — lancer le backfill d'abord.
     * Sans ce verrou, une purge lancee trop tot detruirait les logements de
     * production.</p>
     *
     * <h2>Ce qui est epargne, et pourquoi</h2>
     * <ul>
     *   <li><b>dans un group Baitly</b> — appartient a une organisation ;</li>
     *   <li><b>mappe dans Baitly</b> — a un proprietaire, meme sans group ;</li>
     *   <li><b>relie a une plateforme</b> — quelqu'un distribue avec, et
     *       Channex refuse la suppression d'une property sous channel ;</li>
     *   <li><b>pivot OAuth active</b> — une connexion peut etre en cours dans
     *       l'assistant Channex ; la supprimer casserait le flux en vol. Les
     *       pivots consommees ({@code [Clenzy] OAuth Container ...}), elles,
     *       sont purgeables.</li>
     * </ul>
     *
     * @param dryRun true = simulation, aucun appel destructif (defaut souhaitable)
     */
    public UngroupedPurgeReport purgeUngroupedHubProperties(boolean dryRun) {
        var hub = channexClient.fetchAllPropertiesRaw();
        if (hub == null || !hub.path("data").isArray()) {
            return new UngroupedPurgeReport(dryRun, false, 0, 0, 0, 0, List.of());
        }

        // Union des logements cloisonnes, toutes organisations confondues.
        Set<String> grouped = new HashSet<>();
        for (ChannexOrganizationGroup group : groupRepository.findAllBy()) {
            try {
                grouped.addAll(channexClient.fetchPropertyIdsInGroup(group.getChannexGroupId()));
            } catch (Exception e) {
                // Un group illisible ferait passer son contenu pour orphelin :
                // on ne peut pas purger sur une vue partielle.
                log.warn("ChannexGroup[PURGE]: group {} illisible ({}) — purge annulee",
                    group.getChannexGroupId(), e.getMessage());
                return new UngroupedPurgeReport(dryRun, true, hub.path("data").size(), 0, 0, 0,
                    List.of(new UngroupedProperty(null, null, "KEPT",
                        "Contenu d'un group illisible : impossible de distinguer les orphelins")));
            }
        }

        Set<String> mapped = new HashSet<>();
        for (ChannexPropertyMapping m : mappingRepository.findAllAcrossOrgs()) {
            mapped.add(m.getChannexPropertyId());
        }

        // Verrou : un logement mappe hors group = backfill non joue.
        boolean blocked = mapped.stream().anyMatch(id -> !grouped.contains(id));

        Set<String> withChannels = propertyIdsWithChannels();

        List<UngroupedProperty> items = new ArrayList<>();
        int candidates = 0;
        int deleted = 0;
        int failures = 0;

        for (var prop : hub.path("data")) {
            String id = prop.path("id").asText(null);
            if (id == null) continue;
            String title = prop.path("attributes").path("title").asText("");

            String keptReason = null;
            if (grouped.contains(id)) keptReason = "Rattaché à une organisation";
            else if (mapped.contains(id)) keptReason = "Connecté à Baitly (backfill à relancer)";
            else if (withChannels.contains(id)) keptReason = "Relié à une plateforme";
            else if (ACTIVE_PIVOT_TITLE.equals(title)) keptReason = "Connecteur OAuth actif";

            if (keptReason != null) {
                items.add(new UngroupedProperty(id, title, "KEPT", keptReason));
                continue;
            }

            candidates++;
            if (dryRun || blocked) {
                items.add(new UngroupedProperty(id, title, "PURGE",
                    "Aucune organisation, aucun mapping, aucune plateforme"));
                continue;
            }
            try {
                channexClient.deleteProperty(id);
                deleted++;
                items.add(new UngroupedProperty(id, title, "DELETED", "Supprimé du hub"));
            } catch (Exception e) {
                failures++;
                items.add(new UngroupedProperty(id, title, "FAILED", e.getMessage()));
            }
        }

        if (blocked) {
            log.warn("ChannexGroup[PURGE]: refusee — des logements connectes ne sont pas encore "
                + "cloisonnes. Lancer le backfill avant toute purge.");
        } else {
            log.info("ChannexGroup[PURGE]: dryRun={} — {} candidat(s), {} supprime(s), {} echec(s)",
                dryRun, candidates, deleted, failures);
        }
        return new UngroupedPurgeReport(dryRun, blocked, hub.path("data").size(),
            candidates, deleted, failures, items);
    }

    /** Logements du hub portant au moins un channel OTA. */
    private Set<String> propertyIdsWithChannels() {
        Set<String> ids = new HashSet<>();
        var channels = channexClient.fetchAllChannelsRaw();
        if (channels == null || !channels.path("data").isArray()) return ids;
        for (var channel : channels.path("data")) {
            var attrsProps = channel.path("attributes").path("properties");
            if (attrsProps.isArray()) {
                for (var pid : attrsProps) {
                    String id = pid.asText(null);
                    if (id != null && !id.isBlank()) ids.add(id);
                }
            }
            var rels = channel.path("relationships").path("properties").path("data");
            if (rels.isArray()) {
                for (var r : rels) {
                    String id = r.path("id").asText(null);
                    if (id != null && !id.isBlank()) ids.add(id);
                }
            }
        }
        return ids;
    }
}
