// Bridges Sepolia USDC -> Stacks testnet USDCx via Circle xReserve
// (per https://docs.stacks.co/more-guides/bridging-usdcx).
// Needs deployer-secret-evm.json funded with Sepolia ETH (gas) + USDC.
// Usage: node scripts/bridge-usdcx.cjs <stacks-recipient> <usdc-amount>
const fs = require("fs");
const path = require("path");
const { createWalletClient, createPublicClient, http, parseUnits, toHex, pad } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { sepolia } = require("viem/chains");

const X_RESERVE = "0x008888878f94C0d87defdf0B07f46B93C1934442";
const ETH_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const STACKS_DOMAIN = 10003;
const RPC = process.env.RPC_URL || "https://ethereum-sepolia.publicnode.com";

const X_RESERVE_ABI = [
  {
    name: "depositToRemote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "value", type: "uint256" },
      { name: "remoteDomain", type: "uint32" },
      { name: "remoteRecipient", type: "bytes32" },
      { name: "localToken", type: "address" },
      { name: "maxFee", type: "uint256" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [],
  },
];
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
];

// Stacks address -> bytes32: 11 zero bytes | 1 version byte | 20-byte hash160
function stacksRecipientBytes32(stxAddress) {
  const { c32addressDecode } = require("c32check");
  const [version, hash160hex] = c32addressDecode(stxAddress);
  const out = new Uint8Array(32);
  out[11] = version;
  Buffer.from(hash160hex, "hex").forEach((b, i) => (out[12 + i] = b));
  return toHex(out);
}

async function main() {
  const [recipient, amountStr] = process.argv.slice(2);
  if (!recipient || !amountStr) throw new Error("usage: bridge-usdcx.cjs <ST...> <amount>");
  const secret = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployer-secret-evm.json"), "utf8")
  );
  const account = privateKeyToAccount(secret.privateKey);
  const client = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
  const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });

  const eth = await pub.getBalance({ address: account.address });
  const usdc = await pub.readContract({
    address: ETH_USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address],
  });
  console.log(`EVM ${account.address}: ${Number(eth) / 1e18} ETH, ${Number(usdc) / 1e6} USDC`);
  const value = parseUnits(amountStr, 6);
  if (eth === 0n) throw new Error("NO_SEPOLIA_ETH");
  if (usdc < value) throw new Error("NO_SEPOLIA_USDC");

  const remoteRecipient = stacksRecipientBytes32(recipient);
  console.log("remoteRecipient:", remoteRecipient);

  const approveTx = await client.writeContract({
    address: ETH_USDC, abi: ERC20_ABI, functionName: "approve", args: [X_RESERVE, value],
  });
  console.log("approve tx:", approveTx);
  await pub.waitForTransactionReceipt({ hash: approveTx });

  const depositTx = await client.writeContract({
    address: X_RESERVE, abi: X_RESERVE_ABI, functionName: "depositToRemote",
    args: [value, STACKS_DOMAIN, remoteRecipient, ETH_USDC, 0n, "0x"],
  });
  console.log("depositToRemote tx:", depositTx);
  await pub.waitForTransactionReceipt({ hash: depositTx });
  console.log(`Bridged ${amountStr} USDC -> ${recipient}. USDCx mints after attestation (usually a few minutes).`);
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
