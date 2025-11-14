import type { ScriptDoc } from "@/lib/scriptDoc";

export const mockScriptDoc: ScriptDoc = {
  metadata: {
    projectId: "demo-project",
    title: "Echoes on the Pier",
    format: "feature",
    genre: "Sci-Fi Drama",
    subgenres: ["Family", "Mystery"],
    logline:
      "An estranged sound designer returns home to capture the mysterious signal haunting her family's pier.",
    rating: "PG-13",
    toneKeywords: ["atmospheric", "intimate", "mysterious"],
    targetLength: {
      unit: "pages",
      value: 105,
    },
    status: "draft",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    relatedProjects: [
      {
        projectId: "doc-signal-archive",
        relationship: "inspired-by",
        title: "Signal Archive",
        notes: "Short doc exploring the original anomaly recordings.",
      },
    ],
    franchiseOriginId: "universe-reyes",
    isExtension: true,
  },
  revision: {
    id: "rev-1",
    version: "0.3.0",
    label: "Initial studio exploration",
    createdAt: "2024-01-01T00:00:00.000Z",
    createdBy: "Script Speech",
    notes: "Seeded from blueprint outline for UI exploration.",
  },
  referenceAssets: [
    {
      id: "asset-moonlight",
      title: "Moonlit tide study",
      description: "Long exposure photo of the pier with bioluminescent tide.",
      url: "https://example.com/assets/moonlight.jpg",
      thumbnailUrl: "https://example.com/assets/moonlight-thumb.jpg",
      sourceType: "link",
      tags: ["lighting", "location"],
      attribution: "J. Alvarez",
    },
    {
      id: "asset-console",
      title: "Analog mixing console",
      description: "Reference board for the studio flashback.",
      url: "https://example.com/assets/console.png",
      thumbnailUrl: "https://example.com/assets/console-thumb.png",
      sourceType: "upload",
      tags: ["prop"],
      attribution: "Set design team",
    },
  ],
  characters: [
    {
      id: "char-mara",
      name: "Mara Reyes",
      description: "Gifted sound designer navigating grief and rediscovery.",
      pronouns: "she/her",
      archetype: "Reluctant prodigy",
      goal: "Decode the signal and reconcile with her brother.",
      arc: "From avoidance to embrace of her family's legacy.",
      voiceNotes: "Measured, observant, occasionally wry.",
      referenceAssetIds: ["asset-console"],
    },
    {
      id: "char-luis",
      name: "Luis Reyes",
      description: "Brother safeguarding the pier and its secrets.",
      pronouns: "he/him",
      archetype: "Guardian",
      goal: "Protect the pier from corporate buyout.",
      arc: "Learns to trust Mara's instincts again.",
      referenceAssetIds: ["asset-moonlight"],
    },
  ],
  locations: [
    {
      id: "loc-pier",
      name: "Reyes Family Pier",
      description: "Weathered pier with experimental hydrophones installed.",
      type: "mixed",
      sensoryNotes: "Salt, creaking wood, distant foghorns.",
      referenceAssetIds: ["asset-moonlight"],
    },
    {
      id: "loc-studio",
      name: "Abandoned Mix Studio",
      description: "Dusty analog setup with walls of cassette archives.",
      type: "interior",
      referenceAssetIds: ["asset-console"],
    },
  ],
  props: [
    {
      id: "prop-recorder",
      name: "Custom field recorder",
      description: "Mara's modded recorder capable of capturing subsonic layers.",
      purpose: "Records the anomaly",
      isCritical: true,
      referenceAssetIds: ["asset-console"],
    },
  ],
  beats: [
    {
      id: "beat-setup",
      order: 0,
      title: "Return to the pier",
      summary:
        "Mara arrives and senses something off as hydrophones hum with residual signal.",
      intent: "Reunite siblings and establish the anomaly.",
      spotlightCharacterIds: ["char-mara", "char-luis"],
      locationIds: ["loc-pier"],
      referenceAssetIds: ["asset-moonlight"],
      durationSeconds: 180,
      sceneIds: ["scene-arrival"],
    },
    {
      id: "beat-investigation",
      order: 1,
      title: "Signal patterns emerge",
      summary:
        "Late-night recording session reveals rhythmic signal echoing Mara's childhood lullaby.",
      intent: "Deepen mystery and show Mara's obsession.",
      spotlightCharacterIds: ["char-mara"],
      locationIds: ["loc-studio"],
      referenceAssetIds: ["asset-console"],
      durationSeconds: 240,
      sceneIds: ["scene-recording"],
    },
    {
      id: "beat-revelation",
      order: 2,
      title: "Pier awakens",
      summary:
        "Signal triggers light swell across the water revealing submerged array Mara never knew existed.",
      intent: "Promise of deeper family secret.",
      spotlightCharacterIds: ["char-mara", "char-luis"],
      locationIds: ["loc-pier"],
      referenceAssetIds: ["asset-moonlight"],
      durationSeconds: 210,
      sceneIds: ["scene-swell"],
    },
  ],
  scenes: [
    {
      id: "scene-arrival",
      order: 0,
      beatId: "beat-setup",
      title: "Mara steps onto the pier",
      summary:
        "She tests hydrophones while Luis watches from the shack, tension thick between them.",
      slugline: {
        setting: "EXT",
        location: "REYES FAMILY PIER",
        timeOfDay: "DUSK",
      },
      elements: [
        {
          id: "scene-arrival-action-1",
          type: "action",
          text: "Waves lap softly as Mara kneels to adjust the hydrophone cables.",
        },
        {
          id: "scene-arrival-dialogue-1",
          type: "dialogue",
          speaker: "MARA",
          text: "You ever fix that grounding issue?",
        },
        {
          id: "scene-arrival-dialogue-2",
          type: "dialogue",
          speaker: "LUIS",
          text: "Been waiting on the expert.",
        },
        {
          id: "scene-arrival-action-2",
          type: "action",
          text: "The recorder peaks for a beat, the anomaly whispering beneath the breeze.",
        },
      ],
      referenceAssetIds: ["asset-moonlight"],
      locationIds: ["loc-pier"],
      characterIds: ["char-mara", "char-luis"],
    },
    {
      id: "scene-recording",
      order: 1,
      beatId: "beat-investigation",
      title: "Decoding the signal",
      summary:
        "Mara isolates frequencies and hums along, discovering the lullaby's cadence in the noise.",
      slugline: {
        setting: "INT",
        location: "ABANDONED MIX STUDIO",
        timeOfDay: "NIGHT",
      },
      elements: [
        {
          id: "scene-recording-action-1",
          type: "action",
          text: "LEDs pulse erratically as Mara rides the console faders.",
        },
        {
          id: "scene-recording-dialogue-1",
          type: "dialogue",
          speaker: "MARA",
          text: "It's mapping to something familiar...",
        },
        {
          id: "scene-recording-note-1",
          type: "note",
          tone: "info",
          text: "Overlay archived family lullaby in sound design pass.",
        },
      ],
      referenceAssetIds: ["asset-console"],
      locationIds: ["loc-studio"],
      characterIds: ["char-mara"],
    },
    {
      id: "scene-swell",
      order: 2,
      beatId: "beat-revelation",
      title: "The swell of light",
      summary:
        "Signal crescendos, water glows, and Luis confesses the array was their mother's unfinished project.",
      slugline: {
        setting: "EXT",
        location: "REYES FAMILY PIER",
        timeOfDay: "NIGHT",
      },
      elements: [
        {
          id: "scene-swell-action-1",
          type: "action",
          text: "Bioluminescence blooms beneath the planks, outlining a hidden grid of devices.",
        },
        {
          id: "scene-swell-dialogue-1",
          type: "dialogue",
          speaker: "LUIS",
          text: "She built it for you to finish.",
        },
        {
          id: "scene-swell-transition-1",
          type: "transition",
          text: "CUT TO BLACK.",
        },
      ],
      referenceAssetIds: ["asset-moonlight"],
      locationIds: ["loc-pier"],
      characterIds: ["char-mara", "char-luis"],
    },
  ],
  conceptAnalysis: {
    conceptSummary:
      "Grounded sci-fi mystery about family legacy and sound revealing hidden ecosystems.",
    keywords: [
      "sound design",
      "family mystery",
      "bioluminescence",
      "returning home",
    ],
    audiencePromise: "An intimate, sensory thriller blending emotion with science intrigue.",
    genreConfidence: [
      { genre: "Sci-Fi", confidence: 0.85 },
      { genre: "Drama", confidence: 0.9 },
      { genre: "Mystery", confidence: 0.75 },
    ],
    toneConfidence: [
      { tone: "Atmospheric", confidence: 0.9 },
      { tone: "Hopeful", confidence: 0.6 },
    ],
    lengthRecommendation: {
      unit: "minutes",
      min: 95,
      max: 115,
      typical: 105,
      confidence: 0.8,
      rationale:
        "Feature-length allows the mystery to unfold while preserving intimate character work.",
    },
    recommendedFormats: [
      {
        formatId: "feature",
        confidence: 0.88,
        rationale: "Character-driven cinematic arcs with premium production design.",
        suggestedLength: { unit: "pages", typical: 110, min: 100, max: 115 },
        suggestedGenres: ["Sci-Fi", "Drama"],
      },
      {
        formatId: "limited-series",
        confidence: 0.55,
        rationale: "Could expand into multi-episode exploration of the anomaly and town history.",
        suggestedLength: {
          unit: "minutes",
          typical: 300,
        },
        suggestedGenres: ["Sci-Fi", "Mystery", "Drama"],
      },
    ],
    relatedProjects: [
      {
        projectId: "short-echoes",
        relationship: "spinoff",
        title: "Echoes: The Signal Hunters",
        notes: "Proposed social-first extension featuring user-submitted recordings.",
      },
    ],
    isFranchiseExtension: true,
    extensionNotes:
      "Expands the Reyes family universe established in the short doc, bridging into feature territory.",
  },
};
