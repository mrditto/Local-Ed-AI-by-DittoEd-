export interface ModelTier {
  id: "light" | "recommended" | "enhanced";
  label: string;
  model: string;
  downloadSize: string;
  blurb: string;
  badge?: string;
}

export const modelTiers: ModelTier[] = [
  {
    id: "light",
    label: "Light",
    model: "llama3.2:1b",
    downloadSize: "~1.3 GB",
    blurb: "For older or low-memory computers (8 GB RAM or less). Fastest, simpler responses.",
  },
  {
    id: "recommended",
    label: "Recommended",
    model: "phi4-mini:latest",
    downloadSize: "~2.5 GB",
    badge: "Default",
    blurb: "Best balance of quality and speed for most school machines.",
  },
  {
    id: "enhanced",
    label: "Enhanced",
    model: "llama3.1:8b",
    downloadSize: "~4.9 GB",
    blurb: "Higher quality responses. Needs a newer computer with 16 GB RAM and patience.",
  },
];
