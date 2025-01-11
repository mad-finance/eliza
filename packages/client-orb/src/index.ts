import bodyParser from "body-parser";
import cors from "cors";
import express, { Request as ExpressRequest } from "express";
import { Server as HttpServer, createServer } from "http";
import { Server as SocketIOServer, ServerOptions } from "socket.io";
import { v4 as uuid } from "uuid";
import {
    generateImage,
    generateText,
    Content,
    Memory,
    ModelClass,
    State,
    Client,
    IAgentRuntime,
    UUID,
    composeContext,
    generateMessageResponse,
    messageCompletionFooter,
    AgentRuntime,
    stringToUuid,
    settings,
} from "@elizaos/core";
import { isAddress } from "viem";
import createPost from "./services/orb/createPost";
import { getWallets } from "./services/coinbase.ts";
import { getRandomPrompt } from "./utils/postPrompt";
import { mintProfile } from "./services/lens/mintProfile";
import { getClient } from "./services/mongo";
import parseJwt from "./services/lens/parseJwt";
import { updateProfile } from "./services/lens/updateProfile";
// import { addDelegators } from "./services/lens/addDelegators";
import {
    downloadVideoBuffer,
    getLensImageURL,
    pinFile,
} from "./services/lens/ipfs";
import { tipPublication } from "./services/orb/tip";
import handleUserTips from "./utils/handleUserTips";
import ContentJudgementService from "./services/critic";
import { updatePointsWithProfileId } from "./services/stack";
import createPostAction from "./actions/createPost";
import searchTokenAction from "./actions/searchToken";
import { launchpadCreate } from "./actions/launchpadCreate";
import { sendMessage } from "./services/orb/sendMessage";
import { tokenAnalysisPlugin } from "@elizaos/plugin-token-analysis";
import { createClientBase } from "@elizaos/client-twitter";
import { DEXSCREENER_URL } from "./services/codex";
import { fetchFeed } from "./services/lens/fetchFeed";
import { searchLensForTerm } from "./services/lens/search.ts";
import { AGENT_HANDLE } from "./utils/constants.ts";
import {
    createTrendingClubReport,
    formatTrendingClubReport,
} from "./services/launchpad/trending.ts";
import { generateVideoRunway } from "./services/runway.ts";
import { launchpadAnalyticsAction } from "@elizaos/plugin-bonsai-launchpad";
import searchToken from "./services/launchpad/searchToken.ts";

export const messageHandlerTemplate =
    `# Action Examples
{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{messageDirections}}

{{recentMessages}}

{{actions}}

# Instructions: Write a response to the most recent message as {{agentName}}. Ignore "action". Don't say anything similar to a previous conversation message, make each thought fresh and unique. avoid responding with platitudes.
NO EMOJIS. don't take yourself to seriously, don't say 'ah' or 'oh', be brief and concise.
` + messageCompletionFooter;

export const longerMssageHandlerTemplate =
    `# Action Examples
{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{messageDirections}}

{{recentMessages}}

{{actions}}

# Instructions: Write a response to the most recent message as {{agentName}}. Ignore "action". Don't say anything similar to a previous conversation message, make each thought fresh and unique. avoid responding with platitudes.
NO EMOJIS. don't take yourself to seriously, don't say 'ah' or 'oh'. Feel free to be as concise or descriptive as you see fit. If requested to clarify or dive deeper, do so without hesitation. Feel free to 'hallucinate' once in a while to provide a more creative response.
` + messageCompletionFooter;

export const faqMessageHandlerTemplate =
    `About {{agentName}}:
{{bio}}
{{lore}}

{{providers}}

{{attachments}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{messageDirections}}

{{recentMessages}}

# This agent is associated with the Bonsai meme coin project - a cross chain social token for creativity and culture. It has expanded now to encapsulate AI agents such as this one and
will eventually allow for users to spin up their own. There is also a meme coin launchpad where users can create their own meme coin bonding curve to try and launch new tokens
onto the blockchain. this will be on Base and require a bonding curve to reach 69k USDC before the token is minted and a uniswap pool deployed. Once uniswap v4 is released you'll be
able to give your tokens custom hooks. Bonsai NFT holders will be first class citizens with a variety of perks including getting their token featured, and no trading or registration fees.
You can find all info about Bonsai on their homepage: bonsai.meme.

The Bonsai token can be found at these contract addresses (CA) for these chains:
Polygon: 0x3d2bD0e15829AA5C362a4144FdF4A1112fa29B5c
Base: 0x474f4cb764df9da079D94052fED39625c147C12C
zkSync: 0xB0588f9A9cADe7CD5f194a5fe77AcD6A58250f82

Bonsai started as a meme coin to bring the Lens community together. After being airdropped to top Lens profiles it expanded to Base and zkSync chains via LayerZero's OFT token standard
to become the culture token for web3 social and creatives. More recently it has expanded with Sage (you) - the first AI agent, running on an upgraded version of the ai16z Eliza platform
with expanded capabilities. Sage posts to X and Orb, a web3 social app, and also responds to content he likes or is relevant to Bonsai.

On Orb Sage will tip posts made in the Bonsai club if he thinks they are really good. His criteria is that it should be interesting, informative and/or entertaining and he considers whether
its relevant and constructive to the Bonsai community. When he judges content he looks at text and associated media. Sage ONLY tips on Orb, nowhere else.

This is all part of the Bons(ai) rebrand, taking Bonsai into the future by creating AI agents that are capable of posting online, conducting onchain transactions, talking with each other to improve decision
making, analyze onchain data, create tokens on the launchpad and make decisions independently as autonomous entities. You can also interact with agents such as Sage directly through the chat
interface at agent.bonsai.meme.

# Instructions: Write a response to the most recent message as {{agentName}}. Ignore "action". Be complete in your answers and say everything there is to say. Use the information
above when asked about details around the Bonsai project.
` +
    messageCompletionFooter +
    `For action just put 'NONE'. For the "text" part it has to be valid json. That means (amongst other things) no line breaks.`;

