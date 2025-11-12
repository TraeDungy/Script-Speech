export interface SupabaseClient {
  from<T>(table: string): SupabaseQuery<T>;
}

export interface SupabaseQuery<T> {
  select(columns: string): SupabaseQuery<T>;
  insert(values: T | T[]): SupabaseQuery<T>;
  update(values: Partial<T>): SupabaseQuery<T>;
  eq(column: string, value: unknown): SupabaseQuery<T>;
  gte(column: string, value: unknown): SupabaseQuery<T>;
  limit(count: number): SupabaseQuery<T>;
  order(column: string, options?: { ascending?: boolean }): SupabaseQuery<T>;
  maybeSingle(): Promise<{ data: T | null; error: unknown }>;
  single(): Promise<{ data: T; error: unknown }>;
}

export declare function getSupabaseClient(): SupabaseClient;
