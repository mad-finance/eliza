import {
    createPublicClient,
    http,
    parseUnits,
    formatEther,
    TransactionReceipt,
    zeroAddress,
    erc20Abi,
    maxUint256,
    decodeAbiParameters,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { groupBy, reduce } from "lodash/collection";
import { Wallet } from "@coinbase/coinbase-sdk";
import { BonsaiLaunchpadAbi } from "@elizaos/plugin-bonsai-launchpad";
import { getEventFromReceipt, encodeAbi } from "../../utils/viem";
import { toHexString } from "../../utils/utils";
import { CHAIN_TO_RPC } from "../../utils/constants";
import { elizaLogger } from "@elizaos/core";

export const IS_PRODUCTION = true; // process.env.LAUNCHPAD_CHAIN_ID === "8453";
export const CONTRACT_CHAIN_ID = IS_PRODUCTION ? base.id : baseSepolia.id;
export const CHAIN = IS_PRODUCTION ? base : baseSepolia;
export const LAUNCHPAD_CONTRACT_ADDRESS = IS_PRODUCTION
    ? "0xA44dD13Bd66C4C4aDF8F70c3DFA26334764C1d64"
    : "0x60aaa60eb9a11f3e82e2ca87631d4b37e1b88891";

export const INITIAL_CHIP_SUPPLY_CAP = 10; // with 6 decimals in the contract
export const DECIMALS = 6;
export const USDC_DECIMALS = 6;

export const USDC_CONTRACT_ADDRESS = IS_PRODUCTION
    ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const DEFAULT_HOOK_ADDRESS = IS_PRODUCTION
    ? zeroAddress
    : "0xA788031C591B6824c032a0EFe74837EE5eaeC080";
export const BONSAI_TOKEN_ADDRESS_BASE = IS_PRODUCTION
    ? "0x474f4cb764df9da079D94052fED39625c147C12C"
    : "0x3d2bD0e15829AA5C362a4144FdF4A1112fa29B5c";
export const BONSAI_NFT_BASE_ADDRESS = IS_PRODUCTION
    ? "0xf060fd6b66B13421c1E514e9f10BedAD52cF241e"
    : "0xE9d2FA815B95A9d087862a09079549F351DaB9bd";

export const publicClient = () => {
    const chain = IS_PRODUCTION ? base : baseSepolia;
    return createPublicClient({
        chain,
        transport: http(CHAIN_TO_RPC[chain.id]),
    });
};

type RegistrationParams = {
    pubId: string; // webhook post
    handle: string; // creator
    profileId: string; // creator
    tokenName: string;
    tokenSymbol: string;
    tokenDescription: string;
    tokenImage: string;
    initialSupply: string;
    curveType?: number; // default to 1
    strategy?: string; // default to "lens"
};
export const registerClub = async (
    wallet: Wallet,
    creator: `0x${string}`,
    params: RegistrationParams
): Promise<{ objectId?: string; clubId?: string }> => {
    const token = encodeAbi(
        ["string", "string", "string"],
        [params.tokenName, params.tokenSymbol, params.tokenImage]
    );
    const contractInvocation = await wallet.invokeContract({
        contractAddress: LAUNCHPAD_CONTRACT_ADDRESS,
        abi: BonsaiLaunchpadAbi,
        method: "registerClub",
        args: {
            hook: DEFAULT_HOOK_ADDRESS,
            token,
            initialSupply: params.initialSupply,
            curve: (params.curveType ?? 1).toString(),
            creator,
        },
    });
    await contractInvocation.wait();
    const hash = contractInvocation.getTransactionHash();
    console.log(`tx: ${hash}`);
    const receipt: TransactionReceipt =
        await publicClient().waitForTransactionReceipt({
            hash: hash as `0x${string}`,
        });
    let clubId;
    if (receipt.status === "success") {
        const event = getEventFromReceipt({
            contractAddress: LAUNCHPAD_CONTRACT_ADDRESS,
            transactionReceipt: receipt,
            abi: BonsaiLaunchpadAbi,
            eventName: "RegisteredClub",
        });
        clubId = event.args.clubId;
    } else {
        elizaLogger.error("contract::registerClub ERROR - TX FAILED");
    }

    return { clubId };
};

export const getRegistrationFee = async (
    amountEther: string,
    curve: number,
    account?: `0x${string}`
): Promise<bigint> => {
    const amountWithDecimals = parseUnits(amountEther, DECIMALS);
    const client = publicClient();
    return (await client.readContract({
        address: LAUNCHPAD_CONTRACT_ADDRESS,
        abi: BonsaiLaunchpadAbi,
        functionName: "getRegistrationFee",
        args: [amountWithDecimals, curve],
        account,
    })) as bigint;
};

export const getTokenBalance = async (
    account: `0x${string}`,
    token = USDC_CONTRACT_ADDRESS
): Promise<bigint> => {
    const client = publicClient();
    return (await client.readContract({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account],
    })) as bigint;
};
