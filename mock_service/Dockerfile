FROM node:20-alpine AS builder

WORKDIR /project/mock_service

COPY mock_service/package*.json ./
RUN npm install

COPY mock_service/tsconfig.json ./
COPY mock_service/src ./src
RUN npm run build

FROM node:20-alpine

WORKDIR /project

COPY proto ./proto
COPY --from=builder /project/mock_service/dist ./mock_service/dist

WORKDIR /project/mock_service
COPY mock_service/package*.json ./
RUN npm install --omit=dev

CMD ["node", "dist/server.js"]
