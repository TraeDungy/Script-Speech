export class UnauthorizedError extends Error {}

export async function requireServerAuthSession(): Promise<{ user: { id: string } }>
