import { Wallet } from "@coinbase/coinbase-sdk"
import { LensClient, production, isRelaySuccess, LensTransactionStatusType } from "@lens-protocol/client"
import { profile, ProfileOptions } from '@lens-protocol/metadata';

import { uploadJson } from "./ipfs"

const environment = production

// update profile metadata owned by the wallet
export default async (wallet: Wallet, profileId: string, profileData: ProfileOptions, approveSignless?: boolean) => {
  // authenticate with api
  const client = new LensClient({
    environment,
  })
  const [address] = await wallet.listAddresses()
  const challenge = await client.authentication.generateChallenge({
    signedBy: address as unknown as string,
    for: profileId,
  })
  const signature = await wallet.signMessage(challenge.text)
  await client.authentication.authenticate({ id: challenge.id, signature })

  const metadata = profile(profileData)
  const metadataURI = await uploadJson(metadata);

  // approve signless for all future txs
  if (approveSignless) {
    console.log('approving signless...');
    const typedDataResult = await client.profile.createChangeProfileManagersTypedData({
      approveSignless: true,
    });
    console.log(typedDataResult);
  }

  const result = await client.profile.setProfileMetadata({ metadataURI });

  // handle authentication errors
  if (result.isFailure()) return false;

  const data = result.value;

  if (!isRelaySuccess(data)) return false;

  // wait for the tx to be mined and indexed
  const completion = await client.transaction.waitUntilComplete({ forTxId: data.txId });
  return completion?.status === LensTransactionStatusType.Complete;
};
