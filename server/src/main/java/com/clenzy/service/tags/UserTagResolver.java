package com.clenzy.service.tags;

import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Tags d'un utilisateur : client.*.
 */
@Component
public class UserTagResolver implements ReferenceTagResolver {

    private final UserRepository userRepository;
    private final EntityTagBuilders builders;

    public UserTagResolver(UserRepository userRepository, EntityTagBuilders builders) {
        this.userRepository = userRepository;
        this.builders = builders;
    }

    @Override
    public String referenceType() {
        return "user";
    }

    @Override
    public void resolve(Long userId, Map<String, Object> context) {
        if (userId == null) return;

        userRepository.findById(userId).ifPresent(user ->
                context.put("client", builders.clientTags(user))
        );
    }
}
