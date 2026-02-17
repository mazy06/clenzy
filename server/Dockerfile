# ====== Build stage ======
FROM maven:3.9.6-eclipse-temurin-17 AS build
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
FROM eclipse-temurin:17-jre
WORKDIR /app

ENV JAVA_OPTS=""
ENV SPRING_PROFILES_ACTIVE=prod

COPY --from=build /workspace/target/clenzy-platform-1.0.0.jar /app/app.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]


