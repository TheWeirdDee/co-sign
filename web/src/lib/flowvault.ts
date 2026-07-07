import { FlowVault, isValidAddress } from "flowvault-sdk";
import type { ContractCallRequest, NetworkName } from "flowvault-sdk";
import { request } from "@stacks/connect";

// Testnet principals per architecture §0; env overrides, hardcoded fallback so
// the app still boots without a .env.local.
const FLOWVAULT_FALLBACK = "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2";
const TOKEN_FALLBACK = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx";

function splitPrincipal(principal: string): [string, string] {
  const [address, name] = principal.split(".");
  if (!address || !name) throw new Error(`Invalid contract principal: ${principal}`);
  return [address, name];
}

const [contractAddress, contractName] = splitPrincipal(
  process.env.NEXT_PUBLIC_FLOWVAULT_CONTRACT ?? FLOWVAULT_FALLBACK
);
const [tokenContractAddress, tokenContractName] = splitPrincipal(
  process.env.NEXT_PUBLIC_TOKEN_CONTRACT ?? TOKEN_FALLBACK
);

export const NETWORK = (process.env.NEXT_PUBLIC_STACKS_NETWORK ?? "testnet") as NetworkName;
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
