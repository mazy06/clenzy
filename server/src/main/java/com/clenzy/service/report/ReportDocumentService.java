package com.clenzy.service.report;

import com.clenzy.dto.report.*;
import com.clenzy.model.Property;
import com.clenzy.model.ReportDocument;
import com.clenzy.model.ReportDocumentStatus;
import com.clenzy.model.User;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReportDocumentRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.service.report.narrative.ReportNarrativeService;
import com.clenzy.service.report.render.ReportPdfService;
import com.clenzy.service.report.snapshot.ReportScope;
import com.clenzy.service.report.snapshot.ReportSnapshotBuilder;
import com.clenzy.util.PiiMasker;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Orchestre la production des rapports.
 *
 * <p>Une demande, N documents : c'est ici que le decoupage
 * ({@link ReportGroupBy}) se resout en perimetres, chacun donnant un document
 * numerote et fige. Une conciergerie qui envoie son releve mensuel a vingt
 * proprietaires fait UN appel.</p>
 */
@Service
public class ReportDocumentService {

    private static final Logger log = LoggerFactory.getLogger(ReportDocumentService.class);

    private final ReportSnapshotBuilder snapshotBuilder;
    private final ReportNarrativeService narrativeService;
    private final ReportPdfService pdfService;
    private final ReportDocumentRepository repository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final OrganizationAccessGuard accessGuard;
    private final EmailService emailService;
    private final ObjectMapper objectMapper;

    public ReportDocumentService(ReportSnapshotBuilder snapshotBuilder,
                                 ReportNarrativeService narrativeService,
                                 ReportPdfService pdfService,
                                 ReportDocumentRepository repository,
                                 PropertyRepository propertyRepository,
                                 UserRepository userRepository,
                                 OrganizationRepository organizationRepository,
                                 OrganizationAccessGuard accessGuard,
                                 EmailService emailService,
                                 ObjectMapper objectMapper) {
        this.snapshotBuilder = snapshotBuilder;
        this.narrativeService = narrativeService;
        this.pdfService = pdfService;
        this.repository = repository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.accessGuard = accessGuard;
        this.emailService = emailService;
        this.objectMapper = objectMapper;
    }

    // ── Apercu ──────────────────────────────────────────────────────────────

    /**
     * Calcule un rapport SANS le persister ni le commenter.
     *
     * <p>Sert l'apercu a l'ecran pendant qu'on compose sa demande : on ne
     * numerote pas un brouillon qu'on ajuste, et on ne paie pas un agent a
     * chaque frappe.</p>
     */
    @Transactional(readOnly = true)
    public ReportSnapshot preview(ReportRequest request, Long orgId) {
        final List<ReportScope> scopes = resolveScopes(request, orgId);
        if (scopes.isEmpty()) {
            throw new IllegalArgumentException("Aucun bien dans le perimetre demande");
        }
        return snapshotBuilder.build(request, scopes.get(0), orgId,
                issuerName(orgId), issuerLogo(orgId));
    }

    // ── Generation ──────────────────────────────────────────────────────────

    /**
     * Produit les documents d'une demande.
     *
     * <p>Le commentaire de l'agent est demande hors transaction d'ecriture n'est
     * PAS possible ici sans compliquer le flux : l'appel reste dans la
     * transaction, mais il ne leve jamais (voir {@link ReportNarrativeService}).
     * Une panne de LLM produit un rapport sans commentaire, pas un echec.</p>
     */
    @Transactional
    public List<ReportDocument> generate(ReportRequest request, Long orgId, String keycloakId) {
        final List<ReportScope> scopes = resolveScopes(request, orgId);
        if (scopes.isEmpty()) {
            throw new IllegalArgumentException("Aucun bien dans le perimetre demande");
        }

        final String issuer = issuerName(orgId);
        final String logo = issuerLogo(orgId);
        final List<ReportDocument> produced = new ArrayList<>(scopes.size());
        for (ReportScope scope : scopes) {
            final ReportSnapshot snapshot = snapshotBuilder.build(request, scope, orgId, issuer, logo);
            final ReportNarrative narrative = request.withNarrative()
                    ? narrativeService.narrate(snapshot, orgId)
                    : ReportNarrative.empty();
            produced.add(persist(request, scope, snapshot, narrative, orgId, keycloakId));
        }
        return produced;
    }

