package com.clenzy.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableCaching
public class CacheConfig {

    /**
     * Crée un ObjectMapper configuré avec le support JSR310 pour les types date/time Java 8
     * et le typage pour préserver les types lors de la désérialisation depuis Redis
     */
    private ObjectMapper createObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        
        // Activer le typage pour préserver les types lors de la désérialisation depuis Redis
        // Cela évite les ClassCastException (LinkedHashMap au lieu de PropertyDto)
        // Utilisation de LaissezFaireSubTypeValidator pour permettre tous les types
        mapper.activateDefaultTyping(
            LaissezFaireSubTypeValidator.instance,
            com.fasterxml.jackson.databind.ObjectMapper.DefaultTyping.NON_FINAL,
            com.fasterxml.jackson.annotation.JsonTypeInfo.As.PROPERTY
        );
        
        return mapper;
    }

    /**
     * Crée un sérialiseur Redis configuré avec le support JSR310
     */
    private GenericJackson2JsonRedisSerializer createRedisSerializer() {
        return new GenericJackson2JsonRedisSerializer(createObjectMapper());
    }

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory redisConnectionFactory) {
        // Sérialiseur configuré avec support JSR310
        GenericJackson2JsonRedisSerializer jsonSerializer = createRedisSerializer();
        
        // Configuration par défaut
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofHours(1))
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer))
                .disableCachingNullValues();

        // Configurations spécifiques par cache
        Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();
        
        // Cache des permissions (permanent)
        cacheConfigurations.put("permissions", defaultConfig
                .entryTtl(Duration.ZERO) // Pas d'expiration
                .prefixCacheNameWith("clenzy:permissions:"));
        
        // Cache des utilisateurs (1 heure)
        cacheConfigurations.put("users", defaultConfig
                .entryTtl(Duration.ofHours(1))
                .prefixCacheNameWith("clenzy:users:"));
        
        // Cache des propriétés (30 minutes)
        cacheConfigurations.put("properties", defaultConfig
                .entryTtl(Duration.ofMinutes(30))
                .prefixCacheNameWith("clenzy:properties:"));
        
        // Cache des équipes (2 heures)
        cacheConfigurations.put("teams", defaultConfig
                .entryTtl(Duration.ofHours(2))
                .prefixCacheNameWith("clenzy:teams:"));
        
        // Cache des rôles (permanent)
        cacheConfigurations.put("roles", defaultConfig
                .entryTtl(Duration.ZERO)
                .prefixCacheNameWith("clenzy:roles:"));

        return RedisCacheManager.builder(redisConnectionFactory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigurations)
                .build();
    }
}
