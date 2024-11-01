import { decodeEventLog, getAddress, TransactionReceipt, createPublicClient, http, Log } from "viem";
import { polygon } from "viem/chains";

interface GetEventFromReceiptProps {
  transactionReceipt: TransactionReceipt,
  contractAddress: `0x${string}`,
  abi: any,
  eventName: string
}

/**
 * return a decoded event object from `transactionReceipt`
 */
export const getEventFromReceipt = ({
  transactionReceipt,
  contractAddress,
  abi,
  eventName
}: GetEventFromReceiptProps): { args?: any } => {
  const logs: any[] = contractAddress
    ? transactionReceipt.logs.filter(({ address }) => getAddress(address) === getAddress(contractAddress))
    : transactionReceipt.logs;

  return logs
    .map((l) => {
      try {
        return decodeEventLog({ abi, data: l.data, topics: l.topics });
      } catch { return {}; }
    })
    .find((event: { eventName: string, args: any}) => event.eventName === eventName);
};

export const getPublicClient = (chain: string) => {
  if (chain === "polygon") {
    return createPublicClient({
      chain: polygon,
      transport: http(process.env.POLYGON_RPC_URL!),
    });
  } else {
    throw new Error("invalid chain");
  }
}