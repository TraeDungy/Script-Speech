export type LandingHero = {
  title: string;
  phrases: string[];
  description: string;
};

export type LandingVignette = {
  title: string;
  description: string;
  footnote: number;
};

export type LandingCadenceStep = {
  heading: string;
  body: string;
  anchor: number;
};

export type LandingCallToAction = {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: {
    label: string;
    href: string;
  };
  secondaryCta: {
    label: string;
    href: string;
  };
  helper: string;
};

export type LandingContent = {
  hero: LandingHero;
  vignettes: LandingVignette[];
  cadence: LandingCadenceStep[];
  callToAction: LandingCallToAction;
};

export const landingContent: LandingContent = {
  hero: {
    title: "The voice-led story studio for directors who think out loud.",
    phrases: [
      "Draft cinema-ready stories by speaking",
      "Sketch acts, beats, and shots without friction",
      "Deliver production files the same day",
    ],
    description:
      "Script Speech keeps the landing page focused on the mood: low light, confident lines, and zero clutter. Speak your vision and the canvas adapts without compromising precision.",
  },
  vignettes: [
    {
      title: "Voice directs the room",
      description:
        "Speak the brief, calibrate tone, and watch the story spine assemble itself. Text is always there when you need to fine tune.",
      footnote: 1,
    },
    {
      title: "Canvas stays in sync",
      description:
        "Outline, beat grid, and script view are rendered from one ScriptDoc core so every revision lands everywhere at once.",
      footnote: 2,
    },
    {
      title: "References travel with you",
      description:
        "Boards, clips, and research snippets follow each scene and export with your package. Nothing gets stranded in a drive.",
      footnote: 3,
    },
  ],
  cadence: [
    {
      heading: "1. Tune the signal",
      body: "A minimalist intake checks format, pacing, and references while your waveform shows the room is listening.",
      anchor: 1,
    },
    {
      heading: "2. Move the pieces",
      body: "Outline and beat editors adapt instantly to voice or keyboard adjustments so structure never lags behind.",
      anchor: 2,
    },
    {
      heading: "3. Deliver with certainty",
      body: "Queue exports, share secure links, and walk into your next session with production-ready files in hand.",
      anchor: 4,
    },
  ],
  callToAction: {
    eyebrow: "Early collaborator program",
    title: "Help us tune Script Speech for productions that move fast.",
    description:
      "Founding teams receive guided onboarding, access to the redesigned studio canvas, and direct lines to the crew building the experience.",
    primaryCta: {
      label: "Preview the canvas",
      href: "/studio",
    },
    secondaryCta: {
      label: "Study the system",
      href: "/faq",
    },
    helper: "Prefer a personal intro? Request access and we will respond within one business day.",
  },
};
