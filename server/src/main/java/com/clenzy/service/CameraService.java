package com.clenzy.service;

import com.clenzy.dto.camera.CameraDto;
import com.clenzy.dto.camera.CreateCameraDto;
import com.clenzy.integration.tuya.service.TuyaApiService;
import com.clenzy.integration.tuya.service.TuyaDeviceClaimService;
import com.clenzy.model.Camera;
import com.clenzy.model.Camera.CameraStatus;
import com.clenzy.model.Property;
import com.clenzy.repository.CameraRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service business des cameras. L'isolation multi-tenant est assuree par le
 * filtre Hibernate {@code organizationFilter} (meme pattern que SmartLockService).
 * L'URL RTSP est chiffree a la creation et jamais re-exposee.
 */
@Service
public class CameraService {

    private static final Logger log = LoggerFactory.getLogger(CameraService.class);

    /** Prefixe d'une source camera resolue a la demande via le cloud Tuya (device_id). */
    private static final String TUYA_SOURCE_PREFIX = "tuya:";

    private final CameraRepository cameraRepository;
    private final PropertyRepository propertyRepository;
    private final TokenEncryptionService encryptionService;
    private final CameraStreamService cameraStreamService;
    private final TenantContext tenantContext;
    private final TuyaApiService tuyaApiService;
    private final TuyaDeviceClaimService claimService;

    public CameraService(CameraRepository cameraRepository,
                         PropertyRepository propertyRepository,
                         TokenEncryptionService encryptionService,
                         CameraStreamService cameraStreamService,
                         TenantContext tenantContext,
                         TuyaApiService tuyaApiService,
                         TuyaDeviceClaimService claimService) {
        this.cameraRepository = cameraRepository;
        this.propertyRepository = propertyRepository;
        this.encryptionService = encryptionService;
        this.cameraStreamService = cameraStreamService;
        this.tenantContext = tenantContext;
        this.tuyaApiService = tuyaApiService;
        this.claimService = claimService;
    }

