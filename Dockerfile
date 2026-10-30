# syntax=docker/dockerfile:1
# Targets:
#   api      production API            (node, non-root, prod dependencies only)
#   web      production web            (nginx serving the built front end, proxying /api)
#   dev-api  development API           (all dependencies, node --watch; source is bind-mounted)
#   dev-web  development front end     (Vite dev server with HMR; source is bind-mounted)
ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.28-alpine

# ---------- API ----------
FROM ${NODE_IMAGE} AS api-base
WORKDIR /srv/app
RUN chown node:node /srv/app
USER node
COPY --chown=node:node app/package.json app/package-lock.json ./

FROM api-base AS api-prod-deps
RUN npm ci --omit=dev

FROM api-base AS dev-api
RUN npm ci
COPY --chown=node:node app/ ./
ENV HOST=0.0.0.0 NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM ${NODE_IMAGE} AS api
WORKDIR /srv/app
ENV NODE_ENV=production HOST=0.0.0.0 APP_PORT=3000
COPY --from=api-prod-deps /srv/app/node_modules ./node_modules
COPY app/package.json ./
COPY app/src ./src
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "src/server.js"]

# ---------- Front end ----------
FROM ${NODE_IMAGE} AS web-base
WORKDIR /srv/web
RUN chown node:node /srv/web
USER node
COPY --chown=node:node web/package.json web/package-lock.json ./
# npm can exit 0 while skipping the native rolldown binding (npm/cli#4828); fail here instead of at `vite build`
RUN npm ci && node --input-type=module -e "await import('rolldown')"

FROM web-base AS dev-web
COPY --chown=node:node web/ ./
ENV VITE_HOST=0.0.0.0 API_URL=http://api:3000
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM web-base AS web-build
COPY --chown=node:node web/ ./
USER root
RUN mkdir /srv/www && chown node:node /srv/www
USER node
RUN npm run build        # tsc && vite build, writes to ../www (/srv/www)

FROM ${NGINX_IMAGE} AS web
ENV API_UPSTREAM=api:3000 RESOLVER=127.0.0.11
COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=web-build /srv/www /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1
