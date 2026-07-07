import { beforeEach, describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";
import { readFileSync } from "node:fs";

// Tests 1-10 are the architecture sec.7 checklist; 11-13 cover the
// coordinator-owned vault specifics (deferred disbursement under overlapping
// locks, and unbacked-job resolution).
//
// They run against the REAL flowvault-v2 source (pulled as a Clarinet
// requirement from testnet, deployed in simnet at its real principal). The
// role-gated usdcx token is replaced by an open-mint mock deployed AT THE REAL
// usdcx PRINCIPAL so cosign's token pinning is exercised.

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const client = accounts.get("wallet_1")!;
const newcomer = accounts.get("wallet_2")!;
const backer = accounts.get("wallet_3")!;
const newcomer2 = accounts.get("wallet_4")!;

const FLOWVAULT = "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2";
const USDCX_DEPLOYER = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
const USDCX = `${USDCX_DEPLOYER}.usdcx`;
const COSIGN = "cosign";
const cosignPrincipal = `${deployer}.cosign`;
const token = () => Cl.contractPrincipal(USDCX_DEPLOYER, "usdcx");

// Deploy the open-mint mock at the real usdcx principal (cosign pins this
// exact token contract; the real one's mint is role-gated). The simnet resets
// between tests, so redeploy before each.
beforeEach(() => {
  simnet.deployContract(
    "usdcx",
    readFileSync("contracts/mock-usdcx.clar", "utf8"),
    { clarityVersion: 3 },
    USDCX_DEPLOYER
  );
});

const JOB_VALUE = 1_000_000; // 1.0 USDCx in micro-units
const ESCROW = 1_020_000; // job-value + 2% reward pool
const STAKE_FLOOR = 200_000; // exactly 20%
const REWARD = 20_000; // 2% of job value

// error codes from cosign.clar
const ERR_STAKE_BELOW_FLOOR = 104;
const ERR_DEADLINE_NOT_REACHED = 107;
const ERR_ALREADY_RESOLVED = 108;
const ERR_STILL_LOCKED = 112;

function height(): number {
  return simnet.stacksBlockHeight;
}

function mint(to: string, amount: number) {
  const res = simnet.callPublicFn(
    USDCX,
    "mint",
    [Cl.uint(amount), Cl.principal(to)],
    deployer
  );
  expect(res.result).toBeOk(Cl.bool(true));
}

function balance(who: string): bigint {
  const res = simnet.callReadOnlyFn(USDCX, "get-balance", [Cl.principal(who)], deployer);
  return (res.result as any).value.value;
}

function createJob(deadline: number, who = newcomer, by = client): bigint {
  mint(by, ESCROW);
  const res = simnet.callPublicFn(
    COSIGN,
    "create-job",
    [Cl.principal(who), Cl.uint(JOB_VALUE), Cl.uint(deadline), token()],
    by
  );
  expect(res.result.type).toBe("ok");
  return (res.result as { value: { value: bigint } }).value.value;
}

function coSign(jobId: bigint, stake: number, fund = true) {
  if (fund) mint(backer, stake);
  return simnet.callPublicFn(
    COSIGN,
    "co-sign",
    [Cl.uint(jobId), Cl.uint(stake), token()],
    backer
  );
}

function readTerms(jobId: bigint) {
  return simnet.callReadOnlyFn(COSIGN, "read-terms", [Cl.uint(jobId)], client);
}

function resolve(jobId: bigint, sender: string = deployer) {
  return simnet.callPublicFn(COSIGN, "resolve", [Cl.uint(jobId), token()], sender);
}

function getJob(jobId: bigint) {
  return simnet.callReadOnlyFn(COSIGN, "get-job", [Cl.uint(jobId)], client);
}

function jobField(jobId: bigint, field: string): any {
  const res = getJob(jobId);
  const cv = (res.result as any).value.value[field];
  if (cv.type === "true") return true;
  if (cv.type === "false") return false;
  return cv.value;
}

// Open a job and co-sign it (stake moves into the coordinator-owned vault).
function backedJob(
  deadlineOffset = 60,
  stake = STAKE_FLOOR,
  who = newcomer
): { jobId: bigint; deadline: number } {
  const deadline = height() + deadlineOffset;
  const jobId = createJob(deadline, who);
  const res = coSign(jobId, stake);
  expect(res.result).toBeOk(Cl.bool(true));
  return { jobId, deadline };
}

// Newcomer deposits job-value into their OWN vault per read-terms, then the
// permissionless funding snapshot is recorded.
function newcomerCompletesFunding(jobId: bigint, who = newcomer) {
  const terms = readTerms(jobId);
  const t = (terms.result as any).value.value;
  const lockUntil = Number(t["lock-until-block"].value);
  mint(who, JOB_VALUE);
  const rules = simnet.callPublicFn(
    FLOWVAULT,
    "set-routing-rules",
    [Cl.uint(JOB_VALUE), Cl.uint(lockUntil), Cl.none(), Cl.uint(0)],
    who
  );
  expect(rules.result).toBeOk(Cl.bool(true));
  const dep = simnet.callPublicFn(FLOWVAULT, "deposit", [token(), Cl.uint(JOB_VALUE)], who);
  expect(dep.result.type).toBe("ok");
  const conf = simnet.callPublicFn(COSIGN, "confirm-funding", [Cl.uint(jobId)], deployer);
  expect(conf.result).toBeOk(Cl.bool(true));
}

function mineUntil(block: number) {
  const delta = block - height();
  if (delta > 0) simnet.mineEmptyBlocks(delta);
}

describe("cosign.clar -- architecture sec.7 checklist (coordinator-owned vault)", () => {
  it("1. create-job creates an 'open' job with correct fields and escrows 102%", () => {
    const deadline = height() + 100;
    const clientBefore = balance(client);
    mint(client, ESCROW);
    const res = simnet.callPublicFn(
      COSIGN,
      "create-job",
      [Cl.principal(newcomer), Cl.uint(JOB_VALUE), Cl.uint(deadline), token()],
      client
    );
    expect(res.result.type).toBe("ok");
    const jobId = (res.result as any).value.value as bigint;
    const createdAt = height();
    expect(getJob(jobId).result).toBeSome(
      Cl.tuple({
        client: Cl.principal(client),
        newcomer: Cl.principal(newcomer),
        backer: Cl.none(),
        "job-value": Cl.uint(JOB_VALUE),
        "stake-amount": Cl.uint(0),
        "escrow-amount": Cl.uint(ESCROW),
        "deadline-block": Cl.uint(deadline),
        status: Cl.stringAscii("open"),
        funded: Cl.bool(false),
        "backed-block": Cl.uint(createdAt),
        disbursed: Cl.bool(false),
      })
    );
    // escrow left the client and sits locked in the coordinator's vault
    expect(balance(client)).toBe(clientBefore);
    const vault = simnet.callReadOnlyFn(
      FLOWVAULT,
      "get-vault-state",
      [Cl.principal(cosignPrincipal)],
      client
    );
    const vs = (vault.result as any).value;
    expect(vs["locked-balance"].value).toBeGreaterThanOrEqual(BigInt(ESCROW));
  });

  it("2. co-sign with stake = exactly 20% succeeds and locks the stake in the coordinator vault", () => {
    const { jobId } = backedJob(60);
    expect(jobField(jobId, "status")).toBe("backed");
    expect(jobField(jobId, "stake-amount")).toBe(BigInt(STAKE_FLOOR));
    // the stake physically left the backer -- no cooperating-wallet assumption
    expect(balance(backer)).toBe(0n);
  });

  it("3. co-sign with stake = 19.9% rejects (floor enforced in contract)", () => {
    const deadline = height() + 60;
    const jobId = createJob(deadline);
    const res = coSign(jobId, 199_000); // 19.9% of 1_000_000
    expect(res.result).toBeErr(Cl.uint(ERR_STAKE_BELOW_FLOOR));
    expect(jobField(jobId, "status")).toBe("open");
  });

  it("4. read-terms unbacked returns full-lock params", () => {
    const deadline = height() + 100;
    const jobId = createJob(deadline);
    expect(readTerms(jobId).result).toBeOk(
      Cl.tuple({
        "lock-amount": Cl.uint(JOB_VALUE),
        "lock-until-block": Cl.uint(deadline),
        "split-address": Cl.none(),
        "split-amount": Cl.uint(0),
      })
    );
  });

  it("5. read-terms backed returns shortened lock-until, unchanged lock-amount", () => {
    const { jobId, deadline } = backedJob(100);
    const now = height();
    // reduction = remaining * (stake/job-value = 0.2) * (IMPROVEMENT_FACTOR = 0.5)
    const remaining = deadline - now;
    const expectedReduction = Math.floor((remaining * STAKE_FLOOR * 50) / (JOB_VALUE * 100));
    expect(expectedReduction).toBeGreaterThan(0);
    expect(readTerms(jobId).result).toBeOk(
      Cl.tuple({
        "lock-amount": Cl.uint(JOB_VALUE), // unchanged -- improvement is timing only
        "lock-until-block": Cl.uint(deadline - expectedReduction),
        "split-address": Cl.none(),
        "split-amount": Cl.uint(0),
      })
    );
  });

  it("6. resolve before deadline rejects", () => {
    const { jobId } = backedJob(60);
    expect(resolve(jobId).result).toBeErr(Cl.uint(ERR_DEADLINE_NOT_REACHED));
    expect(jobField(jobId, "status")).toBe("backed");
  });

  it("7. resolve at deadline, newcomer completed -> newcomer paid, stake + 2% to backer, 'settled'", () => {
    const { jobId, deadline } = backedJob(60);
    newcomerCompletesFunding(jobId);
    const newcomerBefore = balance(newcomer);
    const backerBefore = balance(backer);
    const clientBefore = balance(client);
    mineUntil(deadline);
    expect(resolve(jobId).result).toBeOk(Cl.stringAscii("settled"));
    expect(jobField(jobId, "status")).toBe("settled");
    expect(jobField(jobId, "disbursed")).toBe(true);

    // real token movements, not routing intentions:
    expect(balance(newcomer) - newcomerBefore).toBe(BigInt(JOB_VALUE));
    expect(balance(backer) - backerBefore).toBe(BigInt(STAKE_FLOOR + REWARD));
    expect(balance(client)).toBe(clientBefore);
    expect(balance(cosignPrincipal)).toBe(0n); // nothing sticks to the coordinator

    const routing = simnet.callReadOnlyFn(COSIGN, "read-resolution", [Cl.uint(jobId)], client);
    expect(routing.result).toBeOk(
      Cl.tuple({
        "newcomer-amount": Cl.uint(JOB_VALUE),
        "backer-amount": Cl.uint(STAKE_FLOOR + REWARD),
        "client-amount": Cl.uint(0),
        disbursed: Cl.bool(true),
      })
    );

    // standing cache bumped for both newcomer and backer
    for (const who of [newcomer, backer]) {
      const standing = simnet.callReadOnlyFn(COSIGN, "get-standing", [Cl.principal(who)], client);
      expect(standing.result).toStrictEqual(Cl.tuple({ "clean-completions": Cl.uint(1) }));
    }
  });

  it("8. resolve at deadline, newcomer ghosted -> escrow + slashed stake to client, 'ghosted'", () => {
    const { jobId, deadline } = backedJob(60);
    // newcomer never deposits
    const clientBefore = balance(client);
    const backerBefore = balance(backer);
    mineUntil(deadline);
    expect(resolve(jobId).result).toBeOk(Cl.stringAscii("ghosted"));
    expect(jobField(jobId, "status")).toBe("ghosted");
    expect(jobField(jobId, "disbursed")).toBe(true);

    // restitution: the wronged client gets their escrow back PLUS the stake
    expect(balance(client) - clientBefore).toBe(BigInt(ESCROW + STAKE_FLOOR));
    expect(balance(backer)).toBe(backerBefore); // backer's stake is gone
    expect(balance(cosignPrincipal)).toBe(0n);

    const routing = simnet.callReadOnlyFn(COSIGN, "read-resolution", [Cl.uint(jobId)], client);
    expect(routing.result).toBeOk(
      Cl.tuple({
        "newcomer-amount": Cl.uint(0),
        "backer-amount": Cl.uint(0),
        "client-amount": Cl.uint(ESCROW + STAKE_FLOOR),
        disbursed: Cl.bool(true),
      })
    );
  });

  it("9. resolve twice -> second call rejects (idempotent)", () => {
    const { jobId, deadline } = backedJob(60);
    newcomerCompletesFunding(jobId);
    mineUntil(deadline);
    expect(resolve(jobId).result).toBeOk(Cl.stringAscii("settled"));
    expect(resolve(jobId).result).toBeErr(Cl.uint(ERR_ALREADY_RESOLVED));
    expect(jobField(jobId, "status")).toBe("settled");
  });

  it("10. coordinator never holds a raw balance; funds only ever sit inside FlowVault", () => {
    const clean = backedJob(60);
    newcomerCompletesFunding(clean.jobId);
    mineUntil(clean.deadline);
    expect(resolve(clean.jobId).result).toBeOk(Cl.stringAscii("settled"));

    const ghost = backedJob(60);
    mineUntil(ghost.deadline);
    expect(resolve(ghost.jobId).result).toBeOk(Cl.stringAscii("ghosted"));

    // no raw token balance held by the coordinator at any tx boundary
    expect(balance(cosignPrincipal)).toBe(0n);

    // no assets of any kind (STX or FT) credited directly to the coordinator
    const assets = simnet.getAssetsMap();
    for (const [asset, holders] of assets) {
      const held = holders.get(cosignPrincipal);
      expect(held ?? 0n, `coordinator holds ${asset}`).toBe(0n);
    }
  });

  it("11. overlapping deadlines: outcome fixed at each deadline; disbursement deferred until the shared lock expires", () => {
    // Job A (short deadline) and job B (long deadline) share the coordinator
    // vault's single lock slot -- B's deposit extends the lock past A's deadline.
    const a = backedJob(30);
    const b = backedJob(90, STAKE_FLOOR, newcomer2);
    newcomerCompletesFunding(a.jobId);

    const backerBefore = balance(backer);
    const newcomerBefore = balance(newcomer);

    mineUntil(a.deadline);
    // outcome recorded at A's own deadline...
    expect(resolve(a.jobId).result).toBeOk(Cl.stringAscii("settled"));
    // ...but funds are still under B's extended lock
    expect(jobField(a.jobId, "disbursed")).toBe(false);
    expect(balance(backer)).toBe(backerBefore);
    const early = simnet.callPublicFn(COSIGN, "disburse", [Cl.uint(a.jobId), token()], deployer);
    expect(early.result).toBeErr(Cl.uint(ERR_STILL_LOCKED));

    // once the shared lock expires, anyone can trigger the payout
    mineUntil(b.deadline);
    const late = simnet.callPublicFn(COSIGN, "disburse", [Cl.uint(a.jobId), token()], deployer);
    expect(late.result).toBeOk(Cl.bool(true));
    expect(jobField(a.jobId, "disbursed")).toBe(true);
    expect(balance(newcomer) - newcomerBefore).toBe(BigInt(JOB_VALUE));
    expect(balance(backer) - backerBefore).toBe(BigInt(STAKE_FLOOR + REWARD));

    // job B (its newcomer never funded) resolves ghosted, disbursing inline
    expect(resolve(b.jobId).result).toBeOk(Cl.stringAscii("ghosted"));
    expect(jobField(b.jobId, "disbursed")).toBe(true);
    expect(balance(cosignPrincipal)).toBe(0n);
  });

  it("12. unbacked job, newcomer completes -> newcomer paid, reward remainder returns to client", () => {
    const deadline = height() + 60;
    const jobId = createJob(deadline);
    newcomerCompletesFunding(jobId);
    const newcomerBefore = balance(newcomer);
    const clientBefore = balance(client);
    mineUntil(deadline);
    expect(resolve(jobId).result).toBeOk(Cl.stringAscii("settled"));
    expect(balance(newcomer) - newcomerBefore).toBe(BigInt(JOB_VALUE));
    expect(balance(client) - clientBefore).toBe(BigInt(REWARD)); // unused reward pool
  });

  it("13. unbacked job, newcomer ghosts -> client gets the full escrow back", () => {
    const deadline = height() + 60;
    const jobId = createJob(deadline);
    const clientBefore = balance(client);
    mineUntil(deadline);
    expect(resolve(jobId).result).toBeOk(Cl.stringAscii("ghosted"));
    expect(balance(client) - clientBefore).toBe(BigInt(ESCROW));
  });
});
