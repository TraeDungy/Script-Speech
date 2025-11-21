const STORAGE_DRIVER = process.env.STORAGE_DRIVER?.trim() ?? process.env.ASSET_STORAGE_DRIVER?.trim();

function normaliseBucket(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\s+/g, "-");
}

function normaliseFolder(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim().replace(/^\//, "").replace(/\/$/, "");
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export type StorageDriver = "supabase" | "s3" | "local";

export function getStorageDriver(): StorageDriver {
  if (STORAGE_DRIVER === "supabase" || STORAGE_DRIVER === "s3") {
    return STORAGE_DRIVER;
  }
  if (process.env.SUPABASE_STORAGE_BUCKET && process.env.SUPABASE_URL) {
    return "supabase";
  }
  if (process.env.S3_BUCKET && process.env.AWS_REGION) {
    return "s3";
  }
  return "local";
}

export const SUPABASE_STORAGE_BUCKET = normaliseBucket(
  process.env.SUPABASE_STORAGE_BUCKET ?? process.env.ASSET_SUPABASE_BUCKET,
  "reference-assets",
);
export const SUPABASE_STORAGE_FOLDER = normaliseFolder(
  process.env.SUPABASE_STORAGE_FOLDER ?? process.env.ASSET_SUPABASE_FOLDER,
  "reference",
);

export const STORAGE_SIGNED_URL_TTL_SECONDS = (() => {
  const raw = process.env.STORAGE_SIGNED_URL_TTL_SECONDS ?? process.env.ASSET_SIGNED_URL_TTL;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 60;
})();

export const STORAGE_MAX_UPLOAD_BYTES = (() => {
  const raw = process.env.STORAGE_MAX_UPLOAD_BYTES ?? process.env.ASSET_MAX_UPLOAD_BYTES;
  if (!raw) {
    return 500 * 1024 * 1024; // 500 MB default
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 500 * 1024 * 1024;
})();

export const STORAGE_ALLOWED_CONTENT_TYPES = (() => {
  const raw = process.env.STORAGE_ALLOWED_CONTENT_TYPES ?? process.env.ASSET_ALLOWED_CONTENT_TYPES;
  if (!raw) {
    return [
      "image/",
      "audio/",
      "video/",
      "application/pdf",
      "application/json",
      "text/plain",
    ];
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
})();

export const S3_BUCKET = process.env.S3_BUCKET?.trim() ?? process.env.ASSET_S3_BUCKET?.trim();
export const S3_PREFIX = process.env.S3_PREFIX?.trim() ?? process.env.ASSET_S3_PREFIX?.trim() ?? "assets";
export const S3_REGION = process.env.S3_REGION?.trim() ?? process.env.AWS_REGION?.trim();
export const S3_ENDPOINT = process.env.S3_ENDPOINT?.trim();
export const S3_FORCE_PATH_STYLE = (() => {
  const raw = process.env.S3_FORCE_PATH_STYLE ?? process.env.ASSET_S3_FORCE_PATH_STYLE;
  if (!raw) return false;
  return ["1", "true", "on", "yes"].includes(raw.toLowerCase());
})();
export const S3_PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL?.trim();

export const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID?.trim() ?? process.env.AWS_ACCESS_KEY_ID?.trim();
export const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY?.trim() ?? process.env.AWS_SECRET_ACCESS_KEY?.trim();
export const S3_SESSION_TOKEN = process.env.S3_SESSION_TOKEN?.trim() ?? process.env.AWS_SESSION_TOKEN?.trim();