    private ReportDocument persist(ReportRequest request, ReportScope scope, ReportSnapshot snapshot,
                                   ReportNarrative narrative, Long orgId, String keycloakId) {
        final String snapshotJson = write(snapshot);
        final String hash = sha256(snapshotJson);

        final ReportDocument document = new ReportDocument();
        document.setOrganizationId(orgId);
        document.setDocumentNumber(nextNumber(orgId));
        document.setProfile(request.profile());
        document.setStatus(ReportDocumentStatus.DRAFT);
        document.setTitle(snapshot.meta().title());
        document.setRecipientUserId(scope.ownerId());
        document.setRecipientName(scope.recipientName());
        document.setRecipientEmail(scope.recipientEmail());
        document.setPeriodStart(request.from());
        document.setPeriodEnd(request.to());
        document.setDataAsOf(snapshot.meta().dataAsOf());
        document.setSnapshotJson(snapshotJson);
        document.setNarrativeJson(narrative == null ? null : write(narrative));
        document.setSnapshotHash(hash);
        document.setCreatedByKeycloakId(keycloakId);
        return repository.save(document);
    }

    // ── Perimetres ──────────────────────────────────────────────────────────

    /**
     * Traduit le decoupage demande en perimetres concrets.
     *
     * <p>Cumule et separe partagent le meme calcul : seule la liste des biens
     * change. C'est ce qui garantit que la somme des releves separes egale le
     * releve cumule, au centime.</p>
     */
    private List<ReportScope> resolveScopes(ReportRequest request, Long orgId) {
        final List<Property> candidates = propertyRepository.findByOrganizationId(orgId).stream()
                .filter(p -> request.propertyIds().isEmpty() || request.propertyIds().contains(p.getId()))
                .filter(p -> request.ownerIds().isEmpty()
                        || (p.getOwner() != null && request.ownerIds().contains(p.getOwner().getId())))
                .toList();

        if (candidates.isEmpty()) {
            return List.of();
        }

        return switch (request.groupBy()) {
            case NONE -> {
                // Un perimetre cumule d'un SEUL proprietaire reste son releve :
                // sans son adresse, le document se produit mais ne peut pas
                // partir — et rien ne le disait avant l'echec de l'envoi.
                final Long ownerId = singleOwnerOf(candidates);
                final User owner = ownerOf(candidates, ownerId);
                yield List.of(new ReportScope(ownerId, keycloakOf(candidates, ownerId),
                        organizationRecipient(candidates),
                        owner == null ? null : owner.getEmail(), candidates));
            }

            case OWNER -> candidates.stream()
                    .filter(p -> p.getOwner() != null)
                    .collect(Collectors.groupingBy(p -> p.getOwner().getId(),
                            LinkedHashMap::new, Collectors.toList()))
                    .entrySet().stream()
                    .map(entry -> {
                        final User owner = entry.getValue().get(0).getOwner();
                        return new ReportScope(entry.getKey(), owner.getKeycloakId(),
                                displayName(owner), owner.getEmail(), entry.getValue());
                    })
                    .toList();

            case PROPERTY -> candidates.stream()
                    .map(property -> new ReportScope(
                            property.getOwner() == null ? null : property.getOwner().getId(),
                            property.getOwner() == null ? null : property.getOwner().getKeycloakId(),
                            property.getName(),
                            property.getOwner() == null ? null : property.getOwner().getEmail(),
                            List.of(property)))
                    .toList();
        };
    }

    /** Un perimetre cumule d'un seul proprietaire reste SON releve : le nom suit. */
    private Long singleOwnerOf(List<Property> properties) {
        final Set<Long> owners = properties.stream()
                .filter(p -> p.getOwner() != null)
                .map(p -> p.getOwner().getId())
                .collect(Collectors.toSet());
        return owners.size() == 1 ? owners.iterator().next() : null;
    }

