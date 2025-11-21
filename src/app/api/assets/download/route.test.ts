import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const assetModule = vi.hoisted(() => ({
  getReferenceAsset: vi.fn(),
}));

const storageModule = vi.hoisted(() => ({
  getStorageProvider: vi.fn(),
}));

const authModule = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    requireServerAuthSession: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
    UnauthorizedError,
  };
});

const authzModule = vi.hoisted(() => {
  class ProjectAuthorizationError extends Error {}
  return {
    ensureProjectMembership: vi.fn(),
    ProjectAuthorizationError,
  };
});

vi.mock("@/lib/assets", () => assetModule);
vi.mock("@/lib/storage", () => storageModule);
vi.mock("@/lib/auth/server", () => authModule);
vi.mock("@/lib/authz/projects.server", () => authzModule);

const mockGetReferenceAsset = assetModule.getReferenceAsset;
const mockGetStorageProvider = storageModule.getStorageProvider;
const mockRequireServerAuthSession = authModule.requireServerAuthSession;
const mockEnsureProjectMembership = authzModule.ensureProjectMembership;

describe("/api/assets/download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireServerAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mockEnsureProjectMembership.mockResolvedValue(undefined);
  });

  it("returns a signed download URL", async () => {
    mockGetReferenceAsset.mockResolvedValueOnce({
      id: "asset-1",
      projectId: "p1",
      contentType: "image/png",
      name: "Poster",
    });
    mockGetStorageProvider.mockReturnValueOnce({
      createSignedDownload: vi
        .fn()
        .mockResolvedValue({
          url: "https://signed",
          assetUrl: "https://public/asset-1",
          method: "GET",
          headers: {},
          expiresAt: "2024-01-01T00:00:00.000Z",
        }),
      createSignedUpload: vi.fn(),
    });

    const request = new NextRequest("http://localhost/api/assets/download?assetId=asset-1");
    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      download: {
        url: "https://signed",
        assetUrl: "https://public/asset-1",
        method: "GET",
        headers: {},
        expiresAt: "2024-01-01T00:00:00.000Z",
      },
    });
  });

  it("returns 404 when the asset does not exist", async () => {
    mockGetReferenceAsset.mockResolvedValueOnce(null);
    const request = new NextRequest("http://localhost/api/assets/download?assetId=missing");
    const response = await GET(request);
    expect(response.status).toBe(404);
  });
});
