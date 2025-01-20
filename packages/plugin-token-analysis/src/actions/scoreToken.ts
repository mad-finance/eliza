import { composeContext, generateObjectDeprecated } from "@elizaos/core";
import {
    ActionExample,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    type Action,
} from "@elizaos/core";
import { TokenProvider } from "../providers/token";
import { createClientBase } from "@elizaos/client-twitter";
import { getClient } from "../services/mongo.ts";
import { executeTradeAction } from "./executeTrade.ts";
import {
    OptionalArrayScoreSchema,
    OptionalArrayTokenInfoSchema,
} from "./../types/schema.ts";

const messageTemplate = `Respond with a JSON markdown block, containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "ticker": "$BONSAI"
    "inputTokenAddress": "0x474f4cb764df9da079D94052fED39625c147C12C",
    "chain": "base"
}
\`\`\`

{{recentMessages}}

Given the recent messages extract the following information about the requested token:
- The token ticker
- Contract address of the token
- The chain that the token is on

ONLY GET THE MOST RECENT TOKEN INFO FROM THE MESSAGES. MOST LIKELY FROM THE VERY LAST MESSAGE.

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined. The result should be a valid JSON object with the following schema:
\`\`\`json
{
    "ticker": string | null,
    "inputTokenAddress": string | null,
    "chain": string | null
}
\`\`\`

The ticker will be several characters with a dollar sign in front such as $Degen, $BONSAI, $eth, $SOL, $BTC, $MOG, $wif. It may be all caps or all lower case or something in between.
The chain will be one of the following: ["solana", "ethereum", "arbitrum", "avalanche", "bsc", "optimism", "polygon", "base", "zksync"]
The token address will start with a "0x" and be 42 characters long, hexadecimal (example: 0x474f4cb764df9da079D94052fED39625c147C12C) UNLESS it is a Solana token in which case it will be 44 characters long and a mix of digits and letters (example: 5voS9evDjxF589WuEub5i4ti7FWQmZCsAsyD5ucbuRqM).
An example message would look like this: what about this token 0x00561688b20a2b8a47f504d44b7b63b996fbcbd4 on base?
`;

// TODO: update judgement instructions
const ratingTemplate = `Respond with a JSON markdown block, containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "rating": "STRONG_BUY",
    "reason": "This token is a strong buy because..."
}
\`\`\`

Social Report
{{socialResult}}

Technical Report
{{technicalResult}}

Should trade analysis (this is a boolean condition based on all of the technical report elements, defined as: isTop10Holder || isVolume24h || isPriceChange24h || isPriceChange12h || isUniqueWallet24h || isLiquidityTooLow || isMarketCapTooLow):
{{shouldTrade}}

You are an expert crypto and memecoin trader. You know how to combine charting skills with sentiment analysis to determine if a coin is under or over valued.

Given the social and technical reports assign the token a TokenScore rating. Note that there may be missing data for certain metrics since this reporting is still in development. Disregard this and make your analysis solely on the data present.
For the technical report the most important things are signs of momentum in increasing price, higher highs higher lows, increasing volume, that kind of thing.
For the social data an active community is one of the most important signals. Remember that we only fetch the 20 latest tweets from search and current token holders are always going to be hyper bullish on their own bags.
For the "should trade" result, this indicates that an action - buy or sell - is preffered to neutral. Note that if there is missing or empty data from the technical report, which may be the case for api calls that aren't supported yet, then this may not be accurate.

Beyond these things interpret the data as you see fit.

Token Score should be one of the following: "STRONG_SELL", "SELL", "NEUTRAL", "BUY", "STRONG_BUY"

Include your reasoning also. Respond with a JSON markdown block, containing only the extracted values. The result should be a valid JSON object with the following schema:
\`\`\`json
{
    "rating": string,
    "reason": string
}
\`\`\`
`;

// scoreToken should took CA, not symbol. return TokenScore enum

export enum TokenScore {
    STRONG_SELL = 0,
    SELL = 1,
    NEUTRAL = 2,
    BUY = 3,
    STRONG_BUY = 4,
}

// SOCIAL ANALYSIS
const socialAnalysis = async (
    runtime: IAgentRuntime,
    ticker: string
): Promise<{ socialReport: string; tweets: any[] }> => {
    // Ensure ticker starts with $ for Twitter search
    if (!ticker.startsWith("$")) {
        ticker = `$${ticker}`;
    }

    const client = await createClientBase(runtime);
    await client.init(true);
    const { tweets } = await client.searchWithDelay(ticker);
    let report = `Social Analysis Report for ${ticker}\n\n`;

    for (const tweet of tweets) {
        // Skip retweets to avoid duplicate content
        if (tweet.isRetweet) continue;

        const engagement = {
            likes: tweet.likes || 0,
            retweets: tweet.retweets || 0,
            replies: tweet.replies || 0,
            views: tweet.views || 0,
        };

        const timestamp = tweet.timeParsed
            ? new Date(tweet.timeParsed).toISOString()
            : "Unknown time";

        report += `---\nTweet: ${tweet.text}\n`;
        report += `Author: @${tweet.username}\n`;
        report += `Time: ${timestamp}\n`;
        report += `Engagement: ${engagement.likes} likes, ${engagement.retweets} RTs, ${engagement.replies} replies, ${engagement.views} views\n`;
    }

    return {
        socialReport: tweets?.length > 0 ? report : "No relevant tweets found",
        tweets,
    };
};

