import { createHash, createHmac } from "node:crypto";

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

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeS3Key(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function getSigningKey(secret: string, dateStamp: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function ensureProtocol(url: string): string {
  if (!url.match(/^https?:\/\//i)) {
    return `https://${url}`;
  }
  return url;
}

function buildS3Endpoint() {
  if (!S3_BUCKET || !S3_REGION) {
    throw new Error("S3 storage is not configured");
  }

  if (!S3_ENDPOINT) {
    const host = S3_FORCE_PATH_STYLE
      ? `s3.${S3_REGION}.amazonaws.com`
      : `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;
    return { protocol: "https:", host, basePath: "" };
  }

  const endpoint = new URL(ensureProtocol(S3_ENDPOINT));
  return {
    protocol: endpoint.protocol || "https:",
    host: endpoint.host,
    basePath: endpoint.pathname.replace(/\/$/, ""),
  };
}

function buildS3RequestPath(key: string) {
  const { protocol, host: rawHost, basePath } = buildS3Endpoint();
  const encodedKey = encodeS3Key(key);
  let host = rawHost;
  let path = basePath ? `${basePath}/${encodedKey}` : `/${encodedKey}`;

  if (S3_FORCE_PATH_STYLE) {
    const bucketSegment = encodeRfc3986(S3_BUCKET!);
    path = basePath ? `${basePath}/${bucketSegment}/${encodedKey}` : `/${bucketSegment}/${encodedKey}`;
  } else if (!S3_ENDPOINT || !rawHost.startsWith(`${S3_BUCKET}.`)) {
    host = `${encodeURIComponent(S3_BUCKET!)}.${rawHost}`;
  }

  path = path.replace(/\/{2,}/g, "/");
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  return { protocol, host, path };
}

function createS3SignedUrl(options: {
  method: "GET" | "PUT";
  key: string;
  expiresIn: number;
  contentType?: string;
  responseContentDisposition?: string;
}): { url: string; headers: Record<string, string> } {
  if (!S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw new Error("S3 storage is not configured");
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${S3_REGION}/s3/aws4_request`;
  const { protocol, host, path } = buildS3RequestPath(options.key);

  const signedHeaders: Array<[string, string]> = [["host", host]];
  if (options.contentType) {
    signedHeaders.push(["content-type", options.contentType]);
  }
  signedHeaders.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalHeaders = signedHeaders
    .map(([name, value]) => `${name}:${value.trim().replace(/\s+/g, " ")}\n`)
    .join("");
  const signedHeaderNames = signedHeaders.map(([name]) => name).join(";");

  const baseQuery: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${S3_ACCESS_KEY_ID}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", Math.min(7 * 24 * 60 * 60, Math.max(1, options.expiresIn)).toString()],
    ["X-Amz-SignedHeaders", signedHeaderNames],
  ];

  if (S3_SESSION_TOKEN) {
    baseQuery.push(["X-Amz-Security-Token", S3_SESSION_TOKEN]);
  }

  if (options.responseContentDisposition) {
    baseQuery.push(["response-content-disposition", options.responseContentDisposition]);
  }

  baseQuery.sort((a, b) => {
    if (a[0] === b[0]) {
      return a[1].localeCompare(b[1]);
    }
    return a[0].localeCompare(b[0]);
  });

  const canonicalQuery = baseQuery
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");

  const canonicalRequest = [
    options.method,
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaderNames,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = getSigningKey(S3_SECRET_ACCESS_KEY!, dateStamp, S3_REGION);
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  const finalQuery = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  const url = `${protocol}//${host}${path}?${finalQuery}`;

  const headers: Record<string, string> = {};
  if (options.contentType) {
    headers["Content-Type"] = options.contentType;
  }

  return { url, headers };
}

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
  constructor() {
    if (!S3_BUCKET || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
      throw new Error("S3 storage is not configured");
    }
  }

  private getAssetUrl(key: string): string {
    if (S3_PUBLIC_BASE_URL) {
      return `${S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
    }
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
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

    const { url, headers } = createS3SignedUrl({
      method: "PUT",
      key,
      expiresIn: STORAGE_SIGNED_URL_TTL_SECONDS,
      contentType,
    });

    return {
      uploadUrl: url,
      method: "PUT",
      headers,
      assetUrl: this.getAssetUrl(key),
      expiresAt: new Date(Date.now() + STORAGE_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
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

    const { url } = createS3SignedUrl({
      method: "GET",
      key,
      expiresIn: STORAGE_SIGNED_URL_TTL_SECONDS,
      responseContentDisposition: fileName
        ? `attachment; filename="${encodeURIComponent(fileName)}"`
        : undefined,
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
