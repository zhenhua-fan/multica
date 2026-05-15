import { type Page } from "@playwright/test";
import { TestApiClient } from "./fixtures";

const DEFAULT_E2E_NAME = "E2E User";
const DEFAULT_E2E_EMAIL = "e2e@multica.ai";
const DEFAULT_E2E_WORKSPACE = "e2e-workspace";

/**
 * Log in as the default E2E user and ensure the workspace exists first.
 * Authenticates via API (send-code → DB read → verify-code), then injects
 * the token into localStorage so the browser session is authenticated.
 *
 * Returns the E2E workspace slug so callers can build workspace-scoped URLs.
 */
export async function loginAsDefault(page: Page): Promise<string> {
  const api = new TestApiClient();
  await api.login(DEFAULT_E2E_EMAIL, DEFAULT_E2E_NAME);
  const workspace = await api.ensureWorkspace(
    "E2E Workspace",
    DEFAULT_E2E_WORKSPACE,
  );

  const token = api.getToken();
  await page.goto("/login");
  await page.evaluate((t) => {
    localStorage.setItem("multica_token", t);
  }, token);
  await page.goto(`/${workspace.slug}/issues`);
  await page.waitForURL("**/issues", { timeout: 10000 });
  return workspace.slug;
}

/**
 * Create a TestApiClient logged in as the default E2E user.
 * Call api.cleanup() in afterEach to remove test data created during the test.
 */
export async function createTestApi(): Promise<TestApiClient> {
  const api = new TestApiClient();
  await api.login(DEFAULT_E2E_EMAIL, DEFAULT_E2E_NAME);
  await api.ensureWorkspace("E2E Workspace", DEFAULT_E2E_WORKSPACE);
  return api;
}

export async function openWorkspaceMenu(page: Page) {
  // Click the workspace switcher button (has ChevronDown icon)
  await page.locator("aside button").first().click();
  // Wait for dropdown to appear
  await page.locator('[class*="popover"]').waitFor({ state: "visible" });
}

/**
 * Lightweight API helper for channel/wiki/chat E2E test data setup using page.request.
 * Use this for simple CRUD operations — no DB connection needed.
 */
export function createApiHelper(page: Page) {
  const api = page.request;
  return {
    async createChannel(data: { name: string; slug: string; description?: string }) {
      const res = await api.post("/api/channels", { data });
      return res.json();
    },
    async listChannels() {
      const res = await api.get("/api/channels");
      return res.json();
    },
    async createWikiDocument(channelId: string, data: { title: string; content: string; content_type?: string }) {
      const res = await api.post(`/api/channels/${channelId}/wiki/documents`, { data });
      return res.json();
    },
    async searchWiki(channelId: string, query: string, topK = 5) {
      const res = await api.post(`/api/channels/${channelId}/wiki/search`, { data: { query, top_k: topK, threshold: 0.5 } });
      return res.json();
    },
    async createChatSession(data: { agent_id: string; title?: string }) {
      const res = await api.post("/api/chat/sessions", { data });
      return res.json();
    },
    async sendChatMessage(sessionId: string, content: string) {
      const res = await api.post(`/api/chat/sessions/${sessionId}/messages`, { data: { content } });
      return res.json();
    },
  };
}
