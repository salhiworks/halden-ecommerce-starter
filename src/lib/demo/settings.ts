import type { SettingsInput } from "@/lib/domain/settings";

/**
 * The demo store's settings: a fictional shop called Halden.
 *
 * Deliberately contains no real contact details. The email uses the
 * `.example` domain, which is reserved and can never be registered, and the
 * WhatsApp number is empty — so WhatsApp checkout runs in demo mode (the
 * message is shown, never sent) until an owner adds their own number.
 */
export const DEMO_SETTINGS: SettingsInput = {
  store: {
    name: "Halden",
    tagline: "Well-made things for everyday life",
    description:
      "Halden is a small independent store for everyday goods: audio and desk tech, things for the kitchen and home, wardrobe staples, bags and daily care — chosen to be used, not stored.",
    logoUrl: "",
    language: "en",
    currency: "USD",
    siteUrl: "",
  },
  contact: {
    email: "hello@halden.example",
    phone: "",
    whatsapp: "",
    address: "",
    hours: "Monday to Saturday, 9:00–18:00",
  },
  social: {},
  checkout: {
    whatsapp: true,
    cashOnDelivery: true,
    bankTransfer: true,
    bankTransferInstructions:
      "Account name: Halden Goods (demo)\nBank: Example Bank\nAccount number: replace with your own details in Settings → Checkout\n\nYour order ships as soon as the transfer arrives.",
    confirmationNote: "We confirm every order by phone or WhatsApp within one business day.",
  },
  shipping: {
    methods: [
      {
        id: "standard",
        name: "Standard delivery",
        description: "3–5 business days",
        price: 6,
        requiresAddress: true,
      },
      {
        id: "express",
        name: "Express delivery",
        description: "1–2 business days",
        price: 14,
        requiresAddress: true,
      },
      {
        id: "pickup",
        name: "Pickup from the studio",
        description: "Ready the next business day",
        price: 0,
        requiresAddress: false,
      },
    ],
    freeShippingThreshold: 75,
    areas: "",
  },
  theme: {
    accent: "#0F4C5C",
    fontPairing: "signage",
    corners: "soft",
  },
  homepage: {
    announcement: {
      enabled: true,
      text: "Free delivery on orders over $75",
      href: "/shop",
    },
    hero: {
      enabled: true,
      eyebrow: "The everyday edit",
      heading: "Good things, used every day",
      text: "Headphones you'll wear on every commute, mugs that become your favourite, a bag that goes everywhere. Fewer, better things — delivered to your door.",
      imageUrl: "/demo/hero/hero-1.jpg",
      primaryLabel: "Shop everything",
      primaryHref: "/shop",
      secondaryLabel: "Browse the gift guide",
      secondaryHref: "/collections/gift-guide",
    },
    sections: [
      { id: "categories", type: "categories", enabled: true, title: "Shop by category" },
      {
        id: "featured",
        type: "products",
        enabled: true,
        title: "Most loved",
        source: "featured",
        collectionId: null,
        limit: 8,
      },
      {
        id: "gift-banner",
        type: "banner",
        enabled: true,
        eyebrow: "Gift guide",
        heading: "Gifts they'll actually use",
        text: "Thoughtful picks across every aisle, most under $60 — wrapped in plain paper, ready to give.",
        imageUrl: "/demo/banners/gift-guide.jpg",
        linkLabel: "Shop the gift guide",
        linkHref: "/collections/gift-guide",
        align: "start",
      },
      {
        id: "desk",
        type: "products",
        enabled: true,
        title: "The desk setup",
        source: "collection",
        collectionId: "de000000-0000-4000-8000-a00000000002",
        limit: 4,
      },
      { id: "highlights", type: "highlights", enabled: true },
      {
        id: "new",
        type: "products",
        enabled: true,
        title: "Just in",
        source: "new",
        collectionId: null,
        limit: 4,
      },
    ],
  },
  policies: {
    about:
      "Halden is a demo store that shows what this platform can do. Every product, price and photo here is sample content — replace it with your own from the dashboard.\n\nWe started with a simple idea: buy fewer things, and make them good ones. Everything we stock is something we would use ourselves.",
    shipping:
      "We deliver Monday to Saturday.\n\n- Standard delivery: 3–5 business days, $6\n- Express delivery: 1–2 business days, $14\n- Pickup from the studio: free, ready the next business day\n\nDelivery is free on orders over $75. We confirm every order with you before it ships.",
    returns:
      "Changed your mind? Return unused items within 30 days for a refund or an exchange.\n\nContact us with your order number and we'll arrange the return. Items must be unused and in their original packaging. Personal-care products can only be returned unopened.",
    privacy:
      "We only collect what we need to deliver your order: your name, phone number, delivery address and, if you give it, your email.\n\nWe use these details to confirm, deliver and support your order — never for advertising, and we never sell them. We don't use tracking cookies. To see or delete the details we hold about you, contact us.",
  },
};
