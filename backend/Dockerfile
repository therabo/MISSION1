FROM maven:3.9.16-eclipse-temurin-21@sha256:99e61abcff91a9b1333463bd8451fb18495d6eba9250ac66a338b518f8278320 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -ntp -DskipTests clean package

FROM eclipse-temurin:21-jre-jammy@sha256:affcab5356e1270ac35d2361ee83135af2f03e8d580eca78a6d5d6fdbf048db0
LABEL org.opencontainers.image.title="MISSION1 backend" \
      org.opencontainers.image.description="ISS data acquisition, persistence and read-only APIs" \
      org.opencontainers.image.source="https://github.com/therabo/MISSION1"
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 mission1 \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin mission1
WORKDIR /app
COPY --from=build --chown=10001:10001 /workspace/target/mission1-backend-0.1.0-SNAPSHOT.jar ./app.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