export interface Payload {
    action: string;
    data: { [key: string]: string };
}
export interface SimliClientConfig {
    apiKey: string;
    faceID: string;
    handleSilence: boolean;
    videoRef: HTMLVideoElement;
    audioRef: HTMLAudioElement;
}
export class OrbClient {
    private app: express.Application;
    private server: HttpServer;
    private io: SocketIOServer;
    private agents: Map<string, AgentRuntime>;
    private responded: Record<string, boolean>;

    constructor() {
        console.log("OrbClient constructor");
        this.app = express();
        this.server = createServer(this.app);
        this.io = new SocketIOServer<ServerOptions>(this.server, {
            cors: { origin: "*", methods: ["GET", "POST"] },
        });
        this.app.use(cors());
        this.agents = new Map();
        this.responded = {};

        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        this.initializeWebSocket();

        /* test endpoint for launchpad analysis */
        this.app.post(
            "/:agentId/launchpad-analysis",
            async (req: express.Request, res: express.Response) => {
                console.log("Launchpad Analysis");
                const agentId = req.params.agentId;
                const roomId =
                    req.body.roomId || stringToUuid("default-room-" + agentId);
                const userId = stringToUuid(req.body.userId ?? "user");

                let runtime = this.agents.get(agentId);

                // if runtime is null, look for runtime with the same name
                if (!runtime) {
                    runtime = Array.from(this.agents.values()).find(
                        (a) =>
                            a.character.name.toLowerCase() ===
                            agentId.toLowerCase()
                    );
                }

                if (!runtime) {
                    res.status(404).send("Agent not found");
                    return;
                }

                await runtime.ensureConnection(
                    userId,
                    roomId,
                    req.body.userName,
                    req.body.name,
                    "direct"
                );

                const text = req.body.text;
                const messageId = stringToUuid(Date.now().toString());

                const content: Content = {
                    text,
                    attachments: [],
                    source: "direct",
                    inReplyTo: undefined,
                };

                const memory: Memory = {
                    id: messageId,
                    agentId: runtime.agentId,
                    userId,
                    roomId,
                    content,
                    createdAt: Date.now(),
                };

                await runtime.messageManager.createMemory(memory);

                const result = await launchpadAnalyticsAction.handler(
                    runtime,
                    memory
                );
                res.json({ result });
            }
        );

        /* endpoint for get and rating a trending club */
        this.app.post(
            "/:agentId/trending-club",
            async (req: express.Request, res: express.Response) => {
                // get agent
                const agentId = req.params.agentId;
                const roomId = stringToUuid(
                    req.body.roomId ?? "default-room-" + agentId
                );
                const userId = stringToUuid(req.body.userId ?? "user");

                let runtime = this.agents.get(agentId);

                // if runtime is null, look for runtime with the same name
                if (!runtime) {
                    runtime = Array.from(this.agents.values()).find(
                        (a) =>
                            a.character.name.toLowerCase() ===
                            agentId.toLowerCase()
                    );
                }

                if (!runtime) {
                    res.status(404).send("Agent not found");
                    return;
                }

                await runtime.ensureConnection(
                    userId,
                    roomId,
                    req.body?.userName,
                    req.body?.name,
                    "direct"
                );

                const wallets = await getWallets(agentId);
                if (!wallets?.polygon) {
                    res.status(404).send("Polygon wallet not found");
                    return;
                }

                // get trending token report
                const clubResult = await createTrendingClubReport();
                const formatted = formatTrendingClubReport(clubResult);

                // create orb post
                await createPost(
                    wallets.polygon,
                    wallets.profile.id,
                    wallets.profile.handle,
                    formatted
                );

                res.json({ clubResult, formatted });
            }
        );

        this.app.get(
            "/bonsai-launchpad/search-token",
            async (req: express.Request, res: express.Response) => {
                const query = req.query.q as string;
                if (!query) {
                    res.status(400).json({
                        error: "Query parameter 'q' is required",
                    });
                } else {
                    const clubId = await searchToken(query);
                    res.status(200).json({ clubId });
                }
            }
        );

        /* endpoint for search lens */
        this.app.post(
            "/search-lens",
            async (req: express.Request, res: express.Response) => {
                const queryTerm = req.body.query;
                const lensResults = await searchLensForTerm(queryTerm);
                res.json(lensResults);
            }
        );

        /* test endpoint for token ratings */
        this.app.post(
            "/:agentId/score-token",
            async (req: express.Request, res: express.Response) => {
                console.log("Score Token");
                const agentId = req.params.agentId;
                const roomId =
                    req.body.roomId || stringToUuid("default-room-" + agentId);
                const userId = stringToUuid(req.body.userId ?? "user");

                let runtime = this.agents.get(agentId);

                // if runtime is null, look for runtime with the same name
                if (!runtime) {
                    runtime = Array.from(this.agents.values()).find(
                        (a) =>
                            a.character.name.toLowerCase() ===
                            agentId.toLowerCase()
                    );
                }

                if (!runtime) {
                    res.status(404).send("Agent not found");
                    return;
                }

                await runtime.ensureConnection(
                    userId,
                    roomId,
                    req.body.userName,
                    req.body.name,
                    "direct"
                );

                const text = req.body.text;
                const messageId = stringToUuid(Date.now().toString());

                const content: Content = {
                    text,
                    attachments: [],
                    source: "direct",
                    inReplyTo: undefined,
                };

                const memory: Memory = {
                    id: messageId,
                    agentId: runtime.agentId,
                    userId,
                    roomId,
                    content,
                    createdAt: Date.now(),
                };

                await runtime.messageManager.createMemory(memory);

                const tokenScoreAction = tokenAnalysisPlugin.actions[0];
                const result = await tokenScoreAction.handler(runtime, memory);
                res.json(result);
            }
        );

        // GENERAL ENTRY POINT
        this.app.post(
            "/:agentId/message",
            async (req: express.Request, res: express.Response) => {
                console.log("OrbClient message");
                const agentId = req.params.agentId;
                const roomId =
                    req.body.roomId || stringToUuid("default-room-" + agentId);
                const userId = stringToUuid(req.body.userId ?? "user");
                const payload: Payload = req.body.payload; // in order for actions to pull in preset params
                const imageURL = req.body.imageURL; // any image attachment

                let runtime = this.agents.get(agentId);

                // if runtime is null, look for runtime with the same name
                if (!runtime) {
                    runtime = Array.from(this.agents.values()).find(
                        (a) =>
                            a.character.name.toLowerCase() ===
                            agentId.toLowerCase()
                    );
                }

                if (!runtime) {
                    res.status(404).send("Agent not found");
                    return;
                }

                await runtime.ensureConnection(
                    userId,
                    roomId,
                    req.body.userName,
                    req.body.name,
                    "direct"
                );

                const text = req.body.text;
                const messageId = stringToUuid(Date.now().toString());

                const content: Content = {
                    text,
                    attachments: [],
                    source: "direct",
                    inReplyTo: undefined,
                };

                const userMessage = {
                    content,
                    userId,
                    roomId,
                    agentId: runtime.agentId,
                };

                const memory: Memory = {
                    id: messageId,
                    agentId: runtime.agentId,
                    userId,
                    roomId,
                    content,
                    createdAt: Date.now(),
                };

                await runtime.messageManager.createMemory(memory);

                const state = (await runtime.composeState(userMessage, {
                    agentName: runtime.character.name,
                })) as State;
                state.payload = {
                    ...payload,
                    userId: req.body.userId,
                };
                state.imageURL = imageURL;
                state.userAddress = req.body.userId
                    ? isAddress(req.body.userId)
                        ? req.body.userId
                        : undefined
                    : undefined;

                const context = composeContext({
                    state,
                    template: longerMssageHandlerTemplate,
                });

                const response = await generateMessageResponse({
                    runtime: runtime,
                    context,
                    modelClass: ModelClass.SMALL,
                });

                // save response to memory
                const responseMessage = {
                    ...userMessage,
                    userId: runtime.agentId,
                    content: response,
                };

                await runtime.messageManager.createMemory(responseMessage);

                if (!response) {
                    res.status(500).send(
                        "No response from generateMessageResponse"
                    );
                    return;
                }

                let message = null as Content | null;

                await runtime.evaluate(memory, state);

                // if we process some actions, send the original response as a ws event for feedback
                if (response.action !== "NONE") {
                    console.log("emitting to roomId", roomId);
                    this.io.to(roomId).emit(
                        "response",
                        JSON.stringify({
                            text: response.text,
                            action: "NONE",
                        })
                    );
                }

                // set the adminProfileId to be able to post to orb
                const token = req.headers["lens-access-token"] as string;
                if (token) {
                    const { id: adminProfileId } = parseJwt(token);
                    state.adminProfileId = adminProfileId;
                }

                const result = await runtime.processActions(
                    memory,
                    [responseMessage],
                    state,
                    async (newMessage) => {
                        if (newMessage.action !== "NONE") {
                            // doing this to skip duplicate messages
                            // TODO: maybe handle video too
                            if (newMessage.action === "GENERATE_IMAGE") {
                                return [memory];
                            }

                            console.log("emitting to roomId", roomId);
                            this.io.to(roomId).emit(
                                "response",
                                JSON.stringify({
                                    text: newMessage.text,
                                    attachments: newMessage.attachments,
                                    action: "NONE",
                                })
                            );
                        } else if (newMessage.source !== "imageGeneration") {
                            message = newMessage;
                        }

                        return [memory];
                    }
                );

                if (message) {
                    res.json([message, response]);
                } else {
                    res.json([response]);
                }
            }
        );

        this.app.post(
            "/:agentId/faq",
            async (req: express.Request, res: express.Response) => {
                console.log("FAQ message");
                const agentId = req.params.agentId;
                const roomId =
                    req.body.roomId || stringToUuid("default-room-" + agentId);
                const userId = stringToUuid(req.body.userId ?? "user");
                const payload: Payload = req.body.payload; // in order for actions to pull in preset params

                let runtime = this.agents.get(agentId);

                // if runtime is null, look for runtime with the same name
                if (!runtime) {
                    runtime = Array.from(this.agents.values()).find(
                        (a) =>
                            a.character.name.toLowerCase() ===
                            agentId.toLowerCase()
                    );
                }

                if (!runtime) {
                    res.status(404).send("Agent not found");
                    return;
                }

                await runtime.ensureConnection(
                    userId,
                    roomId,
                    req.body.userName,
                    req.body.name,
                    "direct"
                );

                const text = req.body.text;
                const messageId = stringToUuid(Date.now().toString());

                const content: Content = {
                    text,
                    attachments: [],
                    source: "direct",
                    inReplyTo: undefined,
                };

                const userMessage = {
                    content,
                    userId,
                    roomId,
                    agentId: runtime.agentId,
                };

                const memory: Memory = {
                    id: messageId,
                    agentId: runtime.agentId,
                    userId,
                    roomId,
                    content,
                    createdAt: Date.now(),
                };

                await runtime.messageManager.createMemory(memory);

                const state = (await runtime.composeState(userMessage, {
                    agentName: runtime.character.name,
                })) as State;
                state.payload = {
                    ...payload,
                    userId: req.body.userId,
                };

                const context = composeContext({
                    state,
                    template: faqMessageHandlerTemplate,
                });

                const response = await generateMessageResponse({
                    runtime: runtime,
                    context,
                    modelClass: ModelClass.SMALL,
                });

                // save response to memory
                const responseMessage = {
                    ...userMessage,
                    userId: runtime.agentId,
                    content: response,
                };

                await runtime.messageManager.createMemory(responseMessage);

                if (!response) {
                    res.status(500).send(
                        "No response from generateMessageResponse"
                    );
                    return;
                }

                let message = null as Content | null;

                await runtime.evaluate(memory, state);

                if (message) {
                    res.json([message, response]);
                } else {
                    res.json([response]);
                }
            }
        );

        // agent creates a post on bonsai club
        this.app.post(
            "/:agentId/orb/create-post",
            async (req: express.Request, res: express.Response) => {
                console.log("OrbClient create-post");
                // 7% chance of posting, sleep for some time
                const shouldPost = Math.random() < 0.07 || req.body?.shouldPost;
                if (!shouldPost) {
                    res.status(200).send("Skipped posting this time.");
                    return;
                }

                const sleepTime = Math.floor(Math.random() * 6) * 60000; // Sleep timer between 0-5 minutes
                if (!req.body?.shouldPost) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, sleepTime)
                    );
                }

