const loopback = (hostname) =>
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname === "[::1]" ||
  /^127\./.test(hostname);
export function normalizeConnection(input) {
  if (!input || typeof input.website !== "string" || !input.website.trim())
    throw new Error("Set a companion website address.");
  const website = new URL(input.website),
    relay = new URL(input.relay || website.origin),
    desktop = new URL(input.desktopRelay || relay.origin);
  for (const url of [website, relay, desktop])
    if (url.username || url.password || url.search || url.hash)
      throw new Error(
        "Connection addresses cannot contain credentials, queries or fragments.",
      );
  if (website.protocol !== "https:" || relay.protocol !== "https:")
    throw new Error("Use HTTPS addresses for the phone.");
  if (
    desktop.protocol !== "https:" &&
    !(desktop.protocol === "http:" && loopback(desktop.hostname))
  )
    throw new Error(
      "The desktop address must use HTTPS or local loopback HTTP.",
    );
  website.pathname = website.pathname
    .replace(/\/companion\/?$/, "/")
    .replace(/\/?$/, "/");
  return {
    website: website.href,
    relay: relay.origin,
    desktopRelay: desktop.origin,
    kind: input.kind || "configured",
  };
}
export const connectionKey = (connection) =>
  [connection.website, connection.relay, connection.desktopRelay].join("|");
export function chooseConnection(built, saved) {
  let defaults;
  try {
    defaults = normalizeConnection(built);
  } catch {}
  if (
    saved &&
    ((saved.manual === true &&
      saved.buildKey === (defaults ? connectionKey(defaults) : "")) ||
      !defaults)
  ) {
    try {
      return { connection: normalizeConnection(saved), manual: true };
    } catch {}
  }
  if (defaults) return { connection: defaults, manual: false };
  return { connection: null, manual: false };
}
