FROM node:24.22.0-bookworm-slim@sha256:91acba91b842bec0bf7ea6f5e09c644c7ccad72c4996ed9616d861d1c7cd60d4 AS build
WORKDIR /workspace/frontend
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . ./
COPY --from=crew_fixtures /crew-response.json /person-response.json /workspace/docs/crew/rest-api-validation/
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
LABEL org.opencontainers.image.title="MISSION1 frontend" \
      org.opencontainers.image.description="Static Earth View and same-origin API proxy" \
      org.opencontainers.image.source="https://github.com/therabo/MISSION1"
COPY --chown=101:101 nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=101:101 /workspace/frontend/dist/ /usr/share/nginx/html/
USER 101:101
EXPOSE 8080
