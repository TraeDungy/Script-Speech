interface SupabaseStorageBucketApi {
  upload(path: string, file: unknown, options?: Record<string, unknown>): Promise<{ error?: unknown }>;
  createSignedUrl(path: string, expiresIn: number): Promise<{ data?: { signedUrl?: string }; error?: unknown }>;
}

interface SupabaseStorageClient {
  from(bucket: string): SupabaseStorageBucketApi;
}

export interface SupabaseServiceClient {
  storage: SupabaseStorageClient;
  from(table: string): {
    select(columns: string): { eq(column: string, value: string): { maybeSingle(): Promise<{ data: any; error?: any }> } };
  };
}

export function getSupabaseServiceClient(): SupabaseServiceClient | null
