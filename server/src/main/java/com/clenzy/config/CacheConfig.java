package com.clenzy.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.databind.jsontype.PolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.ChannelTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

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
        // (évite les ClassCastException LinkedHashMap au lieu de PropertyDto).
        // Whitelist stricte (BasicPolymorphicTypeValidator) au lieu de LaissezFaire :
        // seuls les types Clenzy + JDK usuels sont désérialisables, ce qui bloque les
        // gadgets de désérialisation polymorphe si une valeur Redis était empoisonnée.
        PolymorphicTypeValidator ptv = BasicPolymorphicTypeValidator.builder()
            .allowIfSubType("com.clenzy.")
            .allowIfSubType("java.lang.")
            .allowIfSubType("java.util.")
            .allowIfSubType("java.time.")
            .allowIfSubType("java.math.")
            .build();
        mapper.activateDefaultTyping(
            ptv,
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

    /**
     * Identifiant unique de CE noeud, partage par le publisher et le listener
     * d'invalidation. Permet a chaque instance d'ignorer ses propres messages
     * pub/sub (pas de boucle de re-publication / double eviction locale).
     */
    @Bean
    @Qualifier("cacheNodeId")
    public String cacheNodeId() {
        return UUID.randomUUID().toString();
    }

    @Bean
    public CacheInvalidationPublisher cacheInvalidationPublisher(StringRedisTemplate stringRedisTemplate,
                                                                 @Qualifier("cacheNodeId") String cacheNodeId) {
        return new RedisCacheInvalidationPublisher(stringRedisTemplate, cacheNodeId);
    }

    /**
     * Container pub/sub : abonne CE noeud au canal d'invalidation pour evincer son
     * L1 local quand un AUTRE noeud evince/vide un cache (C3-AUDITIP-CACHE).
     */
    @Bean
    public RedisMessageListenerContainer cacheInvalidationListenerContainer(
            RedisConnectionFactory redisConnectionFactory,
            CacheManager cacheManager,
            @Qualifier("cacheNodeId") String cacheNodeId) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(redisConnectionFactory);
        if (cacheManager instanceof TwoLayerCacheManager twoLayerCacheManager) {
            CacheInvalidationListener listener =
                    new CacheInvalidationListener(twoLayerCacheManager, cacheNodeId);
            container.addMessageListener(listener, new ChannelTopic(RedisCacheInvalidationPublisher.CHANNEL));
        }
        return container;
    }

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory redisConnectionFactory,
                                     CacheInvalidationPublisher cacheInvalidationPublisher) {
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

        // Cache AI design tokens (24 heures)
        cacheConfigurations.put("ai-design-tokens", defaultConfig
                .entryTtl(Duration.ofHours(24))
                .prefixCacheNameWith("clenzy:ai-design:"));

        // Cache site snapshots for preview (10 minutes)
        cacheConfigurations.put("site-snapshots", defaultConfig
                .entryTtl(Duration.ofMinutes(10))
                .prefixCacheNameWith("clenzy:site-snapshots:"));

        // Cache booking-engine public property responses (10 minutes).
        // Evicted by BookingEngineChannelAdapter on host-profile change so widgets
        // embedded on conciergerie/proprietaire websites pick up new photos / names
        // without waiting for the TTL.
        cacheConfigurations.put("booking-engine-properties", defaultConfig
                .entryTtl(Duration.ofMinutes(10))
                .prefixCacheNameWith("clenzy:booking-engine-properties:"));

        RedisCacheManager redisCacheManager = RedisCacheManager.builder(redisConnectionFactory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigurations)
                .build();

        // Niveau 8 : Caffeine L1 (30s, 500 entries) devant Redis L2, avec
        // invalidation L1 cross-instance via Redis pub/sub (C3-AUDITIP-CACHE).
        return new TwoLayerCacheManager(
                redisCacheManager, Duration.ofSeconds(30), 500, cacheInvalidationPublisher);
    }
}