    /** Le proprietaire unique du perimetre, s'il y en a un. */
    private User ownerOf(List<Property> properties, Long ownerId) {
        if (ownerId == null) {
            return null;
        }
        return properties.stream()
                .filter(p -> p.getOwner() != null && ownerId.equals(p.getOwner().getId()))
                .findFirst().map(Property::getOwner).orElse(null);
    }

    /** L'identifiant Keycloak du proprietaire unique, s'il y en a un. */
    private String keycloakOf(List<Property> properties, Long ownerId) {
        final User owner = ownerOf(properties, ownerId);
        return owner == null ? null : owner.getKeycloakId();
    }

    private String organizationRecipient(List<Property> properties) {
        final Long ownerId = singleOwnerOf(properties);
        if (ownerId == null) {
            return "Portefeuille consolide";
        }
        return properties.stream().filter(p -> p.getOwner() != null).findFirst()
                .map(p -> displayName(p.getOwner())).orElse("Portefeuille consolide");
    }

    private String displayName(User user) {
        if (user == null) {
            return "Destinataire";
        }
        if (user.getCompanyName() != null && !user.getCompanyName().isBlank()) {
            return user.getCompanyName();
        }
        final String name = String.join(" ",
                Objects.toString(user.getFirstName(), ""), Objects.toString(user.getLastName(), "")).trim();
        return name.isBlank() ? Objects.toString(user.getEmail(), "Destinataire") : name;
    }

    /** L'emetteur AFFICHE : la conciergerie, jamais Baitly — le document est le sien. */
    private String issuerName(Long orgId) {
        return organizationRepository.findById(orgId)
                .map(com.clenzy.model.Organization::getName)
                .filter(name -> name != null && !name.isBlank())
                .orElse("Votre gestionnaire");
    }

    /** Le logo de marque blanche, s'il est configure. Resolu au RENDU, pas ici. */
    private String issuerLogo(Long orgId) {
        return organizationRepository.findById(orgId)
                .map(com.clenzy.model.Organization::getBrandingLogoUrl)
                .filter(url -> url != null && !url.isBlank())
                .orElse(null);
    }

    // ── Lecture, relecture, diffusion ───────────────────────────────────────

    @Transactional(readOnly = true)
    public ReportDocument load(Long id, Long orgId) {
        final ReportDocument document = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Rapport introuvable : " + id));
        accessGuard.requireSameOrganization(document.getOrganizationId(), orgId,
                "Rapport hors de votre organisation");
        return document;
    }

    @Transactional(readOnly = true)
    public List<ReportDocument> list(Long orgId) {
        return repository.findByOrganizationIdOrderByCreatedAtDesc(orgId,
                org.springframework.data.domain.PageRequest.of(0, 100)).getContent();
    }

    /**
     * Rend le PDF.
     *
     * <p>Volontairement HORS transaction : le rendu resout le logo de marque
     * blanche, donc une requete reseau — jamais dans une transaction (regle
     * n°2) — et un document de seize pages retiendrait la connexion pendant
     * tout son assemblage. Le chargement, lui, a sa propre transaction.</p>
     */
    public byte[] pdf(Long id, Long orgId) {
        final ReportDocument document = load(id, orgId);
        return pdfService.toPdf(readSnapshot(document), readNarrative(document),
                document.getStatus() == ReportDocumentStatus.DRAFT);
    }

    public String html(Long id, Long orgId) {
        final ReportDocument document = load(id, orgId);
        return pdfService.toHtml(readSnapshot(document), readNarrative(document),
                document.getStatus() == ReportDocumentStatus.DRAFT);
    }

    /**
     * Supprime un rapport.
     *
     * <p>Un document DEJA ENVOYE ne se supprime pas : il fait foi de ce qui a
     * ete transmis a un proprietaire, et l'effacer effacerait la trace de
     * l'envoi. Ce qu'on supprime, ce sont les brouillons et les relus — les
     * essais, pas les preuves.</p>
     */
    @Transactional
    public void delete(Long id, Long orgId) {
        final ReportDocument document = load(id, orgId);
        if (document.getSentAt() != null) {
            throw new IllegalStateException(
                    "Un rapport transmis à son destinataire ne se supprime pas : il fait foi de l'envoi");
        }
        repository.delete(document);
    }

