# Weub Video Streaming API

A minimal video-sharing application that allows users to upload, process, and stream videos.

## Features

- Upload videos in common formats (MP4, MOV, WEBM, AVI)
- Automatic HLS transcoding with adaptive bitrate streaming
- Search and filter videos by title, tags, and upload date
- Real-time processing status updates
- Browser-based video streaming with quality selection

## Architecture

Weub is built with NestJS and uses a modern architecture for efficient video processing:

```
[Client] -- HTTP POST (upload) --> [NestJS API]
└──> Saves file & metadata
└──> Enqueues "transcode" job -> [Redis (BullMQ)]
     ↓
[Transcode Worker] (FFmpeg)
     ↓
Updates DB: status = "ready", adds HLS URLs
     ↓
[Client] -- GET (video metadata) --> [NestJS API]
└──> Renders HLS Player using `.m3u8` from static server
```

## Processing Pipeline

1. **Upload**: Videos are uploaded and stored with UUID-based filenames
2. **Queue**: Background transcoding jobs are created and queued
3. **Process**: Videos are transcoded to HLS format with multiple resolutions
4. **Stream**: Ready videos can be streamed via HLS playlists

## Tech Stack

- **Backend**: NestJS (Node.js framework)
- **Database**: PostgreSQL (via Prisma ORM)
- **Queue System**: Redis with BullMQ
- **Video Processing**: FFmpeg
- **Streaming Protocol**: HTTP Live Streaming (HLS)
- **API Documentation**: OpenAPI/Swagger

## Prerequisites

- Node.js (v16+)
- PostgreSQL
- Redis
- FFmpeg

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/weub.git
cd weub

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npx prisma migrate dev
```

## Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod
```

## Docker Setup

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down
```

## API Documentation

Once the application is running, you can access the Swagger documentation at:

```
http://localhost:3000/api/docs
```

## API Endpoints

### Video Management

- `POST /api/v1/videos/upload` - Upload a new video
- `GET /api/v1/videos` - List and search videos
- `GET /api/v1/videos/{videoId}` - Get video details

### Video Streaming

- `GET /api/v1/streaming/{videoId}` - Stream a video

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue on the GitHub repository or contact juxluvjoe@gmail.com.
