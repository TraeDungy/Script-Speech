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
    title: "Turn any script into studio-quality audio in minutes.",
    phrases: [
      "Paste your script. Choose your voice. Hit generate.",
      "No gear. No studio. No voice actor invoices.",
      "Broadcast-ready audio for podcasts, YouTube, audiobooks, and film.",
    ],
    description:
      "Script Speech gives creators and agencies a professional voice studio in their browser. AI voices that sound like they cost five hundred dollars — without the invoice.",
  },
  vignettes: [
    {
      title: "Built for volume",
      description:
        "Batch your scripts and process entire seasons, chapters, or campaigns overnight. Wake up to finished files. No back-and-forth with a voice actor.",
      footnote: 1,
    },
    {
      title: "Studio quality, browser simple",
      description:
        "Every export is broadcast-ready: clean frequencies, consistent levels, zero room noise. MP3, WAV, and M4A available. Works anywhere your audience listens.",
      footnote: 2,
    },
    {
      title: "Revise instantly",
      description:
        "Change one word or rewrite the whole script — regeneration takes seconds. No retake fees, no waiting for studio availability, no version confusion.",
      footnote: 3,
    },
  ],
  cadence: [
    {
      heading: "1. Paste your script",
      body: "Drop in your copy — narration, dialogue, ad read, chapter text. Any format, any length.",
      anchor: 1,
    },
    {
      heading: "2. Choose your voice",
      body: "Select from 24+ broadcast-quality AI voices. Conversational, documentary, audiobook, commercial. Preview before you commit.",
      anchor: 2,
    },
    {
      heading: "3. Export and publish",
      body: "Download your finished audio file in seconds. Commercial license included. Ready for your DAW, your host, or your editor.",
      anchor: 4,
    },
  ],
  callToAction: {
    eyebrow: "Early access — first 50 users",
    title: "Get in while pricing is at its lowest.",
    description:
      "Script Speech is open to waitlist users first. Founding members lock in the lowest price this product will ever be — before the public launch.",
    primaryCta: {
      label: "Open the studio",
      href: "/studio",
    },
    secondaryCta: {
      label: "See pricing",
      href: "/pricing",
    },
    helper: "Questions? Hit reply on any email and we respond personally.",
  },
};
