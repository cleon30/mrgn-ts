import { IconArrowRight } from "@tabler/icons-react";
import { VersionedTransaction } from "@solana/web3.js";

import {
  Bank,
  MarginRequirementType,
  MarginfiAccountWrapper,
  MarginfiClient,
  OperationalState,
  SimulationResult,
} from "@mrgnlabs/marginfi-client-v2";
import { AccountSummary, ExtendedBankInfo } from "@mrgnlabs/marginfi-v2-ui-state";
import {
  SolanaTransaction,
  TransactionBroadcastType,
  Wallet,
  percentFormatter,
  tokenPriceFormatter,
  usdFormatter,
} from "@mrgnlabs/mrgn-common";
import {
  ActionMessageType,
  DYNAMIC_SIMULATION_ERRORS,
  loopingBuilder,
  showErrorToast,
  MultiStepToastHandle,
  cn,
  extractErrorString,
  LoopActionTxns,
} from "@mrgnlabs/mrgn-utils";

import { IconPyth, IconSwitchboard } from "~/components/ui/icons";
import { GroupData } from "~/store/tradeStore";

export type TradeSide = "long" | "short";

export async function looping({
  marginfiClient,
  marginfiAccount,
  depositBank,
  borrowBank,
  depositAmount,
  options,
  priorityFee,
  broadcastType,
}: {
  marginfiClient: MarginfiClient | null;
  marginfiAccount: MarginfiAccountWrapper;
  depositBank: ExtendedBankInfo;
  borrowBank: ExtendedBankInfo;
  depositAmount: number;
  options: LoopActionTxns;
  priorityFee: number;
  broadcastType: TransactionBroadcastType;
}) {
  if (marginfiClient === null) {
    showErrorToast({ message: "Marginfi client not ready" });
    return;
  }

  const multiStepToast = new MultiStepToastHandle("Looping", [
    { label: `Executing looping ${depositBank.meta.tokenSymbol} with ${borrowBank.meta.tokenSymbol}` },
  ]);
  multiStepToast.start();

  try {
    let sigs: string[] = [];

    if (options.actionTxn) {
      sigs = await marginfiClient.processTransactions([...options.additionalTxns, options.actionTxn], {
        broadcastType: broadcastType,
        priorityFeeMicro: priorityFee,
      });
    } else {
      if (!options.actionQuote) {
        throw new Error("No action quote found");
      }
      const loopingResult = await loopingBuilder({
        marginfiAccount,
        depositBank,
        depositAmount,
        borrowBank,
        quote: options.actionQuote!,
        connection: marginfiClient.provider.connection,
        borrowAmount: options.borrowAmount,
        actualDepositAmount: options.actualDepositAmount,
      });
      sigs = await marginfiClient.processTransactions([...loopingResult.additionalTxs, loopingResult.flashloanTx], {
        broadcastType: broadcastType,
        priorityFeeMicro: priorityFee,
      });
    }
    multiStepToast.setSuccessAndNext();
    return sigs;
  } catch (error: any) {
    const msg = extractErrorString(error);
    //   Sentry.captureException({ message: error });
    multiStepToast.setFailed(msg);
    console.log(`Error while looping: ${msg}`);
    console.log(error);
    return;
  }
}

export interface SimulateLoopingActionProps {
  marginfiClient: MarginfiClient;
  account: MarginfiAccountWrapper | null;
  bank: ExtendedBankInfo;
  loopingTxn: SolanaTransaction | null;
  feedCrankTxs: SolanaTransaction[];
}

export async function simulateLooping({
  marginfiClient,
  account,
  bank,
  loopingTxn,
  feedCrankTxs,
}: SimulateLoopingActionProps): Promise<SimulationResult | null> {
  let simulationResult: SimulationResult;

  if (loopingTxn && marginfiClient && account) {
    const [mfiAccountData, bankData] = await marginfiClient.simulateTransactions(
      [...feedCrankTxs, loopingTxn],
      [account.address, bank.address]
    );
    if (!mfiAccountData || !bankData) throw new Error("Failed to simulate looping");
    const previewBanks = marginfiClient.banks;
    previewBanks.set(
      bank.address.toBase58(),
      Bank.fromBuffer(bank.address, bankData, marginfiClient.program.idl, marginfiClient.feedIdMap)
    );
    const previewClient = new MarginfiClient(
      marginfiClient.config,
      marginfiClient.program,
      {} as Wallet,
      true,
      marginfiClient.group,
      marginfiClient.banks,
      marginfiClient.oraclePrices,
      marginfiClient.mintDatas,
      marginfiClient.feedIdMap
    );
    const previewMarginfiAccount = MarginfiAccountWrapper.fromAccountDataRaw(
      account.address,
      previewClient,
      mfiAccountData,
      marginfiClient.program.idl
    );

    return {
      banks: previewBanks,
      marginfiAccount: previewMarginfiAccount,
    };
  }
  return null;
}

