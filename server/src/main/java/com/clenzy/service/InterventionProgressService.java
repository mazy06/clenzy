package com.clenzy.service;

import com.clenzy.dto.InterventionResponse;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.repository.InterventionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class InterventionProgressService {

    private static final Logger log = LoggerFactory.getLogger(InterventionProgressService.class);

    private final InterventionRepository interventionRepository;
    private final InterventionMapper interventionMapper;
    private final InterventionAccessPolicy accessPolicy;
    private final InterventionLifecycleService lifecycleService;
    private final ObjectMapper objectMapper;

    public InterventionProgressService(InterventionRepository interventionRepository,
                                       InterventionMapper interventionMapper,
                                       InterventionAccessPolicy accessPolicy,
                                       InterventionLifecycleService lifecycleService,
                                       ObjectMapper objectMapper) {
        this.interventionRepository = interventionRepository;
        this.interventionMapper = interventionMapper;
        this.accessPolicy = accessPolicy;
        this.lifecycleService = lifecycleService;
        this.objectMapper = objectMapper;
    }

    /**
     * Mettre a jour la progression d'une intervention.
     * Accessible aux TECHNICIAN, HOUSEKEEPER et SUPERVISOR pour leurs interventions assignees.
     *
     * La completion est UNIQUEMENT declenchee par l'appel explicite a completeIntervention()
     * (bouton "Terminer" dans le recap). Pas d'auto-completion sur progress=100%
     * pour eviter les race conditions lors des re-hydratations React.
     */
    public InterventionResponse updateProgress(Long id, Integer progressPercentage, Jwt jwt) {
        if (progressPercentage < 0 || progressPercentage > 100) {
            throw new IllegalArgumentException("La progression doit etre entre 0 et 100");
        }

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);

        intervention.setProgressPercentage(progressPercentage);
        intervention = interventionRepository.save(intervention);
        log.debug("Progress updated: id={}, progress={}%", intervention.getId(), progressPercentage);

        return interventionMapper.convertToResponse(intervention);
    }

    public InterventionResponse updateNotes(Long id, String notes, Jwt jwt) {
        if (notes != null && notes.length() > 10_000) {
            throw new IllegalArgumentException("Notes trop longues (max 10 000 caracteres)");
        }

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);

        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent etre commentees");
        }

        intervention.setNotes(notes);
        intervention = interventionRepository.save(intervention);

        log.debug("Notes updated for intervention: {}", intervention.getId());

        return interventionMapper.convertToResponse(intervention);
    }

    public InterventionResponse updateValidatedRooms(Long id, String validatedRooms, Jwt jwt) {
        if (validatedRooms != null && validatedRooms.length() > 10_000) {
            throw new IllegalArgumentException("Donnees validatedRooms trop longues (max 10 000 caracteres)");
        }

        // Validate JSON format before opening DB transaction work
        try {
            objectMapper.readTree(validatedRooms);
        } catch (Exception e) {
            throw new IllegalArgumentException("Format JSON invalide pour validatedRooms");
        }

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);

        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent avoir leurs pieces validees");
        }

        intervention.setValidatedRooms(validatedRooms);
        intervention = interventionRepository.save(intervention);

        log.debug("Validated rooms updated for intervention: {}", intervention.getId());

        return interventionMapper.convertToResponse(intervention);
    }

    public InterventionResponse updateCompletedSteps(Long id, String completedSteps, Jwt jwt) {
        if (completedSteps != null && completedSteps.length() > 10_000) {
            throw new IllegalArgumentException("Donnees completedSteps trop longues (max 10 000 caracteres)");
        }

        // Validate JSON format before opening DB transaction work
        try {
            objectMapper.readTree(completedSteps);
        } catch (Exception e) {
            throw new IllegalArgumentException("Format JSON invalide pour completedSteps");
        }

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);

        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent avoir leurs etapes completees mises a jour");
        }

        intervention.setCompletedSteps(completedSteps);
        intervention = interventionRepository.save(intervention);

        log.debug("Completed steps updated for intervention: {}", intervention.getId());

        return interventionMapper.convertToResponse(intervention);
    }
}
