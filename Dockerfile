# syntax=docker/dockerfile:1.7
FROM node:24.1.0-alpine3.22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/agent-client/package.json packages/agent-client/package.json
RUN npm ci
COPY . .
RUN npm run build --workspace @hfj/contracts
RUN npm run build
RUN npm prune --omit=dev

FROM node:24.1.0-alpine3.22 AS runtime
RUN apk add --no-cache ca-certificates git openssh-client tini \
  && addgroup -g 10001 hfj \
  && adduser -D -H -u 10001 -G hfj hfj
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOUSEHOLD_REPOSITORY_ROOT=/data/households \
    HOUSEHOLD_WORKTREE_ROOT=/data/households/.worktrees
COPY --from=build --chown=hfj:hfj /app/package.json /app/package-lock.json ./
COPY --from=build --chown=hfj:hfj /app/node_modules ./node_modules
COPY --from=build --chown=hfj:hfj /app/apps/server/package.json ./apps/server/package.json
COPY --from=build --chown=hfj:hfj /app/apps/server/dist ./apps/server/dist
COPY --from=build --chown=hfj:hfj /app/apps/web/package.json ./apps/web/package.json
COPY --from=build --chown=hfj:hfj /app/apps/web/dist ./apps/web/dist
COPY --from=build --chown=hfj:hfj /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=hfj:hfj /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=hfj:hfj /app/packages/agent-client/install-metadata.json ./packages/agent-client/install-metadata.json
USER hfj
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "start", "--workspace", "@hfj/server"]
