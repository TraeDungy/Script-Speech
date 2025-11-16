import crypto from "node:crypto";

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

export interface SignedDownload {
  url: string;
  headers?: Record<string, string>;
  expiresAt: string;
}

export interface StorageProvider {
  createSignedUpload(input: {
    assetId: string;
    contentType: string;
    size: number;
    projectId?: string | null;
  }): Promise<SignedUpload>;

  createSignedDownload(input: {
    assetId: string;
    contentType: string;
    projectId?: string | null;
    fileName?: string;
  }): Promise<SignedDownload>;
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

const S3_MAX_PRESIGN_SECONDS = 7 * 24 * 60 * 60;

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeS3Key(key: string): string {
  return key
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(encodeRfc3986)
    .join("/");
}

function normaliseEndpoint(raw?: string | null): string | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function buildS3UrlComponents({
  bucket,
  key,
  region,
  endpoint,
  forcePathStyle,
}: {
  bucket: string;
  key: string;
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
}): { url: URL; canonicalUri: string } {
  const encodedKey = encodeS3Key(key);
  if (!bucket) {
    throw new Error("S3 bucket is required for signing");
  }

  if (endpoint) {
    const base = new URL(endpoint);
    const basePath = base.pathname.replace(/\/$/, "");
    if (forcePathStyle) {
      const path = `${basePath}/${bucket}/${encodedKey}`.replace(/\/+/g, "/");
      const url = new URL(`${base.protocol}//${base.host}${path.startsWith("/") ? "" : "/"}${path}`);
      return { url, canonicalUri: url.pathname || "/" };
    }
    const path = `${basePath}/${encodedKey}`.replace(/\/+/g, "/");
    const url = new URL(`${base.protocol}//${bucket}.${base.host}${path.startsWith("/") ? "" : "/"}${path}`);
    return { url, canonicalUri: url.pathname || "/" };
  }

  if (forcePathStyle) {
    const host = `s3.${region}.amazonaws.com`;
    const url = new URL(`https://${host}/${bucket}/${encodedKey}`);
    return { url, canonicalUri: url.pathname || "/" };
  }

  const url = new URL(`https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`);
  return { url, canonicalUri: url.pathname || "/" };
}

function formatAmzDate(date: Date): string {
  const pad = (value: number, size = 2) => value.toString().padStart(size, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function hashSha256(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hmacSha256(key: crypto.BinaryLike | crypto.KeyObject, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function getSigningKey(secret: string, dateStamp: string, region: string): Buffer {
  const kDate = hmacSha256(`AWS4${secret}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "s3");
  return hmacSha256(kService, "aws4_request");
}

function buildCanonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(params[key])}`)
    .join("&");
}

function createPresignedS3Url({
  method,
  bucket,
  region,
  key,
  expiresIn,
  headers,
  query,
  endpoint,
  forcePathStyle,
  accessKeyId,
  secretAccessKey,
  sessionToken,
}: {
  method: "GET" | "PUT";
  bucket: string;
  region: string;
  key: string;
  expiresIn: number;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}): string {
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3 credentials are not configured");
  }

  const endpointUrl = normaliseEndpoint(endpoint);
  const { url, canonicalUri } = buildS3UrlComponents({
    bucket,
    key,
    region,
    endpoint: endpointUrl,
    forcePathStyle,
  });

  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const expires = Math.min(S3_MAX_PRESIGN_SECONDS, Math.max(1, Math.round(expiresIn)));

  const canonicalHeaders: Record<string, string> = {
    host: url.host,
    ...(headers
      ? Object.fromEntries(
          Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value.trim()]),
        )
      : {}),
  };

  const signedHeadersList = Object.keys(canonicalHeaders)
    .map((name) => name.toLowerCase())
    .sort();
  const signedHeaders = signedHeadersList.join(";");
  const canonicalHeadersString = signedHeadersList.map((name) => `${name}:${canonicalHeaders[name]}`).join("\n") + "\n";

  const queryParams: Record<string, string> = {
    ...(query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expires.toString(),
    "X-Amz-SignedHeaders": signedHeaders,
  };

  if (sessionToken) {
    queryParams["X-Amz-Security-Token"] = sessionToken;
  }

  const canonicalQuery = buildCanonicalQuery(queryParams);
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeadersString}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hashSha256(canonicalRequest)}`;
  const signingKey = getSigningKey(secretAccessKey, dateStamp, region);
  const signature = hmacSha256(signingKey, stringToSign).toString("hex");

  const finalQuery = buildCanonicalQuery({
    ...queryParams,
    "X-Amz-Signature": signature,
  });

  const signedUrl = new URL(url.toString());
  signedUrl.search = finalQuery;
  return signedUrl.toString();
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

  async createSignedDownload({ assetId }: {
    assetId: string;
    contentType: string;
    projectId?: string | null;
    fileName?: string;
  }): Promise<SignedDownload> {
    const expiresAt = new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    return {
      url: `/api/assets?assetId=${assetId}`,
      expiresAt,
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

  async createSignedDownload({
    assetId,
    contentType,
    projectId,
    fileName,
  }: {
    assetId: string;
    contentType: string;
    projectId?: string | null;
    fileName?: string;
  }): Promise<SignedDownload> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase storage is not configured");
    }

    const client = getSupabaseClient();
    const path = buildStoragePath({
      assetId,
      contentType,
      projectId,
      prefix: SUPABASE_STORAGE_FOLDER,
    });

    const { data, error } = await client.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(path, STORAGE_SIGNED_URL_TTL_SECONDS, {
        download: fileName,
      });

    if (error || !data) {
      console.error("Failed to create Supabase signed download", error);
      throw error ?? new Error("Unable to create signed download");
    }

    const supabaseBaseUrl = SUPABASE_URL?.replace(/\/$/, "");
    const absoluteUrl = data.signedUrl.startsWith("http")
      ? data.signedUrl
      : `${supabaseBaseUrl ?? ""}${data.signedUrl.startsWith("/") ? "" : "/"}${data.signedUrl}`;

    return {
      url: absoluteUrl,
      expiresAt: new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    };
  }
}

class S3StorageProvider implements StorageProvider {
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly forcePathStyle: boolean;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly sessionToken?: string;

  constructor() {
    if (!S3_BUCKET || !S3_REGION) {
      throw new Error("S3 storage is not configured");
    }
    if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new Error("S3 credentials are required for S3 storage");
    }

    this.bucket = S3_BUCKET;
    this.region = S3_REGION;
    this.endpoint = S3_ENDPOINT ?? undefined;
    this.forcePathStyle = S3_FORCE_PATH_STYLE;
    this.accessKeyId = S3_ACCESS_KEY_ID;
    this.secretAccessKey = S3_SECRET_ACCESS_KEY;
    this.sessionToken = S3_SESSION_TOKEN ?? undefined;
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
    ensureUploadAllowed({ contentType, size });

    const key = buildStoragePath({
      assetId,
      contentType,
      projectId,
      prefix: S3_PREFIX,
    });

    const uploadUrl = createPresignedS3Url({
      method: "PUT",
      bucket: this.bucket,
      region: this.region,
      key,
      expiresIn: STORAGE_SIGNED_URL_TTL_SECONDS,
      headers: {
        "content-type": contentType,
      },
      endpoint: this.endpoint,
      forcePathStyle: this.forcePathStyle,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      sessionToken: this.sessionToken,
    });

    const expiresAt = new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    const assetUrl = S3_PUBLIC_BASE_URL
      ? `${S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      assetUrl,
      expiresAt,
    };
  }

  async createSignedDownload({
    assetId,
    contentType,
    projectId,
    fileName,
  }: {
    assetId: string;
    contentType: string;
    projectId?: string | null;
    fileName?: string;
  }): Promise<SignedDownload> {
    const key = buildStoragePath({
      assetId,
      contentType,
      projectId,
      prefix: S3_PREFIX,
    });

    const query = fileName
      ? {
          "response-content-disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        }
      : undefined;

    const url = createPresignedS3Url({
      method: "GET",
      bucket: this.bucket,
      region: this.region,
      key,
      expiresIn: STORAGE_SIGNED_URL_TTL_SECONDS,
      query,
      endpoint: this.endpoint,
      forcePathStyle: this.forcePathStyle,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      sessionToken: this.sessionToken,
    });

    return {
      url,
      expiresAt: new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
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
