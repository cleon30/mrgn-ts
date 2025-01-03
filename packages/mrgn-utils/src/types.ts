import { QuoteResponse } from "@jup-ag/react-hook";
import { ActionType, ActiveBankInfo, ExtendedBankInfo } from "@mrgnlabs/marginfi-v2-ui-state";

export enum LendingModes {
  LEND = "lend",
  BORROW = "borrow",
}

export enum PoolTypes {
  ALL = "all",
  ISOLATED = "isolated",
  STABLE = "stable",
  LST = "lst",
}

interface PreviousTxnLending {
  txn: string;
  txnType: "LEND";
  lendingOptions: {
    amount: number;
    type: ActionType;
    bank: ActiveBankInfo;
    collatRepay?: {
      borrowBank: ActiveBankInfo;
      withdrawBank: ActiveBankInfo;
      withdrawAmount: number;
    };
  };
}

interface PreviousTxnStake {
  txn: string;
  txnType: "STAKE" | "UNSTAKE";
  stakingOptions: {
    amount: number;
    type: ActionType;
    originDetails: {
      amount: number;
      bank: ExtendedBankInfo;
    };
  };
}

interface PreviousTxnLoop {
  txn: string;
  txnType: "LOOP";
  loopOptions: {
    depositBank: ActiveBankInfo;
    borrowBank: ActiveBankInfo;
    depositAmount: number;
    borrowAmount: number;
    leverage: number;
  };
}

interface PreviousTxnPositionClosed {
  txn: string;
  txnType: "CLOSE_POSITION";
  positionClosedOptions: {
    tokenBank: ExtendedBankInfo;
    collateralBank: ExtendedBankInfo;
  };
}

export interface PreviousTxnTradingOptions {
  initDepositAmount: string;
  depositAmount: number;
  depositBank: ActiveBankInfo;
  borrowAmount: number;
  borrowBank: ActiveBankInfo;
  leverage: number;
  quote: QuoteResponse;
  entryPrice: number;
  type: "long" | "short";
}

interface PreviousTxnTrading {
  txn: string;
  txnType: "TRADING";
  tradingOptions: PreviousTxnTradingOptions;
}

export type PreviousTxn =
  | PreviousTxnLoop
  | PreviousTxnLending
  | PreviousTxnTrading
  | PreviousTxnPositionClosed
  | PreviousTxnStake;
