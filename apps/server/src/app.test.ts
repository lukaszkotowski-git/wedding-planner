import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { injectOg } from "./spa";

describe("app", () => {
  const app = createApp();

  it("responds to health check", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  it("requires auth for weddings", async () => {
    const res = await request(app).get("/api/weddings");
    expect(res.status).toBe(401);
  });
});

describe("injectOg", () => {
  it("escapes values and replaces the title", () => {
    const html = injectOg("<head><title>X</title><!--app-head--></head>", {
      title: 'Ania & "Tom"',
      description: "12 czerwca 2027",
      url: "https://x/w/a",
    });
    expect(html).not.toContain("<title>X</title>");
    expect(html).toContain("<title>Ania &#38; &#34;Tom&#34;</title>");
    expect(html).toContain('property="og:url" content="https://x/w/a"');
  });
});
