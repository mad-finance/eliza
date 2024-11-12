import bodyParser from "body-parser";
import cors from "cors";
import express, { Request as ExpressRequest } from "express";
import multer, { File } from "multer";
import { generateCaption, generateImage } from "@ai16z/eliza/src/generation.ts";
import { composeContext } from "@ai16z/eliza/src/context.ts";
import { generateMessageResponse } from "@ai16z/eliza/src/generation.ts";
import { messageCompletionFooter } from "@ai16z/eliza/src/parsing.ts";
import { AgentRuntime } from "@ai16z/eliza/src/runtime.ts";
import {
    Content,
    Memory,
    ModelClass,
    State,
    Client,
    IAgentRuntime,
} from "@ai16z/eliza/src/types.ts";
import { stringToUuid } from "@ai16z/eliza/src/uuid.ts";
import settings from "@ai16z/eliza/src/settings.ts";
import createPost from "./services/orb/createPost.ts";
import { getWallets } from "./services/coinbase.ts";
import { getRandomPrompt } from "./utils/postPrompt.ts";
import { mintProfile } from "./services/lens/mintProfile.ts";
import { getClient } from "./services/mongo.ts";
import parseJwt from "./services/lens/parseJwt.ts";
import { updateProfile } from "./services/lens/updateProfile.ts";
// import { addDelegators } from "./services/lens/addDelegators.ts";
import { getLensImageURL } from "./services/lens/ipfs.ts";
import { tipPublication } from "./services/orb/tip.ts";
import handleUserTips from "./utils/handleUserTips.ts";
const upload = multer({ storage: multer.memoryStorage() });

export const messageHandlerTemplate =
    // {{goals}}
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

# Instructions: Write the next thought for {{agentName}}. Ignore "action".
` + messageCompletionFooter;

export interface SimliClientConfig {
    apiKey: string;
    faceID: string;
    handleSilence: boolean;
    videoRef: any;
    audioRef: any;
}
export class OrbClient {
    private app: express.Application;
    private agents: Map<string, AgentRuntime>;

    constructor() {
        console.log("OrbClient constructor");
        this.app = express();
        this.app.use(cors());
        this.agents = new Map();

        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));

        // agent creates a post on bonsai club
        this.app.post(
            "/:agentId/orb/create-post",
            async (req: express.Request, res: express.Response) => {
                console.log("OrbClient create-post");
                // 10% chance of posting, sleep for some time
                const shouldPost = Math.random() < 0.1 || req.body.shouldPost;
                if (!shouldPost) {
                    res.status(200).send("Skipped posting this time.");
                    return;
                }

                const sleepTime = Math.floor(Math.random() * 6) * 60000; // Sleep timer between 0-5 minutes
                if (!req.body.shouldPost) {
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

                const wallets = await getWallets(agentId, true);
                if (!wallets?.polygon) {
                    res.status(404).send("Polygon wallet not found");
                    return;
                }

                const text = req.body.text || getRandomPrompt();

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

                // TODO: writes a new post, not responding to message
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
                if (Math.random() < 0.15) {
                    // TODO: generate a prompt based on the post
                    const imagePrompt = `Generate an image to accompany this post: ${responseMessage.content.text}`;
                    const imageResponse = await generateImage(
                        { prompt: imagePrompt, width: 1024, height: 1024 },
                        runtime
                    );
                    // TODO: this url is base64 data. upload to ipfs first?
                    imageUrl = imageResponse.data[0];
                }
                console.log("imageUrl", imageUrl);

                /* create post */
                if (process.env.ORB_DRY_RUN != "true") {
                    await createPost(
                        wallets.polygon,
                        wallets.profile.id,
                        responseMessage.content.text,
                        imageUrl
                    );
                }

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

                const { collection, tips } = await getClient();
                const agent = await collection.findOne({
                    clubId: params.community_id,
                });
                if (!agent) {
                    res.status(404).send();
                    return;
                }

                const wallets = await getWallets(agent.agentId, false);
                if (!wallets?.polygon) {
                    res.status(500).send("failed to load polygon wallet");
                    return;
                }

                try {
                    // process content from the publication, perform the resulting action
                    const content = params.lens.content;
                    const imageURL = params.lens.image?.item
                        ? getLensImageURL(params.lens.image?.item)
                        : undefined;
                    // TODO: after refactor
                    // const { rating, comment } = await this.contentJudgementService.judgeContent({ text: content, imageUrl: imageURL })
                    const rating = 5;
                    const comment = "";
                    if (rating >= 5) {
                        // TODO: send sticker reaction from bonsai energy
                    }

                    if (rating >= 6 && rating < 8) {
                        await createPost(
                            wallets?.polygon,
                            wallets?.profile?.id,
                            comment,
                            undefined,
                            params.publication_id
                        );
                    }

                    // tip with the reply
                    if (rating >= 8) {
                        const tipAmount = await handleUserTips(
                            tips,
                            rating,
                            agent.agentId,
                            params.profile_id
                        );
                        if (tipAmount > 0) {
                            await tipPublication(
                                wallets?.polygon,
                                params.publication_id,
                                tipAmount,
                                comment
                            );
                        } else {
                            const reply = `${comment}. I'd tip you, but you exceeded your daily limit.`;
                            await createPost(
                                wallets?.polygon,
                                wallets?.profile?.id,
                                reply,
                                undefined,
                                params.publication_id
                            );
                        }
                    }

                    res.status(200).json();
                } catch (error) {
                    console.log(error);
                    res.status(400).send(error);
                }
            }
        );

        // admin endpoint to create an agent
        this.app.post(
            "/admin/create/:agentId",
            async (req: express.Request, res: express.Response) => {
                // verify lens jwt token
                const { fundTxHash } = req.body;
                const { agentId } = req.params;
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

                if (!agentId) {
                    res.status(400).send("agentId is required");
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
                        agentId
                    );

                    const { collection } = await getClient();
                    await collection.updateOne(
                        { agentId },
                        { $set: { profileId, adminProfileId } }
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

                res.status(200).json({
                    wallets: { polygon: polygon.getId(), base: base.getId() },
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
        this.app.listen(port, () => {
            console.log(`Orb client running at http://localhost:${port}/`);
        });
    }
}

export const OrbClientInterface: Client = {
    start: async (runtime: AgentRuntime) => {
        console.log("OrbClientInterface start");
        const client = new OrbClient();
        const serverPort = parseInt(settings.SERVER_PORT || "3001");
        client.registerAgent(runtime);
        client.start(serverPort);
        return client;
    },
    stop: async (runtime: IAgentRuntime) => {
        console.warn("Orb client does not support stopping yet");
    },
};

export default OrbClientInterface;
