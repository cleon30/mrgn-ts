import React from "react";

import { ExtendedBankInfo, ActionType } from "@mrgnlabs/marginfi-v2-ui-state";
import { computeBankRate, LendingModes } from "@mrgnlabs/mrgn-utils";

import { SelectedBankItem, BankListWrapper } from "../../../../../../components";

import { TokenTrigger, TokenList } from "./components";

type BankSelectProps = {
  selectedBank: ExtendedBankInfo | null;
  banks: ExtendedBankInfo[];
  nativeSolBalance: number;
  lendMode: ActionType;
  connected: boolean;

  setSelectedBank: (selectedBank: ExtendedBankInfo | null) => void;
};

export const BankSelect = ({
  selectedBank,
  banks,
  nativeSolBalance,
  lendMode,
  connected,
  setSelectedBank,
}: BankSelectProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  // idea check list if banks[] == 1 make it unselectable
  const isSelectable = React.useMemo(() => true, []);

  const lendingMode = React.useMemo(
    () =>
      lendMode === ActionType.Deposit || lendMode === ActionType.Withdraw ? LendingModes.LEND : LendingModes.BORROW,
    [lendMode]
  );

  const calculateRate = React.useCallback(
    (bank: ExtendedBankInfo) => {
      return computeBankRate(bank, lendingMode);
    },
    [lendingMode]
  );

  return (
    <>
      {!isSelectable && (
        <div className="flex gap-3 w-full items-center">
          {selectedBank && (
            <SelectedBankItem bank={selectedBank} lendingMode={lendingMode} rate={calculateRate(selectedBank)} />
          )}
        </div>
      )}

      {isSelectable && (
        <BankListWrapper
          isOpen={isOpen}
          setIsOpen={setIsOpen}
          Trigger={<TokenTrigger selectedBank={selectedBank} lendingMode={lendingMode} isOpen={isOpen} />}
          Content={
            <TokenList
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              selectedBank={selectedBank}
              onSetSelectedBank={setSelectedBank}
              lendMode={lendMode}
              banks={banks}
              nativeSolBalance={nativeSolBalance}
              connected={connected}
            />
          }
        />
      )}
    </>
  );
};