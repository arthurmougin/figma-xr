export interface Connection {
  website: string;
  relay: string;
  desktopRelay: string;
  kind: string;
}
export function normalizeConnection(input: unknown): Connection;
export function connectionKey(connection: Connection): string;
export function chooseConnection(
  built: unknown,
  saved: unknown,
): { connection: Connection | null; manual: boolean };