    /** Liste les cameras de l'organisation (filtre Hibernate = isolation). */
    public List<CameraDto> getUserCameras(String userId) {
        return cameraRepository.findByStatus(CameraStatus.ACTIVE).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public CameraDto createCamera(String userId, CreateCameraDto dto) {
        Property property = propertyRepository.findById(dto.propertyId())
                .orElseThrow(() -> new IllegalArgumentException("Propriete introuvable: " + dto.propertyId()));

        Camera camera = new Camera();
        camera.setUserId(userId);
        camera.setName(dto.name());
        camera.setPropertyId(property.getId());
        camera.setRoomName(dto.roomName());
        camera.setBrand(dto.brand());
        camera.setRtspUrlEncrypted(encryptionService.encrypt(resolveSourceToStore(dto)));
        camera.setStreamName("cam_" + UUID.randomUUID().toString().replace("-", ""));
        camera.setStatus(CameraStatus.ACTIVE);
        camera.setOrganizationId(tenantContext.getRequiredOrganizationId());

        // Garde-fou multi-tenant : reclame le device Tuya (rejet si deja rattache a une autre org).
        if ("TUYA".equalsIgnoreCase(dto.brand())) {
            claimService.claim(dto.externalDeviceId().trim(), "camera");
        }

        Camera saved = cameraRepository.save(camera);
        // Enregistre le flux cote go2rtc (best-effort) : RTSP/HTTP direct, ou allocation Tuya.
        registerResolvedStream(saved);
        log.info("Camera creee: {} (property={}, brand={}) pour user={}", saved.getName(), saved.getPropertyId(), saved.getBrand(), userId);
        return toDto(saved);
    }

    @Transactional
    public void deleteCamera(String userId, Long cameraId) {
        Camera camera = cameraRepository.findById(cameraId)
                .orElseThrow(() -> new IllegalArgumentException("Camera introuvable: " + cameraId));
        // Libere la reclamation Tuya si la source en est une.
        String stored = encryptionService.decrypt(camera.getRtspUrlEncrypted());
        if (stored != null && stored.startsWith(TUYA_SOURCE_PREFIX)) {
            claimService.release(stored.substring(TUYA_SOURCE_PREFIX.length()));
        }
        cameraStreamService.removeStream(camera.getStreamName());
        cameraRepository.delete(camera);
        log.info("Camera supprimee: {} (id={}) pour user={}", camera.getName(), cameraId, userId);
    }

    /**
     * Re-alloue et re-enregistre le flux d'une camera (utile pour les sources Tuya dont l'URL
     * allouee expire). Scopee org via le filtre Hibernate sur findById. Best-effort.
     */
    @Transactional(readOnly = true)
    public void refreshStream(Long cameraId) {
        Camera camera = cameraRepository.findById(cameraId)
                .orElseThrow(() -> new IllegalArgumentException("Camera introuvable: " + cameraId));
        registerResolvedStream(camera);
    }

    /** Valeur a stocker (chiffree) selon le brand : {@code tuya:<deviceId>} ou l'URL RTSP/HTTP. */
    private String resolveSourceToStore(CreateCameraDto dto) {
        if ("TUYA".equalsIgnoreCase(dto.brand())) {
            if (dto.externalDeviceId() == null || dto.externalDeviceId().isBlank()) {
                throw new IllegalArgumentException("externalDeviceId requis pour une camera Tuya");
            }
            return TUYA_SOURCE_PREFIX + dto.externalDeviceId().trim();
        }
        if (dto.rtspUrl() == null || dto.rtspUrl().isBlank()) {
            throw new IllegalArgumentException("rtspUrl requis pour une camera non-Tuya");
        }
        return dto.rtspUrl();
    }

    /** Resout la source stockee en URL exploitable par go2rtc puis l'enregistre (best-effort). */
    private void registerResolvedStream(Camera camera) {
        String resolved = resolveGo2rtcSource(encryptionService.decrypt(camera.getRtspUrlEncrypted()));
        if (resolved != null && !resolved.isBlank()) {
            cameraStreamService.registerStream(camera.getStreamName(), resolved);
        }
    }

    /**
     * Convertit la source stockee en URL pour go2rtc : pour {@code tuya:<deviceId>}, alloue une
     * URL de flux via l'API Tuya (duree de vie limitee) ; sinon retourne l'URL RTSP/HTTP directe.
     */
    private String resolveGo2rtcSource(String stored) {
        if (stored == null) {
            return null;
        }
        if (stored.startsWith(TUYA_SOURCE_PREFIX)) {
            return allocateTuyaRtsp(stored.substring(TUYA_SOURCE_PREFIX.length()));
        }
        return stored;
    }

    /** Alloue une URL RTSP via le cloud Tuya pour un device camera. Null si echec. NON VALIDE. */
    @SuppressWarnings("unchecked")
    private String allocateTuyaRtsp(String deviceId) {
        try {
            Map<String, Object> resp = tuyaApiService.allocateStream(deviceId, "RTSP");
            Object result = resp == null ? null : resp.get("result");
            if (result instanceof Map<?, ?> map) {
                Object url = ((Map<String, Object>) map).get("url");
                if (url != null) {
                    return url.toString();
                }
            }
            log.warn("Tuya allocateStream: URL absente de la reponse pour device {}", deviceId);
        } catch (Exception e) {
            log.warn("Tuya allocateStream echec (device {}): {}", deviceId, e.getMessage());
        }
        return null;
    }

    private CameraDto toDto(Camera c) {
        String propertyName = propertyRepository.findById(c.getPropertyId())
                .map(Property::getName)
                .orElse(null);
        boolean online = c.getStatus() == CameraStatus.ACTIVE;
        return new CameraDto(
                c.getId(), c.getName(), c.getPropertyId(), propertyName, c.getRoomName(),
                c.getBrand(), c.getStatus().name(), online, c.isRecording(),
                c.getStreamName(), cameraStreamService.webrtcUrl(c.getStreamName()),
                cameraStreamService.snapshotUrl(c.getStreamName()), c.getCreatedAt());
    }
}
