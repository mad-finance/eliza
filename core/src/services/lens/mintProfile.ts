import { parseEther, zeroAddress } from "viem";
import { Wallet, Coinbase, Amount } from "@coinbase/coinbase-sdk";
import { isValidHandle } from "@lens-protocol/client";
import abi from "./abi/PermissionlessCreator.json";
import { getEventFromReceipt, getPublicClient } from "../../utils/viem";
import { LENS_HUB_PROXY, ASSET_ID_POL } from "../../utils/constants";
import Events from "./abi/Events";
import { bToHexString } from "../../utils/utils";

const PERMISSIONLESS_CREATOR_ADDRESS = "0x0b5e6100243f793e480DE6088dE6bA70aA9f3872";

// mint a profile and return the created profileId
export default async (wallet: Wallet, handle: string): Promise<{ profileId?: string, txHash?: string}> => {
  if (!isValidHandle(handle)) throw new Error(`invalid handle: ${handle}`);
  const [address] = await wallet.listAddresses()
  const args = {
    createProfileParams: [address.getId(), zeroAddress, "0x"],
    handle,
    delegatedExecutors: []
  };

  const contractInvocation = await wallet.invokeContract({
    contractAddress: PERMISSIONLESS_CREATOR_ADDRESS,
    method: "createProfileWithHandle",
    args,
    abi,
    assetId: "pol",
    amount: 8 // 8 POL to mint profile
  });

  await contractInvocation.wait();
  const hash = contractInvocation.getTransactionHash();
  console.log(`tx: ${hash}`);
  const transactionReceipt = await getPublicClient("polygon").waitForTransactionReceipt({
    hash: hash! as `0x${string}`,
  });

  const event = getEventFromReceipt({
    transactionReceipt: transactionReceipt!,
    contractAddress: LENS_HUB_PROXY,
    abi: Events,
    eventName: "ProfileCreated"
  });

  if (!event) throw new Error("profile created event not found");

  return {
    profileId: bToHexString(event.args?.profileId),
    txHash: hash
  };
};