// Polls the client wallet's USDCx balance until the xReserve attestation mints.
// Usage: node scripts/wait-usdcx.cjs [address] [minMicro]
const { fetchCallReadOnlyFunction, Cl } = require("@stacks/transactions");

const addr = process.argv[2] ?? "ST331V7SY253DWZHXM8BKZZ0SYHXX4XV17QXQ1MXF";
const min = BigInt(process.argv[3] ?? "1000000");

async function balance() {
  const r = await fetchCallReadOnlyFunction({
    contractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    contractName: "usdcx",
    functionName: "get-balance",
    functionArgs: [Cl.principal(addr)],
    network: "testnet",
    senderAddress: addr,
  });
  return BigInt(r.value.value);
}

(async () => {
  for (let i = 1; i <= 90; i++) {
    try {
      const b = await balance();
      console.log(`check ${i}: ${Number(b) / 1e6} USDCx`);
      if (b >= min) {
        console.log("USDCX_MINTED");
        return;
      }
    } catch (e) {
      console.log(`check ${i}: network error (${e.cause?.code ?? e.message}), retrying`);
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
  console.log("TIMEOUT");
  process.exit(1);
})();
