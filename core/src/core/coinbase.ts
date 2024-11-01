import { Coinbase, Wallet } from "@coinbase/coinbase-sdk";
import { getClient } from "./mongo";
import { decrypt, encrypt } from "../utils/crypto";

// lens profile
export type WalletProfile = { id: `0x${string}`, handle: string }
export const getWallets = async (agentId: string): Promise<{ base: Wallet, polygon: Wallet, profile?: WalletProfile, adminProfileId: string } | undefined> => {
  Coinbase.configure({
    apiKeyName: process.env.COINBASE_API_NAME! as string,
    privateKey: process.env.COINBASE_API_PRIVATE_KEY!.replaceAll("\\n", "\n") as string,
    // debugging: true
  });

  const { collection } = await getClient();

  let wallets: any;
  const walletData = await collection.findOne({ agentId });

  try {
    if (!walletData) {
      const [base, polygon] = await Promise.all([
        Wallet.create({ networkId: Coinbase.networks.BaseSepolia }),
        Wallet.create({ networkId: Coinbase.networks.PolygonMainnet })
      ]);

      await collection.insertOne({
        agentId,
        wallets: {
          base: encrypt(JSON.stringify(base.export())),
          polygon: encrypt(JSON.stringify(polygon.export()))
        }
      });
    } else {
      const [base, polygon] = await Promise.all([
        Wallet.import(JSON.parse(decrypt(walletData.wallets.base))),
        Wallet.import(JSON.parse(decrypt(walletData.wallets.polygon)))
      ]);

      wallets = {
        base,
        polygon,
        profile: { id: walletData.profileId, handle: agentId },
        adminProfileId: walletData.adminProfileId,
      };
    }
  } catch (error) {
    console.log("Failed to load wallet", error);
  }

  return wallets;
};
