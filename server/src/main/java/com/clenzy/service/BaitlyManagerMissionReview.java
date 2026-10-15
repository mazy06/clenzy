package com.clenzy.service;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;
import jakarta.validation.constraints.*;

/** Same control/payment lifecycle as the PMS, with the manager's assessment stored atomically. */
@Service @Transactional
public class BaitlyManagerMissionReview {
    public record Review(@NotNull @Pattern(regexp="approve|reject") String decision,@Size(max=1000) String feedback,
        @Min(1) @Max(5) Integer rating,@DecimalMin("0") @Digits(integer=10,fraction=2) BigDecimal amount,@NotNull Long version){}
    private final InterventionRepository missions;private final InterventionAccessPolicy access;private final InterventionLifecycleService lifecycle;
    public BaitlyManagerMissionReview(InterventionRepository missions,InterventionAccessPolicy access,InterventionLifecycleService lifecycle){this.missions=missions;this.access=access;this.lifecycle=lifecycle;}
    public InterventionResponse record(Long id,Review command,Jwt jwt){
        var initial=missions.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));access.assertCanAccess(initial,jwt);
        if(!JwtRoleExtractor.extractUserRole(jwt).isPlatformStaff()&&!access.canReview(initial,jwt))throw new org.springframework.security.access.AccessDeniedException("Contrôle réservé au gestionnaire.");
        var mission=missions.findForReview(id,initial.getOrganizationId()).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        if(mission.getStatus()!=InterventionStatus.AWAITING_VALIDATION||!Objects.equals(command.version(),mission.getVersion()))throw new ResponseStatusException(HttpStatus.CONFLICT,"Le travail à contrôler a changé.");
        if("approve".equals(command.decision())&&command.amount()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Montant de mission requis.");
        if("reject".equals(command.decision())&&(command.feedback()==null||command.feedback().isBlank()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Motif de reprise requis.");
        mission.setCustomerFeedback(command.feedback()==null?null:command.feedback().trim());mission.setCustomerRating(command.rating());
        return "approve".equals(command.decision())?lifecycle.validateIntervention(id,command.amount(),jwt):lifecycle.rejectWork(id,command.feedback(),jwt);
    }
}
