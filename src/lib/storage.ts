import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getSupabaseClient } from "@/lib/db/client";
import { SUPABASE_URL, isSupabaseConfigured } from "@/lib/db/config";

import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_FORCE_PATH_STYLE,
  S3_PREFIX,
  S3_PUBLIC_BASE_URL,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  S3_SESSION_TOKEN,
  STORAGE_ALLOWED_CONTENT_TYPES,
  STORAGE_MAX_UPLOAD_BYTES,
  STORAGE_SIGNED_URL_TTL_SECONDS,
  SUPABASE_STORAGE_BUCKET,
  SUPABASE_STORAGE_FOLDER,
  getStorageDriver,
} from "./storage/config";

export interface SignedUpload {
  uploadUrl: string;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  assetUrl: string;
  expiresAt: string;
}

export interface StorageProvider {
  createSignedUpload(input: {
    assetId: string;
    contentType: string;
    size: number;
    projectId?: string | null;
  }): Promise<SignedUpload>;
}

function normaliseContentType(value: string): string {
  return value.trim().toLowerCase();
}

function isContentTypeAllowed(contentType: string): boolean {
  const normalised = normaliseContentType(contentType);
  return STORAGE_ALLOWED_CONTENT_TYPES.some((pattern) => {
    const p = pattern.toLowerCase();
    if (!p) return false;
    if (p === "*") return true;
    if (p.includes("*")) {
      const escaped = p
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\\\*/g, ".*");
      return new RegExp(`^${escaped}$`).test(normalised);
    }
    if (p.endsWith("/")) {
      return normalised.startsWith(p);
    }
    if (p.endsWith("/*")) {
      return normalised.startsWith(p.slice(0, -1));
    }
    return normalised === p;
  });
}

function ensureUploadAllowed({
  contentType,
  size,
}: {
  contentType: string;
  size: number;
}) {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error("Upload size must be greater than zero");
  }

  if (size > STORAGE_MAX_UPLOAD_BYTES) {
    throw new Error("Upload exceeds configured size limit");
  }

  if (!contentType) {
    throw new Error("Content type is required");
  }

  if (!isContentTypeAllowed(contentType)) {
    throw new Error(`Uploads with content type '${contentType}' are not permitted`);
  }
}

const CONTENT_TYPE_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/heic": "heic",
  "image/heif": "heif",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "application/json": "json",
  "text/plain": "txt",
};

function getExtensionForContentType(contentType: string): string {
  const normalised = normaliseContentType(contentType);
  if (CONTENT_TYPE_EXTENSION_MAP[normalised]) {
    return CONTENT_TYPE_EXTENSION_MAP[normalised];
  }
  const subtype = normalised.split("/")[1];
  return subtype ? subtype.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "bin";
}

function buildStoragePath({
  assetId,
  projectId,
  contentType,
  prefix,
}: {
  assetId: string;
  projectId?: string | null;
  contentType: string;
  prefix: string;
}) {
  const extension = getExtensionForContentType(contentType);
  const safeProjectSegment = projectId?.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() ?? "shared";
  return `${prefix}/${safeProjectSegment}/${assetId}.${extension}`;
}

class LocalStorageProvider implements StorageProvider {
  async createSignedUpload({
    assetId,
    contentType,
    size,
  }: {
    assetId: string;
    contentType: string;
    size: number;
    projectId?: string | null;
  }): Promise<SignedUpload> {
    ensureUploadAllowed({ contentType, size });
    const expires = new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000);

    return {
      uploadUrl: `/api/assets?assetId=${assetId}`,
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      assetUrl: `/api/assets/${assetId}`,
      expiresAt: expires.toISOString(),
    };
  }
}

class SupabaseStorageProvider implements StorageProvider {
  async createSignedUpload({
    assetId,
    contentType,
    size,
    projectId,
  }: {
    assetId: string;
    contentType: string;
    size: number;
    projectId?: string | null;
  }): Promise<SignedUpload> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase storage is not configured");
    }

    ensureUploadAllowed({ contentType, size });

    const client = getSupabaseClient();
    const path = buildStoragePath({
      assetId,
      contentType,
      projectId,
      prefix: SUPABASE_STORAGE_FOLDER,
    });

    const { data, error } = await client.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .createSignedUploadUrl(path, STORAGE_SIGNED_URL_TTL_SECONDS);

    if (error || !data) {
      console.error("Failed to create Supabase signed upload", error);
      throw error ?? new Error("Unable to create signed upload");
    }

    const baseUrl = client.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    const supabaseBaseUrl = SUPABASE_URL?.replace(/\/$/, "");
    const absoluteUploadUrl = data.signedUrl.startsWith("http")
      ? data.signedUrl
      : `${supabaseBaseUrl ?? ""}${data.signedUrl.startsWith("/") ? "" : "/"}${data.signedUrl}`;
    const expiresAt = new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString();

    const fallbackAssetUrl = supabaseBaseUrl
      ? `${supabaseBaseUrl}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${path}`
      : `${SUPABASE_STORAGE_BUCKET}/${path}`;

    return {
      uploadUrl: absoluteUploadUrl,
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      assetUrl: baseUrl ?? fallbackAssetUrl,
      expiresAt,
    };
  }
}

class S3StorageProvider implements StorageProvider {
  private client: S3Client;

  constructor() {
    if (!S3_BUCKET || !S3_REGION) {
      throw new Error("S3 storage is not configured");
    }

    this.client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      forcePathStyle: S3_FORCE_PATH_STYLE,
      credentials:
        S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: S3_ACCESS_KEY_ID,
              secretAccessKey: S3_SECRET_ACCESS_KEY!,
              sessionToken: S3_SESSION_TOKEN,
            }
          : undefined,
    });
  }

  async createSignedUpload({
    assetId,
    contentType,
    size,
    projectId,
  }: {
    assetId: string;
    contentType: string;
    size: number;
    projectId?: string | null;
  }): Promise<SignedUpload> {
    if (!S3_BUCKET || !S3_REGION) {
      throw new Error("S3 storage is not configured");
    }

    ensureUploadAllowed({ contentType, size });

    const key = buildStoragePath({
      assetId,
      contentType,
      projectId,
      prefix: S3_PREFIX,
    });

    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });

    const signedUrl = await getSignedUrl(this.client, command, {
      expiresIn: STORAGE_SIGNED_URL_TTL_SECONDS,
    });

    const expiresAt = new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    const assetUrl = S3_PUBLIC_BASE_URL
      ? `${S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
      : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;

    return {
      uploadUrl: signedUrl,
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      assetUrl,
      expiresAt,
    };
  }
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    const driver = getStorageDriver();
    if (driver === "supabase") {
      provider = new SupabaseStorageProvider();
    } else if (driver === "s3") {
      provider = new S3StorageProvider();
    } else {
      provider = new LocalStorageProvider();
    }
  }

  return provider;
}
