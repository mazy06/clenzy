package com.clenzy.service;

import com.clenzy.dto.MaintenanceRequestDto;
import com.clenzy.dto.QuoteRequestDto;
import com.clenzy.dto.ReceivedFormDto;
import com.clenzy.model.ReceivedForm;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.hibernate.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

/**
 * Formulaires recus (devis, maintenance, support) :
 * - enregistrement depuis les endpoints publics (landing page, page support) ;
 * - consultation/administration reservee au staff plateforme (SUPER_ADMIN, SUPER_MANAGER).
 *
 * <p>Les formulaires sont par nature inter-tenant (DEVIS publics sans org,
 * MAINTENANCE/SUPPORT potentiellement multi-org) : les lectures admin desactivent
 * le filtre Hibernate {@code organizationFilter}, en contrepartie le garde-fou
 * {@link #requirePlatformStaff()} est applique systematiquement (audit regle 3).</p>
 */
@Service
public class ReceivedFormService {

    private static final Logger log = LoggerFactory.getLogger(ReceivedFormService.class);
    private static final String STATUS_ARCHIVED = "ARCHIVED";

    private final ReceivedFormRepository receivedFormRepository;
    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;
    private final TenantContext tenantContext;

    public ReceivedFormService(ReceivedFormRepository receivedFormRepository,
                               ObjectMapper objectMapper,
                               EntityManager entityManager,
                               TenantContext tenantContext) {
        this.receivedFormRepository = receivedFormRepository;
        this.objectMapper = objectMapper;
        this.entityManager = entityManager;
        this.tenantContext = tenantContext;
    }

    // ─── Enregistrement (endpoints publics) ─────────────────────────────────

    /**
     * Enregistre une demande de devis venant de la landing page.
     *
     * @return l'id du formulaire persiste
     */
    @Transactional
    public Long recordQuoteForm(QuoteRequestDto dto, String clientIp) {
        ReceivedForm form = new ReceivedForm();
        form.setFormType("DEVIS");
        form.setFullName(dto.getFullName());
        form.setEmail(dto.getEmail());
        form.setPhone(dto.getPhone());
        form.setCity(dto.getCity());
        form.setPostalCode(dto.getPostalCode());
        form.setSubject("Demande de devis — " + dto.getFullName() + " — " + dto.getCity());
        form.setPayload(writePayload(dto));
        form.setIpAddress(clientIp);
        ReceivedForm saved = receivedFormRepository.save(form);
        log.info("ReceivedForm DEVIS saved id={} for {} ({})", saved.getId(), dto.getFullName(), dto.getEmail());
        return saved.getId();
    }

    /**
     * Enregistre une demande de devis maintenance venant de la landing page.
     *
     * @return l'id du formulaire persiste
     */
    @Transactional
    public Long recordMaintenanceForm(MaintenanceRequestDto dto, String clientIp) {
        ReceivedForm form = new ReceivedForm();
        form.setFormType("MAINTENANCE");
        form.setFullName(dto.getFullName());
        form.setEmail(dto.getEmail());
        form.setPhone(dto.getPhone());
        form.setCity(dto.getCity());
        form.setPostalCode(dto.getPostalCode());
        form.setSubject("Maintenance — " + dto.getFullName() + (dto.getCity() != null ? " — " + dto.getCity() : ""));
        form.setPayload(writePayload(dto));
        form.setIpAddress(clientIp);
        ReceivedForm saved = receivedFormRepository.save(form);
        return saved.getId();
    }

    /**
     * Enregistre une demande de support venant de la page d'authentification PMS.
     *
     * @return l'id du formulaire persiste
     */
    @Transactional
    public Long recordSupportForm(String name, String email, String phone, String subjectLabel,
                                  Map<String, String> payload, String clientIp) {
        ReceivedForm form = new ReceivedForm();
        form.setFormType("SUPPORT");
        form.setFullName(name);
        form.setEmail(email);
        form.setPhone(phone == null || phone.isEmpty() ? null : phone);
        form.setSubject("Support — " + subjectLabel + " — " + name);
        form.setPayload(writePayload(payload));
        form.setIpAddress(clientIp);
        ReceivedForm saved = receivedFormRepository.save(form);
        return saved.getId();
    }

    // ─── Administration (staff plateforme) ──────────────────────────────────

