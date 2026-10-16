import type { EventType } from "@/lib/api/types";

/** Photos for the picture slots. Files live in public/images; credits are in progress.md. */
export const EVENT_TYPE_IMAGES: Record<EventType, string> = {
  wedding: "/images/event-wedding.jpg",
  birthday: "/images/event-birthday.jpg",
  corporate: "/images/event-corporate.jpg",
};

export const LANDING_HERO_IMAGE = "/images/landing-hero.jpg";

const CATEGORY_IMAGES: Record<string, string> = {
  venue: "/images/vendor-venue.jpg",
  catering: "/images/vendor-catering.jpg",
  photography: "/images/vendor-photography.jpg",
  music: "/images/vendor-music.jpg",
  decoration: "/images/vendor-decoration.jpg",
  florist: "/images/vendor-florist.jpg",
  cake: "/images/vendor-cake.jpg",
  lighting: "/images/vendor-lighting.jpg",
  transport: "/images/vendor-transport.jpg",
  makeup: "/images/vendor-makeup.jpg",
};

/** An unknown category falls back to the decoration photo, like `captionFor` does for its caption. */
export const imageForCategory = (category: string) =>
  CATEGORY_IMAGES[category] ?? CATEGORY_IMAGES.decoration;
