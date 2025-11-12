import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH, POST, PUT } from "./route";

const assetModule = vi.hoisted(() => ({
  listReferenceAssets: vi.fn(),
  getReferenceAsset: vi.fn(),
  createReferenceAsset: vi.fn(),
  recordAssetBinary: vi.fn(),
  updateReferenceAsset: vi.fn(),
  serializeReferenceAsset: (asset: unknown) => asset,
}));

const storageModule = vi.hoisted(() => ({
  getStorageProvider: vi.fn(),
}));

vi.mock("@/lib/assets", () => assetModule);
vi.mock("@/lib/storage", () => storageModule);

const mockListReferenceAssets = assetModule.listReferenceAssets;
const mockGetReferenceAsset = assetModule.getReferenceAsset;
const mockCreateReferenceAsset = assetModule.createReferenceAsset;
const mockRecordAssetBinary = assetModule.recordAssetBinary;
const mockUpdateReferenceAsset = assetModule.updateReferenceAsset;
const mockGetStorageProvider = storageModule.getStorageProvider;

const observabilityModule = vi.hoisted(() => ({
  recordApiRequest: vi.fn(),
  recordApiError: vi.fn(),
  captureApiException: vi.fn(),
  withSpan: async (_options: unknown, fn: (span: { setAttribute: () => void }) => Promise<unknown>) =>
    fn({ setAttribute: () => {} }),
}));

vi.mock("@/lib/observability", () => observabilityModule);

const mockRecordApiRequest = observabilityModule.recordApiRequest;
const mockRecordApiError = observabilityModule.recordApiError;
const mockCaptureApiException = observabilityModule.captureApiException;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/assets", () => {
  it("returns all assets", async () => {
    mockListReferenceAssets.mockResolvedValueOnce([
      { id: "a1", contentType: "image/png" },
    ]);

    const request = new NextRequest("http://localhost/api/assets");
    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      assets: [{ id: "a1", contentType: "image/png" }],
    });
  });

  it("returns a single asset", async () => {
    mockGetReferenceAsset.mockResolvedValueOnce({ id: "a2", contentType: "audio/mp3" });

    const request = new NextRequest("http://localhost/api/assets?assetId=a2");
    const response = await GET(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ asset: { id: "a2", contentType: "audio/mp3" } });
  });

  it("returns 404 when asset is missing", async () => {
    mockGetReferenceAsset.mockResolvedValueOnce(null);
    const request = new NextRequest("http://localhost/api/assets?assetId=missing");
    const response = await GET(request);
    expect(response.status).toBe(404);
  });

  it("creates a new asset and returns upload info", async () => {
    mockCreateReferenceAsset.mockResolvedValueOnce({ id: "asset-1", projectId: "p1" });
    mockGetStorageProvider.mockReturnValueOnce({
      createSignedUpload: vi.fn().mockResolvedValue({ uploadUrl: "signed" }),
    });

    const request = new NextRequest("http://localhost/api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Clip", contentType: "audio/wav", size: 1200 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      asset: { id: "asset-1", projectId: "p1" },
      upload: { uploadUrl: "signed" },
    });
  });

  it("uploads binary data for an asset", async () => {
    mockGetReferenceAsset.mockResolvedValueOnce({ id: "asset-2", contentType: "image/png" });
    mockRecordAssetBinary.mockResolvedValueOnce({ id: "asset-2", contentType: "image/jpeg" });

    const request = new NextRequest("http://localhost/api/assets?assetId=asset-2", {
      method: "PUT",
      body: Buffer.from("data"),
      headers: { "content-type": "image/jpeg" },
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ asset: { id: "asset-2", contentType: "image/jpeg" } });
  });

  it("updates asset metadata", async () => {
    mockUpdateReferenceAsset.mockResolvedValueOnce({ id: "asset-3", name: "Updated" });

    const request = new NextRequest("http://localhost/api/assets", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId: "asset-3", updates: { name: "Updated" } }),
    });

    const response = await PATCH(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ asset: { id: "asset-3", name: "Updated" } });
  });
});
