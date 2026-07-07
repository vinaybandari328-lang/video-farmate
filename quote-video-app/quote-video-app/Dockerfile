FROM node:20-slim

# ffmpeg for rendering, fontconfig + dejavu font for drawtext captions
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core fontconfig ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY server.js videoEngine.js ./
COPY public ./public

RUN mkdir -p outputs tmp

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
