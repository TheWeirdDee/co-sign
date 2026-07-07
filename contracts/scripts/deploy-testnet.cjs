// Deploys contracts/cosign.clar to Stacks testnet using the throwaway key in
// contracts/deployer-secret.json (gitignored). mock-usdcx is test-only and is
// deliberately NOT deployed.
const fs = require("fs");
const path = require("path");
const {
  makeContractDeploy,
  broadcastTransaction,
  getAddressFromPrivateKey,
} = require("@stacks/transactions");

async function main() {
  const secret = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployer-secret.json"), "utf8")
  );
  const codeBody = fs.readFileSync(
    path.join(__dirname, "..", "contracts", "cosign.clar"),
    "utf8"
  );
  const address = getAddressFromPrivateKey(secret.privateKey, "testnet");

  const transaction = await makeContractDeploy({
    contractName: "cosign",
    codeBody,
    senderKey: secret.privateKey,
    network: "testnet",
    clarityVersion: 3,
    fee: 300000n, // 0.3 STX, generous for a ~12KB contract
  });

  const result = await broadcastTransaction({ transaction, network: "testnet" });
  if (result.error) {
    console.error("BROADCAST FAILED:", JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log("CONTRACT:", `${address}.cosign`);
  console.log("TXID:", result.txid);
  console.log("EXPLORER:", `https://explorer.hiro.so/txid/0x${result.txid}?chain=testnet`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