export function generateStats(
  accountSummary: AccountSummary,
  tokenBank: ExtendedBankInfo,
  usdcBank: ExtendedBankInfo,
  simulationResult: SimulationResult | null,
  looping: LoopActionTxns | null,
  isAccountInitialized: boolean
) {
  let simStats: StatResult | null = null;

  if (simulationResult) {
    simStats = getSimulationStats(simulationResult, tokenBank, usdcBank);
  }

  const currentStats = getCurrentStats(accountSummary, tokenBank, usdcBank);

  const priceImpactPct = looping?.actionQuote ? Number(looping.actionQuote.priceImpactPct) : undefined;
  const slippageBps = looping?.actionQuote ? Number(looping.actionQuote.slippageBps) : undefined;
  const platformFeeBps = looping?.actionQuote?.platformFee
    ? Number(looping.actionQuote.platformFee?.feeBps)
    : undefined;

  const currentLiqPrice = currentStats.liquidationPrice ? usdFormatter.format(currentStats.liquidationPrice) : null;
  const simulatedLiqPrice = simStats?.liquidationPrice ? usdFormatter.format(simStats?.liquidationPrice) : null;
  const showLiqComparison = currentLiqPrice && simulatedLiqPrice;

  let oracle = "";
  switch (tokenBank?.info.rawBank.config.oracleSetup) {
    case "PythLegacy":
      oracle = "Pyth";
      break;
    case "PythPushOracle":
      oracle = "Pyth";
      break;
    case "SwitchboardV2":
      oracle = "Switchboard";
      break;
  }

  return (
    <>
      <dl className="w-full grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
        <dt>Entry Price</dt>
        <dd className="text-primary text-right">{tokenPriceFormatter(tokenBank.info.state.price)}</dd>
        {(currentLiqPrice || simulatedLiqPrice) && (
          <>
            <dt>Liquidation Price</dt>

            <dd className="text-primary text-right flex flex-row justify-end gap-2">
              {currentLiqPrice && <span>{currentLiqPrice}</span>}
              {showLiqComparison && <IconArrowRight width={12} height={12} />}
              {simulatedLiqPrice && <span>{simulatedLiqPrice}</span>}
            </dd>
          </>
        )}
        {slippageBps !== undefined ? (
          <>
            <dt>Slippage</dt>
            <dd className={cn(slippageBps > 500 && "text-alert-foreground", "text-right")}>
              {percentFormatter.format(slippageBps / 10000)}
            </dd>
          </>
        ) : (
          <></>
        )}
        {platformFeeBps !== undefined ? (
          <>
            <dt>Platform fee</dt>
            <dd className="text-right">{percentFormatter.format(platformFeeBps / 10000)}</dd>
          </>
        ) : (
          <></>
        )}
        {priceImpactPct !== undefined ? (
          <>
            <dt>Price impact</dt>
            <dd
              className={cn(
                priceImpactPct > 0.05
                  ? "text-mrgn-error"
                  : priceImpactPct > 0.01
                  ? "text-alert-foreground"
                  : "text-mrgn-success",
                "text-right"
              )}
            >
              {percentFormatter.format(priceImpactPct)}
            </dd>
          </>
        ) : (
          <></>
        )}
        <dt>Oracle</dt>
        <dd className="text-primary flex items-center gap-1 ml-auto">
          {oracle}
          {oracle === "Pyth" ? <IconPyth size={14} /> : <IconSwitchboard size={14} />}
        </dd>
        {tokenBank.info.state.totalDeposits > 0 && (
          <>
            <dt>Total deposits</dt>
            <dd className="text-primary text-right">
              {tokenBank.info.state.totalDeposits.toFixed(2)} {tokenBank.meta.tokenSymbol}
            </dd>
          </>
        )}
        {tokenBank.info.state.totalBorrows > 0 && (
          <>
            <dt>Total borrows</dt>
            <dd className="text-primary text-right">
              {tokenBank.info.state.totalBorrows.toFixed(2)} {tokenBank.meta.tokenSymbol}
            </dd>
          </>
        )}
      </dl>

      {/* {looping && !isAccountInitialized ? (
        <label className="text-xs italic text-muted-foreground text-center">
          Health & liquidation simulation will display after the initial transaction.
        </label>
      ) : (
        <></>
      )} */}
    </>
  );

  // health comparison
}