                const agentId = req.params.agentId;
                const roomId = stringToUuid(
                    req.body.roomId ?? "default-room-" + agentId
                );
                const userId = stringToUuid(req.body.userId ?? "user");

                let runtime = this.agents.get(agentId);

                // if runtime is null, look for runtime with the same name
                if (!runtime) {
                    runtime = Array.from(this.agents.values()).find(
                        (a) =>
                            a.character.name.toLowerCase() ===
                            agentId.toLowerCase()
                    );
                }

                if (!runtime) {
                    res.status(404).send("Agent not found");
                    return;
                }

                await runtime.ensureConnection(
                    userId,
                    roomId,
                    req.body?.userName,
                    req.body?.name,
                    "direct"
                );

                const wallets = await getWallets(agentId);
                if (!wallets?.polygon) {
                    res.status(404).send("Polygon wallet not found");
                    return;
                }

                // get post prompt
                let text = req.body.text || getRandomPrompt();
                const randomNumber = Math.random();
                if (randomNumber < 0.6) {
                    const twitterSearchClient = await createClientBase(runtime);
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                    const homeTimeline =
                        await twitterSearchClient.fetchHomeTimeline(20);
                    // Format timeline into string of tweets and authors
                    const timelineText = homeTimeline
                        .map((tweet) => `@${tweet.username}: ${tweet.text}`)
                        .join("\n");

                    // Add timeline context to prompt text
                    text = `Here are some recent tweets from your timeline:\n${timelineText}\n\n Write a tweet of your own that's directly relevant to something that someone else is saying. Try to write something totally different than previous messages you've sent.`;
                } else if (randomNumber < 0.8) {
                    const homeTimeline = await fetchFeed(
                        wallets.polygon,
                        wallets.profile.id
                    );
                    // Format timeline into string of tweets and authors
                    const timelineText = homeTimeline
                        .map((post) => `${post.author}: ${post.content}`)
                        .join("\n");
                    text = `Here are some recent posts from your Lens timeline:\n${timelineText}\n\n Write a post of your own that's directly relevant to something that someone else is saying. Try to write something totally different than previous messages you've sent.`;
                }

