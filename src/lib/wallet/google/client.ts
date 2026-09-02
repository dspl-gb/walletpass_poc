import "server-only";

import { invalidCredentials, providerError } from "@/lib/wallet/common/errors";

import { getGoogleAccessToken, requireGoogleConfig } from "./auth";

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";

export interface WalletApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  body?: unknown;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function walletApi<T>(path: string, options: WalletApiOptions = {}): Promise<T> {
  requireGoogleConfig();
  const token = await getGoogleAccessToken();
  const method = options.method ?? "GET";

  let response: Response;
  try {
    response = await fetch(`${WALLET_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw providerError("Google Wallet is temporarily unavailable. Please try again in a moment.", error);
  }

  const payload = await parseBody(response);

  if (response.status === 401 || response.status === 403) {
    throw invalidCredentials(
      "Google Wallet rejected the configured service account. Please contact support.",
      { status: response.status, payload },
    );
  }

  if (!response.ok) {
    const error = new WalletHttpError(response.status, payload);
    throw error;
  }

  return payload as T;
}

export class WalletHttpError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`Google Wallet API returned ${status}`);
    this.name = "WalletHttpError";
    this.status = status;
    this.payload = payload;
  }
}

export function isWalletHttpError(error: unknown): error is WalletHttpError {
  return error instanceof WalletHttpError;
}
