const TRUSTED_NEWS_HOSTS = Object.freeze(["kemkes.go.id", "antaranews.com"]);

/**
 * Return a canonical HTTPS article URL only for the publisher domains that
 * supply this dashboard's RSS feeds. Invalid and off-site URLs are discarded.
 * @param {unknown} value
 * @returns {string}
 */
export function safeNewsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return "";

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const trustedHost = TRUSTED_NEWS_HOSTS.some(
      (base) => hostname === base || hostname.endsWith("." + base),
    );

    if (
      url.protocol !== "https:" ||
      !trustedHost ||
      url.username ||
      url.password ||
      url.port
    ) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}
