import type { DemoProductDef } from "./catalog";

/**
 * Demo products. The copy is written from the photographs in
 * public/demo/products — every colour, material and detail named here is
 * visible in the picture — and the prices and specifications are sample
 * values for a fictional shop.
 *
 * Together they exercise everything the storefront supports: colour swatches
 * with their own photos (backpack, tee), size and colour grids with tracked
 * stock and sold-out combinations, capacity-priced electronics, scents and
 * sizes that change nothing visually, sale prices, and products with no
 * options at all.
 */

const SIZES = ["S", "M", "L", "XL"];

function sizes(prefixSku: string, price: number, stock: number[], compareAt?: number) {
  return SIZES.map((size, index) => ({
    values: [size],
    price,
    compareAt,
    stock: stock[index] ?? 0,
    sku: `${prefixSku}-${size}`,
  }));
}

export const DEMO_PRODUCTS: DemoProductDef[] = [
  /* --------------------------------------------------------- audio & tech */
  {
    n: 1,
    slug: "aria-wireless-headphones",
    name: "Aria Wireless Headphones",
    summary: "Over-ear · noise cancelling · 40-hour battery",
    description:
      "Soft cushions, a headband that still feels light after a long flight, and noise cancelling that takes the edge off trains and open offices.\n\nAria folds into its case and stays connected to two devices at once, so moving from laptop to phone is a single tap.",
    category: "audio-tech",
    collections: ["desk-setup"],
    tags: ["headphones", "bluetooth", "noise cancelling", "over-ear"],
    featured: true,
    addedDaysAgo: 34,
    photos: ["Aria headphones in matte black, seen from above", "Holding the Aria headphones by the ear cups"],
    price: 129,
    compareAt: 159,
    sku: "HAL-AUD-ARIA",
    trackInventory: true,
    stock: 14,
    specs: [
      ["Colour", "Matte black"],
      ["Battery", "Up to 40 hours"],
      ["Charging", "USB-C — 10 minutes for 5 hours"],
      ["Connection", "Bluetooth 5.3, two devices at once"],
      ["Weight", "254 g"],
    ],
  },
  {
    n: 2,
    slug: "pulse-wireless-earbuds",
    name: "Pulse Wireless Earbuds",
    summary: "True wireless · 30 hours with the case",
    description:
      "Small, secure and easy to forget you're wearing. Pulse sits flush in the ear, shrugs off rain and gym sweat, and the pocket-sized case tops them up three more times.",
    category: "audio-tech",
    collections: ["gift-guide"],
    tags: ["earbuds", "bluetooth", "wireless", "true wireless"],
    addedDaysAgo: 51,
    photos: ["Black Pulse earbuds beside their open charging case"],
    price: 79,
    sku: "HAL-AUD-PULSE",
    trackInventory: true,
    stock: 22,
    specs: [
      ["Colour", "Graphite black"],
      ["Battery", "7 hours, 30 hours with the case"],
      ["Water resistance", "IPX4 — sweat and splash proof"],
      ["Charging", "USB-C and wireless"],
      ["In the box", "Three sizes of ear tips"],
    ],
  },
  {
    n: 3,
    slug: "keystone-mechanical-keyboard",
    name: "Keystone Mechanical Keyboard",
    summary: "Compact 75% layout · wireless · Mac and Windows",
    description:
      "A compact mechanical keyboard that keeps the function row and arrow keys and loses everything else. Charcoal keycaps with two orange accents, and switches you can swap without soldering.\n\nPick linear switches for a smooth, quiet press, or tactile for a small bump you can feel.",
    category: "audio-tech",
    collections: ["desk-setup"],
    tags: ["keyboard", "mechanical", "wireless", "desk"],
    featured: true,
    addedDaysAgo: 6,
    photos: ["Keystone keyboard in charcoal with orange accent keys, on white marble"],
    options: [
      {
        name: "Switches",
        values: [
          { label: "Linear", swatch: null },
          { label: "Tactile", swatch: null },
        ],
      },
    ],
    variants: [
      { values: ["Linear"], price: 119, stock: 8, sku: "HAL-KEY-LIN" },
      { values: ["Tactile"], price: 119, stock: 0, sku: "HAL-KEY-TAC" },
    ],
    trackInventory: true,
    specs: [
      ["Layout", "84 keys (75%)"],
      ["Connection", "Bluetooth for three devices, or USB-C"],
      ["Battery", "Up to 200 hours with the backlight off"],
      ["Keycaps", "Double-shot, charcoal and orange"],
    ],
  },
  {
    n: 4,
    slug: "vault-portable-ssd",
    name: "Vault Portable SSD",
    summary: "Brushed aluminium · up to 1,050 MB/s · USB-C",
    description:
      "Thinner than a phone and fast enough to edit straight from the drive. Vault's brushed aluminium shell keeps it cool, and it works with laptops, tablets and consoles out of the box.",
    category: "audio-tech",
    collections: ["desk-setup"],
    tags: ["ssd", "storage", "drive", "backup", "usb-c"],
    featured: true,
    addedDaysAgo: 27,
    photos: ["Vault portable SSD in brushed aluminium next to a laptop"],
    options: [
      {
        name: "Capacity",
        values: [
          { label: "1 TB", swatch: null },
          { label: "2 TB", swatch: null },
          { label: "4 TB", swatch: null },
        ],
      },
    ],
    variants: [
      { values: ["1 TB"], price: 99, stock: 25, sku: "HAL-SSD-1T" },
      { values: ["2 TB"], price: 149, compareAt: 169, stock: 12, sku: "HAL-SSD-2T" },
      { values: ["4 TB"], price: 259, stock: 3, sku: "HAL-SSD-4T" },
    ],
    trackInventory: true,
    specs: [
      ["Speed", "Up to 1,050 MB/s read"],
      ["Connection", "USB-C 3.2 Gen 2, both cables included"],
      ["Size", "96 × 58 × 9 mm"],
      ["Weight", "62 g"],
    ],
  },

  /* ------------------------------------------------------- home & kitchen */
  {
    n: 5,
    slug: "lumen-floor-lamp",
    name: "Lumen Floor Lamp",
    summary: "Adjustable steel shade · charcoal grey",
    description:
      "A tall reading lamp with a pivoting steel shade, so the light lands on the page and not in your eyes. Slim enough to tuck beside a sofa or a desk.",
    category: "home-kitchen",
    tags: ["lamp", "lighting", "floor lamp", "reading"],
    addedDaysAgo: 63,
    photos: ["Lumen floor lamp with a charcoal steel shade against a white wall"],
    price: 119,
    sku: "HAL-LGT-LUMEN",
    specs: [
      ["Height", "176 cm"],
      ["Shade", "Powder-coated steel, adjustable"],
      ["Bulb", "E27, up to 13 W LED (not included)"],
      ["Cable", "2 m with foot switch"],
    ],
  },
  {
    n: 6,
    slug: "linen-soy-candle",
    name: "Linen Soy Candle",
    summary: "Hand-poured soy wax · wooden wick · 45 hours",
    description:
      "Poured by hand into a clear glass jar, with a wooden wick that crackles softly as it burns. Clean-burning soy wax and a scent that fills a room without taking it over.",
    category: "home-kitchen",
    collections: ["gift-guide", "under-50"],
    tags: ["candle", "soy", "scented", "home fragrance"],
    featured: true,
    addedDaysAgo: 41,
    photos: [
      "Linen soy candle in a clear glass jar",
      "The candle from above, with star anise and matches",
      "The candle beside an acacia tray, with dried lavender",
    ],
    options: [
      {
        name: "Scent",
        values: [
          { label: "Linen & Lavender", swatch: null },
          { label: "Amber & Star Anise", swatch: null },
          { label: "Unscented", swatch: null },
        ],
      },
    ],
    variants: [
      { values: ["Linen & Lavender"], price: 24, sku: "HAL-CDL-LIN" },
      { values: ["Amber & Star Anise"], price: 24, sku: "HAL-CDL-AMB" },
      { values: ["Unscented"], price: 22, sku: "HAL-CDL-UNS" },
    ],
    specs: [
      ["Wax", "100% soy"],
      ["Wick", "Wood, crackles as it burns"],
      ["Burn time", "About 45 hours"],
      ["Size", "8 × 7 cm, 180 g"],
    ],
  },
  {
    n: 7,
    slug: "forest-glass-candle",
    name: "Forest Glass Candle",
    summary: "Green glass vessel · wooden lid · 60 hours",
    description:
      "A slow-burning candle in a deep green glass with an acacia lid. When it's finished, the glass makes a good home for pens, matches or a small plant.",
    category: "home-kitchen",
    collections: ["gift-guide", "under-50"],
    tags: ["candle", "scented", "green glass", "home fragrance"],
    addedDaysAgo: 2,
    photos: [
      "Forest candle in green glass with a wooden lid",
      "The candle lit, on a green marble coaster",
      "The candle with cotton stems on white tiles",
    ],
    options: [
      {
        name: "Scent",
        values: [
          { label: "Cedar & Moss", swatch: null },
          { label: "Fig Leaf", swatch: null },
        ],
      },
    ],
    variants: [
      { values: ["Cedar & Moss"], price: 36, sku: "HAL-CDL-FOR-CED" },
      { values: ["Fig Leaf"], price: 36, sku: "HAL-CDL-FOR-FIG" },
    ],
    specs: [
      ["Vessel", "Recycled green glass, reusable"],
      ["Lid", "Acacia wood"],
      ["Burn time", "About 60 hours"],
      ["Size", "9.5 × 8 cm"],
    ],
  },
  {
    n: 8,
    slug: "painted-stoneware-mugs",
    name: "Painted Stoneware Mugs, Set of 2",
    summary: "Hand-painted glaze · 350 ml each",
    description:
      "Two generous stoneware mugs, each painted by hand — one with soft grey brush marks, one with sand-coloured chevrons. No two sets are quite the same.",
    category: "home-kitchen",
    collections: ["gift-guide", "under-50"],
    tags: ["mug", "coffee", "tea", "stoneware", "ceramic"],
    addedDaysAgo: 72,
    photos: ["Two stoneware mugs: one with grey brush marks, one with sand chevrons"],
    price: 38,
    compareAt: 44,
    sku: "HAL-KIT-MUG2",
    specs: [
      ["Material", "Stoneware"],
      ["Capacity", "350 ml each"],
      ["Care", "Dishwasher and microwave safe"],
      ["Includes", "2 mugs, one of each pattern"],
    ],
  },
  {
    n: 9,
    slug: "speckled-stoneware-set",
    name: "Speckled Stoneware Cup Set",
    summary: "One tall tumbler and four small cups",
    description:
      "Oat-coloured glaze flecked with brown, left unglazed at the base so you feel the clay. The tall tumbler holds water or flowers; the small cups are made for espresso, tea or a splash of something stronger.",
    category: "home-kitchen",
    collections: ["gift-guide", "under-50"],
    tags: ["cups", "tumbler", "espresso", "stoneware", "ceramic"],
    addedDaysAgo: 58,
    photos: ["A tall speckled tumbler with a raw clay base, beside four small cups"],
    price: 48,
    sku: "HAL-KIT-SPECK",
    specs: [
      ["Includes", "1 tumbler (400 ml) and 4 cups (120 ml)"],
      ["Glaze", "Speckled oat, raw clay base"],
      ["Care", "Dishwasher safe"],
    ],
  },
  {
    n: 10,
    slug: "pebble-bud-vase",
    name: "Pebble Bud Vase",
    summary: "Matte white porcelain · 14 cm",
    description:
      "A small porcelain vase shaped like a river pebble, made for a single stem or a sprig of eucalyptus. The matte glaze has a soft, chalky feel.",
    category: "home-kitchen",
    collections: ["gift-guide", "under-50"],
    tags: ["vase", "porcelain", "flowers", "decor"],
    addedDaysAgo: 80,
    photos: ["A matte white bud vase holding a sprig of eucalyptus"],
    price: 26,
    sku: "HAL-HOM-BUD",
    specs: [
      ["Material", "Porcelain, matte glaze"],
      ["Height", "14 cm"],
      ["Opening", "1.5 cm, for single stems"],
    ],
  },
  {
    n: 11,
    slug: "heritage-serving-boards",
    name: "Heritage Serving Boards, Set of 3",
    summary: "Solid hardwood · three sizes",
    description:
      "Three boards cut from solid hardwood, each with its own grain — two deep walnut tones and one pale board with a knot in it. Use them for bread, cheese or chopping, and hang them up when you're done.",
    category: "home-kitchen",
    collections: ["gift-guide"],
    tags: ["cutting board", "serving board", "wood", "kitchen"],
    addedDaysAgo: 45,
    photos: ["Three wooden serving boards in walnut and pale wood, leaning against a wall"],
    price: 68,
    sku: "HAL-KIT-BOARDS",
    specs: [
      ["Includes", "Small, medium and large boards"],
      ["Wood", "Solid hardwood, food-safe oil finish"],
      ["Largest", "45 × 20 cm"],
      ["Care", "Hand wash, oil now and then"],
    ],
  },
  {
    n: 12,
    slug: "minimal-wall-clock",
    name: "Minimal Wall Clock",
    summary: "Silent sweep movement · 30 cm",
    description:
      "Big, clear numbers, a thin black frame and an orange second hand that glides instead of ticking. Quiet enough for a bedroom.",
    category: "home-kitchen",
    collections: ["desk-setup", "under-50"],
    tags: ["clock", "wall clock", "decor"],
    addedDaysAgo: 90,
    photos: ["A round wall clock with a black frame and an orange second hand"],
    price: 45,
    sku: "HAL-HOM-CLOCK",
    specs: [
      ["Diameter", "30 cm"],
      ["Movement", "Silent sweep, no ticking"],
      ["Frame", "Black aluminium"],
      ["Power", "1 × AA battery, included"],
    ],
  },
  {
    n: 13,
    slug: "enameled-dutch-oven",
    name: "Enameled Cast Iron Dutch Oven",
    summary: "Flame orange · oven-safe to 260 °C",
    description:
      "The pot for stews, bread and everything braised. Heavy cast iron holds the heat evenly, and the glossy enamel needs no seasoning — it goes from hob to oven to table.",
    category: "home-kitchen",
    tags: ["dutch oven", "cast iron", "cookware", "pot"],
    featured: true,
    addedDaysAgo: 30,
    photos: ["A flame-orange enameled Dutch oven on a kitchen counter"],
    options: [
      {
        name: "Size",
        values: [
          { label: "24 cm · 4.2 L", swatch: null },
          { label: "28 cm · 6.7 L", swatch: null },
        ],
      },
    ],
    variants: [
      { values: ["24 cm · 4.2 L"], price: 159, stock: 6, sku: "HAL-KIT-DO-24" },
      { values: ["28 cm · 6.7 L"], price: 189, stock: 2, sku: "HAL-KIT-DO-28" },
    ],
    trackInventory: true,
    specs: [
      ["Material", "Enameled cast iron"],
      ["Hobs", "All, including induction"],
      ["Oven", "Safe to 260 °C, lid included"],
      ["Care", "Dishwasher safe; hand washing keeps the shine"],
    ],
  },
  {
    n: 14,
    slug: "insulated-steel-bottle",
    name: "Insulated Steel Bottle",
    summary: "Cold for 24 hours, hot for 12",
    description:
      "A double-walled steel bottle in a matte sage finish that doesn't show fingerprints. It keeps water cold through a summer day and coffee hot through a long morning.",
    category: "home-kitchen",
    collections: ["gift-guide", "under-50"],
    tags: ["water bottle", "insulated", "steel", "reusable"],
    addedDaysAgo: 23,
    photos: ["A matte sage-green insulated steel bottle"],
    options: [
      {
        name: "Size",
        values: [
          { label: "500 ml", swatch: null },
          { label: "750 ml", swatch: null },
        ],
      },
    ],
    variants: [
      { values: ["500 ml"], price: 32, sku: "HAL-KIT-BTL-500" },
      { values: ["750 ml"], price: 38, sku: "HAL-KIT-BTL-750" },
    ],
    specs: [
      ["Colour", "Sage green, matte"],
      ["Material", "18/8 stainless steel, double-walled"],
      ["Lid", "Leak-proof steel cap"],
    ],
  },
  {
    n: 15,
    slug: "chunky-knit-throw",
    name: "Chunky Knit Throw",
    summary: "Soft grey · 130 × 170 cm",
    description:
      "A heavy, chunky-knit throw with long fringed edges. Grey goes with everything, and it is big enough to share on the sofa. (The cushion in the photo is not included.)",
    category: "home-kitchen",
    collections: ["gift-guide"],
    tags: ["throw", "blanket", "knit", "living room"],
    addedDaysAgo: 66,
    photos: ["A chunky grey knit throw draped over a sofa, with a white cushion"],
    price: 79,
    sku: "HAL-HOM-THROW",
    specs: [
      ["Material", "Cotton-blend chunky knit"],
      ["Size", "130 × 170 cm"],
      ["Care", "Machine wash cold, dry flat"],
    ],
  },

  /* ---------------------------------------------------------------- apparel */
  {
    n: 16,
    slug: "everyday-organic-tee",
    name: "Everyday Organic Tee",
    summary: "Heavyweight organic cotton · relaxed fit",
    description:
      "The T-shirt you reach for first: thick enough not to cling, soft from the first wash, with a collar that keeps its shape. Cut slightly relaxed through the body.",
    category: "apparel",
    collections: ["under-50"],
    tags: ["t-shirt", "tee", "organic cotton", "basics"],
    featured: true,
    addedDaysAgo: 38,
    photos: ["The Everyday tee folded, in red, black, white and navy", "The white Everyday tee, worn"],
    options: [
      {
        name: "Colour",
        values: [
          { label: "Black", swatch: "#1b1b1c" },
          { label: "White", swatch: "#f4f4f1" },
          { label: "Navy", swatch: "#1d2b4f" },
          { label: "Red", swatch: "#a3161f" },
        ],
      },
      { name: "Size", values: ["XS", ...SIZES].map((label) => ({ label, swatch: null })) },
    ],
    variants: [
      ...[
        ["Black", [6, 12, 15, 9, 4]],
        ["White", [5, 10, 0, 7, 3]],
        ["Navy", [3, 8, 9, 6, 2]],
        ["Red", [0, 4, 6, 3, 0]],
      ].flatMap(([colour, stock]) =>
        ["XS", ...SIZES].map((size, index) => ({
          values: [colour as string, size],
          price: 28,
          stock: (stock as number[])[index],
          sku: `HAL-TEE-${(colour as string).slice(0, 3).toUpperCase()}-${size}`,
          photo: colour === "White" ? 2 : undefined,
        })),
      ),
    ],
    trackInventory: true,
    specs: [
      ["Material", "100% organic cotton, 220 g/m²"],
      ["Fit", "Relaxed — take your usual size"],
      ["Care", "Machine wash at 30 °C"],
    ],
  },
  {
    n: 17,
    slug: "heavyweight-hoodie",
    name: "Heavyweight Hoodie",
    summary: "Brushed fleece · dropped shoulder",
    description:
      "A thick, brushed-fleece hoodie with a dropped shoulder and a deep hood. Washed for softness in two quiet colours: blush and sage.",
    category: "apparel",
    tags: ["hoodie", "sweatshirt", "fleece", "basics"],
    addedDaysAgo: 19,
    photos: ["Blush and sage hoodies hanging on a clothes rail"],
    options: [
      {
        name: "Colour",
        values: [
          { label: "Blush", swatch: "#d8b5a3" },
          { label: "Sage", swatch: "#b7c2ae" },
        ],
      },
      { name: "Size", values: SIZES.map((label) => ({ label, swatch: null })) },
    ],
    variants: [
      ...sizes("HAL-HOOD-BLU", 68, [4, 7, 5, 2]).map((variant) => ({ ...variant, values: ["Blush", ...variant.values] })),
      ...sizes("HAL-HOOD-SAG", 68, [3, 0, 6, 4]).map((variant) => ({ ...variant, values: ["Sage", ...variant.values] })),
    ],
    trackInventory: true,
    specs: [
      ["Material", "80% cotton, 20% recycled polyester, 400 g/m²"],
      ["Fit", "Oversized — size down for a closer fit"],
      ["Care", "Machine wash at 30 °C, inside out"],
    ],
  },
  {
    n: 18,
    slug: "fleece-crewneck",
    name: "Fleece Crewneck Sweatshirt",
    summary: "White · brushed inside",
    description:
      "A clean white crewneck with ribbed cuffs and hem, brushed on the inside for warmth. Layer it over a tee or wear it on its own.",
    category: "apparel",
    tags: ["sweatshirt", "crewneck", "fleece", "basics"],
    addedDaysAgo: 47,
    photos: ["A white crewneck sweatshirt laid flat with jeans and sneakers"],
    options: [{ name: "Size", values: SIZES.map((label) => ({ label, swatch: null })) }],
    variants: sizes("HAL-CREW-WHT", 58, [5, 9, 8, 3]),
    trackInventory: true,
    specs: [
      ["Material", "Cotton fleece, brushed inside"],
      ["Colour", "White"],
      ["Care", "Machine wash at 30 °C"],
    ],
  },
  {
    n: 19,
    slug: "classic-denim-jacket",
    name: "Classic Denim Jacket",
    summary: "Dark indigo · four patch pockets",
    description:
      "A relaxed chore jacket in dark indigo denim, with four patch pockets, contrast stitching and a soft printed lining. Over a hoodie in autumn, over a tee in spring.",
    category: "apparel",
    tags: ["denim", "jacket", "chore jacket", "outerwear"],
    addedDaysAgo: 55,
    photos: ["Dark indigo denim chore jacket with four patch pockets, against a grey backdrop"],
    options: [{ name: "Size", values: SIZES.map((label) => ({ label, swatch: null })) }],
    variants: sizes("HAL-DNM-JKT", 119, [2, 5, 4, 1]),
    trackInventory: true,
    specs: [
      ["Fabric", "12 oz denim, 100% cotton"],
      ["Lining", "Printed cotton"],
      ["Fit", "Relaxed — size down for a closer fit"],
    ],
  },
  {
    n: 20,
    slug: "lightweight-bomber",
    name: "Lightweight Bomber Jacket",
    summary: "Rust · water-repellent shell",
    description:
      "A light bomber in a warm rust colour, with ribbed cuffs, a zip sleeve pocket and a shell that shrugs off a shower. Easy to pack, easy to wear.",
    category: "apparel",
    tags: ["bomber", "jacket", "outerwear", "lightweight"],
    featured: true,
    addedDaysAgo: 3,
    photos: ["A rust-coloured bomber jacket held up on a hanger"],
    options: [{ name: "Size", values: SIZES.map((label) => ({ label, swatch: null })) }],
    variants: sizes("HAL-BMB-RST", 98, [3, 6, 5, 2], 128),
    trackInventory: true,
    specs: [
      ["Shell", "Recycled nylon, water-repellent"],
      ["Colour", "Rust"],
      ["Pockets", "Two side pockets, one zip sleeve pocket"],
    ],
  },
  {
    n: 21,
    slug: "suede-ankle-boots",
    name: "Suede Ankle Boots",
    summary: "Tan suede · side zip · EU 36–42",
    description:
      "Soft tan suede ankle boots with a side zip, a small strap and a row of studs at the heel. A chunky rubber sole keeps them comfortable all day.",
    category: "apparel",
    tags: ["boots", "ankle boots", "suede", "shoes"],
    featured: true,
    addedDaysAgo: 5,
    photos: ["A pair of tan suede ankle boots with a side zip and studs"],
    options: [
      {
        name: "Size",
        values: ["36", "37", "38", "39", "40", "41", "42"].map((label) => ({ label, swatch: null })),
      },
    ],
    variants: ["36", "37", "38", "39", "40", "41", "42"].map((size, index) => ({
      values: [size],
      price: 139,
      stock: [1, 3, 4, 0, 5, 2, 1][index],
      sku: `HAL-BOOT-TAN-${size}`,
    })),
    trackInventory: true,
    specs: [
      ["Upper", "Suede leather"],
      ["Sole", "Rubber, 3 cm"],
      ["Sizing", "EU sizes — true to size"],
    ],
  },

  /* ---------------------------------------------------- bags & accessories */
  {
    n: 22,
    slug: "leather-backpack",
    name: "Leather Backpack",
    summary: "Full-grain leather · fits a 15″ laptop",
    description:
      "A rounded leather backpack that wears in beautifully, with a padded laptop sleeve, a zip front pocket and two side pockets for a bottle and an umbrella. Choose cognac, burgundy or black.",
    category: "bags-accessories",
    tags: ["backpack", "leather", "laptop bag", "bag"],
    featured: true,
    addedDaysAgo: 15,
    photos: ["The leather backpack in cognac", "The leather backpack in burgundy", "The black backpack beside the burgundy"],
    options: [
      {
        name: "Colour",
        values: [
          { label: "Cognac", swatch: "#8b4a3b" },
          { label: "Burgundy", swatch: "#6b2433" },
          { label: "Black", swatch: "#1c1c1e" },
        ],
      },
    ],
    variants: [
      { values: ["Cognac"], price: 189, stock: 5, sku: "HAL-BAG-BP-COG", photo: 1 },
      { values: ["Burgundy"], price: 189, stock: 3, sku: "HAL-BAG-BP-BUR", photo: 2 },
      { values: ["Black"], price: 189, stock: 2, sku: "HAL-BAG-BP-BLK", photo: 3 },
    ],
    trackInventory: true,
    specs: [
      ["Leather", "Full-grain, vegetable-tanned"],
      ["Laptop", "Padded sleeve, up to 15″"],
      ["Size", "42 × 30 × 14 cm"],
    ],
  },
  {
    n: 23,
    slug: "canvas-tote",
    name: "Canvas Tote",
    summary: "Heavy cotton canvas · long handles",
    description:
      "A plain black tote in thick cotton canvas, with handles long enough to wear on the shoulder. Holds a laptop, the groceries or a day at the beach.",
    category: "bags-accessories",
    collections: ["gift-guide", "under-50"],
    tags: ["tote", "bag", "canvas", "shopping bag"],
    addedDaysAgo: 70,
    photos: ["A black canvas tote hanging on a wooden coat stand"],
    price: 24,
    sku: "HAL-BAG-TOTE-BLK",
    specs: [
      ["Material", "12 oz cotton canvas"],
      ["Size", "38 × 42 cm, 65 cm handles"],
      ["Colour", "Black"],
    ],
  },
  {
    n: 24,
    slug: "bifold-leather-wallet",
    name: "Bifold Leather Wallet",
    summary: "Waxed brown leather · 6 card slots",
    description:
      "A slim bifold in waxed brown leather that darkens and creases with use. Six card slots and a full-length note pocket, and nothing else.",
    category: "bags-accessories",
    collections: ["gift-guide"],
    tags: ["wallet", "leather", "card holder"],
    addedDaysAgo: 85,
    photos: ["A brown leather bifold wallet"],
    price: 54,
    sku: "HAL-ACC-WAL",
    specs: [
      ["Leather", "Waxed full-grain"],
      ["Holds", "6 cards and notes"],
      ["Size", "11 × 9 cm closed"],
    ],
  },
  {
    n: 25,
    slug: "leather-belt",
    name: "Leather Belt",
    summary: "Tan leather · brushed steel buckle",
    description:
      "A 3.5 cm belt in textured tan leather with a plain brushed-steel buckle. Smart enough for chinos, sturdy enough for jeans.",
    category: "bags-accessories",
    collections: ["under-50"],
    tags: ["belt", "leather"],
    addedDaysAgo: 60,
    photos: ["Close-up of a tan leather belt and its steel buckle"],
    options: [
      {
        name: "Size",
        values: [
          { label: "S · 80–90 cm", swatch: null },
          { label: "M · 90–100 cm", swatch: null },
          { label: "L · 100–110 cm", swatch: null },
        ],
      },
    ],
    variants: [
      { values: ["S · 80–90 cm"], price: 48, sku: "HAL-ACC-BELT-S" },
      { values: ["M · 90–100 cm"], price: 48, sku: "HAL-ACC-BELT-M" },
      { values: ["L · 100–110 cm"], price: 48, sku: "HAL-ACC-BELT-L" },
    ],
    specs: [
      ["Leather", "Textured full-grain"],
      ["Width", "3.5 cm"],
      ["Buckle", "Brushed steel"],
    ],
  },
  {
    n: 26,
    slug: "round-metal-sunglasses",
    name: "Round Metal Sunglasses",
    summary: "Gold frame · green polarised lenses",
    description:
      "A thin gold metal frame with round, bottle-green lenses. Polarised to cut glare off water and roads, with full UV400 protection.",
    category: "bags-accessories",
    collections: ["gift-guide"],
    tags: ["sunglasses", "eyewear", "summer"],
    addedDaysAgo: 12,
    photos: ["Round gold-frame sunglasses with green lenses on white marble"],
    price: 89,
    sku: "HAL-ACC-SUN-RND",
    specs: [
      ["Frame", "Gold-tone stainless steel"],
      ["Lenses", "Green, polarised, UV400"],
      ["Includes", "Hard case and cleaning cloth"],
    ],
  },

  /* ---------------------------------------------------------- beauty & care */
  {
    n: 27,
    slug: "dune-eau-de-parfum",
    name: "Dune Eau de Parfum",
    summary: "Warm sand, sea salt and sandalwood",
    description:
      "A fragrance that smells like the end of a beach day: warm skin, salt in the air and dry sandalwood. Soft at first, it settles close to the skin and lasts into the evening.",
    category: "beauty-care",
    collections: ["gift-guide"],
    tags: ["perfume", "fragrance", "eau de parfum", "unisex"],
    featured: true,
    addedDaysAgo: 8,
    photos: [
      "Dune eau de parfum resting in sand",
      "The Dune bottle at an angle in warm light",
      "The Dune bottle half-buried in sand",
    ],
    options: [
      {
        name: "Size",
        values: [
          { label: "50 ml", swatch: null },
          { label: "100 ml", swatch: null },
        ],
      },
    ],
    variants: [
      { values: ["50 ml"], price: 78, sku: "HAL-BTY-DUNE-50" },
      { values: ["100 ml"], price: 112, sku: "HAL-BTY-DUNE-100" },
    ],
    specs: [
      ["Notes", "Sea salt, ambrette, sandalwood"],
      ["Concentration", "Eau de parfum, 18%"],
      ["Bottle", "Glass, refillable"],
    ],
  },
  {
    n: 28,
    slug: "sea-mineral-body-set",
    name: "Sea Mineral Body Set",
    summary: "Body lotion 200 ml + body balm 50 ml",
    description:
      "A light daily lotion and a richer balm for elbows, knees and hands, both made with sea minerals and aloe. They sink in quickly and leave a faint, fresh scent.",
    category: "beauty-care",
    collections: ["gift-guide", "under-50"],
    tags: ["body lotion", "balm", "skincare", "set"],
    addedDaysAgo: 10,
    photos: ["The body lotion bottle and balm jar in sand", "The body lotion bottle in sand"],
    price: 46,
    sku: "HAL-BTY-SEA-SET",
    specs: [
      ["Includes", "Body lotion 200 ml, body balm 50 ml"],
      ["Key ingredients", "Sea minerals, aloe, shea butter"],
      ["Skin type", "All, including sensitive"],
    ],
  },
  {
    n: 29,
    slug: "botanical-face-oil",
    name: "Botanical Face Oil",
    summary: "Squalane and rosehip · 30 ml",
    description:
      "A few drops at night and skin wakes up softer. A lightweight blend of plant squalane and rosehip that absorbs without a greasy finish, in an amber glass dropper bottle.",
    category: "beauty-care",
    collections: ["under-50"],
    tags: ["face oil", "serum", "skincare"],
    addedDaysAgo: 29,
    photos: ["An amber dropper bottle of face oil on a wooden stand"],
    price: 38,
    sku: "HAL-BTY-OIL",
    specs: [
      ["Key ingredients", "Squalane, rosehip, vitamin E"],
      ["Size", "30 ml amber glass"],
      ["Use", "2–3 drops, evening"],
    ],
  },
  {
    n: 30,
    slug: "gentle-hand-body-wash",
    name: "Gentle Hand & Body Wash",
    summary: "Unscented · 500 ml pump",
    description:
      "A mild, unscented wash for hands and body that cleans without leaving skin tight. A big pump bottle that looks good by any sink.",
    category: "beauty-care",
    collections: ["under-50"],
    tags: ["hand wash", "body wash", "soap", "unscented"],
    addedDaysAgo: 48,
    photos: ["A white pump bottle of hand and body wash on brown linen"],
    price: 22,
    sku: "HAL-BTY-WASH",
    specs: [
      ["Size", "500 ml pump bottle"],
      ["Scent", "Unscented"],
      ["Skin type", "All, including sensitive"],
    ],
  },
];
