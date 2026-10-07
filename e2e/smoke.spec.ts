import { expect, test } from "@playwright/test";

const domain = process.env.E2E_DOMAIN ?? "onenexora.com";
const url = (sub: string, path = "/") => `https://${sub ? `${sub}.` : ""}${domain}${path}`;

const nexoraHosts = [
  "",
  "account",
  "console",
  "status",
  "api",
  "docs",
  "developers",
  "sentinel",
  "cspm",
  "gateway",
];

test.describe("F01 public site", () => {
  for (const path of [
    "/",
    "/platform",
    "/products",
    "/pricing",
    "/marketplace",
    "/legal/privacy",
  ]) {
    test(`F01-H ${path} renders`, async ({ request }) => {
      const res = await request.get(url("", path));
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/html");
    });
  }

  test("F01-N unknown page is a 404", async ({ request }) => {
    expect((await request.get(url("", "/definitely-not-a-page"))).status()).toBe(404);
  });

  test("security.txt is published", async ({ request }) => {
    const res = await request.get(url("", "/.well-known/security.txt"));
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("Contact:");
  });
});

test.describe("authenticated surfaces reject anonymous visitors", () => {
  for (const [sub, path] of [
    ["console", "/billing"],
    ["console", "/api-keys"],
    ["console", "/admin"],
    ["account", "/organizations"],
    ["sentinel", "/app"],
  ]) {
    test(`F01-N ${sub}${path} redirects to sign-in`, async ({ request }) => {
      const res = await request.get(url(sub, path), { maxRedirects: 0 });
      expect([302, 307]).toContain(res.status());
    });
  }
});

test.describe("F03/F04 API key rejection", () => {
  test("F03-N no key", async ({ request }) => {
    const res = await request.get(url("api", "/v1/products"));
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe("missing_api_key");
  });

  test("F03-N bogus key", async ({ request }) => {
    const res = await request.get(url("api", "/v1/products"), {
      headers: { authorization: "Bearer nx_live_bogus" },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe("invalid_api_key");
  });

  test("F04-N gateway without a key", async ({ request }) => {
    const res = await request.post(url("gateway", "/v1/chat"), { data: {} });
    expect(res.status()).toBe(401);
  });
});

test.describe("F05 webhooks verify signatures", () => {
  test("F05-N stripe rejects a bad signature", async ({ request }) => {
    const res = await request.post(url("api", "/v1/webhooks/stripe"), {
      data: "{}",
      headers: { "stripe-signature": "t=1,v1=bad" },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe("invalid_signature");
  });

  test("F05-N clerk rejects an unsigned call", async ({ request }) => {
    const res = await request.post(url("api", "/v1/webhooks/clerk"), { data: "{}" });
    expect(res.status()).toBe(401);
  });

  test("F05-N vigilo plan sync rejects an unsigned call", async ({ request }) => {
    const res = await request.post(url("vigilo-api", "/v1/internal/org-plan"), { data: {} });
    expect(res.status()).toBe(401);
  });
});

test.describe("B-001 security headers", () => {
  for (const sub of nexoraHosts) {
    test(`${sub || "website"} sends baseline security headers`, async ({ request }) => {
      // Judge the host's own response: account redirects to Clerk's domain, which we don't control.
      const res = await request.get(url(sub, sub === "api" ? "/v1/health" : "/"), {
        maxRedirects: 0,
      });
      const h = res.headers();
      expect(h["strict-transport-security"]).toMatch(/max-age=\d{7,}/);
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["referrer-policy"]).toBeTruthy();
      expect(h["x-powered-by"]).toBeUndefined();
    });
  }
});

test.describe("canonical host and social card", () => {
  test("www redirects to the apex and keeps the path", async ({ request }) => {
    const res = await request.get(url("www", "/pricing?x=1"), { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toBe(`https://${domain}/pricing?x=1`);
  });

  test("the home page has a large social card that resolves to an image", async ({ request }) => {
    const html = await (await request.get(url(""))).text();
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    const og = html.match(/property="og:image" content="([^"]+)"/)?.[1];
    expect(og).toBeTruthy();
    const img = await request.get(og!);
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toContain("image/png");
  });
});
