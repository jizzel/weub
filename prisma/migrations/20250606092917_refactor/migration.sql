-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "OutputStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('HLS_TRANSCODE', 'THUMBNAIL_GENERATE');

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "file_extension" VARCHAR(10) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "upload_path" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_outputs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "resolution" VARCHAR(10) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bitrate" INTEGER NOT NULL,
    "playlist_path" TEXT NOT NULL,
    "segment_directory" TEXT NOT NULL,
    "file_size" BIGINT,
    "segment_count" INTEGER,
    "segment_duration" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "status" "OutputStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "video_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcoding_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "video_id" UUID NOT NULL,
    "job_type" "JobType" NOT NULL DEFAULT 'HLS_TRANSCODE',
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress_percentage" INTEGER NOT NULL DEFAULT 0,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "job_data" JSONB,
    "result_data" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "next_retry_at" TIMESTAMPTZ,
    "worker_id" VARCHAR(100),
    "estimated_duration_seconds" INTEGER,

    CONSTRAINT "transcoding_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "metric_name" VARCHAR(100) NOT NULL,
    "metric_value" DECIMAL(65,30) NOT NULL,
    "metric_unit" VARCHAR(20),
    "context" JSONB,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- CreateIndex
CREATE INDEX "videos_created_at_idx" ON "videos"("created_at" DESC);

-- CreateIndex
CREATE INDEX "videos_tags_idx" ON "videos" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "video_outputs_video_id_idx" ON "video_outputs"("video_id");

-- CreateIndex
CREATE INDEX "video_outputs_status_idx" ON "video_outputs"("status");

-- CreateIndex
CREATE INDEX "video_outputs_resolution_idx" ON "video_outputs"("resolution");

-- CreateIndex
CREATE UNIQUE INDEX "video_outputs_video_id_resolution_key" ON "video_outputs"("video_id", "resolution");

-- CreateIndex
CREATE INDEX "transcoding_jobs_video_id_idx" ON "transcoding_jobs"("video_id");

-- CreateIndex
CREATE INDEX "transcoding_jobs_status_idx" ON "transcoding_jobs"("status");

-- CreateIndex
CREATE INDEX "transcoding_jobs_created_at_idx" ON "transcoding_jobs"("created_at");

-- CreateIndex
CREATE INDEX "transcoding_jobs_next_retry_at_idx" ON "transcoding_jobs"("next_retry_at");

-- CreateIndex
CREATE INDEX "system_metrics_metric_name_recorded_at_idx" ON "system_metrics"("metric_name", "recorded_at" DESC);

-- CreateIndex
CREATE INDEX "system_metrics_recorded_at_idx" ON "system_metrics"("recorded_at" DESC);

-- AddForeignKey
ALTER TABLE "video_outputs" ADD CONSTRAINT "video_outputs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcoding_jobs" ADD CONSTRAINT "transcoding_jobs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
