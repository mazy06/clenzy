package com.clenzy.service.compliance;

import com.clenzy.model.ManagementContract;
import com.clenzy.model.ManagementContract.ObligationBearer;
import com.clenzy.repository.ManagementContractRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Qui porte quelle obligation réglementaire, pour un logement donné.
 *
 * <p><b>Une seule règle</b> : le déclarant est l'exploitant — c'est-à-dire
 * l'organisation — sauf si un mandat de gestion actif dit le contraire pour
 * cette obligation-là. Deux conséquences voulues :</p>
 *
 * <ul>
 *   <li>un propriétaire qui exploite seul n'est pas un cas particulier : il EST
 *       l'organisation, il porte donc tout, sans qu'aucun contrat n'existe ;</li>
 *   <li>l'absence de contrat ne crée jamais un trou de responsabilité — elle
 *       laisse l'obligation à l'exploitant, qui est le seul à pouvoir agir.</li>
 * </ul>
 *
 * <p>Source unique : les scanners de conformité, la soumission des fiches et le
 * calcul de la taxe posent tous la question ici. Sans ce point de passage, la
 * règle se serait recopiée trois fois et aurait divergé.</p>
 */
@Service
public class ObligationOwnership {

    /** Les obligations réglementaires qu'un mandat peut déplacer. */
    public enum Obligation {
        /** Fiche de police / déclaration voyageur au téléservice. */
        POLICE_DECLARATION,
        /** Déclaration et reversement de la taxe de séjour. */
        TOURIST_TAX,
        /** Détention et renouvellement de la licence ou du numéro d'enregistrement. */
        LICENCE
    }

    private final ManagementContractRepository contractRepository;

    public ObligationOwnership(ManagementContractRepository contractRepository) {
        this.contractRepository = contractRepository;
    }

    /**
     * {@code true} si l'ORGANISATION porte cette obligation pour ce logement —
     * donc si c'est à elle que le produit doit demander d'agir.
     *
     * <p>Défensif par construction : pas de logement, pas de contrat actif, ou
     * lecture en échec ⇒ l'organisation porte. Une obligation réglementaire ne
     * doit jamais disparaître à cause d'une donnée manquante.</p>
     */
    @Transactional(readOnly = true)
    public boolean orgBears(Long organizationId, Long propertyId, Obligation obligation) {
        return bearerOf(organizationId, propertyId, obligation) == ObligationBearer.AGENCY;
    }

    /** Le porteur effectif — {@code AGENCY} par défaut (cf. {@link #orgBears}). */
    @Transactional(readOnly = true)
    public ObligationBearer bearerOf(Long organizationId, Long propertyId, Obligation obligation) {
        if (organizationId == null || propertyId == null) {
            return ObligationBearer.AGENCY;
        }
        try {
            return contractRepository.findActiveByPropertyId(propertyId, organizationId)
                    .map(contract -> switch (obligation) {
                        case POLICE_DECLARATION -> contract.getPoliceDeclarationBy();
                        case TOURIST_TAX -> contract.getTouristTaxBy();
                        case LICENCE -> contract.getLicenceHeldBy();
                    })
                    .orElse(ObligationBearer.AGENCY);
        } catch (Exception e) {
            return ObligationBearer.AGENCY; // jamais de trou par défaillance de lecture
        }
    }

    /** Le mandat actif de ce logement, pour tracer au titre de quoi on déclare. */
    @Transactional(readOnly = true)
    public Long activeContractId(Long organizationId, Long propertyId) {
        if (organizationId == null || propertyId == null) {
            return null;
        }
        try {
            return contractRepository.findActiveByPropertyId(propertyId, organizationId)
                    .map(ManagementContract::getId)
                    .orElse(null);
        } catch (Exception e) {
            return null;
        }
    }
}
