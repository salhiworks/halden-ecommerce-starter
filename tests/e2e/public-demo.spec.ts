import { expect, test, type Page } from "@playwright/test";
import { addToBag, expectToast, placeOrder, signInAsOwner } from "./fixtures";

/** The preview's answer to any change, as a toast or inline, depending on the screen. */
async function expectRefused(page: Page) {
  await expect(page.getByText(/changes aren't saved/).first()).toBeVisible();
}

/**
 * Public demo mode (PUBLIC_DEMO_MODE=true), as on the hosted Halden demo:
 * visitors can try the whole shop and look around the dashboard, but can't
 * change anything, see anyone's data, or leave anything behind.
 */

test.describe.configure({ mode: "serial" });

// A name no other test uses, to prove demo orders never reach the owner.
const VISITOR = `Demo Visitor ${Date.now().toString(36)}`;

test("the shop says it is a demo and leads to the dashboard preview", async ({ page }) => {
  await page.goto("/");
  const bar = page.getByTestId("demo-bar");
  await expect(bar).toContainText("demo store");
  await bar.getByRole("link", { name: /Explore the dashboard/ }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByTestId("preview-entry")).toBeVisible();
});

test("a demo order goes all the way through but is never saved", async ({ page }) => {
  await addToBag(page, "canvas-tote");
  await page.goto("/checkout");
  await expect(page.getByTestId("demo-notice")).toBeVisible();
  const order = await placeOrder(page, "Pay on delivery", { name: VISITOR });
  await expect(page.getByTestId("demo-notice")).toBeVisible();
  await expect(page.getByText(`Order #${order.number}`).first()).toBeVisible();

  // The real owner's dashboard has never heard of it.
  await signInAsOwner(page);
  await page.goto(`/admin/orders?view=all&q=${encodeURIComponent(VISITOR)}`);
  await expect(page.getByText(VISITOR)).toHaveCount(0);
  expect((await page.goto(`/admin/orders/${order.id}`))?.status()).toBe(404);
});

test("a WhatsApp demo order shows the message and sends nothing", async ({ page }) => {
  await addToBag(page, "pebble-bud-vase");
  await placeOrder(page, "Order on WhatsApp", { name: VISITOR });
  await expect(page.getByTestId("whatsapp-message")).toContainText("Pebble Bud Vase");
  await expect(page.getByTestId("open-whatsapp")).toHaveCount(0);
});

test("guests can explore the whole dashboard but change nothing", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Explore the dashboard" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("preview-banner")).toBeVisible();

  // Orders are samples made for the preview — never real customers.
  await page.goto("/admin/orders?view=all");
  await expect(page.getByText("Alex Sample").first()).toBeVisible();
  await expect(page.getByText(VISITOR)).toHaveCount(0);

  // Editing a product looks normal, but saving is refused…
  await page.goto("/admin/products?q=Canvas%20Tote");
  await page.getByRole("link", { name: "Canvas Tote" }).first().click();
  await page.getByLabel("Price", { exact: true }).fill("1");
  await page.getByTestId("save-product").click();
  await expectRefused(page);
  // …and the shop is unchanged.
  await page.goto("/products/canvas-tote");
  await expect(page.getByText("$24").first()).toBeVisible();

  // Settings, order actions and uploads are refused the same way.
  await page.goto("/admin/settings#store");
  await page.locator("form#store").getByLabel("Store name").fill("Guest was here");
  await page.locator("form#store").getByRole("button", { name: "Save", exact: true }).click();
  await expectRefused(page);
  await expect(page.locator("#account")).toHaveCount(0);

  await page.goto("/admin/orders?view=new");
  await page.getByRole("link", { name: /#\d+/ }).first().click();
  await page.getByTestId("transition-confirmed").click();
  await page.getByTestId("confirm-transition").click();
  await expectRefused(page);
  await page.keyboard.press("Escape");

  const upload = await page.request.post("/api/admin/media", {
    multipart: { file: { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) } },
  });
  expect(upload.status()).toBe(403);

  // Leaving the preview closes the dashboard again.
  await page.getByRole("button", { name: "Leave preview" }).first().click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await context.close();
});

test("the store owner signs in and edits as usual", async ({ page }) => {
  await signInAsOwner(page);
  await expect(page.getByTestId("preview-banner")).toHaveCount(0);

  await page.goto("/admin/storefront");
  const heading = page.getByTestId("hero-heading");
  const original = await heading.inputValue();
  await heading.fill("Edited by the owner");
  await page.locator("form#hero").getByRole("button", { name: "Save", exact: true }).click();
  await expectToast(page, "Homepage banner saved");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Edited by the owner");

  await page.goto("/admin/storefront");
  await page.getByTestId("hero-heading").fill(original);
  await page.locator("form#hero").getByRole("button", { name: "Save", exact: true }).click();
  await expectToast(page, "Homepage banner saved");
});