// TECHNICAL ANALYSIS
export const technicalAnalysis = async (
    inputTokenAddress: string,
    chain: string
): Promise<{ formattedReport: string; shouldTrade: boolean }> => {
    const tokenProvider = new TokenProvider(inputTokenAddress, chain);
    const result = await tokenProvider.getAllTokenReport();
    return result;
};

export const scoreToken: Action = {
    name: "SCORE_TOKEN",
    similes: ["SCORE_TOKEN", "RATE_TOKEN", "ANALYZE_TOKEN"],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Check if the necessary parameters are provided in the message
        console.log("Message:", message);
        return true;
    },
    description: "Analyze a token.",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<{
        score: TokenScore;
        scoreString: string;
        reason: string;
        tweets: any[];
    }> => {
        // composeState
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        let response;
        // @ts-ignore
        if (state.payload && state.payload.action === "SCORE_TOKEN") {
            const { data } = state.payload as { data: any };
            response = data;
        } else {
            const messageContext = composeContext({
                state,
                template: messageTemplate,
            });

            response = await generateObjectDeprecated({
                runtime,
                context: messageContext,
                modelClass: ModelClass.SMALL,
            });
        }

        console.log("response:", response);

        let { ticker, inputTokenAddress, chain } = response;
        ticker = ticker?.replace("$", "").toLowerCase();
        chain = chain?.toLowerCase();

        const [socialResult, technicalResult] = await Promise.all([
            ticker
                ? socialAnalysis(runtime, ticker)
                : Promise.resolve({
                      socialReport: "No ticker - skipping social analysis",
                      tweets: [],
                  }),
            inputTokenAddress && chain
                ? (async () => {
                      return technicalAnalysis(inputTokenAddress, chain);
                  })()
                : Promise.resolve({
                      formattedReport:
                          "No chain or token address - skipping technical analysis",
                      shouldTrade: false,
                  }),
        ]);

        // prompt LLM to read the results and return a TokenScore
        const context = ratingTemplate
            .replace("{{socialResult}}", socialResult.socialReport)
            .replace("{{technicalResult}}", technicalResult.formattedReport)
            .replace(
                "{{shouldTrade}}",
                technicalResult.shouldTrade ? "Yes" : "No"
            );
        let ratingResponse;
        try {
            ratingResponse = await generateObjectDeprecated({
                runtime,
                context,
                modelClass: ModelClass.SMALL,
            });
        } catch (error) {
            console.log(error);
            // fail gracefully
            callback?.({
                text: "Failed to generate rating, try again later",
                // @ts-ignore
                attachments: [],
                action: "NONE",
            });
            return;
        }

        const scoreString = ratingResponse.rating.replace(
            "TokenScore.",
            ""
        ) as keyof typeof TokenScore;
        const score = TokenScore[scoreString] as number;

        const attachments = socialResult.tweets.map(({ id, username }) => ({
            button: {
                label: `Post by @${username}`,
                url: `https://x.com/${username}/status/${id}`,
            },
        }));

        let objectId;
        // store non-neutral to the db - using ticker, userAddress as the uniq id
        if (score != TokenScore.NEUTRAL) {
            const { tickers } = await getClient();
            try {
                const result = await tickers.insertOne({
                    ticker,
                    inputTokenAddress,
                    chain,
                    score,
                    // @ts-ignore
                    userId: state.payload.userId,
                    agentId: message.agentId,
                    imageURL: response.imageURL,
                    createdAt: Math.floor(Date.now() / 1000),
                });
                objectId = result.insertedId;
            } catch (error) {
                if (
                    !error.message.includes(
                        "duplicate key error collection: moonshot.tickers"
                    )
                ) {
                    console.log(error);
                }
            }
        }

        // take action; TODO: should use trust score of the user
        if (
            technicalResult.shouldTrade &&
            (score == TokenScore.STRONG_SELL ||
                score == TokenScore.STRONG_BUY) &&
            inputTokenAddress &&
            chain
        ) {
            // send the response as a ws message
            callback?.({
                text: ratingResponse.reason,
                // @ts-expect-error attachments
                attachments,
                action: "EXECUTE_TRADE",
            });

            state.payload = {
                action: "EXECUTE_TRADE",
                data: {
                    score,
                    ticker,
                    inputTokenAddress,
                    chain,
                    objectId,
                },
            };

            // let this action handle the final callback
            await executeTradeAction.handler(
                runtime,
                message,
                state,
                {},
                callback
            );
        } else {
            // no action to take, handle normally
            callback?.({
                text: ratingResponse.reason,
                // @ts-ignore
                attachments,
                action: "NONE",
            });
        }

        return {
            score,
            scoreString,
            reason: ratingResponse.reason,
            tweets: socialResult.tweets,
        };
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Score this token on Base with ticker $BONSAI and CA: 0x474f4cb764df9da079d94052fed39625c147c12c",
                },
            },
            {
                user: "Sage",
                content: {
                    text: "Analyzing token 0x474f4cb764df9da079D94052fED39625c147C12C on Base",
                    action: "SCORE_TOKEN",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Rate this token on Base with ticker $BONSAI and CA: 0x474f4cb764df9da079d94052fed39625c147c12c",
                },
            },
            {
                user: "Sage",
                content: {
                    text: "Analyzing $BONSAI on Base",
                    action: "SCORE_TOKEN",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Analyze this token on Base with ticker $BONSAI and CA: 0x474f4cb764df9da079d94052fed39625c147c12c",
                },
            },
            {
                user: "Sage",
                content: {
                    text: "Analyzing $BONSAI on Base",
                    action: "SCORE_TOKEN",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
