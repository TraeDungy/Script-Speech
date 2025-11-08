export type AccessRequestInput = {
  email: string;
  message?: string;
};

export type AccessRequestRecord = {
  id: string;
  email: string;
  message?: string;
  submittedAt: string;
};

const requests: AccessRequestRecord[] = [];

export async function createAccessRequest({
  email,
  message,
}: AccessRequestInput): Promise<AccessRequestRecord> {
  const trimmedEmail = email.trim();
  const trimmedMessage = message?.trim();

  if (!trimmedEmail) {
    throw new Error("Email is required");
  }

  const entry: AccessRequestRecord = {
    id: crypto.randomUUID(),
    email: trimmedEmail.toLowerCase(),
    message: trimmedMessage,
    submittedAt: new Date().toISOString(),
  };

  requests.push(entry);

  return entry;
}

export async function listAccessRequests(): Promise<AccessRequestRecord[]> {
  return [...requests].reverse();
}
