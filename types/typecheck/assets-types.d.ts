export type AssetSourceType = "upload" | "external";
export type AssetStatus =
  | "pending"
  | "uploading"
  | "scanning"
  | "processing"
  | "ready"
  | "failed"
  | "quarantined";
export type AssetScanStatus = "pending" | "clean" | "infected" | "error";
export type AssetTranscodeStatus = "pending" | "queued" | "processing" | "ready" | "error";
