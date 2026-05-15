import { test, expect } from "@playwright/test";
import { loginAsDefault, createApiHelper } from "./helpers";

test.describe("Channel Conversations", () => {
  test("can navigate to channel conversations page", async ({ page }) => {
    const slug = await loginAsDefault(page);

    // Create a channel via API
    const api = createApiHelper(page);
    const ch = await api.createChannel({
      name: "Chat Channel",
      slug: `chat-${Date.now()}`,
    });

    // Navigate to the channel's conversations page
    await page.goto(`/${slug}/channels/${ch.data.slug}/conversations`);

    // Verify the conversations page loads
    await expect(page.locator("text=Conversations")).toBeVisible({ timeout: 10_000 });

    // The page should show a placeholder with channel context
    await expect(
      page.locator(`text=All conversations in #${ch.data.slug} will appear here`),
    ).toBeVisible();
  });

  test("channel home page shows welcome message", async ({ page }) => {
    const slug = await loginAsDefault(page);

    // Create a channel via API
    const api = createApiHelper(page);
    const ch = await api.createChannel({
      name: "Welcome Channel",
      slug: `welcome-${Date.now()}`,
    });

    // Navigate to the channel home page
    await page.goto(`/${slug}/channels/${ch.data.slug}`);

    // Verify the welcome message
    await expect(page.locator(`text=Welcome to #${ch.data.slug}`)).toBeVisible({
      timeout: 10_000,
    });

    // Should also show hint text about conversations
    await expect(
      page.locator("text=Start a new conversation or browse existing ones below"),
    ).toBeVisible();
  });

  test("conversation detail page shows chat view", async ({ page }) => {
    const slug = await loginAsDefault(page);

    // Create a channel via API
    const api = createApiHelper(page);
    const ch = await api.createChannel({
      name: "Detail Channel",
      slug: `detail-${Date.now()}`,
    });

    // Navigate to a specific conversation
    // The conversation ID doesn't need to exist — the page renders a placeholder
    const fakeConvId = "00000000-0000-0000-0000-000000000000";
    await page.goto(`/${slug}/channels/${ch.data.slug}/conversations/${fakeConvId}`);

    // Verify the conversation header renders
    await expect(page.locator("text=Chat View")).toBeVisible({ timeout: 10_000 });

    // The header should show the conversation ID
    await expect(page.locator(`text=Conversation ${fakeConvId}`)).toBeVisible();
  });

  test("channels index page prompts to select a channel", async ({ page }) => {
    const slug = await loginAsDefault(page);

    // Navigate to the channels index (no channel selected)
    await page.goto(`/${slug}/channels`);

    // Should show the empty/select state
    await expect(page.locator("text=Select a channel")).toBeVisible({ timeout: 10_000 });

    // Should have helpful text
    await expect(
      page.locator(
        "text=Choose a channel from the sidebar to view its conversations",
      ),
    ).toBeVisible();
  });

  test("can create a chat session via API", async ({ page }) => {
    const slug = await loginAsDefault(page);

    const api = createApiHelper(page);

    // Get an agent to use for the chat session
    const agentsRes = await page.request.get("/api/agents");
    const agents = await agentsRes.json();

    // Skip if no agents are available
    if (!Array.isArray(agents) || agents.length === 0) {
      test.skip(true, "No agents available for chat session creation");
      return;
    }

    const agentId = agents[0].id;

    // Create a chat session
    const session = await api.createChatSession({
      agent_id: agentId,
      title: "E2E Test Chat",
    });

    expect(session.id || session.data?.id).toBeDefined();

    // Send a message
    const sessionId = session.id || session.data?.id;
    const msg = await api.sendChatMessage(sessionId, "Hello from E2E test!");

    expect(msg.id || msg.data?.id).toBeDefined();
  });
});
