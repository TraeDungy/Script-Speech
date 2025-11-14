declare module "buffer" {
  export class Buffer extends Uint8Array {
    static from(data: string | ArrayBuffer | ArrayLike<number>, encoding?: string): Buffer;
    toString(encoding?: string): string;
  }
}

declare module "node:buffer" {
  export * from "buffer";
}
