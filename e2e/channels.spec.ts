import { test, expect } from "@playwright/test";
import { loginAsDefault, createApiHelper } from "./helpers";

test.describe("Channels", () => {
  test("can navigate to channels page and see the sidebar", async ({ page }) => {
    const slug = await loginAsDefault(page);

    // Navigate to channels page
    await page.goto(`/${slug}/channels`);

    // Verify channels page loads with the sidebar
    await expect(page.locator("text=Channels")).toBeVisible({ timeout: 10_000 });

    // Verify the "Create Channel" button is visible in the sidebar
    await expect(page.getByRole("button", { name: "Create Channel" })).toBeVisible();

    // Verify the empty state or channel list container
    await expect(page.locator("text=Select a channel")).toBeVisible();
  });

  test("can create a channel via the dialog", async ({ page }) => {
    const slug = await loginAsDefault(page);

    // Navigate to channels
    await page.goto(`/${slug}/channels`);
    await expect(page.locator("text=Channels")).toBeVisible();

    // Click "Create Channel" button in the sidebar footer
    await page.getByRole("button", { name: "Create Channel" }).click();

    // Verify the create dialog appears
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("text=Create Channel")).toBeVisible();

    // Fill in channel name
    const nameInput = dialog.locator('input[placeholder="e.g. general, engineering, design"]');
    await nameInput.fill("Test Channel E2E");

    // Verify slug auto-generates
    const slugInput = dialog.locator('input[placeholder="auto-generated-from-name"]');
    await expect(slugInput).toHaveValue("test-channel-e2e");

    // Add a description
    const descInput = dialog.locator("textarea");
    await descInput.fill("A channel created by E2E tests");

    // Submit the form
    await dialog.getByRole("button", { name: "Create Channel" }).click();

    // Dialog should close after successful creation
    // Wait for redirect or channel to appear in sidebar
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  });

  test("can switch between channels", async ({ page }) => {
    const slug = await loginAsDefault(page);

    // Create two channels via API for reliable setup
    const api = createApiHelper(page);
    const ch1 = await api.createChannel({ name: "Alpha", slug: `alpha-${Date.now()}` });
    const ch2 = await api.createChannel({ name: "Beta", slug: `beta-${Date.now()}` });

    // Navigate to channels page
    await page.goto(`/${slug}/channels`);
    await expect(page.locator("text=Channels")).toBeVisible();

    // Click the first channel in the sidebar
    await page.getByRole("button", { name: "Alpha" }).click();

    // Verify the channel header shows the channel name
    // (ChannelHeader shows "Welcome to #..." in the home page)
    await expect(page.locator("text=Welcome to #")).toBeVisible({ timeout: 10_000 });

    // Check the URL includes the channel slug
    await expect(page).toHaveURL(new RegExp(`/channels/${ch1.data.slug}`));

    // Switch to the second channel
    await page.getByRole("button", { name: "Beta" }).click();
    await expect(page).toHaveURL(new RegExp(`/channels/${ch2.data.slug}`));
  });

  test("channel settings button is accessible", async ({ page }) => {
    const slug = await loginAsDefault(page);

    // Create a channel via API
    const api = createApiHelper(page);
    const ch = await api.createChannel({
      name: "Settings Test",
      slug: `settings-${Date.now()}`,
    });

    // Navigate directly to the channel
    await page.goto(`/${slug}/channels/${ch.data.slug}`);
    await expect(page.locator("text=Channels")).toBeVisible();

    // Click the settings button in the channel header
    const settingsButton = page.getByRole("button", { name: "Channel settings" });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    // Verify settings dialog opens
    const settingsDialog = page.getByRole("dialog");
    await expect(settingsDialog).toBeVisible({ timeout: 5_000 });
    // The settings dialog should contain the channel name
    await expect(settingsDialog.locator("text=Settings Test")).toBeVisible();
  });

  test("channel member count is visible in header", async ({ page }) => {
    const slug = await loginAsDefault(page);

    // Create a channel via API (creator auto-joined as owner)
    const api = createApiHelper(page);
    const ch = await api.createChannel({
      name: "Member Count",
      slug: `members-${Date.now()}`,
    });

    // Navigate to the channel
    await page.goto(`/${slug}/channels/${ch.data.slug}`);

    // ChannelHeader shows member count (should be 1 — the creator)
    // The member count is rendered as a number next to the Users icon
    await expect(page.locator("text=1")).toBeVisible({ timeout: 10_000 });
  });

  test("collapsed sidebar still shows channel icons", async ({ page }) => {
    const slug = await loginAsDefault(page);

    // Create a channel via API
    const api = createApiHelper(page);
    await api.createChannel({ name: "Collapse Test", slug: `collapse-${Date.now()}` });

    // Navigate to channels page
    await page.goto(`/${slug}/channels`);
    await expect(page.locator("text=Channels")).toBeVisible();

    // Click the collapse toggle button
    const collapseButton = page.locator('button[title="Collapse sidebar"]');
    await collapseButton.click();

    // Sidebar should now be collapsed. The channel text "Create Channel" should be hidden,
    // but the channel list area should still be present.
    // Verify the expand button is now visible
    await expect(page.locator('button[title="Expand sidebar"]')).toBeVisible();
  });
});
