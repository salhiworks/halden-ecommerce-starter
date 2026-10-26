import { expect, test as setup } from "@playwright/test";
import { OWNER, SETUP_TOKEN, signInAsOwner, STORAGE_STATE, SUPABASE } from "./fixtures";

/**
 * First run of a fresh store: the dashboard sends you to set up the owner
 * account, which in production needs the server's setup token.
 */
setup("create the owner account with the setup token", async ({ page }) => {
  if (SUPABASE) {
    // A Supabase store already has its admin: sign in.
    await signInAsOwner(page);
    await page.context().storageState({ path: STORAGE_STATE });
    return;
  }
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/(login|setup)/);

  await page.goto("/admin/setup");
  const fill = async (token: string) => {
    await page.getByLabel("Your email").fill(OWNER.email);
    await page.getByLabel("Choose a password").fill(OWNER.password);
    await page.getByLabel("Repeat the password").fill(OWNER.password);
    await page.getByLabel("Setup token").fill(token);
    await page.getByRole("button", { name: "Create owner account" }).click();
  };

  await fill("not-the-token");
  await expect(page.getByRole("alert").filter({ hasText: "setup token is not correct" })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/setup/);

  await fill(SETUP_TOKEN);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hello");

  await page.context().storageState({ path: STORAGE_STATE });
});
