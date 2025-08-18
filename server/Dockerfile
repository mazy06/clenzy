# ====== Build stage ======
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /workspace

# Copy only server module to leverage Docker cache better
COPY pom.xml /workspace/pom.xml
COPY src /workspace/src

# Build jar (skip tests)
RUN mvn -B -DskipTests package

# ====== Runtime stage ======
FROM eclipse-temurin:17-jre
WORKDIR /app

ENV JAVA_OPTS=""
ENV SPRING_PROFILES_ACTIVE=prod

COPY --from=build /workspace/target/clenzy-platform-1.0.0.jar /app/app.jar

EXPOSE 8082

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]


