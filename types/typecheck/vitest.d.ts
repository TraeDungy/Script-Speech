export type MockFn = (...args: unknown[]) => unknown;

export const describe: (...args: unknown[]) => void;
export const it: (...args: unknown[]) => void;
export const beforeEach: (...args: unknown[]) => void;

export interface ExpectLike {
  (value: unknown): ExpectLike;
  toBe?: (value: unknown) => void;
  toEqual?: (value: unknown) => void;
  toMatchObject?: (value: unknown) => void;
  resolves?: { toEqual?: (value: unknown) => Promise<void>; toMatchObject?: (value: unknown) => Promise<void> };
  objectContaining?: (value: unknown) => unknown;
  toHaveBeenCalled?: () => void;
  toHaveBeenCalledWith?: (...args: unknown[]) => void;
  toHaveBeenCalledTimes?: (times: number) => void;
  not?: ExpectLike;
}

export const expect: ExpectLike;

export const vi: {
  fn: (
    ...impl: unknown[]
  ) => MockFn & {
    mockResolvedValue?: (value: unknown) => MockFn;
    mockResolvedValueOnce?: (value: unknown) => MockFn;
    mockRejectedValueOnce?: (value: unknown) => MockFn;
    mockReturnValueOnce?: (value: unknown) => MockFn;
  };
  mock: (module: string, factory: () => unknown) => void;
  hoisted: <T>(factory: () => T) => T;
  clearAllMocks: () => void;
};
