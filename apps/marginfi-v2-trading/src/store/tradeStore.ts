import { create, StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  ActiveBankInfo,
  ExtendedBankInfo,
  ExtendedBankMetadata,
  makeExtendedBankInfo,
  makeExtendedBankMetadata,
  fetchTokenAccounts,
} from "@mrgnlabs/marginfi-v2-ui-state";
import { MarginfiClient, getConfig, BankMap, Bank, OraclePrice } from "@mrgnlabs/marginfi-client-v2";
import {
  Wallet,
  TokenMetadata,
  loadTokenMetadatas,
  loadBankMetadatas,
  getValueInsensitive,
} from "@mrgnlabs/mrgn-common";

type TradeGroupsCache = {
  [group: string]: [string, string];
};

type TradeStoreState = {
  initialized: boolean;

  groupsCache: TradeGroupsCache;

  // array of marginfi groups
  groups: PublicKey[];

  // array of extended bank objects (excluding USDC)
  banks: ExtendedBankInfo[];
  banksIncludingUSDC: ExtendedBankInfo[];

  // marginfi client, initialized when viewing an active group
  marginfiClient: MarginfiClient | null;

  // active group, currently being viewed / traded
  activeGroup: {
    token: ExtendedBankInfo;
    usdc: ExtendedBankInfo;
  } | null;

  // fetch groups / banks
  fetchTradeState: ({ connection, wallet }: { connection: Connection; wallet: Wallet }) => void;

  // set active banks and initialize marginfi client
  setActiveBank: ({
    bankPk,
    connection,
    wallet,
  }: {
    bankPk: PublicKey;
    connection: Connection;
    wallet: Wallet;
  }) => void;
};

const { programId } = getConfig();

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

function createTradeStore() {
  return create<TradeStoreState>(stateCreator);
}

const stateCreator: StateCreator<TradeStoreState, [], []> = (set, get) => ({
  initialized: false,
  groupsCache: {},
  groups: [],
  banks: [],
  banksIncludingUSDC: [],
  marginfiClient: null,
  activeGroup: null,

  fetchTradeState: async ({ connection, wallet }) => {
    try {
      // fetch groups
      const tradeGroups: TradeGroupsCache = await fetch(
        "https://storage.googleapis.com/mrgn-public/mfi-trade-groups.json"
      ).then((res) => res.json());

      if (!tradeGroups) {
        console.error("Failed to fetch trade groups");
        return;
      }

      const tokenMetadataMap = await loadTokenMetadatas(
        "https://storage.googleapis.com/mrgn-public/mfi-trade-metadata-cache.json"
      );

      const bankMetadataMap = await loadBankMetadatas(
        "https://storage.googleapis.com/mrgn-public/mfi-bank-metadata-cache.json"
      );

      const groups = Object.keys(tradeGroups).map((group) => new PublicKey(group));
      const allBanks: ExtendedBankInfo[] = [];

      await Promise.all(
        groups.map(async (group) => {
          const bankKeys = tradeGroups[group.toBase58()].map((bank) => new PublicKey(bank));
          const marginfiClient = await MarginfiClient.fetch(
            {
              environment: "production",
              cluster: "mainnet",
              programId,
              groupPk: group,
            },
            wallet,
            connection,
            {
              preloadedBankAddresses: bankKeys,
            }
          );
          const banksIncludingUSDC = Array.from(marginfiClient.banks.values());

          const banksWithPriceAndToken: {
            bank: Bank;
            oraclePrice: OraclePrice;
            tokenMetadata: TokenMetadata;
          }[] = [];

          banksIncludingUSDC.forEach((bank) => {
            const oraclePrice = marginfiClient.getOraclePriceByBank(bank.address);
            if (!oraclePrice) {
              return;
            }

            const bankMetadata = bankMetadataMap[bank.address.toBase58()];
            if (bankMetadata === undefined) {
              return;
            }

            try {
              const tokenMetadata = getValueInsensitive(tokenMetadataMap, bankMetadata.tokenSymbol);
              if (!tokenMetadata) {
                return;
              }

              banksWithPriceAndToken.push({ bank, oraclePrice, tokenMetadata });
            } catch (err) {
              console.error("error fetching token metadata: ", err);
            }
          });

          const [extendedBankInfos, extendedBankMetadatas] = banksWithPriceAndToken.reduce(
            (acc, { bank, oraclePrice, tokenMetadata }) => {
              acc[0].push(makeExtendedBankInfo(tokenMetadata, bank, oraclePrice));
              acc[1].push(makeExtendedBankMetadata(new PublicKey(bank.address), tokenMetadata));

              return acc;
            },
            [[], []] as [ExtendedBankInfo[], ExtendedBankMetadata[]]
          );

          allBanks.push(...extendedBankInfos);

          return;
        })
      );

      set((state) => {
        return {
          ...state,
          initialized: true,
          groupsCache: tradeGroups,
          groups,
          banks: allBanks.filter((bank) => !bank.info.rawBank.mint.equals(USDC_MINT)),
          banksIncludingUSDC: allBanks,
        };
      });
    } catch (error) {
      console.error(error);
    }
  },

  setActiveBank: async ({ bankPk, wallet, connection }) => {
    const bpk = new PublicKey(bankPk);
    const bank = get().banksIncludingUSDC.find((bank) => new PublicKey(bank.address).equals(bpk));
    if (!bank) return;

    const group = new PublicKey(bank.info.rawBank.group);
    const bankKeys = get().groupsCache[group.toBase58()].map((bank) => new PublicKey(bank));
    const marginfiClient = await MarginfiClient.fetch(
      {
        environment: "production",
        cluster: "mainnet",
        programId,
        groupPk: group,
      },
      wallet,
      connection,
      {
        preloadedBankAddresses: bankKeys,
      }
    );
    const groupsBanksKeys = get().groupsCache[group.toBase58()];
    const groupsBanks = get().banksIncludingUSDC.filter((bank) =>
      groupsBanksKeys.includes(new PublicKey(bank.address).toBase58())
    );

    set((state) => {
      return {
        ...state,
        marginfiClient,
        activeGroup: {
          token: groupsBanks[1],
          usdc: groupsBanks[0],
        },
      };
    });
  },
});

export { createTradeStore };
export type { TradeStoreState };