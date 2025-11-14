export class NextRequest {
  headers: Map<string, string>;
  nextUrl: URL;
  constructor(input?: string | URL, init?: RequestInit);
}

export class NextResponse {
  status: number;
  constructor(body?: BodyInit | null, init?: { status?: number; headers?: Record<string, string> });
  json(): Promise<unknown>;
  static json(body?: unknown, init?: { status?: number; headers?: Record<string, string> }): NextResponse;
}
