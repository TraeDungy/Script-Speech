"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { EntityAsset, ReferenceAsset } from "@/lib/assets";

type Beat = {
  id: string;
  title: string;
  summary?: string;
};

type Scene = {
  id: string;
  title: string;
  summary?: string;
};

type ScriptDocStoreState = {
  beats: Beat[];
  scenes: Scene[];
  referenceAssets: ReferenceAsset[];
  entityAssets: EntityAsset[];
};

type ScriptDocStoreActions = {
  setReferenceAssets: (assets: ReferenceAsset[]) => void;
  upsertReferenceAsset: (asset: ReferenceAsset) => void;
  setEntityAssets: (assets: EntityAsset[]) => void;
  upsertEntityAsset: (asset: EntityAsset) => void;
};

type ScriptDocStore = ScriptDocStoreState & ScriptDocStoreActions;

const ScriptDocContext = createContext<ScriptDocStore | undefined>(undefined);

const defaultBeats: Beat[] = [
  { id: "beat-1", title: "Inciting Spark" },
  { id: "beat-2", title: "Rising Tension" }
];

const defaultScenes: Scene[] = [
  { id: "scene-1", title: "Opening Control Room" },
  { id: "scene-2", title: "Field Deployment" }
];

type ProviderProps = {
  children: React.ReactNode;
  initialBeats?: Beat[];
  initialScenes?: Scene[];
};

export function ScriptDocProvider({
  children,
  initialBeats,
  initialScenes
}: ProviderProps) {
  const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([]);
  const [entityAssets, setEntityAssets] = useState<EntityAsset[]>([]);

  const beats = initialBeats ?? defaultBeats;
  const scenes = initialScenes ?? defaultScenes;

  const value = useMemo<ScriptDocStore>(
    () => ({
      beats,
      scenes,
      referenceAssets,
      entityAssets,
      setReferenceAssets: (assets) => setReferenceAssets([...assets]),
      upsertReferenceAsset: (asset) => {
        setReferenceAssets((current) => {
          const existing = current.find((item) => item.id === asset.id);
          if (existing) {
            return current.map((item) => (item.id === asset.id ? asset : item));
          }
          return [...current, asset];
        });
      },
      setEntityAssets: (assets) => setEntityAssets([...assets]),
      upsertEntityAsset: (asset) => {
        setEntityAssets((current) => {
          const existing = current.find((item) => item.id === asset.id);
          if (existing) {
            return current.map((item) => (item.id === asset.id ? asset : item));
          }
          return [...current, asset];
        });
      }
    }),
    [beats, scenes, referenceAssets, entityAssets]
  );

  return <ScriptDocContext.Provider value={value}>{children}</ScriptDocContext.Provider>;
}

export function useScriptDocStore() {
  const context = useContext(ScriptDocContext);
  if (!context) {
    throw new Error("useScriptDocStore must be used within a ScriptDocProvider");
  }

  return context;
}
