export interface DraftVersionRecord {
  id: string;
  projectId: string;
  createdBy: string | null;
  doc: unknown;
}

export async function createDraftVersionRecord(input: {
  projectId: string;
  doc: unknown;
  createdBy: string | null;
}): Promise<DraftVersionRecord>
