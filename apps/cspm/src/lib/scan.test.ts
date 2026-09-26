import { describe, expect, it } from "vitest";
import { parseResourcesInput, scanResources } from "./scan";

const rules = (resources: Parameters<typeof scanResources>[0]) =>
  scanResources(resources).findings.map((f) => `${f.severity}:${f.rule}`);

describe("scanResources", () => {
  it("flags public and unencrypted buckets, passes a clean one", () => {
    expect(rules([{ type: "s3_bucket", name: "b", public_read: true, encrypted: false }])).toEqual([
      "critical:s3-public-read",
      "warning:s3-unencrypted",
    ]);
    expect(rules([{ type: "s3_bucket", name: "b", public_read: false, encrypted: true }])).toEqual(
      [],
    );
  });

  it("distinguishes sensitive ports from other open ingress", () => {
    expect(
      rules([
        {
          type: "security_group",
          name: "sg",
          ingress: [
            { port: 22, cidr: "0.0.0.0/0" },
            { port: 443, cidr: "0.0.0.0/0" },
            { port: 5432, cidr: "10.0.0.0/16" },
          ],
        },
      ]),
    ).toEqual(["critical:sg-open-sensitive-port", "warning:sg-open-ingress"]);
  });

  it("grades IAM wildcards", () => {
    expect(rules([{ type: "iam_policy", name: "p", actions: ["*"], resources: ["*"] }])).toEqual([
      "critical:iam-wildcard-admin",
    ]);
    expect(
      rules([{ type: "iam_policy", name: "p", actions: ["*"], resources: ["arn:x"] }]),
    ).toEqual(["warning:iam-wildcard-action"]);
    expect(
      rules([{ type: "iam_policy", name: "p", actions: ["s3:GetObject"], resources: ["*"] }]),
    ).toEqual([]);
  });

  it("flags public and unencrypted databases", () => {
    expect(
      rules([{ type: "database", name: "db", publicly_accessible: true, encrypted: false }]),
    ).toEqual(["critical:db-public", "warning:db-unencrypted"]);
  });

  it("counts but ignores unknown resource types", () => {
    const result = scanResources([{ type: "lambda", name: "fn" }]);
    expect(result).toEqual({ totalResources: 1, findings: [] });
  });
});

describe("parseResourcesInput", () => {
  it("accepts a bare array or a { resources } wrapper", () => {
    const item = { type: "s3_bucket", name: "b" };
    expect(parseResourcesInput(JSON.stringify([item]))).toEqual([item]);
    expect(parseResourcesInput(JSON.stringify({ resources: [item] }))).toEqual([item]);
  });

  it("rejects invalid input with a clear message", () => {
    expect(() => parseResourcesInput("{not json")).toThrow("Not valid JSON.");
    expect(() => parseResourcesInput('{"foo": 1}')).toThrow(/Expected a JSON array/);
    expect(() => parseResourcesInput('[{"type": "s3_bucket"}]')).toThrow(/index 0/);
  });
});
