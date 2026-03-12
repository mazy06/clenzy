# ====== Build stage ======
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /workspace

# 1. Copier le pom.xml seul pour cacher les dependances
COPY pom.xml /workspace/pom.xml

# 2. Telecharger les dependances (layer cachee tant que pom.xml ne change pas)
#    Retry up to 3 times — Maven Central peut renvoyer des 522 transitoires
RUN for i in 1 2 3; do \
      echo "=== Attempt $i/3: downloading dependencies ===" && \
      mvn -B dependency:go-offline -DskipTests && break || \
      { echo "=== Attempt $i failed, waiting 10s ===" && sleep 10; }; \
    done

# 3. Copier le code source
COPY src /workspace/src

# 4. Build jar (skip tests) — les dependances sont deja en cache
RUN mvn -B -DskipTests clean package && \
    rm -rf ~/.m2/repository

# ====== Runtime stage ======
FROM eclipse-temurin:21-jre
WORKDIR /app

# Librairies necessaires pour java.awt (CAPTCHA puzzle generation) + pg_dump pour backups
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfontconfig1 libfreetype6 fontconfig fonts-dejavu-core \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN groupadd -r clenzy && useradd -r -g clenzy -s /bin/false clenzy

ENV JAVA_OPTS=""
ENV SPRING_PROFILES_ACTIVE=prod

COPY --from=build /workspace/target/clenzy-platform-1.0.0.jar /app/app.jar

# Create upload directories before switching to non-root user
RUN mkdir -p /app/uploads/templates /app/uploads/documents /app/uploads/contact

RUN chown -R clenzy:clenzy /app

USER clenzy

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -sf http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.awt.headless=true -Djava.security.egd=file:/dev/./urandom $JAVA_OPTS -jar /app/app.jar"]


