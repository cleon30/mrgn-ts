import React from "react";

import { TransactionMessage, VersionedTransaction } from "@solana/web3.js";

import { makeBundleTipIx, MarginfiAccountWrapper, MarginfiClient } from "@mrgnlabs/marginfi-client-v2";
import { ActiveBankInfo, ExtendedBankInfo } from "@mrgnlabs/marginfi-v2-ui-state";
import { getSimulationResult } from "../utils/move-position.utils";
import { ActionMessageType } from "@mrgnlabs/mrgn-utils";

type MovePositionSimulationProps = {
  actionTxns: VersionedTransaction[] | null;
  marginfiClient: MarginfiClient | null;
  selectedAccount: MarginfiAccountWrapper | null;
  accountToMoveTo: MarginfiAccountWrapper | null;
  extendedBankInfos: ExtendedBankInfo[];
  activeBank: ActiveBankInfo;

  setActionTxns: (actionTxn: VersionedTransaction[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setErrorMessage: (error: ActionMessageType | null) => void;
};

export const useMoveSimulation = ({
  marginfiClient,
  accountToMoveTo,
  selectedAccount,
  activeBank,
  setActionTxns,
  setIsLoading,
  setErrorMessage,
}: MovePositionSimulationProps) => {
  const generateTxns = React.useCallback(async () => {
    if (!marginfiClient || !accountToMoveTo) {
      return;
    }
    try {
      setIsLoading(true);
      const connection = marginfiClient.provider.connection;
      const blockHash = await connection.getLatestBlockhash();
      const withdrawIx = await selectedAccount?.makeWithdrawIx(activeBank.position.amount, activeBank.address);
      if (!withdrawIx) return;
      const withdrawMessage = new TransactionMessage({
        payerKey: marginfiClient.wallet.publicKey,
        recentBlockhash: blockHash.blockhash,
        instructions: [...withdrawIx.instructions],
      });
      const withdrawTx = new VersionedTransaction(withdrawMessage.compileToV0Message());

      const bundleTipIx = makeBundleTipIx(marginfiClient?.wallet.publicKey);
      const depositIx = await accountToMoveTo.makeDepositIx(activeBank.position.amount, activeBank.address);
      if (!depositIx) return;
      const depositInstruction = new TransactionMessage({
        payerKey: marginfiClient.wallet.publicKey,
        recentBlockhash: blockHash.blockhash,
        instructions: [...depositIx.instructions, bundleTipIx],
      });
      const depositTx = new VersionedTransaction(depositInstruction.compileToV0Message());
      return [withdrawTx, depositTx];
    } catch (error) {
      console.error("Error creating transactions", error);
    }
  }, [marginfiClient, accountToMoveTo, setIsLoading, selectedAccount, activeBank.position.amount, activeBank.address]);

  const handleSimulateTxns = React.useCallback(async () => {
    try {
      const txns = await generateTxns();
      if (!txns || !marginfiClient) return;

      const { actionMethod } = await getSimulationResult({
        marginfiClient,
        txns,
        selectedBank: activeBank,
      });

      if (actionMethod) {
        setErrorMessage(actionMethod);
        setActionTxns([]);
      } else {
        setErrorMessage(null);
        setActionTxns(txns);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  }, [generateTxns, marginfiClient, activeBank, setErrorMessage, setActionTxns, setIsLoading]);

  return {
    handleSimulateTxns,
  };
};