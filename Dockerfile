FROM node:20-bookworm-slim

# Install system dependencies: ffmpeg, python3, curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copy dependency files
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy application files
COPY . .

# Build Vite frontend assets
RUN npm run build

# Create directory for temp media
RUN mkdir -p /app/temp_media && chmod 777 /app/temp_media

ENV PORT=3000
ENV NODE_ENV=production
ENV YT_DLP_PATH=/usr/local/bin/yt-dlp
ENV FFMPEG_PATH=/usr/bin/ffmpeg

EXPOSE 3000

CMD ["npm", "start"]
