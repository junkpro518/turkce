# syntax=docker/dockerfile:1

# --- deps ---
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build ---
FROM node:22-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runtime ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Next.js standalone server + static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Morphology analyzer data files into the working dir (the analyzer reads them from cwd at runtime)
COPY --from=builder /app/node_modules/nlptoolkit-morphologicalanalysis/turkish_finite_state_machine.xml ./
COPY --from=builder /app/node_modules/nlptoolkit-morphologicalanalysis/suffixes.txt ./
COPY --from=builder /app/node_modules/nlptoolkit-morphologicalanalysis/pronunciations.txt ./
COPY --from=builder /app/node_modules/nlptoolkit-dictionary/turkish_dictionary.txt ./
COPY --from=builder /app/node_modules/nlptoolkit-dictionary/turkish_misspellings.txt ./
COPY --from=builder /app/node_modules/nlptoolkit-dictionary/turkish_morphological_lexicon.txt ./

EXPOSE 3000
CMD ["node", "server.js"]
