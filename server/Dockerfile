# ====== Build stage ======
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /workspace

# 1. Copier le pom.xml seul pour cacher les dependances
COPY pom.xml /workspace/pom.xml

# 2. Telecharger les dependances ET les plugins Maven (layer cachee tant que
#    pom.xml ne change pas). Retry up to 3 times — Maven Central peut renvoyer
#    des 522 / timeout Cloudflare transitoires.
#
# Pourquoi `resolve-plugins` en plus de `go-offline` : `go-offline` ne pull
# QUE les deps de compilation/runtime, pas les plugins Maven (clean, jar,
# surefire, etc.) qui sont invoques au build. Sans ca, le stage suivant
# `mvn clean package` essaye d'aller chercher maven-clean-plugin et fail
# si Maven Central est lent (cas frequent sur CI / Docker Desktop).
RUN for i in 1 2 3; do \
      echo "=== Attempt $i/3: downloading dependencies + plugins ===" && \
      mvn -B dependency:go-offline dependency:resolve-plugins -DskipTests && break || \
      { echo "=== Attempt $i failed, waiting 10s ===" && sleep 10; }; \
    done

# 3. Install Playwright Chromium during build (Maven has the JAR unpacked)
ENV PLAYWRIGHT_BROWSERS_PATH=/playwright-browsers
RUN mvn -B exec:java -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install chromium" || \
    echo "Playwright browser install will happen at runtime"

# 4. Copier le code source
COPY src /workspace/src

# 5. Build jar (skip tests). Le cache local contient deja toutes les deps
# ET tous les plugins grace au stage 2 (go-offline + resolve-plugins).
# Pas de flag `-o` strict ici car certains plugins peuvent declencher des
# lookups d'extensions (resilience4j, etc.) que `resolve-plugins` ne couvre
# pas a 100%. Retry 3x au cas ou un fetch reseau marginal arrive.
RUN for i in 1 2 3; do \
      echo "=== Build attempt $i/3 ===" && \
      mvn -B -DskipTests clean package && break || \
      { echo "=== Build attempt $i failed, waiting 10s ===" && sleep 10; }; \
    done && \
    rm -rf ~/.m2/repository

# ====== Runtime stage ======
FROM eclipse-temurin:21-jre
WORKDIR /app

# Librairies necessaires pour java.awt (CAPTCHA) + pg_dump + Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfontconfig1 libfreetype6 fontconfig fonts-dejavu-core \
    postgresql-client \
    libnss3 libxss1 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdbus-1-3 \
    libexpat1 libgbm1 libpango-1.0-0 libpangocairo-1.0-0 libxcomposite1 \
    libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 libxrender1 \
    libxshmfence1 libasound2t64 \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN groupadd -r clenzy && useradd -r -g clenzy -s /bin/false clenzy

ARG KPI_TEST_COVERAGE_PCT=0
ENV JAVA_OPTS=""
ENV SPRING_PROFILES_ACTIVE=prod
ENV KPI_TEST_COVERAGE_PCT=${KPI_TEST_COVERAGE_PCT}
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright

COPY --from=build /workspace/target/clenzy-platform-1.0.0.jar /app/app.jar

# Copy pre-installed Playwright browsers from build stage
COPY --from=build /playwright-browsers /app/.playwright

# Create upload + tmp directories before switching to non-root user.
# /app/tmp est utilise par Spring Boot 3.x pour extraire les nested JARs au
# demarrage : on l'isole de /tmp (root:root) pour eviter "Failed to create
# unpack directory in directory '/tmp'" quand l'user clenzy n'a pas les bons
# droits sur /tmp (cas frequent avec certaines configs Docker Desktop).
#
# chmod 1777 sur /app/tmp = sticky bit (comme /tmp standard) pour s'assurer
# que TOUT user (meme si UID change entre builds) peut creer des sous-dossiers.
# Diagnostic explicite pour debugger si la layer Docker est corrompue.
RUN mkdir -p /app/uploads/templates /app/uploads/documents /app/uploads/contact /app/tmp \
    && chmod 1777 /app/tmp \
    && test -d /app/tmp || (echo "ERROR: /app/tmp not created" && exit 1)

RUN chown -R clenzy:clenzy /app

USER clenzy

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -sf http://localhost:8080/actuator/health || exit 1

# -Djava.io.tmpdir=/app/tmp : force Spring Boot a unpack les nested JARs dans
# /app/tmp (owned by clenzy) plutot que dans /tmp (root:root sticky-bit qui
# pose parfois probleme avec les containers non-root).
ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.awt.headless=true -Djava.io.tmpdir=/app/tmp -Djava.security.egd=file:/dev/./urandom $JAVA_OPTS -jar /app/app.jar"]
