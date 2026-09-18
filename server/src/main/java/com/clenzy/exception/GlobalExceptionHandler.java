package com.clenzy.exception;

import com.clenzy.config.SyncMetrics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;

import org.apache.catalina.connector.ClientAbortException;

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

    @ExceptionHandler(MessagingRecipientMissingException.class)
    public ResponseEntity<Map<String, Object>> handleMessagingRecipientMissing(MessagingRecipientMissingException ex) {
        logger.info("Envoi message refuse pour reservation #{} (canal {}): {}",
                ex.getReservationId(), ex.getChannel(), ex.getMessage());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Destinataire manquant");
        errorResponse.put("message", ex.getMessage());
        errorResponse.put("reservationId", ex.getReservationId());
        errorResponse.put("channel", ex.getChannel());
        errorResponse.put("code", "MESSAGING_RECIPIENT_MISSING");
        errorResponse.put("status", HttpStatus.BAD_REQUEST.value());

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
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

    /**
     * Fichier au-dela de la limite multipart.
     *
     * <p>Sans ce traitement, depasser la taille produit un 500 « Erreur lors du
     * traitement de la requete » : un message technique pour ce qui est une
     * erreur de l'utilisateur, et qui ne lui dit pas quoi faire. Le controle
     * applicatif ne peut pas s'en charger — Spring interrompt la requete AVANT
     * que le controller soit atteint.</p>
     */
    /**
     * Echec de validation d'un corps de requete annote {@code @Valid}.
     *
     * <p>Sans ce traitement, l'utilisateur recoit « Validation failed for
     * argument [0] in public org.springframework.http.ResponseEntity&lt;... » :
     * la signature Java de la methode, pour ce qui est une erreur de saisie.
     * Les messages portes par les annotations sont, eux, deja rediges pour un
     * humain — ce sont eux qu'on rend.</p>
     *
     * <p>{@code fields} accompagne le message pour les interfaces capables de
     * surligner le champ fautif ; {@code message} reste le texte a afficher
     * quand elles ne le font pas.</p>
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            // Premier message par champ : les suivants repetent la meme cause.
            fields.putIfAbsent(error.getField(),
                error.getDefaultMessage() != null ? error.getDefaultMessage() : "Valeur invalide");
        }
        for (ObjectError error : ex.getBindingResult().getGlobalErrors()) {
            fields.putIfAbsent(error.getObjectName(),
                error.getDefaultMessage() != null ? error.getDefaultMessage() : "Valeur invalide");
        }
        String message = fields.values().stream().findFirst().orElse("Requete invalide");
        logger.warn("Validation refusee : {}", fields);

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Requete invalide");
        errorResponse.put("message", message);
        errorResponse.put("fields", fields);
        errorResponse.put("status", HttpStatus.BAD_REQUEST.value());

        return ResponseEntity.badRequest().body(errorResponse);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUploadSize(MaxUploadSizeExceededException ex) {
        logger.warn("Fichier refuse : taille au-dela de la limite ({})", ex.getMessage());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Fichier trop volumineux");
        errorResponse.put("message", "Fichier trop volumineux (10 Mo maximum)");
        errorResponse.put("status", HttpStatus.PAYLOAD_TOO_LARGE.value());

        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(errorResponse);
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

    @ExceptionHandler(AiBudgetExceededException.class)
    public ResponseEntity<Map<String, Object>> handleAiBudgetExceeded(AiBudgetExceededException ex) {
        logger.warn("AI budget exceeded: feature={} used={} limit={}", ex.getFeature(), ex.getUsed(), ex.getLimit());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Budget IA depasse");
        errorResponse.put("message", ex.getMessage());
        errorResponse.put("errorCode", ex.getErrorCode());
        errorResponse.put("feature", ex.getFeature());
        errorResponse.put("used", ex.getUsed());
        errorResponse.put("limit", ex.getLimit());
        errorResponse.put("status", HttpStatus.TOO_MANY_REQUESTS.value());

        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(errorResponse);
    }

    @ExceptionHandler(AiCreditsInsufficientException.class)
    public ResponseEntity<Map<String, Object>> handleAiCreditsInsufficient(AiCreditsInsufficientException ex) {
        logger.warn("AI credits insufficient: feature={} balance={} required={}",
                ex.getFeature(), ex.getBalanceMillicredits(), ex.getRequiredMillicredits());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Credits IA insuffisants");
        errorResponse.put("message", ex.getMessage());
        errorResponse.put("errorCode", ex.getErrorCode());
        errorResponse.put("feature", ex.getFeature());
        errorResponse.put("balanceMillicredits", ex.getBalanceMillicredits());
        errorResponse.put("requiredMillicredits", ex.getRequiredMillicredits());
        errorResponse.put("status", HttpStatus.PAYMENT_REQUIRED.value());

        return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(errorResponse);
    }

    @ExceptionHandler(TeamCompositionConflictException.class)
    public ResponseEntity<Map<String, Object>> handleTeamCompositionConflict(TeamCompositionConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", "Équipe engagée", "message", ex.getMessage(), "status", 409));
    }

    @ExceptionHandler(AssignmentConflictException.class)
    public ResponseEntity<Map<String, Object>> handleAssignmentConflict(AssignmentConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", "Conflit d'affectation", "message", ex.getMessage(), "status", 409));
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, Object>> handleOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        logger.warn("Conflit de version (modification concurrente): {}", ex.getMessage());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Conflit de modification");
        errorResponse.put("message", "Les donnees ont ete modifiees par un autre utilisateur. Veuillez rafraichir et reessayer.");
        errorResponse.put("status", HttpStatus.CONFLICT.value());

        return ResponseEntity.status(HttpStatus.CONFLICT).body(errorResponse);
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

    @ExceptionHandler(ClientAbortException.class)
    public ResponseEntity<Void> handleClientAbort(ClientAbortException ex) {
        logger.debug("Client disconnected (broken pipe): {}", ex.getMessage());
        return ResponseEntity.noContent().build();
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
