"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReferenceAsset } from "@/lib/assets";
import { useScriptDocStore } from "@/lib/scriptDocStore";

type ReferenceLibraryPanelProps = {
  projectId: string;
  className?: string;
  title?: string;
};

type UploadingState = {
  [assetId: string]: boolean;
};

type SelectionMap = {
  [assetId: string]: string;
};

export function ReferenceLibraryPanel({
  projectId,
  className,
  title = "Reference Library"
}: ReferenceLibraryPanelProps) {
  const {
    beats,
    scenes,
    referenceAssets,
    entityAssets,
    setReferenceAssets,
    setEntityAssets,
    upsertReferenceAsset,
    upsertEntityAsset
  } = useScriptDocStore();
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<UploadingState>({});
  const [selection, setSelection] = useState<SelectionMap>({});
  const [privacySelection, setPrivacySelection] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [searchResults, setSearchResults] = useState<ReferenceAsset[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [includePrivateLinks, setIncludePrivateLinks] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/assets?includePrivate=${includePrivateLinks}`
        );
        if (!response.ok) {
          throw new Error("Unable to load assets");
        }
        const payload = await response.json();
        if (!cancelled) {
          setReferenceAssets(payload.references ?? []);
          setEntityAssets(payload.assets ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch assets");
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [projectId, includePrivateLinks, setEntityAssets, setReferenceAssets]);

  useEffect(() => {
    const nextSelection: SelectionMap = {};
    const nextPrivacy: Record<string, boolean> = {};
    entityAssets.forEach((link) => {
      nextSelection[link.assetId] = `${link.entityType}:${link.entityId}`;
      nextPrivacy[link.assetId] = link.isPrivate;
    });
    setSelection(nextSelection);
    setPrivacySelection(nextPrivacy);
  }, [entityAssets]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    if (!searchQuery && !selectedTag) {
      setSearchResults(null);
      setSearching(false);
      setSearchError(null);
      return () => {
        controller.abort();
      };
    }

    setSearching(true);
    setSearchError(null);

    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set("projectId", projectId);
        if (searchQuery) {
          params.set("q", searchQuery);
        }
        if (selectedTag) {
          params.set("tags", selectedTag);
        }
        if (includePrivateLinks) {
          params.set("includePrivate", "true");
        }
        const response = await fetch(`/api/assets/search?${params.toString()}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error("Unable to search assets");
        }
        const payload = await response.json();
        if (!cancelled) {
          setSearchResults(payload.assets ?? []);
          setSearching(false);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        if ((err as Error).name === "AbortError") {
          return;
        }
        setSearching(false);
        setSearchError(err instanceof Error ? err.message : "Search failed");
      }
    }, 250);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [projectId, searchQuery, selectedTag, includePrivateLinks]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length) {
        await uploadFiles(files);
      }
    },
    []
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      for (const file of files) {
        let currentAssetId: string | null = null;
        try {
          const basePayload = {
            name: file.name,
            description: undefined,
            contentType: file.type || "application/octet-stream",
            size: file.size,
            projectId
          };

          const createResponse = await fetch("/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(basePayload)
          });

          if (!createResponse.ok) {
            throw new Error("Unable to create asset");
          }

          const createPayload = await createResponse.json();
          const asset: ReferenceAsset = createPayload.asset;
          const uploadInfo = createPayload.upload;

          currentAssetId = asset.id;

          upsertReferenceAsset(asset);
          setUploading((current) => ({ ...current, [asset.id]: true }));

          const isLocalUpload = uploadInfo.uploadUrl.startsWith("/api/assets");

          if (!isLocalUpload) {
            try {
              await fetch(`/api/assets?assetId=${asset.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  statusUpdates: {
                    status: "uploading",
                    processingProgress: 0
                  }
                })
              });
            } catch (err) {
              console.warn("Failed to mark asset as uploading", err);
            }
          }

          const uploadResponse = await fetch(uploadInfo.uploadUrl, {
            method: uploadInfo.method,
            headers: uploadInfo.headers,
            body: file
          });

          if (!uploadResponse.ok) {
            throw new Error("Upload failed");
          }

          let updated: ReferenceAsset | null = null;

          if (uploadInfo.uploadUrl.startsWith("/api/assets")) {
            const uploadPayload = await uploadResponse.json();
            updated = uploadPayload.asset as ReferenceAsset;
          } else {
            const refreshResponse = await fetch(`/api/assets?assetId=${asset.id}`);
            if (refreshResponse.ok) {
              const refreshPayload = await refreshResponse.json();
              updated = refreshPayload.asset as ReferenceAsset;
            }
          }

          if (updated) {
            upsertReferenceAsset(updated);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
          if (currentAssetId) {
            const assetId = currentAssetId;
            setUploading((current) => ({ ...current, [assetId]: false }));
          }
        }
      }
    },
    [projectId, upsertReferenceAsset]
  );

  const handleFileInput = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        await uploadFiles(Array.from(event.target.files));
        event.target.value = "";
      }
    },
    [uploadFiles]
  );

  const entityIndex = useMemo(() => {
    const map = new Map<string, Array<{ type: string; entityId: string; isPrivate: boolean }>>();
    entityAssets.forEach((asset) => {
      const key = asset.assetId;
      const current = map.get(key) ?? [];
      current.push({ type: asset.entityType, entityId: asset.entityId, isPrivate: asset.isPrivate });
      map.set(key, current);
    });
    return map;
  }, [entityAssets]);

  const handleTagSelection = useCallback(
    async (assetId: string, value: string) => {
      if (!value) {
        return;
      }

      const [entityType, entityId] = value.split(":");
      try {
        const response = await fetch(`/api/projects/${projectId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetId,
            entityType,
            entityId,
            isPrivate: privacySelection[assetId] ?? false
          })
        });

        if (!response.ok) {
          throw new Error("Unable to tag asset");
        }

        const payload = await response.json();
        upsertEntityAsset(payload.asset);
        setSelection((current) => ({ ...current, [assetId]: value }));
        setPrivacySelection((current) => ({
          ...current,
          [assetId]: payload.asset.isPrivate ?? false
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to tag asset");
      }
    },
    [privacySelection, projectId, upsertEntityAsset]
  );

  const handlePrivacyToggle = useCallback(
    async (assetId: string, value: boolean) => {
      setPrivacySelection((current) => ({ ...current, [assetId]: value }));
      const selected = selection[assetId];
      if (!selected) {
        return;
      }

      const [entityType, entityId] = selected.split(":");
      try {
        const response = await fetch(`/api/projects/${projectId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId, entityType, entityId, isPrivate: value })
        });

        if (!response.ok) {
          throw new Error("Unable to update privacy");
        }

        const payload = await response.json();
        upsertEntityAsset(payload.asset);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update privacy");
      }
    },
    [projectId, selection, upsertEntityAsset]
  );

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    (searchResults ?? referenceAssets).forEach((item) => {
      item.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [referenceAssets, searchResults]);

  const displayedAssets = searchResults ?? referenceAssets;

  const renderStatusLabel = (asset: ReferenceAsset) => {
    if (asset.status === "ready") {
      return "Ready";
    }
    if (asset.status === "processing") {
      if (asset.transcodeStatus === "processing") {
        return "Transcoding";
      }
      if (asset.scanStatus === "clean") {
        return "Processing";
      }
      return "Awaiting processing";
    }
    if (asset.status === "scanning") {
      return "Scanning";
    }
    if (asset.status === "uploading") {
      return "Uploading";
    }
    if (asset.status === "failed") {
      return "Failed";
    }
    if (asset.status === "quarantined") {
      return "Quarantined";
    }
    return "Pending";
  };

  const renderAssetCard = (asset: ReferenceAsset) => {
    const isUploading = uploading[asset.id];
    const linkedTargets = entityIndex.get(asset.id) ?? [];
    const accessibleLabel = `${asset.name} asset thumbnail`;
    const statusLabel = renderStatusLabel(asset);
    const showProgress =
      typeof asset.processingProgress === "number" &&
      asset.processingProgress > 0 &&
      asset.processingProgress < 100;

    return (
      <div
        key={asset.id}
        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/70 p-4 text-slate-900 shadow-glass backdrop-blur-xs transition-colors duration-200 dark:border-white/5 dark:bg-vs-panel dark:text-vs-accent"
      >
        <div
          className="relative aspect-video overflow-hidden rounded-xl border border-white/10 shadow-glass dark:border-white/5"
          style={{
            backgroundImage: asset.thumbnailUrl ? `url(${asset.thumbnailUrl})` : asset.previewColor,
            backgroundSize: asset.thumbnailUrl ? "cover" : "100%",
            backgroundPosition: "center"
          }}
          aria-label={accessibleLabel}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/55 via-white/20 to-white/5 mix-blend-luminosity dark:from-black/70 dark:via-black/55 dark:to-transparent" />
          <div className="absolute inset-0 bg-black/35 dark:bg-black/45" />
          <div className="relative flex h-full flex-col justify-end gap-1 p-4 text-sm text-white">
            <p className="font-semibold tracking-tight">{asset.name}</p>
            <p className="text-xs text-white/80">
              {asset.contentType} · {Math.round(asset.size / 1024)} KB
            </p>
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">{statusLabel}</p>
          </div>
          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-semibold uppercase tracking-widest text-white">
              Uploading…
            </div>
          ) : null}
        </div>
        {showProgress ? (
          <div className="h-1 overflow-hidden rounded-full bg-slate-200/60 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, asset.processingProgress ?? 0))}%` }}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {linkedTargets.map((target) => {
            const { type, entityId, isPrivate: targetPrivate } = target;
            const label =
              type === "beat"
                ? beats.find((beat) => beat.id === entityId)?.title ?? entityId
                : scenes.find((scene) => scene.id === entityId)?.title ?? entityId;
            return (
              <span
                key={`${asset.id}-${type}-${entityId}`}
                className="flex items-center gap-1 rounded-full border border-white/20 bg-white/60 px-3 py-1 font-medium uppercase tracking-widest text-slate-900 backdrop-blur-xs dark:border-white/10 dark:bg-white/10 dark:text-vs-accent"
              >
                {type === "beat" ? "Beat" : "Scene"}: {label}
                {targetPrivate ? <span aria-label="Private" title="Private" className="text-xs">🔒</span> : null}
              </span>
            );
          })}
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-vs-accent-strong">
          Tag asset
          <select
            className="w-full rounded-xl border border-white/20 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-inner outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-black/40 dark:text-vs-accent"
            value={selection[asset.id] ?? ""}
            onChange={(event) => handleTagSelection(asset.id, event.target.value)}
          >
            <option value="">Select beat or scene</option>
            <optgroup label="Beats">
              {beats.map((beat) => (
                <option key={beat.id} value={`beat:${beat.id}`}>
                  Beat · {beat.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Scenes">
              {scenes.map((scene) => (
                <option key={scene.id} value={`scene:${scene.id}`}>
                  Scene · {scene.title}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-vs-accent-strong">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border border-slate-400 text-slate-600 focus:ring-slate-500 dark:border-white/40 dark:bg-black"
            checked={privacySelection[asset.id] ?? false}
            onChange={(event) => handlePrivacyToggle(asset.id, event.target.checked)}
            disabled={!selection[asset.id]}
          />
          Private link
        </label>
      </div>
    );
  };

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <section
      className={`flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/75 p-6 text-slate-900 shadow-glass backdrop-blur-xs transition-colors duration-200 dark:border-white/5 dark:bg-vs-panel/90 dark:text-vs-accent ${className ?? ""}`}
    >
      <header className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-vs-accent">{title}</h2>
        <p className="text-sm text-slate-600 dark:text-vs-accent-strong/80">
          Drop reference images or videos to keep beats and scenes grounded in shared visuals.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search assets"
            className="w-full max-w-xs rounded-xl border border-white/20 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-inner outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-black/40 dark:text-vs-accent"
          />
          <select
            value={selectedTag}
            onChange={(event) => setSelectedTag(event.target.value)}
            className="w-full max-w-[180px] rounded-xl border border-white/20 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-inner outline-none transition focus:border-slate-400 dark:border-white/10 dark:bg-black/40 dark:text-vs-accent"
          >
            <option value="">All tags</option>
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:text-vs-accent-strong/70">
            <input
              type="checkbox"
              className="h-3 w-3 rounded border border-slate-400 text-slate-600 focus:ring-slate-500 dark:border-white/40 dark:bg-black"
              checked={includePrivateLinks}
              onChange={(event) => setIncludePrivateLinks(event.target.checked)}
            />
            Show private links
          </label>
        </div>
        {searching ? (
          <p className="text-xs text-slate-500 dark:text-vs-accent-strong/70">Searching…</p>
        ) : null}
        {searchError ? (
          <p className="text-xs text-red-600 dark:text-red-300">{searchError}</p>
        ) : null}
      </header>
      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-400/40 bg-white/70 p-8 text-center text-slate-700 transition dark:border-white/20 dark:bg-black/30 dark:text-vs-accent ${
          isDragging ? "border-slate-600/60 bg-white/90 dark:border-white/40 dark:bg-black/50" : ""
        }`}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload reference assets"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            handleBrowseClick();
          }
        }}
      >
        <p className="text-sm font-semibold uppercase tracking-widest">Drag files here or click to upload</p>
        <p className="text-xs text-slate-500 dark:text-vs-accent-strong/70">
          Glassmorphic panels ensure 4.5:1 contrast in light and dark modes.
        </p>
        <button
          type="button"
          onClick={handleBrowseClick}
          className="rounded-full border border-white/30 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-900 shadow-inner transition hover:border-slate-400 hover:bg-white/95 dark:border-white/20 dark:bg-white/10 dark:text-vs-accent dark:hover:border-white/40"
        >
          Browse Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInput}
          aria-hidden
        />
      </div>
      {error ? (
        <p className="rounded-xl border border-red-400/60 bg-red-50/80 p-3 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {displayedAssets.length ? displayedAssets.map(renderAssetCard) : (
          <p className="rounded-2xl border border-white/10 bg-white/60 p-6 text-sm text-slate-600 backdrop-blur-xs dark:border-white/5 dark:bg-black/40 dark:text-vs-accent-strong/70">
            No reference assets yet. Upload files to build your shared palette.
          </p>
        )}
      </div>
    </section>
  );
}
