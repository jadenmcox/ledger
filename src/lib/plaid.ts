import "server-only";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const env = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
  // Don't crash at import time — only fail when the routes actually run.
  // This lets the app boot for users who haven't set up Plaid yet.
}

const config = new Configuration({
  basePath: PlaidEnvironments[env] ?? PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
      "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
    },
  },
});

export const plaid = new PlaidApi(config);

export const PLAID_PRODUCTS = ["transactions"] as const;
export const PLAID_COUNTRY_CODES = ["US"] as const;