                const messageId = stringToUuid(Date.now().toString());

                const content: Content = {
                    text,
                    attachments: [],
                    source: "direct",
                    inReplyTo: undefined,
                };

                const userMessage = {
                    content,
                    userId,
                    roomId,
                    agentId: runtime.agentId,
                };

                const memory: Memory = {
                    id: messageId,
                    agentId: runtime.agentId,
                    userId,
                    roomId,
                    content,
                    createdAt: Date.now(),
                };

                await runtime.messageManager.createMemory(memory);

                const state = (await runtime.composeState(userMessage, {
                    agentName: runtime.character.name,
                })) as State;

                const context = composeContext({
                    state,
                    template: messageHandlerTemplate,
                });

                const response = await generateMessageResponse({
                    runtime: runtime,
                    context,
                    modelClass: ModelClass.SMALL,
                });

                console.log("response", response);

                // save response to memory
                const responseMessage = {
                    ...userMessage,
                    userId: runtime.agentId,
                    content: response,
                };

                await runtime.messageManager.createMemory(responseMessage);

                if (!response) {
                    res.status(500).send(
                        "No response from generateMessageResponse"
                    );
                    return;
                }

                let message = null as Content | null;

                await runtime.evaluate(memory, state);

                /* generate an image */
                let imageUrl;
                let videoUrl;
                if (Math.random() < 0.3) {
                    const imagePrompt = `Generate a unique image to accompany this post: ${responseMessage.content.text}. Try to make images in varied styles that are different than previous ones.`;
                    const imageResponse = await generateImage(
                        { prompt: imagePrompt, width: 1024, height: 1024 },
                        runtime
                    );

                    if (imageResponse.success && imageResponse.data?.[0]) {
                        // Convert base64 to buffer
                        const base64Data = imageResponse.data[0].replace(
                            /^data:image\/\w+;base64,/,
                            ""
                        );
                        const imageBuffer = Buffer.from(base64Data, "base64");

                        // Create a file object that can be used with FormData
                        const file = {
                            buffer: imageBuffer,
                            originalname: `generated_${Date.now()}.png`,
                            mimetype: "image/png",
                        };

                        // Upload to your hosting service
                        imageUrl = await pinFile(file);
                        console.log("imageUrl", imageUrl);
                    }

                    /* generate a video */
                    if (Math.random() < 0.25) {
                        const videoPrompt = await generateText({
                            runtime,
                            context: `Write a succinct prompt to generate a captivating 5 second video based on this message: "${responseMessage.content.text}". Write only the prompt and nothing else, don't include any text in the video, only imagery. the prompt should involve some form of action taking place.`,
                            modelClass: ModelClass.SMALL,
                        });
                        console.log({
                            prompt: videoPrompt,
                            promptImage: imageUrl,
                        });
                        const videoResponse = await generateVideoRunway(
                            {
                                prompt: videoPrompt.slice(0, 510),
                                promptImage: imageUrl,
                            },
                            runtime
                        );
                        if (videoResponse.success && videoResponse.data?.[0]) {
                            try {
                                // Download the video from the URL
                                const videoBuffer = await downloadVideoBuffer(
                                    videoResponse.data[0]
                                );

                                // Create a file object that can be used with FormData
                                const file = {
                                    buffer: videoBuffer,
                                    originalname: `generated_video_${Date.now()}.mp4`,
                                    mimetype: "video/mp4",
                                };

                                // Upload to your hosting service using the existing pinFile function
                                videoUrl = await pinFile(file);
                                console.log(
                                    "Video uploaded successfully:",
                                    videoUrl
                                );
                            } catch (error) {
                                console.error("Error processing video:", error);
                            }
                        }
                    }
                }
                console.log(
                    videoUrl
                        ? "posting video"
                        : imageUrl
                          ? "posting image"
                          : "posting text only"
                );

