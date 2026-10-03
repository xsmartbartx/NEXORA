import { createPublicKey, generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseReport, parseServiceAccount, signAssertion } from "./analytics";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64");

describe("parseServiceAccount", () => {
  it("reads a base64-encoded key", () => {
    const account = parseServiceAccount(
      encode({ client_email: "reader@x.iam.gserviceaccount.com", private_key: privateKey }),
    );
    expect(account.client_email).toBe("reader@x.iam.gserviceaccount.com");
  });

  it("rejects text that isn't base64 JSON, and a key missing its fields", () => {
    expect(() => parseServiceAccount("not json")).toThrow(/base64-encoded JSON/);
    expect(() => parseServiceAccount(encode({ client_email: "a" }))).toThrow(/missing/);
  });
});

describe("signAssertion", () => {
  it("produces a JWT whose signature verifies against the public key", () => {
    const jwt = signAssertion(
      { client_email: "reader@x.iam.gserviceaccount.com", private_key: privateKey },
      1_000,
    );
    const [header, claims, signature] = jwt.split(".") as [string, string, string];

    const verifier = createVerify("RSA-SHA256").update(`${header}.${claims}`);
    expect(verifier.verify(createPublicKey(publicKey), Buffer.from(signature, "base64url"))).toBe(
      true,
    );

    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toMatchObject({
      iss: "reader@x.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_000,
      exp: 4_600,
    });
  });
});

describe("parseReport", () => {
  it("maps the two date ranges by the dimension GA4 adds", () => {
    const summary = parseReport({
      rows: [
        {
          dimensionValues: [{ value: "date_range_1" }],
          metricValues: [{ value: "300" }, { value: "450" }, { value: "250" }],
        },
        {
          dimensionValues: [{ value: "date_range_0" }],
          metricValues: [{ value: "80" }, { value: "110" }, { value: "60" }],
        },
      ],
    });
    expect(summary.last7d).toEqual({ users: 80, sessions: 110, newUsers: 60 });
    expect(summary.last30d).toEqual({ users: 300, sessions: 450, newUsers: 250 });
  });

  it("treats a response with no rows as zero traffic, not an error", () => {
    expect(parseReport({}).last7d).toEqual({ users: 0, sessions: 0, newUsers: 0 });
  });

  it("throws on something that isn't a report", () => {
    expect(() => parseReport(null)).toThrow(/unexpected/);
  });
});
