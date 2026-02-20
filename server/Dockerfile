# ====== Build stage ======
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /workspace

# 1. Copier le pom.xml seul pour cacher les dependances
COPY pom.xml /workspace/pom.xml

# 2. Telecharger les dependances (layer cachee tant que pom.xml ne change pas)
RUN mvn -B dependency:go-offline -DskipTests

# 3. Copier le code source
COPY src /workspace/src

# 4. Build jar (skip tests) — les dependances sont deja en cache
RUN mvn -B -DskipTests clean package && \
    rm -rf ~/.m2/repository

# ====== Runtime stage ======
FROM eclipse-temurin:21-jre
WORKDIR /app

# Non-root user for security
RUN groupadd -r clenzy && useradd -r -g clenzy -s /bin/false clenzy

ENV JAVA_OPTS=""
ENV SPRING_PROFILES_ACTIVE=prod

COPY --from=build /workspace/target/clenzy-platform-1.0.0.jar /app/app.jar

RUN chown -R clenzy:clenzy /app

USER clenzy

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -sf http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom $JAVA_OPTS -jar /app/app.jar"]


