export type ScriptFormatCategory =
  | "film"
  | "television"
  | "digital"
  | "commercial"
  | "documentary"
  | "unscripted"
  | "audio"
  | "live"
  | "experimental";

export interface ScriptFormatLengthProfile {
  unit: "pages" | "minutes" | "seconds";
  typical: number;
  min?: number;
  max?: number;
  notes?: string;
}

export interface ScriptFormatDefinition {
  id: ScriptFormatId;
  label: string;
  category: ScriptFormatCategory;
  description: string;
  synonyms?: string[];
  defaultLength: ScriptFormatLengthProfile;
  alternateLengths?: ScriptFormatLengthProfile[];
  commonGenres?: string[];
  usageExamples?: string[];
}

const BASE_SCRIPT_FORMATS = [
  {
    id: "feature",
    label: "Feature Film",
    category: "film",
    description:
      "Traditional long-form screenplay intended for theatrical or premium streaming release.",
    synonyms: ["feature-length", "film"],
    defaultLength: { unit: "pages", typical: 110, min: 85, max: 125 },
    alternateLengths: [{ unit: "minutes", typical: 110 }],
    commonGenres: [
      "Drama",
      "Comedy",
      "Sci-Fi",
      "Fantasy",
      "Action",
      "Thriller",
      "Romance",
    ],
    usageExamples: ["festival contender", "studio slate", "independent feature"],
  },
  {
    id: "short",
    label: "Short Film",
    category: "film",
    description:
      "Concise narrative piece typically under 40 minutes, ideal for proof-of-concept or festival showcase.",
    synonyms: ["short-form", "proof"],
    defaultLength: { unit: "pages", typical: 12, min: 5, max: 25 },
    alternateLengths: [{ unit: "minutes", typical: 15, min: 5, max: 30 }],
    commonGenres: ["Drama", "Horror", "Comedy", "Experimental"],
    usageExamples: ["festival submission", "pitch trailer", "narrative experiment"],
  },
  {
    id: "limited-series",
    label: "Limited Series",
    category: "television",
    description:
      "Prestige serialized storytelling with a planned ending, often 4-10 episodes.",
    synonyms: ["miniseries"],
    defaultLength: { unit: "pages", typical: 360, notes: "6 episodes x 60 pages" },
    alternateLengths: [
      { unit: "minutes", typical: 300, notes: "6 episodes x 50 minutes" },
    ],
    commonGenres: ["Drama", "Crime", "Historical", "Sci-Fi"],
    usageExamples: ["premium streamer", "limited event television"],
  },
  {
    id: "pilot",
    label: "Series Pilot",
    category: "television",
    description:
      "Opening episode designed to introduce characters and world for a potential ongoing series.",
    synonyms: ["television pilot"],
    defaultLength: { unit: "pages", typical: 55, min: 40, max: 65 },
    alternateLengths: [
      { unit: "minutes", typical: 45, min: 30, max: 60 },
      { unit: "pages", typical: 32, min: 25, max: 35, notes: "Half-hour comedy" },
    ],
    commonGenres: ["Comedy", "Drama", "Procedural", "Animation"],
    usageExamples: ["network pitch", "streaming order", "franchise expansion"],
  },
  {
    id: "social",
    label: "Social Content",
    category: "digital",
    description:
      "Ultra-short vertical or feed-first storytelling optimized for platforms like TikTok or Instagram.",
    synonyms: ["vertical short", "social-first"],
    defaultLength: { unit: "minutes", typical: 1, max: 3 },
    commonGenres: ["Comedy", "Lifestyle", "How-to", "Campaign"],
    usageExamples: ["series of reels", "platform challenge", "teaser content"],
  },
  {
    id: "advertisement",
    label: "Advertisement",
    category: "commercial",
    description:
      "Single-spot creative for broadcast, digital, or theatrical placement with clear call-to-action.",
    synonyms: ["spot", "commercial"],
    defaultLength: { unit: "seconds", typical: 30 },
    alternateLengths: [
      { unit: "seconds", typical: 15 },
      { unit: "seconds", typical: 60 },
    ],
    commonGenres: ["Brand", "Lifestyle", "Comedy", "Inspirational"],
    usageExamples: ["product launch", "retail campaign", "awareness spot"],
  },
  {
    id: "campaign",
    label: "Campaign Narrative",
    category: "commercial",
    description:
      "Multi-spot or multi-platform storytelling arc connected by a central theme or objective.",
    synonyms: ["multi-spot", "campaign arc"],
    defaultLength: {
      unit: "minutes",
      typical: 6,
      notes: "3 x 2-minute anchor pieces plus supporting assets",
    },
    commonGenres: ["Brand", "Lifestyle", "Docu-style"],
    usageExamples: ["brand world-building", "cause marketing", "product ecosystem"],
  },
  {
    id: "doc-short",
    label: "Documentary Short",
    category: "documentary",
    description:
      "Short-form non-fiction storytelling focused on a singular subject or event.",
    synonyms: ["short doc"],
    defaultLength: { unit: "minutes", typical: 20, min: 10, max: 40 },
    commonGenres: ["Biographical", "Issue", "Character study"],
    usageExamples: ["festival doc", "brand doc", "awards short"],
  },
  {
    id: "doc-feature",
    label: "Documentary Feature",
    category: "documentary",
    description:
      "Feature-length non-fiction exploring expansive topics, events, or personalities.",
    synonyms: ["feature doc"],
    defaultLength: { unit: "minutes", typical: 95, min: 80, max: 120 },
    usageExamples: ["streamer acquisition", "theatrical doc", "docu-series pilot"],
  },
  {
    id: "doc-series",
    label: "Documentary Series",
    category: "documentary",
    description:
      "Multi-episode documentary storytelling often blending interviews, archival, and verité.",
    defaultLength: { unit: "minutes", typical: 360, notes: "6 x 60-minute episodes" },
    usageExamples: ["true-crime limited series", "sports doc", "investigative docu-series"],
  },
  {
    id: "reality",
    label: "Reality Competition",
    category: "unscripted",
    description:
      "Unscripted format built around competition, elimination, or transformation arcs.",
    synonyms: ["competition", "unscripted"],
    defaultLength: { unit: "minutes", typical: 44, min: 42, max: 60 },
    usageExamples: ["network competition", "format franchise", "international adaptation"],
  },
  {
    id: "unscripted-docu",
    label: "Docu-follow Series",
    category: "unscripted",
    description:
      "Ongoing observational storytelling centered on real individuals or groups.",
    defaultLength: { unit: "minutes", typical: 30, min: 22, max: 45 },
    usageExamples: ["lifestyle docu-series", "celebrity follow", "brand reality"],
  },
  {
    id: "live-event",
    label: "Live Event",
    category: "live",
    description:
      "Scripted beats and rundown for live broadcasts, award shows, and experiential productions.",
    defaultLength: { unit: "minutes", typical: 120, notes: "Segmented rundown" },
    usageExamples: ["awards show", "conference keynote", "streamed product reveal"],
  },
  {
    id: "audio-drama",
    label: "Audio Drama",
    category: "audio",
    description:
      "Narrative podcast or scripted audio story leveraging soundscapes and voice performances.",
    synonyms: ["narrative podcast"],
    defaultLength: { unit: "minutes", typical: 30, min: 20, max: 45 },
    usageExamples: ["fiction podcast", "immersive audio", "branded story"],
  },
  {
    id: "audio-doc",
    label: "Audio Documentary",
    category: "audio",
    description:
      "Non-fiction audio series or special blending interviews, archival, and narration.",
    defaultLength: { unit: "minutes", typical: 40, min: 25, max: 60 },
    usageExamples: ["true-crime podcast", "journalistic special", "branded series"],
  },
  {
    id: "experimental",
    label: "Experimental / Hybrid",
    category: "experimental",
    description:
      "Boundary-pushing formats combining mediums or interactive elements beyond traditional scripting.",
    defaultLength: { unit: "minutes", typical: 30, notes: "Highly variable" },
    usageExamples: ["immersive installation", "XR storytelling", "interactive film"],
  },
] as const satisfies readonly ScriptFormatDefinition[];

type BaseScriptFormatId = (typeof BASE_SCRIPT_FORMATS)[number]["id"];
export type ScriptFormatId = BaseScriptFormatId | (string & {});

const registry = new Map<ScriptFormatId, ScriptFormatDefinition>();

for (const format of BASE_SCRIPT_FORMATS) {
  registry.set(format.id, format);
}

export const registerScriptFormat = (definition: ScriptFormatDefinition) => {
  registry.set(definition.id, definition);
};

export const listScriptFormats = (): ScriptFormatDefinition[] => [
  ...registry.values(),
];

export const getScriptFormatDefinition = (
  id: ScriptFormatId,
): ScriptFormatDefinition | undefined => registry.get(id);

export const hasScriptFormat = (id: ScriptFormatId): boolean => registry.has(id);

export { BASE_SCRIPT_FORMATS as DEFAULT_SCRIPT_FORMATS };
