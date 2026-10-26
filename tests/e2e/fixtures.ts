import { expect, type Page } from "@playwright/test";

/**
 * The tests run against a throwaway local store by default. With
 * E2E_BACKEND=supabase they run against the Supabase project in the
 * environment instead, signing in as E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD
 * (see tests/e2e/server.mjs and global-teardown.ts).
 */
export const SUPABASE = process.env.E2E_BACKEND === "supabase";

/** Fictional test owner; the local store and its data folder exist only for one run. */
export const OWNER = SUPABASE
  ? { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" }
  : { email: "owner@example.com", password: "e2e-correct-horse-battery" };
export const SETUP_TOKEN = process.env.E2E_SETUP_TOKEN ?? "e2e-setup-token";
export const STORAGE_STATE = "tests/.artifacts/owner.json";

/** The name every test order is placed under, so a Supabase run can clean up after itself. */
export const TEST_CUSTOMER = "Robin Tester";

/** Ofcom's range for drama: +44 7700 900000–900999 never reaches a real phone. */
export const FICTIONAL_WHATSAPP = "+44 7700 900123";

export const NO_SESSION = { cookies: [], origins: [] };

/** Waits for the dashboard's confirmation toast. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
}

/** Saves one settings panel (the panel is a form with its own Save button). */
export async function savePanel(page: Page, panelId: string, toast: string | RegExp) {
  await page.locator(`form#${panelId}`).getByRole("button", { name: "Save", exact: true }).click();
  await expectToast(page, toast);
}

export async function setWhatsAppNumber(page: Page, number: string) {
  await page.goto("/admin/settings#contact");
  const field = page.getByTestId("whatsapp-number");
  await field.fill(number);
  if (await page.locator("form#contact").getByRole("button", { name: "Save", exact: true }).isEnabled()) {
    await savePanel(page, "contact", "Contact details saved");
  }
}

/** Adds one product to the bag from its page and returns to it. */
export async function addToBag(page: Page, slug: string, options: string[] = []) {
  await page.goto(`/products/${slug}`);
  for (const option of options) {
    await page.getByRole("button", { name: option, exact: true }).click();
  }
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** The page never scrolls sideways. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `page is ${overflow}px wider than the screen`).toBeLessThanOrEqual(0);
}

/** Signs the owner in — creating the account first on a fresh local store. */
export async function signInAsOwner(page: Page) {
  await page.goto("/admin/setup");
  if (page.url().includes("/admin/setup")) {
    await page.getByLabel("Your email").fill(OWNER.email);
    await page.getByLabel("Choose a password").fill(OWNER.password);
    await page.getByLabel("Repeat the password").fill(OWNER.password);
    await page.getByLabel("Setup token").fill(SETUP_TOKEN);
    await page.getByRole("button", { name: "Create owner account" }).click();
  } else {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
  }
  await expect(page).toHaveURL(/\/admin$/);
}

export type Method = "Pay on delivery" | "Bank transfer" | "Order on WhatsApp";

/** Places an order from the current bag and returns its id and number. */
export async function placeOrder(page: Page, method: Method, { name = TEST_CUSTOMER, address = true } = {}) {
  await page.goto("/checkout");
  await page.getByRole("radio", { name: new RegExp(method) }).check();
  await page.getByLabel("Full name").fill(name);
  await page.getByRole("textbox", { name: /^Phone/ }).fill("+44 7700 900456");
  if (address) {
    await page.getByLabel("Street and number").fill("1 Example Street");
    await page.getByLabel("City").fill("Testville");
  }
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}\?key=/);
  return {
    id: page.url().match(/\/orders\/([0-9a-f-]{36})/)![1],
    number: Number((await page.getByText(/Order #\d+/).first().textContent())!.match(/#(\d+)/)![1]),
  };
}
