import React from "react";

import Image from "next/image";

import { ActionType, ActiveBankInfo } from "@mrgnlabs/marginfi-v2-ui-state";
import { numeralFormatter, usdFormatter } from "@mrgnlabs/mrgn-common";

import { cn, getTokenImageURL } from "~/utils";
import { useAssetItemData } from "~/hooks/useAssetItemData";

import { ActionBoxDialog } from "~/components/common/ActionBox";
import { IconAlertTriangle } from "~/components/ui/icons";
import { Button } from "~/components/ui/button";

type BankCardProps = {
  bank: ActiveBankInfo;
};

export const BankCard = ({ bank }: BankCardProps) => {
  const { rateAP } = useAssetItemData({ bank, isInLendingMode: true });

  const isUserPositionPoorHealth = React.useMemo(() => {
    if (!bank || !bank?.position?.liquidationPrice) {
      return false;
    }

    const alertRange = 0.05;

    if (bank.position.isLending) {
      return bank.info.state.price < bank.position.liquidationPrice + bank.position.liquidationPrice * alertRange;
    } else {
      return bank.info.state.price > bank.position.liquidationPrice - bank.position.liquidationPrice * alertRange;
    }
  }, [bank]);
  return (
    <div className="bg-background-gray p-4 rounded-lg space-y-4 flex flex-col justify-between">
      <div className="flex justify-between items-center w-full gap-2">
        <div className="flex text-left gap-3">
          <div className="flex items-center">
            <Image
              src={getTokenImageURL(bank.meta.tokenSymbol)}
              className="rounded-full"
              alt={bank.meta.tokenSymbol}
              height={40}
              width={40}
            />
          </div>
          <dl>
            <dt className="font-medium text-lg">{bank.meta.tokenSymbol}</dt>
            <dd className="text-sm font-normal text-success">{rateAP.concat(...[" ", "APY"])}</dd>
          </dl>
        </div>
        {bank.position && (
          <div className="font-medium text-lg mr-2">
            {bank.position.amount < 0.01 ? "< $0.01" : numeralFormatter(bank.position.amount)}
            {" " + bank.meta.tokenSymbol}
          </div>
        )}
      </div>
      {bank.position && (
        <div className="bg-background/60 py-3 px-4 rounded-lg text-sm">
          <dl className="grid grid-cols-2 gap-y-0.5">
            <dt className="text-muted-foreground">USD value</dt>
            <dd className="text-right text-white">
              {bank.position.usdValue < 0.01 ? "< $0.01" : usdFormatter.format(bank.position.usdValue)}
            </dd>
            <dt className="text-muted-foreground">Current price</dt>
            <dd className="text-right text-white">{usdFormatter.format(bank.info.state.price)}</dd>
          </dl>
        </div>
      )}
      {!bank.position && (
        <div className="bg-background/60 py-6 px-4 rounded-lg text-sm">
          <p className="text-muted-foreground">No current position.</p>
        </div>
      )}
      <ActionBoxDialog requestedAction={ActionType.Deposit} requestedBank={bank}>
        <div className="flex w-full gap-4 mt-auto">
          <Button className="flex-1 h-12" variant="outline">
            Withdraw
          </Button>
          <Button className="flex-1 h-12" variant="default">
            Supply more
          </Button>
        </div>
      </ActionBoxDialog>
    </div>
  );
};