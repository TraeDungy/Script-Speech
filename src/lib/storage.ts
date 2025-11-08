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

class LocalStorageProvider implements StorageProvider {
  async createSignedUpload({ assetId, contentType }: {
    assetId: string;
    contentType: string;
    size: number;
    projectId?: string | null;
  }): Promise<SignedUpload> {
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    return {
      uploadUrl: `/api/assets?assetId=${assetId}`,
      method: "PUT",
      headers: {
        "Content-Type": contentType
      },
      assetUrl: `/api/assets/${assetId}`,
      expiresAt: expires.toISOString()
    };
  }
}

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    provider = new LocalStorageProvider();
  }

  return provider;
}
