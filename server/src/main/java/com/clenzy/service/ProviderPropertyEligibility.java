package com.clenzy.service;

import com.clenzy.model.Property;
import com.clenzy.model.PropertyType;
import com.clenzy.repository.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import java.util.List;
import java.util.Arrays;

@Service
public class ProviderPropertyEligibility {
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    public ProviderPropertyEligibility(JdbcTemplate jdbc, UserRepository users) { this.jdbc=jdbc; this.users=users; }

    @Transactional(readOnly=true)
    public List<PropertyType> mine(String subject) {
        Long id=owner(subject);
        var rows=jdbc.query("SELECT allowed_types FROM provider_property_preferences WHERE user_id=?",
            (rs,n) -> Arrays.stream((String[])rs.getArray(1).getArray()).map(PropertyType::valueOf).toList(),id);
        return rows.isEmpty() ? List.of(PropertyType.values()) : rows.getFirst();
    }
    @Transactional
    public List<PropertyType> replace(String subject,List<PropertyType> types) {
        if(types==null || types.stream().anyMatch(java.util.Objects::isNull) || types.size()>PropertyType.values().length)
            throw new IllegalArgumentException("Types de logement invalides");
        Long id=owner(subject);
        jdbc.queryForObject("SELECT public.baitly_lock_property_preferences('user',?)",Integer.class,id);
        var values=types.stream().distinct().map(Enum::name).toArray(String[]::new);
        jdbc.update(connection -> {
            var statement=connection.prepareStatement("INSERT INTO provider_property_preferences(user_id,allowed_types) VALUES (?,?) "
                +"ON CONFLICT(user_id) DO UPDATE SET allowed_types=EXCLUDED.allowed_types");
            statement.setLong(1,id); statement.setArray(2,connection.createArrayOf("text",values)); return statement;
        });
        return types.stream().distinct().toList();
    }
    @Transactional(propagation=Propagation.MANDATORY)
    public void require(String kind,Long id,Property property) {
        if(property==null) throw new IllegalArgumentException("Logement requis pour l'attribution");
        jdbc.queryForObject("SELECT public.baitly_lock_property_preferences(?,?)",Integer.class,kind,id);
        String type=property.getType()==null ? null : property.getType().name();
        if(!Boolean.TRUE.equals(jdbc.queryForObject("SELECT public.baitly_assignee_accepts_property(?,?,?)",Boolean.class,kind,id,type)))
            throw new com.clenzy.exception.AssignmentConflictException("Le prestataire n'accepte pas ce type de logement.");
    }
    private Long owner(String subject) {
        if(subject==null || subject.isBlank()) throw new AccessDeniedException("Identité requise");
        return users.findByKeycloakId(subject).orElseThrow(() -> new AccessDeniedException("Compte introuvable")).getId();
    }
}
