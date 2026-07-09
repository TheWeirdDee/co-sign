import { FlowVault, isValidAddress, tokenToMicro } from "flowvault-sdk";
import type { ContractCallRequest, NetworkName } from "flowvault-sdk";
import { request } from "@stacks/connect";

// Testnet principals per architecture §0. Env overrides use the OFFICIAL
// FlowVault env schema (NEXT_PUBLIC_FLOWVAULT_*), with our earlier combined
// form and hardcoded fallbacks accepted so the app boots without a .env.local.
const FLOWVAULT_FALLBACK = "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2";
const TOKEN_FALLBACK = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx";

function splitPrincipal(principal: string): [string, string] {
  const [address, name] = principal.split(".");
  if (!address || !name) throw new Error(`Invalid contract principal: ${principal}`);
  return [address, name];
}

const contractAddress =
  process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_ADDRESS ??
  splitPrincipal(process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT ?? FLOWVAULT_FALLBACK)[0];
const contractName =
  process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT_NAME ??
  splitPrincipal(process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT ?? FLOWVAULT_FALLBACK)[1];
const tokenContractAddress =
  process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_ADDRESS ??
  splitPrincipal(process.env.NEXT_PUBLIC_TOKEN_CONTRACT ?? TOKEN_FALLBACK)[0];
const tokenContractName =
  process.env.NEXT_PUBLIC_FLOWVAULT_TOKEN_CONTRACT_NAME ??
  splitPrincipal(process.env.NEXT_PUBLIC_TOKEN_CONTRACT ?? TOKEN_FALLBACK)[1];

export const NETWORK = (process.env.NEXT_PUBLIC_FLOWVAULT_NETWORK ??
  process.env.NEXT_PUBLIC_STACKS_NETWORK ??
  "testnet") as NetworkName;
export const FLOWVAULT_PRINCIPAL = `${contractAddress}.${contractName}`;
export const TOKEN_PRINCIPAL = `${tokenContractAddress}.${tokenContractName}`;

const contracts = { contractAddress, contractName, tokenContractAddress, tokenContractName };

/** Read-only FlowVault client — no keys, safe in any runtime. */
export function flowVaultRead(): FlowVault {
  return new FlowVault({ network: NETWORK, ...contracts });
}

/**
 * Wallet-mode FlowVault client. Writes are delegated to the connected browser
 * wallet via @stacks/connect `stx_callContract` — sender keys never touch the
 * frontend (architecture §0).
 */
export function flowVaultWallet(senderAddress: string): FlowVault {
  return new FlowVault({
    network: NETWORK,
    ...contracts,
    senderAddress,
    postConditionMode: "allow",
    contractCallExecutor: async (call: ContractCallRequest) =>
      request("stx_callContract", {
        contract: `${call.contractAddress}.${call.contractName}`,
        functionName: call.functionName,
        functionArgs: call.functionArgs,
        network: call.network,
        postConditionMode: String(call.postConditionMode ?? "allow")
          .toLowerCase()
          .includes("deny")
          ? "deny"
          : "allow",
        postConditions: call.postConditions,
      }),
  });
}

/** STX principals only — BTC (tb1…) addresses are rejected (architecture §0). */
export function isStxAddress(addr: string): boolean {
  return isValidAddress(addr) && !addr.toLowerCase().startsWith("tb1");
}

/** Any valid principal works as read context before a wallet is connected. */
export const READ_CONTEXT_ADDRESS = contractAddress;

/**
 * Deterministic decimal-string -> micro-units (USDCx has 6 decimals), via the
 * SDK's tokenToMicro. Never parse token amounts with floats.
 */
export function parseTokenAmount(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`Enter a USDCx amount like 10 or 2.5 (max 6 decimals).`);
  }
  return BigInt(tokenToMicro(trimmed));
}

/** Map SDK/contract errors to user-facing guidance (official error names). */
export function friendlyError(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  const msg = e instanceof Error ? e.message : String(e);
  switch (name) {
    case "InvalidAddressError":
      return "That is not a valid STX address — reconnect the wallet and use its STX account (BTC addresses are rejected).";
    case "InvalidAmountError":
      return "Amounts must be positive whole micro-unit values — check the USDCx figure.";
    case "InvalidRoutingRuleError":
      return "Those routing values are invalid — the lock must end in the future and any split needs a recipient.";
    case "ContractCallError": {
      const code = (e as { code?: number }).code;
      const known: Record<number, string> = {
        1002: "Insufficient balance for this amount.",
        1003: "Those funds are still locked — wait for the unlock block.",
        1008: "The lock block must be in the future.",
      };
      return known[code ?? -1] ?? `The contract rejected the call${code ? ` (code ${code})` : ""}.`;
    }
    case "NetworkError":
      return "The Stacks testnet API is rate-limited or briefly unreachable — this is usually not a real failure. Wait about 15 seconds, check the board or explorer for whether it actually went through, then only retry if it didn't (retrying a already-broadcast action risks a duplicate).";
    default:
      return msg;
  }
}
