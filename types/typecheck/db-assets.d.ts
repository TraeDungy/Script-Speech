export interface ReferenceAssetRow {
  id: string;
  name: string;
  content_type: string;
  size: number;
  project_id?: string | null;
  description?: string | null;
  tags?: string[] | null;
  source_type?: string | null;
  url?: string | null;
}

export interface ReferenceAsset {
  id: string;
  name: string;
  contentType: string;
  size: number;
  projectId?: string | null;
  description?: string;
  tags?: string[];
  sourceType?: string;
  url?: string;
}

export interface EntityAsset {
  id: string;
  name: string;
  targetId: string;
  targetType: string;
}

export interface CreateReferenceAssetInput extends Partial<ReferenceAsset> {
  name: string;
  contentType: string;
  size: number;
}

export interface CreateEntityAssetInput {
  name: string;
  targetId: string;
  targetType: string;
}

export declare function fetchReferenceAssets(projectId?: string | null): Promise<ReferenceAsset[]>;
export declare function fetchReferenceAsset(assetId: string): Promise<ReferenceAsset | null>;
export declare function insertReferenceAsset(input: CreateReferenceAssetInput): Promise<ReferenceAsset>;
export declare function modifyReferenceAsset(
  assetId: string,
  updates: Partial<ReferenceAsset>,
): Promise<ReferenceAsset | null>;
export declare function persistAssetBinary(
  assetId: string,
  data: unknown,
  contentType: string,
): Promise<ReferenceAsset | null>;
