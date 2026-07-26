package com.clenzy.service;

import com.clenzy.dto.RlsAuditFindingDto;
import com.clenzy.dto.RlsAuditSummaryDto;
import com.clenzy.model.RlsAuditFinding;
import com.clenzy.repository.RlsAuditFindingRepository;
import com.clenzy.tenant.RlsAuditBuffer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Inventaire des chemins échappant à la Row-Level Security — audit sécurité 2026-07-26,
 * plan REM-T-01.
 *
 * <p>Alimente l'écran d'administration qui remplace le relevé manuel par workflow : un
 * contrôle qu'il faut penser à lancer finit par ne plus l'être.
 */
@Service
public class RlsAuditService {

    private final RlsAuditFindingRepository repository;
    private final boolean auditActif;
    private final boolean aspectActif;
    private final boolean rlsActive;

    public RlsAuditService(
            RlsAuditFindingRepository repository,
            @Value("${clenzy.security.rls.audit-missing-guc:false}") boolean auditActif,
            @Value("${clenzy.security.rls.enabled:false}") boolean aspectActif,
            @Value("${spring.liquibase.contexts:!rls}") String liquibaseContexts) {
        this.repository = repository;
        this.auditActif = auditActif;
        this.aspectActif = aspectActif;
        this.rlsActive = liquibaseContexts != null
                && liquibaseContexts.contains("rls")
                && !liquibaseContexts.contains("!rls");
    }

    @Transactional(readOnly = true)
    public RlsAuditSummaryDto etat() {
        List<RlsAuditFindingDto> chemins = repository.findAllByOrderByOccurrencesDesc()
                .stream()
                .map(RlsAuditFindingDto::from)
                .toList();

        return new RlsAuditSummaryDto(
                auditActif,
                // La mesure n'a de sens que si l'aspect pose les GUC. Sinon l'inventaire
                // recense TOUTES les requetes, et son abondance n'apprend rien — c'est ce
                // drapeau qui empeche de lire un inventaire trompeur comme un vrai constat.
                auditActif && aspectActif,
                rlsActive,
                repository.countByResolvedAtIsNull(),
                RlsAuditBuffer.enAttente(),
                RlsAuditBuffer.plafondAtteint(),
                chemins);
    }

    /**
     * Marque un chemin comme traité.
     *
     * <p>La ligne est conservée plutôt que supprimée : si le chemin réapparaît, sa date de
     * dernière observation repassera devant celle de résolution. C'est ce qui distingue
     * « corrigé » de « corrigé puis régressé ».
     */
    @Transactional
    public Optional<RlsAuditFindingDto> marquerTraite(Long id) {
        return repository.findById(id).map(finding -> {
            finding.setResolvedAt(LocalDateTime.now());
            return RlsAuditFindingDto.from(repository.save(finding));
        });
    }

    /** Chemins encore ouverts. Zéro est la condition d'activation de la RLS. */
    @Transactional(readOnly = true)
    public long cheminsOuverts() {
        return repository.countByResolvedAtIsNull();
    }

    @Transactional(readOnly = true)
    public List<RlsAuditFinding> tous() {
        return repository.findAllByOrderByOccurrencesDesc();
    }
}