interface StatResult {
  tokenPositionAmount: number;
  usdcPositionAmount: number;
  healthFactor: number;
  liquidationPrice: number | null;
}

export function getSimulationStats(
  simulationResult: SimulationResult,
  tokenBank: ExtendedBankInfo,
  usdcBank: ExtendedBankInfo
): StatResult {
  let simulationPreview: any | undefined = undefined;

  const { assets, liabilities } = simulationResult.marginfiAccount.computeHealthComponents(
    MarginRequirementType.Maintenance
  );
  const { assets: assetsInit } = simulationResult.marginfiAccount.computeHealthComponents(
    MarginRequirementType.Initial
  );

  const healthFactor = assets.minus(liabilities).dividedBy(assets).toNumber();
  const liquidationPrice = simulationResult.marginfiAccount.computeLiquidationPriceForBank(tokenBank.address);
  // const { lendingRate, borrowingRate } = simulationResult.banks.get(bank.address.toBase58())!.computeInterestRates();

  // Token position
  const tokenPosition = simulationResult.marginfiAccount.activeBalances.find(
    (b) => b.active && b.bankPk.equals(tokenBank.address)
  );
  let tokenPositionAmount = 0;
  if (tokenPosition && tokenPosition.liabilityShares.gt(0)) {
    tokenPositionAmount = tokenPosition.computeQuantityUi(tokenBank.info.rawBank).liabilities.toNumber();
  } else if (tokenPosition && tokenPosition.assetShares.gt(0)) {
    tokenPositionAmount = tokenPosition.computeQuantityUi(tokenBank.info.rawBank).assets.toNumber();
  }

  // usdc position
  const usdcPosition = simulationResult.marginfiAccount.activeBalances.find(
    (b) => b.active && b.bankPk.equals(usdcBank.address)
  );
  let usdcPositionAmount = 0;
  if (usdcPosition && usdcPosition.liabilityShares.gt(0)) {
    usdcPositionAmount = usdcPosition.computeQuantityUi(usdcBank.info.rawBank).liabilities.toNumber();
  } else if (usdcPosition && usdcPosition.assetShares.gt(0)) {
    usdcPositionAmount = usdcPosition.computeQuantityUi(usdcBank.info.rawBank).assets.toNumber();
  }

  const availableCollateral = simulationResult.marginfiAccount.computeFreeCollateral().toNumber();

  return {
    tokenPositionAmount,
    usdcPositionAmount,
    healthFactor,
    liquidationPrice,
  };
}

export function getCurrentStats(
  accountSummary: AccountSummary,
  tokenBank: ExtendedBankInfo,
  usdcBank: ExtendedBankInfo
): StatResult {
  const tokenPositionAmount = tokenBank?.isActive ? tokenBank.position.amount : 0;
  const usdcPositionAmount = usdcBank?.isActive ? usdcBank.position.amount : 0;
  const healthFactor = !accountSummary.balance || !accountSummary.healthFactor ? 1 : accountSummary.healthFactor;

  // always token asset liq price
  const liquidationPrice =
    tokenBank.isActive && tokenBank.position.liquidationPrice && tokenBank.position.liquidationPrice > 0.01
      ? tokenBank.position.liquidationPrice
      : null;

  return {
    tokenPositionAmount,
    usdcPositionAmount,
    healthFactor,
    liquidationPrice,
  };
}

interface CheckActionAvailableProps {
  amount: string;
  connected: boolean;
  activeGroup: GroupData | null;
  loopActionTxns: LoopActionTxns | null;
  tradeSide: TradeSide;
}

export function checkLoopingActionAvailable({
  amount,
  connected,
  activeGroup,
  loopActionTxns,
  tradeSide,
}: CheckActionAvailableProps): ActionMessageType[] {
  let checks: ActionMessageType[] = [];

  const requiredCheck = getRequiredCheck(connected, activeGroup, loopActionTxns);
  if (requiredCheck) return [requiredCheck];

  const generalChecks = getGeneralChecks(amount);
  if (generalChecks) checks.push(...generalChecks);

  // allert checks
  if (activeGroup && loopActionTxns) {
    const lentChecks = canBeLooped(activeGroup, loopActionTxns, tradeSide);
    if (lentChecks.length) checks.push(...lentChecks);
  }

  if (checks.length === 0)
    checks.push({
      isEnabled: true,
    });

  return checks;
}

