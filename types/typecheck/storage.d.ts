export interface SignedUpload {
  uploadUrl: string;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  assetUrl?: string;
  expiresAt: string;
  storageKey?: string;
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
    projectId?: string | null;
    contentType?: string;
    fileName?: string;
  }): Promise<{ url: string }>;
}

export function getStorageProvider(): StorageProvider;
