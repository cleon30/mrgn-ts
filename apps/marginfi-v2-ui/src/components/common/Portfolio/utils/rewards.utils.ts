import { PublicKey, SolanaJSONRPCError, VersionedTransaction } from "@solana/web3.js";

import {
  MarginfiAccountWrapper,
  MarginfiClient,
  ProcessTransactionError,
  ProcessTransactionOpts,
  TOKEN_2022_MINTS,
} from "@mrgnlabs/marginfi-client-v2";
import { extractErrorString, MultiStepToastHandle, captureSentryException } from "@mrgnlabs/mrgn-utils";
import {
  AccountLayout,
  ExtendedV0Transaction,
  getAssociatedTokenAddressSync,
  SolanaTransaction,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@mrgnlabs/mrgn-common";
import { ExtendedBankInfo } from "@mrgnlabs/marginfi-v2-ui-state";

export const executeCollectTxn = async (
  marginfiClient: MarginfiClient,
  actionTxn: SolanaTransaction,
  processOpts: ProcessTransactionOpts,
  setIsLoading: (isLoading: boolean) => void,
  closeDialog: () => void
) => {
  setIsLoading(true);
  const multiStepToast = new MultiStepToastHandle("Collecting rewards", [
    { label: "Signing transaction" },
    {
      label: "Collecting rewards",
    },
  ]);
  multiStepToast.start();

  try {
    const sig = await marginfiClient.processTransactions([actionTxn], {
      ...processOpts,
      callback: (index, success, sig, stepsToAdvance) =>
        success && multiStepToast.setSuccessAndNext(stepsToAdvance, sig),
    });
    multiStepToast.setSuccess();
    closeDialog();
    return sig;
  } catch (error) {
    console.log("error while collecting rewards");
    console.log(error);

    if (!(error instanceof ProcessTransactionError || error instanceof SolanaJSONRPCError)) {
      captureSentryException(error, JSON.stringify(error), {
        action: "Collect rewards",
        wallet: marginfiClient.wallet.publicKey.toBase58(),
      });
    }

    const msg = extractErrorString(error);
    multiStepToast.setFailed(msg);
  } finally {
    setIsLoading(false);
  }
};

/**
 * Generates a transaction for withdrawing emissions from the specified banks.
 * TODO: This function should not return a transaction with empty instructions.
 */
export const generateWithdrawEmissionsTxn = async (
  banksWithEmissions: ExtendedBankInfo[],
  selectedAccount: MarginfiAccountWrapper
): Promise<ExtendedV0Transaction | undefined> => {
  try {
    const bankAddressesWithEmissions = banksWithEmissions.map((bank) => bank.meta.address);
    const tx = await selectedAccount.makeWithdrawEmissionsTx(bankAddressesWithEmissions);

    return tx;
  } catch (error) {
    console.error("Error generating emissions transaction", error);
  }
};

export const fetchBeforeStateEmissions = async (
  marginfiClient: MarginfiClient,
  banksWithEmissions: ExtendedBankInfo[]
): Promise<{
  atas: PublicKey[];
  beforeAmounts: Map<PublicKey, { amount: string; tokenSymbol: string; mintDecimals: number }>;
}> => {
  const atas: PublicKey[] = [];
  const beforeAmounts = new Map<PublicKey, { amount: string; tokenSymbol: string; mintDecimals: number }>();

  for (let bank of banksWithEmissions) {
    if (!bank) {
      throw new Error("Bank is undefined");
    }

    const tokenMint = bank.info.rawBank.emissionsMint;
    const tokenSymbol = bank.info.rawBank.tokenSymbol ?? "";
    const mintDecimals = bank.info.rawBank.mintDecimals;

    const programId = TOKEN_2022_MINTS.includes(tokenMint.toString()) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const ata = getAssociatedTokenAddressSync(tokenMint, marginfiClient.wallet.publicKey, true, programId);
    atas.push(ata);

    const originData = await marginfiClient.provider.connection.getAccountInfo(ata);
    let beforeAmount = "0";
    if (originData) {
      beforeAmount = AccountLayout.decode(originData.data).amount.toString();
    }

    beforeAmounts.set(bank.meta.address, { amount: beforeAmount, tokenSymbol, mintDecimals });
  }

  return { atas, beforeAmounts };
};

export const fetchAfterStateEmissions = (
  previewAtas: (Buffer | null)[],
  banksWithEmissions: ExtendedBankInfo[],
  beforeAmounts: Map<PublicKey, { amount: string; tokenSymbol: string; mintDecimals: number }>
): Map<PublicKey, { amount: string; tokenSymbol: string; mintDecimals: number }> => {
  const afterAmounts = new Map<PublicKey, { amount: string; tokenSymbol: string; mintDecimals: number }>();
  previewAtas.forEach((ata, index) => {
    if (!ata) {
      return;
    }

    const afterAmount = AccountLayout.decode(ata).amount.toString();
    const bankAddress = banksWithEmissions[index].meta.address;
    const beforeData = beforeAmounts.get(bankAddress);

    if (beforeData) {
      afterAmounts.set(bankAddress, {
        amount: afterAmount,
        tokenSymbol: beforeData.tokenSymbol,
        mintDecimals: beforeData.mintDecimals,
      });
    }
  });

  return afterAmounts;
};
