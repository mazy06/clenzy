package com.clenzy.service;

import com.clenzy.dto.camera.CameraDto;
import com.clenzy.dto.camera.CreateCameraDto;
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

    private final CameraRepository cameraRepository;
    private final PropertyRepository propertyRepository;
    private final TokenEncryptionService encryptionService;
    private final CameraStreamService cameraStreamService;
    private final TenantContext tenantContext;

    public CameraService(CameraRepository cameraRepository,
                         PropertyRepository propertyRepository,
                         TokenEncryptionService encryptionService,
                         CameraStreamService cameraStreamService,
                         TenantContext tenantContext) {
        this.cameraRepository = cameraRepository;
        this.propertyRepository = propertyRepository;
        this.encryptionService = encryptionService;
        this.cameraStreamService = cameraStreamService;
        this.tenantContext = tenantContext;
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
        camera.setRtspUrlEncrypted(encryptionService.encrypt(dto.rtspUrl()));
        camera.setStreamName("cam_" + UUID.randomUUID().toString().replace("-", ""));
        camera.setStatus(CameraStatus.ACTIVE);
        camera.setOrganizationId(tenantContext.getRequiredOrganizationId());

        Camera saved = cameraRepository.save(camera);
        // Enregistre le flux RTSP cote go2rtc (best-effort, ne bloque pas la creation).
        cameraStreamService.registerStream(saved.getStreamName(), dto.rtspUrl());
        log.info("Camera creee: {} (property={}) pour user={}", saved.getName(), saved.getPropertyId(), userId);
        return toDto(saved);
    }

    @Transactional
    public void deleteCamera(String userId, Long cameraId) {
        Camera camera = cameraRepository.findById(cameraId)
                .orElseThrow(() -> new IllegalArgumentException("Camera introuvable: " + cameraId));
        cameraStreamService.removeStream(camera.getStreamName());
        cameraRepository.delete(camera);
        log.info("Camera supprimee: {} (id={}) pour user={}", camera.getName(), cameraId, userId);
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
