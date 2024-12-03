import { request, gql } from "graphql-request";
import { getAddress } from "viem";
import { BONSAI_TOKEN_ADDRESS_BASE } from "../utils/constants";

const CODEX_API_URL = "https://graph.codex.io/graphql";
const DEFAULT_LIQUIDITY = 100_000; // TODO: increase once bonsai is up
const DEFAULT_MCAP = 1_000_000;
const DEFAULT_NETWORK_IDS = [1, 8453, 1399811149]; // mainnet, base, solana
export const NETWORK_ID_TO_NAME = {
    8453: "Base",
    1: "Ethereum",
    1399811149: "Solana",
};
export const NETWORK_NAME_TO_NETWORK_ID = {
    base: 8453,
    ethereum: 1,
    solana: 1399811149,
};
export const NETWORK_NAME_TO_EXPLORER_URL = {
    base: "https://basescan.org",
    ethereum: "https://etherscan.io",
    solana: "https://solscan.io",
};
export const DEXSCREENER_URL = "https://dexscreener.com";

const HARDCODED_TOKENS_PER_CHAIN = {
    8453: [BONSAI_TOKEN_ADDRESS_BASE.toLowerCase()],
    1: [],
    1399811149: [],
};

const FILTER_TOKENS = gql`
    query FilterTokens(
        $phrase: String!
        $networkIds: [Int!]
        $liquidity: Float!
        $marketCap: Float!
    ) {
        filterTokens(
            filters: {
                network: $networkIds
                liquidity: { gt: $liquidity }
                marketCap: { gt: $marketCap }
            }
            phrase: $phrase
            limit: 1
            rankings: [{ attribute: liquidity, direction: DESC }]
        ) {
            results {
                buyCount1
                high1
                txnCount1
                uniqueTransactions1
                volume1
                liquidity
                marketCap
                priceUSD
                pair {
                    token0
                    token1
                }
                exchanges {
                    name
                }
                token {
                    address
                    decimals
                    name
                    networkId
                    symbol
                    info {
                        imageSmallUrl
                    }
                }
            }
        }
    }
`;

const query = async (query, variables) => {
    return await request(CODEX_API_URL, query, variables, {
        authorization: process.env.CODEX_API_KEY,
    });
};

type TokenResult = {
    buyCount1: number;
    high1: number;
    txnCount1: number;
    uniqueTransactions1: number;
    volume1: number;
    liquidity: number;
    marketCap: number;
    priceUSD: number;
    pair: {
        token0: string;
        token1: string;
    };
    exchanges: {
        name: string;
    }[];
    token: {
        address: string;
        decimals: number;
        name: string;
        networkId: number;
        symbol: string;
        networkName?: string;
        info?: {
            imageSmallUrl?: string;
        };
    };
};
export const searchTokens = async (
    phrase: string,
    contractAddress?: string
): Promise<TokenResult[]> => {
    try {
        if (phrase.toLowerCase() === "bonsai") {
            // HACK: until we have higher mcap
            contractAddress = getAddress(BONSAI_TOKEN_ADDRESS_BASE);
        }
        const data = (await query(FILTER_TOKENS, {
            phrase: contractAddress || phrase,
            liquidity: contractAddress ? 0 : DEFAULT_LIQUIDITY,
            networkIds: DEFAULT_NETWORK_IDS,
            marketCap: contractAddress ? 0 : DEFAULT_MCAP,
        })) as { filterTokens: { results: TokenResult[] } };

        const res = data.filterTokens?.results;

        // filter by hardcoded tokens
        const filteredRes = res?.find((tokenResult) =>
            HARDCODED_TOKENS_PER_CHAIN[tokenResult.token.networkId].includes(
                tokenResult.token.address.toLowerCase()
            )
        );

        return filteredRes ? [filteredRes] : res;
    } catch (error) {
        console.log(error);
        return [];
    }
};