    /**
     * Liste paginee des formulaires recus, avec filtre optionnel par type.
     * Vue "Archives" si status=ARCHIVED ; sinon liste active (exclut les archives).
     */
    @Transactional(readOnly = true)
    public Page<ReceivedFormDto> listForms(int page, int size, String type, String status) {
        requirePlatformStaff();
        disableTenantFilter();

        PageRequest pageable = PageRequest.of(page, size);
        boolean archivedView = STATUS_ARCHIVED.equalsIgnoreCase(status);
        boolean hasType = type != null && !type.isBlank();
        String typeUpper = hasType ? type.toUpperCase() : null;

        Page<ReceivedForm> result;
        if (archivedView) {
            result = hasType
                    ? receivedFormRepository.findByFormTypeAndStatusOrderByCreatedAtDesc(typeUpper, STATUS_ARCHIVED, pageable)
                    : receivedFormRepository.findByStatusOrderByCreatedAtDesc(STATUS_ARCHIVED, pageable);
        } else {
            result = hasType
                    ? receivedFormRepository.findByFormTypeAndStatusNotOrderByCreatedAtDesc(typeUpper, STATUS_ARCHIVED, pageable)
                    : receivedFormRepository.findByStatusNotOrderByCreatedAtDesc(STATUS_ARCHIVED, pageable);
        }

        return result.map(ReceivedFormDto::fromEntity);
    }

    /**
     * Detail d'un formulaire par ID.
     */
    @Transactional(readOnly = true)
    public Optional<ReceivedFormDto> getForm(Long id) {
        requirePlatformStaff();
        disableTenantFilter();
        return receivedFormRepository.findById(id).map(ReceivedFormDto::fromEntity);
    }

    /**
     * Mise a jour du statut d'un formulaire (NEW -> READ -> PROCESSED -> ARCHIVED).
     * Le statut est suppose deja valide/normalise par l'appelant.
     */
    @Transactional
    public Optional<ReceivedFormDto> updateStatus(Long id, String normalizedStatus) {
        requirePlatformStaff();
        disableTenantFilter();
        return receivedFormRepository.findById(id).map(form -> {
            form.setStatus(normalizedStatus);
            if ("READ".equals(normalizedStatus) && form.getReadAt() == null) {
                form.setReadAt(LocalDateTime.now());
            }
            if ("PROCESSED".equals(normalizedStatus) && form.getProcessedAt() == null) {
                form.setProcessedAt(LocalDateTime.now());
            }
            receivedFormRepository.save(form);
            log.info("Formulaire #{} mis a jour : status={}", id, normalizedStatus);
            return ReceivedFormDto.fromEntity(form);
        });
    }

    /**
     * Compteurs par type et par statut (badges admin).
     */
    @Transactional(readOnly = true)
    public ReceivedFormStats getStats() {
        requirePlatformStaff();
        disableTenantFilter();
        return new ReceivedFormStats(
                receivedFormRepository.countByStatus("NEW"),
                receivedFormRepository.countByStatus("READ"),
                receivedFormRepository.countByStatus("PROCESSED"),
                receivedFormRepository.countByStatus(STATUS_ARCHIVED),
                receivedFormRepository.countByFormType("DEVIS"),
                receivedFormRepository.countByFormType("MAINTENANCE"),
                receivedFormRepository.countByFormType("SUPPORT")
        );
    }

    public record ReceivedFormStats(long totalNew, long totalRead, long totalProcessed, long totalArchived,
                                    long devisCount, long maintenanceCount, long supportCount) {}

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private String writePayload(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Serialisation du payload de formulaire impossible", e);
        }
    }

    /**
     * Refuse l'acces aux lectures/ecritures admin si l'appelant n'est pas staff
     * plateforme (SUPER_ADMIN/SUPER_MANAGER — flag pose par TenantFilter).
     * Contrepartie obligatoire de {@link #disableTenantFilter()} : ces methodes
     * voient les formulaires de toutes les organisations.
     */
    private void requirePlatformStaff() {
        if (!tenantContext.isSuperAdmin()) {
            throw new AccessDeniedException("Acces reserve au staff plateforme");
        }
    }

    /**
     * Desactive le filtre Hibernate "organizationFilter" pour la session courante.
     * Les formulaires recus sont inter-tenant : DEVIS soumis depuis la landing
     * publique (organization_id = NULL), MAINTENANCE/SUPPORT potentiellement
     * soumis depuis differentes orgs. Le controle d'acces est fait en amont
     * via {@link #requirePlatformStaff()}.
     */
    private void disableTenantFilter() {
        entityManager.unwrap(Session.class).disableFilter("organizationFilter");
    }
}
