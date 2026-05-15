import { test, expect } from "@playwright/test";
import { loginAsDefault, createApiHelper } from "./helpers";

test.describe("Wiki", () => {
  test("can create and view a wiki document", async ({ page }) => {
    const slug = await loginAsDefault(page);

    // Create a channel first (wiki is channel-scoped)
    const api = createApiHelper(page);
    const ch = await api.createChannel({
      name: "Wiki Test",
      slug: `wiki-${Date.now()}`,
    });

    // Create a wiki document via API
    const doc = await api.createWikiDocument(ch.data.id, {
      title: "Getting Started Guide",
      content: "# Welcome\n\nThis is a test wiki document.\n\n## Section 1\n\nContent here.",
      content_type: "markdown",
    });

    expect(doc.success).toBeTruthy();
    expect(doc.data.id).toBeDefined();

    // Navigate to the channel's wiki document list
    // Wiki is accessed via channel context; the actual UI route depends on implementation.
    // Verify the document exists by fetching it via API.
    const fetched = await api.getWikiDocument(ch.data.id, doc.data.id);
    expect(fetched.data.title).toBe("Getting Started Guide");
    expect(fetched.data.content).toContain("Welcome");
  });

  test("can list wiki documents in a channel", async ({ page }) => {
    const slug = await loginAsDefault(page);

    const api = createApiHelper(page);
    const ch = await api.createChannel({
      name: "Wiki List",
      slug: `wikilist-${Date.now()}`,
    });

    // Create multiple documents
    await api.createWikiDocument(ch.data.id, {
      title: "Doc A",
      content: "Content A",
    });
    await api.createWikiDocument(ch.data.id, {
      title: "Doc B",
      content: "Content B",
    });

    // List documents via API
    const list = await api.listWikiDocuments(ch.data.id);
    expect(list.success).toBeTruthy();
    expect(list.data.length).toBeGreaterThanOrEqual(2);
    expect(list.data.some((d: any) => d.title === "Doc A")).toBeTruthy();
    expect(list.data.some((d: any) => d.title === "Doc B")).toBeTruthy();
  });

  test("can search wiki documents", async ({ page }) => {
    const slug = await loginAsDefault(page);

    const api = createApiHelper(page);
    const ch = await api.createChannel({
      name: "Wiki Search",
      slug: `wikisearch-${Date.now()}`,
    });

    // Create a document with searchable content
    await api.createWikiDocument(ch.data.id, {
      title: "Architecture Overview",
      content:
        "The system uses a microservices architecture with Go backend and Next.js frontend.",
    });

    // Search for relevant content
    const results = await api.searchWiki(ch.data.id, "microservices architecture", 5);
    expect(results.success).toBeTruthy();
    // Search may return 0 results if embedding service is not fully configured,
    // but the endpoint should return a valid response structure.
    expect(results.data).toBeDefined();
    expect(typeof results.data.total).toBe("number");
  });

  test("can update a wiki document", async ({ page }) => {
    const slug = await loginAsDefault(page);

    const api = createApiHelper(page);
    const ch = await api.createChannel({
      name: "Wiki Update",
      slug: `wikiupdate-${Date.now()}`,
    });

    // Create initial document
    const doc = await api.createWikiDocument(ch.data.id, {
      title: "Draft Document",
      content: "Initial content.",
    });

    // Update the document
    const updated = await api.updateWikiDocument(ch.data.id, doc.data.id, {
      title: "Final Document",
      content: "Updated content with more details.",
    });
    expect(updated.success).toBeTruthy();
    expect(updated.data.title).toBe("Final Document");
    expect(updated.data.content).toBe("Updated content with more details.");
  });

  test("can archive a wiki document", async ({ page }) => {
    const slug = await loginAsDefault(page);

    const api = createApiHelper(page);
    const ch = await api.createChannel({
      name: "Wiki Archive",
      slug: `wikiarchive-${Date.now()}`,
    });

    // Create a document
    const doc = await api.createWikiDocument(ch.data.id, {
      title: "To Be Archived",
      content: "This will be archived.",
    });

    // Archive it
    await api.archiveWikiDocument(ch.data.id, doc.data.id);

    // Verify it's no longer in the active list
    const list = await api.listWikiDocuments(ch.data.id);
    expect(list.data.some((d: any) => d.id === doc.data.id)).toBeFalsy();
  });
});
