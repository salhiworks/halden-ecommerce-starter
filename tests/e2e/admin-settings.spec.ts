import { expect, test, type Page } from "@playwright/test";
import { addToBag, expectNoHorizontalScroll, expectToast, savePanel } from "./fixtures";

/**
 * Settings and storefront customization, each checked in the shop itself.
 * Every test puts things back the way the demo store had them.
 */

test.describe.configure({ mode: "serial" });

const accentOf = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toUpperCase());

test("the store name appears across the shop", async ({ page }) => {
  await page.goto("/admin/settings#store");
  const name = page.locator("form#store").getByLabel("Store name");
  const original = await name.inputValue();
  await name.fill("Northwind Supply");
  await savePanel(page, "store", "Store details saved");

  await page.goto("/");
  await expect(page.getByRole("banner")).toContainText(/Northwind Supply/i);
  await expect(page).toHaveTitle(/Northwind Supply/);

  await page.goto("/admin/settings#store");
  await page.locator("form#store").getByLabel("Store name").fill(original);
  await savePanel(page, "store", "Store details saved");
});

test("a new accent colour restyles the shop", async ({ page }) => {
  await page.goto("/admin/storefront");
  const theme = page.locator("form#theme");
  await theme.getByRole("radio", { name: "Tomato" }).click();
  await savePanel(page, "theme", "Theme saved");
  await page.goto("/");
  expect(await accentOf(page)).toBe("#D2452B");

  await page.goto("/admin/storefront");
  await page.locator("form#theme").getByRole("radio", { name: "Petrol" }).click();
  await savePanel(page, "theme", "Theme saved");
  await page.goto("/");
  expect(await accentOf(page)).toBe("#0F4C5C");
});

test("Arabic turns the whole shop right-to-left", async ({ page }) => {
  await page.goto("/admin/settings#store");
  await page.locator("form#store").getByLabel("Shop language").selectOption("ar");
  await savePanel(page, "store", "Store details saved");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expectNoHorizontalScroll(page);

  await addToBag(page, "canvas-tote");
  await page.goto("/checkout");
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/Checkout/);
  await expectNoHorizontalScroll(page);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin/settings#store");
  // The dashboard itself stays in English, left to right.
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.locator("form#store").getByLabel("Shop language").selectOption("en");
  await savePanel(page, "store", "Store details saved");
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("the homepage headline, announcement and sections are editable", async ({ page }) => {
  await page.goto("/admin/storefront");
  const heading = page.getByTestId("hero-heading");
  const originalHeading = await heading.inputValue();
  await heading.fill("Made to be used every day");
  await savePanel(page, "hero", "Homepage banner saved");

  const announcement = page.locator("form#announcement").getByLabel("Message");
  const originalAnnouncement = await announcement.inputValue();
  await announcement.fill("Orders placed by Thursday ship this week");
  await savePanel(page, "announcement", "Announcement saved");

  const sections = page.locator("form#sections");
  await page.getByTestId("add-section").click();
  await sections.getByRole("button", { name: /^Banner A wide photo/ }).click();
  await sections.getByLabel("Headline").fill("The autumn edit");
  await savePanel(page, "sections", "Homepage sections saved");

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Made to be used every day");
  await expect(page.getByText("Orders placed by Thursday ship this week")).toBeVisible();
  await expect(page.getByRole("heading", { name: "The autumn edit" })).toBeVisible();

  // Put everything back.
  await page.goto("/admin/storefront");
  await page.getByTestId("hero-heading").fill(originalHeading);
  await savePanel(page, "hero", "Homepage banner saved");
  await page.locator("form#announcement").getByLabel("Message").fill(originalAnnouncement);
  await savePanel(page, "announcement", "Announcement saved");
  const banner = page.locator("form#sections li").filter({ hasText: "The autumn edit" });
  await banner.getByRole("button", { name: /^Edit/ }).click();
  await banner.getByRole("button", { name: "Remove section" }).click();
  await savePanel(page, "sections", "Homepage sections saved");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The autumn edit" })).toHaveCount(0);
});

test("checkout methods and delivery prices follow the settings", async ({ page }) => {
  await page.goto("/admin/settings#checkout");
  const bank = page.locator("form#checkout").getByRole("switch", { name: /bank transfer/ });
  await bank.click();
  await savePanel(page, "checkout", "Checkout saved");

  await page.goto("/admin/settings#delivery");
  const standard = page.locator("form#delivery").getByLabel("Price").first();
  await standard.fill("7");
  await savePanel(page, "delivery", "Delivery options saved");

  await addToBag(page, "canvas-tote");
  await page.goto("/checkout");
  await expect(page.getByRole("radio", { name: /Pay on delivery/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Bank transfer/ })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Standard delivery/ })).toBeVisible();
  await expect(page.locator("label").filter({ hasText: "Standard delivery" })).toContainText("$7");

  await page.goto("/admin/settings#checkout");
  await page.locator("form#checkout").getByRole("switch", { name: /bank transfer/ }).click();
  await savePanel(page, "checkout", "Checkout saved");
  await page.goto("/admin/settings#delivery");
  await page.locator("form#delivery").getByLabel("Price").first().fill("6");
  await savePanel(page, "delivery", "Delivery options saved");
});

test("a WhatsApp number in a national format is refused", async ({ page }) => {
  await page.goto("/admin/settings#contact");
  await page.getByTestId("whatsapp-number").fill("0612");
  await page.locator("form#contact").getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("form#contact")).toContainText("full international number");
});

test("demo products can be removed in one go and brought back", async ({ page }) => {
  await page.goto("/admin/settings#demo");
  await page.getByTestId("remove-demo").click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove demo content" }).click();
  await expectToast(page, /Removed \d+ demo products/);

  await page.goto("/shop");
  await expect(page.locator('a[href^="/products/"]')).toHaveCount(0);

  await page.goto("/admin/settings#demo");
  await page.getByRole("button", { name: "Add demo content" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Add demo content" }).click();
  await expectToast(page, /Added \d+ demo products/);
  await page.goto("/shop");
  await expect(page.locator('a[href^="/products/"]').first()).toBeVisible();
});
