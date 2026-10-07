import { renderSocialCard, socialCardSize } from "@/lib/social-card";

export const alt = "NEXORA: production software infrastructure for modern AI-powered applications";
export const size = socialCardSize;
export const contentType = "image/png";

export default function TwitterImage() {
  return renderSocialCard();
}
