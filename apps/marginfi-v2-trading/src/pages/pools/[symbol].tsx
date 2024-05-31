import React from "react";

import { ActiveBankInfo } from "@mrgnlabs/marginfi-v2-ui-state";
import { numeralFormatter, usdFormatter } from "@mrgnlabs/mrgn-common";
import { PublicKey } from "@solana/web3.js";

import Image from "next/image";
import { useRouter } from "next/router";

import { useMrgnlendStore } from "~/store";
import { getTokenImageURL } from "~/utils";

import { BankCard } from "~/components/common/Pool";
import { Loader } from "~/components/ui/loader";
import { IconClockHour4, IconInfoCircle } from "~/components/ui/icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

const USDC_BANK_PK = new PublicKey("2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB");

export default function TradeSymbolPage() {
  const router = useRouter();
  const [initialized, extendedBankInfos, accountSummary] = useMrgnlendStore((state) => [
    state.initialized,
    state.extendedBankInfos,
    state.accountSummary,
  ]);

  const activeBank = React.useMemo(() => {
    if (!router.query.symbol) return null;
    const activeBankPk = new PublicKey(router.query.symbol as string);
    return extendedBankInfos.find((bank) => bank.address.equals(activeBankPk)) as ActiveBankInfo;
  }, [extendedBankInfos, router.query.symbol]);

  const usdcBank = React.useMemo(() => {
    return extendedBankInfos.find((bank) => bank.address.equals(USDC_BANK_PK)) as ActiveBankInfo;
  }, [activeBank]);

  const healthColor = React.useMemo(() => {
    if (accountSummary.healthFactor) {
      let color: string;

      if (accountSummary.healthFactor >= 0.5) {
        color = "#75BA80"; // green color " : "#",
      } else if (accountSummary.healthFactor >= 0.25) {
        color = "#B8B45F"; // yellow color
      } else {
        color = "#CF6F6F"; // red color
      }

      return color;
    } else {
      return "#fff";
    }
  }, [accountSummary.healthFactor]);

  if (!activeBank) return null;

  return (
    <div className="w-full max-w-8xl mx-auto px-4 md:px-8 pb-28 z-10">
      {!initialized && <Loader label="Loading mrgntrade..." className="mt-8" />}
      {initialized && (
        <div className="flex flex-col items-start gap-8 pb-16 w-full">
          <header className="flex flex-col gap-4 justify-center items-center w-full">
            <Image
              src={getTokenImageURL(activeBank.meta.tokenSymbol)}
              width={64}
              height={64}
              className="rounded-full"
              alt={activeBank.meta.tokenName}
            />
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-medium">{activeBank?.meta.tokenName}</h1>
              <h2 className="text-lg text-muted-foreground">{activeBank?.meta.tokenSymbol}</h2>
            </div>
          </header>
          <div className="bg-background-gray-dark p-6 rounded-xl w-full max-w-7xl mx-auto">
            <dl className="flex justify-between items-center gap-2">
              <dt className="flex items-center gap-1.5 text-sm">
                Lend/borrow health factor
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <IconInfoCircle size={16} />
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div className="flex flex-col gap-2 pb-2">
                        <p>
                          Health factor is based off <b>price biased</b> and <b>weighted</b> asset and liability values.
                        </p>
                        <div className="font-medium">
                          When your account health reaches 0% or below, you are exposed to liquidation.
                        </div>
                        <p>The formula is:</p>
                        <p className="text-sm italic text-center">{"(assets - liabilities) / (assets)"}</p>
                        <p>Your math is:</p>
                        <p className="text-sm italic text-center">{`(${usdFormatter.format(
                          accountSummary.lendingAmountWithBiasAndWeighted
                        )} - ${usdFormatter.format(
                          accountSummary.borrowingAmountWithBiasAndWeighted
                        )}) / (${usdFormatter.format(accountSummary.lendingAmountWithBiasAndWeighted)})`}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </dt>
              <dd className="text-xl md:text-2xl font-medium" style={{ color: healthColor }}>
                {numeralFormatter(accountSummary.healthFactor * 100)}%
              </dd>
            </dl>
            <div className="h-2 bg-background-gray-light rounded-full">
              <div
                className="h-2 rounded-full"
                style={{
                  backgroundColor: healthColor,
                  width: `${accountSummary.healthFactor * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between flex-wrap mt-5 mb-10 gap-y-4">
              <Stat label="Current Price" value={usdFormatter.format(activeBank.info.state.price)} />
              <Stat
                label="Total Deposits"
                value={`${numeralFormatter(activeBank.info.state.totalDeposits)} ${activeBank.meta.tokenSymbol}`}
              />
              <Stat
                label="Total Deposits (USD)"
                value={usdFormatter.format(
                  activeBank.info.state.totalDeposits * activeBank.info.oraclePrice.priceRealtime.price.toNumber()
                )}
              />
              <Stat
                label="Interest earned"
                value={
                  <span className="text-xs font-light flex w-full gap-1.5 items-center mt-1">
                    <IconClockHour4 size={14} /> Coming soon
                  </span>
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-8 w-full mx-auto">
              <BankCard bank={activeBank} />
              <BankCard bank={usdcBank} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Stat = ({ label, value }: { label: string; value: JSX.Element | string }) => (
  <dl className="w-1/2 md:w-auto">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="text-xl font-medium text-primary">{value}</dd>
  </dl>
);