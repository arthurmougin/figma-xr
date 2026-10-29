export const FIGMA_SCOPES = ["current_user:read", "file_content:read"];
const PENDING_KEY = "figma-xr:oauth-pending";
const PENDING_TTL = 10 * 60 * 1000;

export interface PendingAuthorization {
	state: string;
	verifier: string;
	redirectUri: string;
	createdAt: number;
}

export interface FigmaTokens {
	access_token: string;
	refresh_token: string;
	expires_at: number;
}

function base64url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function beginAuthorization(
	clientId: string, redirectUri: string, storage: Storage,
): Promise<string> {
	if (!clientId) throw new Error("Figma sign-in is not configured yet.");
	const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
	const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
	const challenge = base64url(new Uint8Array(
		await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
	));
	const pending: PendingAuthorization = { state, verifier, redirectUri, createdAt: Date.now() };
	storage.setItem(PENDING_KEY, JSON.stringify(pending));
	const url = new URL("https://www.figma.com/oauth");
	url.search = new URLSearchParams({
		client_id: clientId, redirect_uri: redirectUri,
		scope: FIGMA_SCOPES.join(" "), state, response_type: "code",
		code_challenge: challenge, code_challenge_method: "S256",
	}).toString();
	return url.href;
}

export function consumeAuthorization(state: string, storage: Storage): PendingAuthorization {
	const raw = storage.getItem(PENDING_KEY);
	storage.removeItem(PENDING_KEY);
	let pending: PendingAuthorization | undefined;
	try { pending = raw ? JSON.parse(raw) : undefined; } catch { /* invalid session */ }
	if (!state || !pending || pending.state !== state ||
		!pending.verifier || !pending.redirectUri ||
		!Number.isFinite(pending.createdAt) || pending.createdAt > Date.now() ||
		Date.now() - pending.createdAt > PENDING_TTL) {
		throw new Error("This sign-in request has expired or is invalid. Please connect to Figma again.");
	}
	return pending;
}

export function clearAuthorization(storage: Storage): void {
	storage.removeItem(PENDING_KEY);
}

export function normalizeTokens(data: unknown, previousRefreshToken?: string | null): FigmaTokens {
	const value = data as Record<string, unknown> | null;
	const expiresIn = Number(value?.expires_in);
	const refreshToken = value?.refresh_token ?? previousRefreshToken;
	if (!value || typeof value.access_token !== "string" || !value.access_token ||
		typeof refreshToken !== "string" || !refreshToken ||
		!Number.isFinite(expiresIn) || expiresIn <= 0) {
		throw new Error("Figma returned an invalid token response. Please connect again.");
	}
	return { access_token: value.access_token, refresh_token: refreshToken,
		expires_at: Date.now() + expiresIn * 1000 };
}

export class OAuthRequestError extends Error {
	status: number;
	constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function requestTokens(
	endpoint: string, payload: Record<string, string>, fetcher: typeof fetch = fetch,
): Promise<unknown> {
	let response: Response;
	try {
		response = await fetcher(endpoint, {
			method: "POST", headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload), cache: "no-store", credentials: "omit",
		});
	} catch {
		throw new OAuthRequestError("Unable to reach Figma sign-in. Please try again later.", 0);
	}
	if (!response.ok) {
		throw new OAuthRequestError(
			response.status === 400 || response.status === 401
				? "Figma could not authorize this session. Please connect again."
				: "Figma sign-in is temporarily unavailable. Please try again later.",
			response.status,
		);
	}
	try { return await response.json(); } catch {
		throw new OAuthRequestError("Figma sign-in returned an invalid response.", 502);
	}
}

// Retry authentication failures once. Permissions, quotas and network errors
// must never start a refresh/retry loop.
export async function fetchWithToken(
	url: string, getToken: () => Promise<string>, refresh: () => Promise<void>,
	fetcher: typeof fetch = fetch,
): Promise<Response> {
	const send = async () => fetcher(url, {
		headers: { Authorization: `Bearer ${await getToken()}` },
	});
	let response = await send();
	if (response.status === 401) {
		await refresh();
		response = await send();
	}
	if (!response.ok) {
		const message = response.status === 429
			? "Figma's API rate limit has been reached. Please try again later."
			: response.status === 403
				? "Figma denied access. Check file sharing and the app's OAuth permissions."
				: `Figma request failed (${response.status}).`;
		throw new Error(message);
	}
	return response;
}