    /**
     * Transmet le rapport a son destinataire.
     *
     * <p>L'ENVOI VAUT RELECTURE. Il y avait auparavant une etape « marquer
     * relu » distincte, que l'envoi exigeait : deux clics pour un seul acte,
     * puisque personne n'envoie un document a un proprietaire sans l'avoir
     * regarde. La garantie qui comptait — qu'un commentaire redige
     * automatiquement n'atteigne personne sans decision humaine — tient au geste
     * d'envoi lui-meme, qui est explicite et trace : on enregistre ici qui a
     * envoye, et donc qui a valide.</p>
     *
     * <p>Un document deja transmis est fige : toute reprise cree une version,
     * jamais une modification en place — sans quoi l'emetteur et le destinataire
     * discutent de deux documents portant le meme numero.</p>
     *
     * <p>L'envoi est repousse APRES le commit — jamais d'appel externe dans une
     * transaction.</p>
     */
    @Transactional
    public ReportDocument send(Long id, Long orgId, String keycloakId, List<String> recipients) {
        final ReportDocument document = load(id, orgId);
        if (document.getStatus() == ReportDocumentStatus.SENT) {
            throw new IllegalStateException(
                    "Ce rapport a déjà été transmis : produisez une nouvelle version");
        }
        final List<String> addresses = addressees(document, recipients);
        if (addresses.isEmpty()) {
            throw new IllegalStateException("Aucune adresse pour ce destinataire");
        }

        final ReportSnapshot snapshot = readSnapshot(document);
        final String issuer = snapshot.meta().issuerName();
        final byte[] pdf = pdfService.toPdf(snapshot, readNarrative(document), false);
        final String subject = document.getTitle() + " — "
                + ReportFormats.period(document.getPeriodStart(), document.getPeriodEnd());
        final String filename = document.getDocumentNumber() + ".pdf";
        final String body = coverEmail(snapshot, document);

        document.setStatus(ReportDocumentStatus.SENT);
        document.setSentAt(LocalDateTime.now());
        // Qui envoie valide : c'est la trace de la decision humaine.
        document.setReviewedAt(LocalDateTime.now());
        document.setReviewedByKeycloakId(keycloakId);
        final ReportDocument saved = repository.save(document);

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                // Un envoi par adresse, et l'echec de l'un n'emporte pas les
                // autres : un carnet d'adresses comporte toujours une adresse
                // morte, et le co-indivisaire n'a pas a payer pour elle.
                for (String address : addresses) {
                    try {
                        // Marque blanche : le proprietaire voit le nom de SA
                        // conciergerie, et sa reponse lui parvient.
                        emailService.sendDocumentEmail(address, subject, body, filename, pdf,
                                issuer, null);
                    } catch (Exception e) {
                        log.error("Envoi du rapport {} a {} impossible",
                                saved.getDocumentNumber(), PiiMasker.maskEmail(address), e);
                    }
                }
            }
        });
        return saved;
    }

    /**
     * Les adresses effectives de l'envoi.
     *
     * <p>Sans demande explicite, c'est le destinataire du document — le
     * comportement historique. Les adresses fournies sont normalisees et
     * dedoublonnees : la meme personne cochee deux fois ne recoit pas deux
     * fois le meme releve.</p>
     */
    private List<String> addressees(ReportDocument document, List<String> requested) {
        final LinkedHashSet<String> addresses = new LinkedHashSet<>();
        final List<String> source = requested == null || requested.isEmpty()
                ? List.of(String.valueOf(document.getRecipientEmail()))
                : requested;

        for (String candidate : source) {
            if (candidate == null) {
                continue;
            }
            final String address = candidate.trim().toLowerCase(Locale.ROOT);
            if (address.isBlank() || "null".equals(address)) {
                continue;
            }
            // Un filtre grossier, delibere : valider une adresse au sens de la
            // norme est un piege, et c'est le serveur SMTP qui tranche pour de
            // bon. On barre ici ce qui ne peut PAS etre une adresse.
            if (!address.matches("[^@\\s]+@[^@\\s.]+\\.[^@\\s]+")) {
                throw new IllegalArgumentException("Adresse invalide : " + address);
            }
            addresses.add(address);
        }
        return List.copyOf(addresses);
    }

    /**
     * Le message qui accompagne le document.
     *
     * <p>Il porte les chiffres cles pour que le destinataire sache, sans ouvrir
     * la piece jointe, si la periode demande son attention. Quand la periode
     * est VIDE, il le dit en toutes lettres : annoncer « Revenus : 0,00 € » en
     * tete d'un message laisse croire a une panne plutot qu'a une absence de
     * sejour.</p>
     */
    private String coverEmail(ReportSnapshot snapshot, ReportDocument document) {
        final StringBuilder body = new StringBuilder(512);
        body.append("<p>Bonjour,</p>");
        body.append("<p>Vous trouverez ci-joint votre ")
                .append(escape(document.getTitle().toLowerCase(Locale.FRANCE)))
                .append(" pour la période ")
                .append(escape(ReportFormats.period(document.getPeriodStart(), document.getPeriodEnd())))
                .append(".</p>");

        final boolean empty = snapshot.kpis().stream()
                .allMatch(kpi -> kpi.rawValue() == null || kpi.rawValue().signum() == 0);

        if (empty) {
            body.append("<p>Aucun séjour n'a été enregistré sur cette période. ")
                    .append("Le document en détaille le périmètre et les mois qui portent de l'activité.</p>");
        } else {
            body.append("<ul>");
            snapshot.kpis().stream().limit(3).forEach(kpi ->
                    body.append("<li><strong>").append(escape(kpi.label())).append("</strong> : ")
                            .append(escape(kpi.value())).append("</li>"));
            body.append("</ul>");
        }

        body.append("<p>").append(escape(snapshot.meta().issuerName())).append("</p>");
        return body.toString();
    }

    // ── Numerotation et empreinte ───────────────────────────────────────────

    /**
     * Numero sequentiel par organisation et par annee.
     *
     * <p>La sequence est tiree du dernier numero attribue, dans la meme
     * transaction que l'insertion : l'index unique
     * {@code (organization_id, document_number, version)} rattrape une course
     * eventuelle plutot que de laisser passer un doublon silencieux.</p>
     */
    private String nextNumber(Long orgId) {
        final String prefix = "R-" + Year.now().getValue() + "-";
        final int last = repository.findLastNumber(orgId, prefix + "%")
                .map(number -> number.substring(prefix.length()))
                .map(suffix -> {
                    try {
                        return Integer.parseInt(suffix);
                    } catch (NumberFormatException e) {
                        return 0;
                    }
                })
                .orElse(0);
        return prefix + String.format("%04d", last + 1);
    }

    private String sha256(String value) {
        try {
            final MessageDigest digest = MessageDigest.getInstance("SHA-256");
            final byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            final StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("Empreinte du snapshot impossible", e);
        }
    }

    // ── Serialisation ───────────────────────────────────────────────────────

    public ReportSnapshot readSnapshot(ReportDocument document) {
        try {
            return objectMapper.readValue(document.getSnapshotJson(), ReportSnapshot.class);
        } catch (Exception e) {
            throw new IllegalStateException("Snapshot du rapport illisible : " + document.getId(), e);
        }
    }

    public ReportNarrative readNarrative(ReportDocument document) {
        if (document.getNarrativeJson() == null) {
            return ReportNarrative.empty();
        }
        try {
            return objectMapper.readValue(document.getNarrativeJson(), ReportNarrative.class);
        } catch (Exception e) {
            log.warn("Commentaire du rapport {} illisible, ignore", document.getId());
            return ReportNarrative.empty();
        }
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Serialisation du rapport impossible", e);
        }
    }

    private static String escape(String value) {
        return com.clenzy.util.StringUtils.escapeHtml(value == null ? "" : value);
    }
}