                /* create post */
                await createPost(
                    wallets.polygon,
                    wallets.profile.id,
                    wallets.profile.handle,
                    responseMessage.content.text,
                    videoUrl ? undefined : imageUrl,
                    videoUrl
                );

                const result = await runtime.processActions(
                    memory,
                    [responseMessage],
                    state,
                    async (newMessages) => {
                        message = newMessages;
                        return [memory];
                    }
                );

                if (message) {
                    res.json([message, response]);
                } else {
                    res.json([response]);
                }
            }
        );

        // webhook endpoint to process a post from bonsai club
        this.app.post(
            "/orb/webhook/new-post",
            async (req: express.Request, res: express.Response) => {
                // TODO: authorization
                const params = req.body;
                if (params.profile_id == "0x088d93") {
                    res.status(500).send("no reply to self");
                    return;
                }
                if (this.responded[params.publication_id]) {
                    const message = `already responded to publication: ${params.publication_id}`;
                    console.log(message);
                    res.status(500).send(message);
                    return;
                }
                this.responded[params.publication_id] = true;
                const { collection, tips } = await getClient();
                const agent = await collection.findOne({
                    clubId: params.community_id,
                });
                if (!agent) {
                    res.status(404).send();
                    return;
                }

                let runtime = this.agents.get(agent.agentId);

                // if runtime is null, look for runtime with the same name
                if (!runtime) {
                    runtime = Array.from(this.agents.values()).find(
                        (a) =>
                            a.character.name.toLowerCase() ===
                            agent.agentId.toLowerCase()
                    );
                }

                if (!runtime) {
                    res.status(404).send("Agent not found");
                    return;
                }

                const contentJudgementService =
                    ContentJudgementService.getInstance(runtime);

                const wallets = await getWallets(agent.agentId, false);
                if (!wallets?.polygon) {
                    res.status(500).send("failed to load polygon wallet");
                    return;
                }

                const userId = stringToUuid(params.profile_id);
                const roomId = stringToUuid(params.community_id);
                const messageId = stringToUuid(params.publication_id);
                const content: Content = {
                    text: params.lens.content,
                    attachments: [],
                    source: "direct",
                    inReplyTo: undefined,
                };
                const userMessage = {
                    content,
                    userId,
                    roomId,
                    agentId: runtime.agentId,
                };

                const memory: Memory = {
                    id: messageId,
                    agentId: runtime.agentId,
                    userId,
                    roomId,
                    content: { text: params.lens.content },
                    createdAt: Date.now(),
                };
                const state = (await runtime.composeState(userMessage, {
                    agentName: runtime.character.name,
                })) as State;
                state.params = params;
                state.userMessage = userMessage.content.text;

                // if the agent was tagged, process as an action
                if (
                    params.lens.content.includes(agent.handle) &&
                    params.lens.content.toLowerCase().includes("create")
                ) {
                    // HACK: hardcoding this action for now, to skip the first process message
                    // save response to memory
                    const responseMessage = {
                        ...userMessage,
                        userId: runtime.agentId,
                        content: {
                            action: "CREATE_LAUNCHPAD_TOKEN",
                            text: "Creating token",
                        },
                    };

                    await runtime.messageManager.createMemory(responseMessage);
                    await runtime.evaluate(memory, state);

                    let message = null as Content | null;

                    await runtime.evaluate(memory, state);

                    await runtime.processActions(
                        memory,
                        [responseMessage],
                        state,
                        async (newMessages) => {
                            message = newMessages;
                            return [memory];
                        }
                    );

                    res.status(200).json({ message });
                } else {
                    try {
                        // rate the post and reply/tip
                        const content = params.lens.content;
                        const imageURL = params.lens.image?.item
                            ? getLensImageURL(params.lens.image?.item)
                            : undefined;
                        const { rating, comment } =
                            await contentJudgementService.judgeContent({
                                text: content,
                                imageUrl: imageURL,
                            });

                        console.log("RESULT");
                        console.log(
                            JSON.stringify({ rating, comment }, null, 2)
                        );

                        if (rating >= 5) {
                            // TODO: send sticker reaction from bonsai energy
                        }

                        // respond to tags
                        if (
                            (content
                                .toLowerCase()
                                .includes(`@lens/${agent.handle}`) &&
                                rating >= 3) ||
                            (rating >= 6 && rating < 8)
                        ) {
                            await createPost(
                                wallets?.polygon,
                                wallets?.profile?.id,
                                wallets?.profile?.handle,
                                comment,
                                undefined,
                                undefined,
                                params.publication_id
                            );
                        }

                        // tip with the reply
                        if (rating >= 7) {
                            const tipAmount = await handleUserTips(
                                tips,
                                rating,
                                agent.agentId,
                                params.profile_id
                            );
                            if (tipAmount > 0) {
                                await updatePointsWithProfileId(
                                    params.profile_id,
                                    "tip",
                                    tipAmount
                                );
                                await tipPublication(
                                    wallets?.polygon,
                                    wallets?.profile?.id,
                                    params.publication_id,
                                    tipAmount,
                                    comment
                                );
                            } else {
                                const reply = `${comment}. I'd tip you, but you exceeded your daily limit.`;
                                await createPost(
                                    wallets?.polygon,
                                    wallets?.profile?.id,
                                    wallets?.profile?.handle,
                                    reply,
                                    undefined,
                                    undefined,
                                    params.publication_id
                                );
                            }
                        }

                        // process actions (like responding with analysis)
                        await runtime.processActions(
                            memory,
                            [],
                            state,
                            async ({ text }) => {
                                await createPost(
                                    wallets?.polygon,
                                    wallets?.profile?.id,
                                    wallets?.profile?.handle,
                                    text,
                                    undefined,
                                    undefined,
                                    params.publication_id
                                );
                                return [];
                            }
                        );

                        res.status(200).json({ rating, comment });
                    } catch (error) {
                        console.log(error);
                        res.status(400).send(error);
                    }
                }
            }
        );

        // webhook endpoint to process a mention from any club (@sage_ai)
        this.app.post(
            "/orb/webhook/post-mention",
            async (req: express.Request, res: express.Response) => {
                // TODO: authorization
                const params = req.body;
                if (params.profileId == "0x088d93") {
                    res.status(500).send("no reply to self");
                    return;
                }
                if (this.responded[params.publicationId]) {
                    const message = `already responded to publication: ${params.publicationId}`;
                    console.log(message);
                    res.status(500).send(message);
                    return;
                }
                this.responded[params.publicationId] = true;
                const { collection } = await getClient();
                const agent = await collection.findOne({
                    handle: AGENT_HANDLE,
                });
                if (!agent) {
                    res.status(404).send();
                    return;
                }

                let runtime = this.agents.get(agent.agentId);

                // if runtime is null, look for runtime with the same name
                if (!runtime) {
                    runtime = Array.from(this.agents.values()).find(
                        (a) =>
                            a.character.name.toLowerCase() ===
                            agent.agentId.toLowerCase()
                    );
                }

                if (!runtime) {
                    res.status(404).send("Agent not found");
                    return;
                }

                const wallets = await getWallets(agent.agentId, false);
                if (!wallets?.polygon) {
                    res.status(500).send("failed to load polygon wallet");
                    return;
                }

                const userId = stringToUuid(params.profileId);
                const roomId = stringToUuid(params.publicationId);
                const messageId = stringToUuid(Date.now().toString());
                const content: Content = {
                    text: params.publicationData.lens.content,
                    attachments: [],
                    source: "direct",
                    inReplyTo: undefined,
                };
                const userMessage = {
                    content,
                    userId,
                    roomId,
                    agentId: runtime.agentId,
                };

                const memory: Memory = {
                    id: messageId,
                    agentId: runtime.agentId,
                    userId,
                    roomId,
                    content: { text: params.publicationData.lens.content },
                    createdAt: Date.now(),
                };
                await runtime.messageManager.createMemory(memory);

                const state = (await runtime.composeState(userMessage, {
                    agentName: runtime.character.name,
                })) as State;
                state.params = {
                    ...params,
                    lens: params.publicationData.lens,
                    publication_id: params.publicationId,
                    profile_id: params.profileId,
                };
                state.userMessage = userMessage.content.text;

                const context = composeContext({
                    state,
                    template: messageHandlerTemplate,
                });

                const response = await generateMessageResponse({
                    runtime: runtime,
                    context,
                    modelClass: ModelClass.SMALL,
                });

                let message = null as Content | null;

                // check if the message contains the word "create" and a $ followed by a word
                if (
                    /create \$\w+/i.test(
                        (state.userMessage as string).toLowerCase()
                    )
                ) {
                    // HACK: agent as the creator
                    const setSelfAsCreator =
                        (state.userMessage as string)
                            .toLowerCase()
                            .includes("yourself as creator") ||
                        (state.userMessage as string)
                            .toLowerCase()
                            .includes("yourself as the creator") ||
                        (state.userMessage as string)
                            .toLowerCase()
                            .includes("you as creator") ||
                        (state.userMessage as string)
                            .toLowerCase()
                            .includes("you as the creator") ||
                        (state.userMessage as string)
                            .toLowerCase()
                            .includes("you are the creator");
                    // @ts-ignore
                    state.params.setSelfAsCreator = setSelfAsCreator;
                    // HACK: hardcoding this action for now, to skip the first process message
                    const createTokenAction =
                        params.publicationData.lens.content
                            .toLowerCase()
                            .includes("create")
                            ? { action: "CREATE_LAUNCHPAD_TOKEN" }
                            : {};
                    // save response to memory
                    const responseMessage = {
                        ...userMessage,
                        userId: runtime.agentId,
                        content: {
                            ...response,
                            ...createTokenAction,
                        },
                    };

                    await runtime.messageManager.createMemory(responseMessage);
                    await runtime.evaluate(memory, state);

                    const result = await runtime.processActions(
                        memory,
                        [responseMessage],
                        state,
                        async (newMessages) => {
                            message = newMessages;
                            return [memory];
                        }
                    );
                } else {
                    // save response to memory
                    const responseMessage = {
                        ...userMessage,
                        userId: runtime.agentId,
                        content: response,
                    };

                    await runtime.messageManager.createMemory(responseMessage);

                    // simply reply
                    await createPost(
                        wallets?.polygon,
                        wallets?.profile?.id,
                        wallets?.profile?.handle,
                        response.text,
                        undefined,
                        undefined,
                        params.publicationId
                    );

                    // process actions (like responding with analysis)
                    await runtime.processActions(
                        memory,
                        [],
                        state,
                        async ({ text }) => {
                            await createPost(
                                wallets?.polygon,
                                wallets?.profile?.id,
                                wallets?.profile?.handle,
                                text,
                                undefined,
                                undefined,
                                params.publication_id
                            );
                            return [];
                        }
                    );
                }

                res.status(200).json({ response, message });
            }
        );

        // webhook endpoint to process a jam message from bonsai club
        this.app.post(
            "/orb/webhook/jam-message",
            async (req: express.Request, res: express.Response) => {
                // TODO: authorization
                const { message, channelId: clubId } = req.body;
                const userId = message.user.id;
                const messageId = message.messageId;
                if (userId == "0x088d93") {
                    res.status(500).send("no reply to self");
                    return;
                }
                if (this.responded[messageId]) {
                    res.status(200).send("already responded");
                    return;
                }
                this.responded[messageId] = true;
                const { collection } = await getClient();
                const agent = await collection.findOne({ clubId });
                if (!agent) {
                    res.status(404).send();
                    return;
                }

                const roomId = stringToUuid(clubId);

                const wallets = await getWallets(agent.agentId, false);
                console.log(JSON.stringify(wallets, null, 2));
                if (!wallets?.polygon) {
                    res.status(404).send("Polygon wallet not found");
                    return;
                }

                let runtime = this.agents.get(agent.agentId);

                // if runtime is null, look for runtime with the same name
                if (!runtime) {
                    runtime = Array.from(this.agents.values()).find(
                        (a) =>
                            a.character.name.toLowerCase() ===
                            agent.agentId.toLowerCase()
                    );
                }

                if (!runtime) {
                    res.status(404).send("Agent not found");
                    return;
                }

                await runtime.ensureConnection(
                    userId,
                    roomId as UUID,
                    req.body.userName,
                    req.body.name,
                    "direct"
                );

                const homeTimeline = await fetchFeed(
                    wallets.polygon,
                    wallets.profile.id
                );
                // Format timeline into string of tweets and authors
                const timelineText = homeTimeline
                    .map((post) => `${post.author}: ${post.content}`)
                    .join("\n");
                const text = `Here are some recent posts from your Lens timeline:\n${timelineText}\n\n Write a response to this message ${message.text} from ${message.user.name} of your own that could be relevant to something that someone else is saying. Try to write a direct response to this message, with our without knowing about your lens timeline.`;

                const content: Content = {
                    text,
                    attachments: [],
                    source: "direct",
                    inReplyTo: undefined,
                };

                const userMessage = {
                    content,
                    userId,
                    roomId: roomId as UUID,
                    agentId: runtime.agentId,
                };

                const memory: Memory = {
                    id: messageId,
                    agentId: runtime.agentId,
                    userId,
                    roomId: roomId as UUID,
                    content,
                    createdAt: Date.now(),
                };

                await runtime.messageManager.createMemory(memory);

                const state = (await runtime.composeState(userMessage, {
                    agentName: runtime.character.name,
                })) as State;

                const context = composeContext({
                    state,
                    template: messageHandlerTemplate,
                });

                const response = await generateMessageResponse({
                    runtime: runtime,
                    context,
                    modelClass: ModelClass.SMALL,
                });

                // send reply directly to the message
                await sendMessage(response.text, messageId);

                // process actions (like responding with analysis)
                await runtime.processActions(
                    memory,
                    [],
                    state,
                    async ({ text }) => {
                        await sendMessage(text, messageId);
                        return [];
                    }
                );
                res.status(200).send();
            }
        );

        // admin endpoint to create an agent
        this.app.post(
            "/admin/create/:agentId",
            async (req: express.Request, res: express.Response) => {
                // verify lens jwt token
                const { fundTxHash } = req.body;
                const { handle } = req.params;
                const agentId = uuid();
                const token = req.headers["lens-access-token"] as string;
                if (!token) {
                    res.status(401).send("Lens access token is required");
                    return;
                }
                const { id: adminProfileId } = parseJwt(token);
                if (!adminProfileId) {
                    res.status(403).send("Invalid access token");
                    return;
                }

                if (!handle) {
                    res.status(400).send("handle is required");
                    return;
                }

                const wallets = await getWallets(agentId, true);
                if (!wallets?.polygon)
                    res.status(500).send("failed to load polygon wallet");

                // TODO: verify `fundTxHash` was sent to this polygon wallet with value = 8 pol

                try {
                    // mints the profile with agentId as the handle, if not already taken
                    const { profileId, txHash } = await mintProfile(
                        wallets!.polygon,
                        handle
                    );

                    const { collection } = await getClient();
                    await collection.updateOne(
                        { agentId },
                        { $set: { profileId, adminProfileId, handle } }
                    );

                    res.status(!!profileId ? 200 : 400).json({
                        profileId,
                        txHash,
                    });
                } catch (error) {
                    console.log(error);
                    res.status(400).send(error);
                }
            }
        );

        // admin endpoint to update an agent
        this.app.put(
            "/admin/:agentId",
            async (req: express.Request, res: express.Response) => {
                // verify lens jwt token
                const { profileData, approveSignless } = req.body;
                const { agentId } = req.params;
                const token = req.headers["lens-access-token"] as string;
                if (!token) {
                    res.status(401).send("Lens access token is required");
                    return;
                }
                if (!profileData) {
                    res.status(400).send("profileData is required");
                    return;
                }
                const { id: adminProfileId } = parseJwt(token);

                const wallets = await getWallets(agentId);
                if (!wallets?.polygon) {
                    res.status(500).send("failed to load polygon wallet");
                    return;
                }
                if (wallets.adminProfileId != adminProfileId) {
                    res.status(403).send("not authenticated admin");
                    return;
                }

                try {
                    const success = await updateProfile(
                        wallets?.polygon,
                        wallets?.profile.id,
                        profileData,
                        approveSignless
                    );
                    // const success = true;
                    // await addDelegators(wallets?.polygon, wallets?.profile?.id, [
                    //     "0x28ff8e457feF9870B9d1529FE68Fbb95C3181f64"
                    // ]);

                    res.status(success ? 200 : 400).send();
                } catch (error) {
                    console.log(error);
                    res.status(400).send(error);
                }
            }
        );

        // get agent info
        this.app.get(
            "/:agentId/info",
            async (req: express.Request, res: express.Response) => {
                const { agentId } = req.params;
                if (!agentId) {
                    res.status(400).send();
                    return;
                }

                const wallets = await getWallets(agentId);
                if (!wallets) {
                    res.status(404).send();
                    return;
                }
                const [polygon] = await wallets.polygon.listAddresses();
                const [base] = await wallets?.base.listAddresses();
                const [baseSepolia] =
                    await wallets?.baseSepolia.listAddresses();

                res.status(200).json({
                    wallets: {
                        polygon: polygon.getId(),
                        base: base.getId(),
                        baseSepolia: baseSepolia.getId(),
                    },
                });
            }
        );

        // get agent actions
        this.app.get(
            "/:agentId/actions",
            async (req: express.Request, res: express.Response) => {
                // TODO: better aggregation pipeline for onlyTrades to group tokens
                const { agentId } = req.params;
                const { page, onlyTrades } = req.query;
                if (!agentId) {
                    res.status(400).send();
                    return;
                }

                let actions = [];
                const { tickers } = await getClient();
                const filter = !!onlyTrades ? { trade: { $ne: null } } : {};
                actions = await tickers
                    .find({ agentId, ...filter })
                    .sort({ createdAt: -1 })
                    .limit(51)
                    .skip(parseInt(page as string) * 50)
                    .toArray();

                const hasMore = actions.length > 50;
                if (hasMore) {
                    actions.pop();
                }
                actions = actions.map((ticker) => ({
                    type: "ticker",
                    createdAt: ticker.createdAt,
                    user: ticker.userId,
                    data: {
                        ticker: ticker.ticker,
                        chain: ticker.chain,
                        score: ticker.score,
                        inputTokenAddress: ticker.inputTokenAddress,
                        url: `${DEXSCREENER_URL}/${ticker.chain}/${ticker.inputTokenAddress}`,
                        imageURL: ticker.imageURL,
                        trade: onlyTrades ? ticker.trade : undefined,
                    },
                }));

                res.status(200).json({
                    actions,
                    hasMore,
                });
            }
        );
    }

    public registerAgent(runtime: AgentRuntime) {
        this.agents.set(runtime.agentId, runtime);
    }

    public unregisterAgent(runtime: AgentRuntime) {
        this.agents.delete(runtime.agentId);
    }

    public start(port: number) {
        // this.app.listen(port, () => {
        //     console.log(`Orb client running at http://localhost:${port}/`);
        // });
        this.server.listen(port, () => {
            console.log(
                `Orb client (and socket.io) server running on http://localhost:${port}/`
            );
        });
    }

    private initializeWebSocket() {
        this.io.on("connection", (socket) => {
            const roomId = socket.handshake.query.roomId as string;
            console.log(`ws joined: ${roomId}`);

            socket.join(roomId);
        });
    }
}

export const OrbClientInterface: Client = {
    start: async (runtime: AgentRuntime) => {
        console.log("OrbClientInterface start");
        const client = new OrbClient();
        const serverPort = parseInt(settings.SERVER_PORT || "3001");
        runtime.registerAction(createPostAction);
        runtime.registerAction(searchTokenAction);
        runtime.registerAction(tokenAnalysisPlugin.actions[0]); // tokenScoreAction
        runtime.registerAction(launchpadCreate);
        runtime.registerAction(launchpadAnalyticsAction);
        client.registerAgent(runtime);
        client.start(serverPort);
        return client;
    },
    stop: async (runtime: IAgentRuntime) => {
        console.warn("Orb client does not support stopping yet");
    },
};

export default OrbClientInterface;
