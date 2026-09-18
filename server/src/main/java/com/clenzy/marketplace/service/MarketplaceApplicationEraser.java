package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.ProviderDocument;
import com.clenzy.repository.ProviderDocumentRepository;
import com.clenzy.service.PhotoStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Effacement d'une candidature : les octets, puis les lignes.
 *
 * <p>Extrait parce que DEUX chemins y menent et qu'ils doivent effacer
 * exactement pareil — la retention automatique et la demande d'effacement. Deux
 * copies de cet ordre finiraient par diverger, et la divergence se paierait en
 * pieces d'identite laissees dans le stockage.</p>
 *
 * <h2>Pourquoi ce n'est pas un {@code PrivacyRequest}</h2>
 * <p>{@code PrivacyRequestService} est construit pour les VOYAGEURS : il est
 * borne a une organisation, part d'un {@code Guest}, et il <b>anonymise</b>
 * plutot qu'il ne supprime — parce qu'une facture et une fiche de police doivent
 * survivre a la demande. Un candidat n'a ni organisation, ni facture, ni
 * obligation de conservation : son effacement est une suppression franche. Les
 * faire entrer dans la meme entite aurait demande un {@code guest_id} nullable,
 * un {@code organization_id} nullable et une branche dans un flux dont la
 * justesse se mesure en euros et en droit.</p>
 */
@Component
public class MarketplaceApplicationEraser {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceApplicationEraser.class);

    private final MarketplaceProviderRepository providerRepository;
    private final ProviderDocumentRepository documentRepository;
    private final PhotoStorageService storageService;

    public MarketplaceApplicationEraser(MarketplaceProviderRepository providerRepository,
                                        ProviderDocumentRepository documentRepository,
                                        PhotoStorageService storageService) {
        this.providerRepository = providerRepository;
        this.documentRepository = documentRepository;
        this.storageService = storageService;
    }

    /**
     * Efface des candidatures, justificatifs et binaires compris.
     *
     * <p><b>L'ordre est la garantie</b> : les octets partent AVANT les lignes.
     * Si leur retrait echoue, la transaction annule aussi la suppression et
     * l'operation sera rejouee. L'ordre inverse laisserait des pieces d'identite
     * dans le stockage, sans plus rien pour les retrouver ni les reclamer.</p>
     *
     * <p>Transaction NEUVE et bornee par l'appelant : une purge de retention
     * progresse par lots, et chaque lot doit pouvoir etre interrompu sans
     * defaire les precedents.</p>
     *
     * @return le nombre de candidatures reellement effacees
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int erase(List<Long> providerIds) {
        return eraseLocked(providerIds, null);
    }

    /** La sélection du lot ne suffit pas : une réouverture peut la suivre. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int eraseExpired(List<Long> providerIds, java.time.LocalDateTime cutoff) {
        java.util.Objects.requireNonNull(cutoff, "Date limite requise");
        return eraseLocked(providerIds, cutoff);
    }

    private int eraseLocked(List<Long> providerIds, java.time.LocalDateTime cutoff) {
        if (providerIds == null || providerIds.isEmpty()) {
            return 0;
        }
        var lockedIds = new java.util.ArrayList<Long>();
        // Ordre stable pour les lots concurrents. Revalidation avant toute suppression de binaire.
        for (Long providerId : providerIds.stream().distinct().sorted().toList()) {
            var provider = providerRepository.findForErasure(providerId).orElse(null);
            if (provider == null) continue;
            if (provider.getRetentionHoldReason() != null) {
                if (cutoff != null) continue;
                throw new IllegalStateException("L'effacement est suspendu pour un litige identifié ; une revue du dossier est requise.");
            }
            if (cutoff != null && (provider.getUserId() != null
                    || provider.getStatus() != com.clenzy.marketplace.model.ProviderStatus.REJECTED
                    || provider.getDecisionSentAt() == null || provider.getDecisionSentAt().isAfter(cutoff))) continue;
            if (provider.getUserId() != null
                    || provider.getStatus() == com.clenzy.marketplace.model.ProviderStatus.ACTIVE
                    || provider.getStatus() == com.clenzy.marketplace.model.ProviderStatus.SUSPENDED) {
                throw new IllegalStateException("Cette fiche est engagée dans un compte prestataire ; son effacement doit passer par le compte.");
            }
            lockedIds.add(providerId);
        }
        for (Long providerId : lockedIds) {
            deleteStoredBinaries(providerId);
        }
        if (!lockedIds.isEmpty()) providerRepository.deleteAllByIdInBatch(lockedIds);
        log.info("Place de marche : {} candidature(s) effacee(s)", lockedIds.size());
        return lockedIds.size();
    }

    /**
     * Retire les octets d'une candidature.
     *
     * <p>Une panne du stockage doit conserver les références pour la prochaine
     * tentative. L'adaptateur de stockage gère la suppression idempotente d'un
     * objet déjà absent ; une exception ne prouve jamais cette absence.</p>
     */
    private void deleteStoredBinaries(Long providerId) {
        List<ProviderDocument> documents =
            documentRepository.findByMarketplaceProviderIdOrderByCreatedAtDesc(providerId);
        for (ProviderDocument document : documents) {
            storageService.delete(document.getStorageKey());
        }
    }
}
