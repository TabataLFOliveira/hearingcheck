import type { Origin, TrackingInput } from "./types.js";

function clip(value: string | null | undefined, max = 120): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function cleanTracking(input: TrackingInput): Required<TrackingInput> {
  return {
    origem: clip(input.origem),
    utmSource: clip(input.utmSource),
    utmMedium: clip(input.utmMedium),
    utmCampaign: clip(input.utmCampaign),
    gclid: clip(input.gclid),
    fbclid: clip(input.fbclid),
  };
}

export function resolveOrigin(input: TrackingInput): Origin {
  const tracking = cleanTracking(input);
  const origem = tracking.origem?.toLowerCase();
  if (origem === "totem" || origem === "site" || origem === "google" || origem === "meta") {
    return origem;
  }
  if (tracking.gclid) return "google";
  if (tracking.fbclid) return "meta";
  const source = tracking.utmSource?.toLowerCase() ?? "";
  if (source === "google" || source === "adwords") return "google";
  if (["meta", "facebook", "instagram", "fb", "ig"].includes(source)) return "meta";
  if (source === "site" || source === "ouvix") return "site";
  if (source === "totem") return "totem";
  return "direto";
}
