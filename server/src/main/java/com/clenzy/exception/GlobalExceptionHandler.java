package com.clenzy.exception;

import com.clenzy.config.SyncMetrics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import org.springframework.security.access.AccessDeniedException;

import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private final SyncMetrics syncMetrics;

    public GlobalExceptionHandler(SyncMetrics syncMetrics) {
        this.syncMetrics = syncMetrics;
    }

    @ExceptionHandler(CalendarConflictException.class)
    public ResponseEntity<Map<String, Object>> handleCalendarConflict(CalendarConflictException ex) {
        syncMetrics.incrementConflictDetected();
        logger.warn("Conflit calendrier: {}", ex.getMessage());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Conflit de calendrier");
        errorResponse.put("message", ex.getMessage());
        errorResponse.put("propertyId", ex.getPropertyId());
        errorResponse.put("from", ex.getFrom() != null ? ex.getFrom().toString() : null);
        errorResponse.put("to", ex.getTo() != null ? ex.getTo().toString() : null);
        errorResponse.put("conflictCount", ex.getConflictCount());
        errorResponse.put("status", HttpStatus.CONFLICT.value());

        return ResponseEntity.status(HttpStatus.CONFLICT).body(errorResponse);
    }

    @ExceptionHandler(RestrictionViolationException.class)
    public ResponseEntity<Map<String, Object>> handleRestrictionViolation(RestrictionViolationException ex) {
        logger.warn("Violation restriction de reservation: {}", ex.getMessage());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Restriction de reservation non respectee");
        errorResponse.put("message", ex.getMessage());
        errorResponse.put("propertyId", ex.getPropertyId());
        errorResponse.put("checkIn", ex.getCheckIn() != null ? ex.getCheckIn().toString() : null);
        errorResponse.put("checkOut", ex.getCheckOut() != null ? ex.getCheckOut().toString() : null);
        errorResponse.put("violations", ex.getViolations());
        errorResponse.put("status", HttpStatus.UNPROCESSABLE_ENTITY.value());

        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(errorResponse);
    }

    @ExceptionHandler(CalendarLockException.class)
    public ResponseEntity<Map<String, Object>> handleCalendarLock(CalendarLockException ex) {
        syncMetrics.incrementLockContention();
        logger.warn("Lock calendrier non disponible: {}", ex.getMessage());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Operation en cours");
        errorResponse.put("message", ex.getMessage());
        errorResponse.put("propertyId", ex.getPropertyId());
        errorResponse.put("status", HttpStatus.TOO_MANY_REQUESTS.value());
        errorResponse.put("retryAfter", 2);

        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header("Retry-After", "2")
                .body(errorResponse);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        logger.warn("Argument invalide: {}", ex.getMessage());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Requete invalide");
        errorResponse.put("message", ex.getMessage());
        errorResponse.put("status", HttpStatus.BAD_REQUEST.value());

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

    @ExceptionHandler(AiNotConfiguredException.class)
    public ResponseEntity<Map<String, Object>> handleAiNotConfigured(AiNotConfiguredException ex) {
        logger.info("AI not configured: errorCode={} feature={}", ex.getErrorCode(), ex.getFeature());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "IA non configuree");
        errorResponse.put("message", ex.getMessage());
        errorResponse.put("errorCode", ex.getErrorCode());
        errorResponse.put("feature", ex.getFeature());
        errorResponse.put("status", HttpStatus.UNPROCESSABLE_ENTITY.value());

        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(errorResponse);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDeniedException(AccessDeniedException ex) {
        logger.warn("Accès refusé: {}", ex.getMessage());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Accès refusé");
        errorResponse.put("message", "Vous n'avez pas les permissions nécessaires pour cette action");
        errorResponse.put("status", HttpStatus.FORBIDDEN.value());

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeException(RuntimeException ex) {
        logger.error("Erreur runtime non gérée", ex);

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Erreur lors du traitement de la requête");
        errorResponse.put("message", ex.getMessage() != null ? ex.getMessage() : "Une erreur inattendue s'est produite");
        errorResponse.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
    
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoResourceFound(NoResourceFoundException ex) {
        logger.debug("Ressource non trouvee: {}", ex.getMessage());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Ressource non trouvee");
        errorResponse.put("message", ex.getMessage());
        errorResponse.put("status", HttpStatus.NOT_FOUND.value());

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
        logger.error("Erreur non gérée", ex);
        
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Erreur lors du traitement de la requête");
        errorResponse.put("message", ex.getMessage() != null ? ex.getMessage() : "Une erreur inattendue s'est produite");
        errorResponse.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
    
    @ExceptionHandler(NotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ResponseEntity<Map<String, Object>> handleNotFoundException(NotFoundException ex) {
        logger.warn("Ressource non trouvée: {}", ex.getMessage());
        
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Ressource non trouvée");
        errorResponse.put("message", ex.getMessage());
        errorResponse.put("status", HttpStatus.NOT_FOUND.value());
        
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
    }
    
    @ExceptionHandler(UnauthorizedException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ResponseEntity<Map<String, Object>> handleUnauthorizedException(UnauthorizedException ex) {
        logger.warn("Accès non autorisé: {}", ex.getMessage());
        
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Accès non autorisé");
        errorResponse.put("message", ex.getMessage());
        errorResponse.put("status", HttpStatus.UNAUTHORIZED.value());
        
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
    }
}
