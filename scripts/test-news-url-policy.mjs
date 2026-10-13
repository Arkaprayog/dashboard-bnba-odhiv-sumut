import assert from "node:assert/strict";
import { safeNewsUrl } from "../src/news-url-policy.js";

const allowed = [
  "https://kemkes.go.id/id/berita",
  "https://www.kemkes.go.id/id/berita",
  "https://sumut.antaranews.com/rss/terkini.xml",
  "https://www.antaranews.com/berita/123",
  "https://m.sumut.antaranews.com/berita/123",
];

for (const value of allowed) {
  assert.ok(safeNewsUrl(value), `Expected trusted publisher URL to pass: ${value}`);
}

const blocked = [
  "",
  "not a URL",
  "http://kemkes.go.id/id/berita",
  "javascript:alert(1)",
  "//kemkes.go.id/id/berita",
  "https://kemkes.go.id.evil.example/phishing",
  "https://antaranews.com.evil.example/phishing",
  "https://evil.example/kemkes.go.id",
  "https://user@kemkes.go.id/path",
  "https://kemkes.go.id:8443/path",
  "https://kemkes.go.id./path",
  "https://example.com/",
];

for (const value of blocked) {
  assert.equal(safeNewsUrl(value), "", `Expected unsafe or off-site URL to be blocked: ${value}`);
}

assert.equal(
  safeNewsUrl("https://kemkes.go.id/id/berita?q=1#detail"),
  "https://kemkes.go.id/id/berita?q=1#detail",
);

console.log(`PASS trusted news URL policy: ${allowed.length} allowed cases, ${blocked.length} blocked cases`);
