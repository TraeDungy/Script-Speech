export interface ExportDownloadRecord {
  jobId: string;
  signedUrl: string;
  expiresAt: string;
  userId?: string;
}

export async function recordExportDownload(record: ExportDownloadRecord): Promise<void>
