import { networkInterfaces } from "node:os";
import { normalizeConnection } from "../plugin/connection.mjs";
function privateIPv4(address) {
  const n = address.split(".").map(Number);
  return (
    n.length === 4 &&
    n.every((x) => Number.isInteger(x) && x >= 0 && x <= 255) &&
    (n[0] === 10 ||
      (n[0] === 192 && n[1] === 168) ||
      (n[0] === 172 && n[1] >= 16 && n[1] <= 31))
  );
}
export function companionConnection({ env = process.env, interfaces } = {}) {
  if (env.FIGMA_XR_COMPANION_URL)
    return normalizeConnection({
      website: env.FIGMA_XR_COMPANION_URL,
      relay: env.FIGMA_XR_RELAY_URL,
      desktopRelay: env.FIGMA_XR_DESKTOP_RELAY_URL,
      kind: "configured",
    });
  // CI/server build interfaces are not addresses a Figma user's phone can use.
  if (env.CI === "true" || env.CI === "1" || env.NODE_ENV === "production")
    return { website: "", relay: "", desktopRelay: "", kind: "unconfigured" };
  if (!interfaces) {
    try {
      interfaces = networkInterfaces();
    } catch {
      interfaces = {};
    }
  }
  const candidates = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (
      /vethernet|vmware|virtualbox|docker|tailscale|wireguard|vpn|loopback|wsl|hyper-v/i.test(
        name,
      )
    )
      continue;
    for (const address of addresses || [])
      if (
        !address.internal &&
        ["IPv4", 4].includes(address.family) &&
        privateIPv4(address.address)
      )
        candidates.push({
          address: address.address,
          priority: /wi-?fi|wlan|airport/i.test(name)
            ? 100
            : /ethernet|^en\d|^eth/i.test(name)
              ? 80
              : 50,
        });
  }
  candidates.sort(
    (a, b) => b.priority - a.priority || a.address.localeCompare(b.address),
  );
  if (!candidates.length)
    return { website: "", relay: "", desktopRelay: "", kind: "unconfigured" };
  const origin = `https://${candidates[0].address}:5173`;
  return normalizeConnection({
    website: origin + "/figma-xr/",
    relay: origin,
    desktopRelay: "http://127.0.0.1:8787",
    kind: "lan",
  });
}