function getRequiredCheck(
  connected: boolean,
  activeGroup: GroupData | null,
  loopActionTxns: LoopActionTxns | null
): ActionMessageType | null {
  if (!connected) {
    return { isEnabled: false };
  }
  if (!activeGroup) {
    return { isEnabled: false };
  }
  if (!loopActionTxns) {
    return { isEnabled: false };
  }

  return null;
}

function getGeneralChecks(amount: string): ActionMessageType[] {
  let checks: ActionMessageType[] = [];

  try {
    if (Number(amount) === 0) {
      checks.push({ isEnabled: false });
    }
    return checks;
  } catch {
    checks.push({ isEnabled: false });
    return checks;
  }
}

function canBeLooped(
  activeGroup: GroupData,
  loopActionTxns: LoopActionTxns,
  tradeSide: TradeSide
): ActionMessageType[] {
  let checks: ActionMessageType[] = [];
  const isUsdcBankPaused =
    activeGroup.pool.quoteTokens[0].info.rawBank.config.operationalState === OperationalState.Paused;
  const isTokenBankPaused = activeGroup.pool.token.info.rawBank.config.operationalState === OperationalState.Paused;

  let tokenPosition,
    usdcPosition: "inactive" | "lending" | "borrowing" = "inactive";

  if (activeGroup.pool.quoteTokens[0].isActive) {
    usdcPosition = activeGroup.pool.quoteTokens[0].position.isLending ? "lending" : "borrowing";
  }

  if (activeGroup.pool.token.isActive) {
    tokenPosition = activeGroup.pool.token.position.isLending ? "lending" : "borrowing";
  }

  const wrongPositionActive =
    tradeSide === "long"
      ? usdcPosition === "lending" || tokenPosition === "borrowing"
      : usdcPosition === "borrowing" || tokenPosition === "lending";

  if (isUsdcBankPaused) {
    checks.push({
      description: `The ${activeGroup.pool.quoteTokens[0].info.rawBank.tokenSymbol} bank is paused at this time.`,
      isEnabled: false,
    });
  }

  if (isTokenBankPaused) {
    checks.push({
      description: `The ${activeGroup.pool.token.info.rawBank.tokenSymbol} bank is paused at this time.`,
      isEnabled: false,
    });
  }

  if (wrongPositionActive && loopActionTxns.actionTxn) {
    const wrongSupplied = tradeSide === "long" ? usdcPosition === "lending" : tokenPosition === "lending";
    const wrongBorrowed = tradeSide === "long" ? tokenPosition === "borrowing" : usdcPosition === "borrowing";

    if (wrongSupplied && wrongBorrowed) {
      checks.push(
        DYNAMIC_SIMULATION_ERRORS.LOOP_CHECK(tradeSide, activeGroup.pool.quoteTokens[0], activeGroup.pool.token)
      );
    } else if (wrongSupplied) {
      checks.push(
        DYNAMIC_SIMULATION_ERRORS.WITHDRAW_CHECK(tradeSide, activeGroup.pool.quoteTokens[0], activeGroup.pool.token)
      );
    } else if (wrongBorrowed) {
      checks.push(
        DYNAMIC_SIMULATION_ERRORS.REPAY_CHECK(tradeSide, activeGroup.pool.quoteTokens[0], activeGroup.pool.token)
      );
    }
  }

  const priceImpactPct = loopActionTxns.actionQuote?.priceImpactPct;

  if (priceImpactPct && Number(priceImpactPct) > 0.01) {
    //invert
    if (priceImpactPct && Number(priceImpactPct) > 0.05) {
      checks.push(DYNAMIC_SIMULATION_ERRORS.PRICE_IMPACT_ERROR_CHECK(Number(priceImpactPct)));
    } else {
      checks.push(DYNAMIC_SIMULATION_ERRORS.PRICE_IMPACT_WARNING_CHECK(Number(priceImpactPct)));
    }
  }

  // Banks will always be stale for now
  // if (
  //   (activeGroup.pool.token && isBankOracleStale(activeGroup.pool.token)) ||
  //   (activeGroup.pool.quoteTokens[0] && isBankOracleStale(activeGroup.pool.quoteTokens[0]))
  // ) {
  //   checks.push(STATIC_SIMULATION_ERRORS.STALE_TRADING);
  // }

  return checks;
}
