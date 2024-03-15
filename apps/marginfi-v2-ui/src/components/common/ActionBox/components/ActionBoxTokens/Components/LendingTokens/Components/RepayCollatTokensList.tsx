import React from "react";

import { PublicKey } from "@solana/web3.js";

import { percentFormatter, aprToApy } from "@mrgnlabs/mrgn-common";
import { ExtendedBankInfo, Emissions } from "@mrgnlabs/marginfi-v2-ui-state";

import { LendingModes } from "~/types";
import { useMrgnlendStore, useUiStore } from "~/store";
import { cn } from "~/utils";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "~/components/ui/command";
import { IconX } from "~/components/ui/icons";

import { ActionBoxItem, BuyWithMoonpay } from "../../SharedComponents";

type RepayCollatTokensListProps = {
  selectedRepayBank?: ExtendedBankInfo;
  onSetRepayTokenBank?: (selectedTokenBank: PublicKey | null) => void;
  highlightedRepayTokens?: PublicKey[];
  isOpen: boolean;
  onClose: () => void;
};

export const RepayCollatTokensList = ({
  selectedRepayBank,
  onSetRepayTokenBank,
  highlightedRepayTokens = [],
  isOpen,
  onClose,
}: RepayCollatTokensListProps) => {
  const [extendedBankInfos, nativeSolBalance] = useMrgnlendStore((state) => [
    state.extendedBankInfos,
    state.nativeSolBalance,
  ]);
  const [lendingMode] = useUiStore((state) => [state.lendingMode, state.setIsWalletOpen]);
  const [searchQuery, setSearchQuery] = React.useState("");

  const calculateRate = React.useCallback(
    (bank: ExtendedBankInfo) => {
      const isInLendingMode = lendingMode === LendingModes.LEND;

      const interestRate = isInLendingMode ? bank.info.state.lendingRate : bank.info.state.borrowingRate;
      const emissionRate = isInLendingMode
        ? bank.info.state.emissions == Emissions.Lending
          ? bank.info.state.emissionsRate
          : 0
        : bank.info.state.emissions == Emissions.Borrowing
        ? bank.info.state.emissionsRate
        : 0;

      const aprRate = interestRate + emissionRate;
      const apyRate = aprToApy(aprRate);

      return percentFormatter.format(apyRate);
    },
    [lendingMode]
  );

  const hasTokens = React.useMemo(() => {
    const hasBankTokens = !!extendedBankInfos.filter(
      (bank) => bank.userInfo.tokenAccount.balance !== 0 || bank.meta.tokenSymbol === "SOL"
    );

    return hasBankTokens;
  }, [extendedBankInfos]);

  /////// FILTERS
  // filter on search
  const searchFilter = React.useCallback(
    (bankInfo: ExtendedBankInfo) => {
      const lowerCaseSearchQuery = searchQuery.toLowerCase();
      return bankInfo.meta.tokenSymbol.toLowerCase().includes(lowerCaseSearchQuery);
    },
    [searchQuery]
  );

  // filter on positions
  const positionFilter = React.useCallback(
    (bankInfo: ExtendedBankInfo, filterActive?: boolean) => {
      return bankInfo.isActive && bankInfo.position.isLending;
    },
    [lendingMode]
  );

  /////// BANKS
  // active position banks
  const filteredBanksActive = React.useMemo(() => {
    return extendedBankInfos
      .filter(searchFilter)
      .filter((bankInfo) => positionFilter(bankInfo, false))
      .sort((a, b) => (b.isActive ? b?.position?.amount : 0) - (a.isActive ? a?.position?.amount : 0));
  }, [extendedBankInfos, searchFilter, positionFilter]);

  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  return (
    <>
      <Command
        className="bg-background-gray relative"
        shouldFilter={false}
        value={selectedRepayBank?.address?.toString().toLowerCase() ?? ""}
      >
        <div className="fixed bg-background-gray w-[90%] z-40 flex justify-between">
          <CommandInput
            placeholder="Search token..."
            className="h-12 "
            autoFocus={false}
            onValueChange={(value) => setSearchQuery(value)}
          />
        </div>
        <button onClick={() => onClose()} className="fixed z-50 top-5 right-4">
          <IconX size={18} className="text-white/50" />
        </button>
        {/* NO TOKENS IN WALLET */}
        {!hasTokens && <BuyWithMoonpay />}

        <CommandEmpty>No tokens found.</CommandEmpty>

        <div className="overflow-auto mt-[50px]">
          {/* REPAYING */}
          {filteredBanksActive.length > 0 && onSetRepayTokenBank && (
            <CommandGroup heading="Currently supplying">
              {filteredBanksActive.map((bank, index) => (
                <CommandItem
                  key={index}
                  value={bank.address?.toString().toLowerCase()}
                  // disabled={!ownedBanksPk.includes(bank.address)}
                  onSelect={(currentValue) => {
                    onSetRepayTokenBank(
                      extendedBankInfos.find((bankInfo) => bankInfo.address.toString().toLowerCase() === currentValue)
                        ?.address ?? null
                    );
                    onClose();
                  }}
                  className={cn(
                    "cursor-pointer font-medium flex items-center justify-between gap-2 data-[selected=true]:bg-background-gray-light data-[selected=true]:text-white py-2",
                    highlightedRepayTokens.find((v) => v.equals(bank.info.state.mint)) ? "opacity-1" : "opacity-50"
                  )}
                >
                  <ActionBoxItem
                    rate={calculateRate(bank)}
                    lendingMode={lendingMode}
                    bank={bank}
                    showBalanceOverride={false}
                    nativeSolBalance={nativeSolBalance}
                    isRepay={true}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </div>
      </Command>
    </>
  );
};