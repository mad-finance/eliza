import fs from "fs";
import { composeContext } from "../../core/context.ts";
import { log_to_file } from "../../core/logger.ts";
import { embeddingZeroVector } from "../../core/memory.ts";
import { Content, HandlerCallback, IAgentRuntime, Memory, ModelClass } from "../../core/types.ts";
import { stringToUuid } from "../../core/uuid.ts";
import { ClientBase } from "./base.ts";
import { generateText } from "../../core/generation.ts";
import createPost from "../../services/orb/createPost.ts";

const newPostPrompt = `{{timeline}}

{{providers}}

About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{postDirections}}

{{recentPosts}}

{{characterPostExamples}}

# Task: Generate a post in the voice and style of {{agentName}}, aka @{{twitterUserName}}
Write a single sentence post that is {{adjective}} about {{topic}} (without mentioning {{topic}} directly), from the perspective of {{agentName}}. Try to write something totally different than previous posts. Do not add commentary or ackwowledge this request, just write the post.
Your response should not contain any questions. Brief, concise statements only. No emojis. Use \\n\\n (double spaces) between statements.`;

export class OrbGenerationClient extends ClientBase {

    private wallets;

    constructor(runtime: IAgentRuntime, _wallets: any) {
        // Initialize the client and pass an optional callback to be called when the client is ready
        super({
            runtime,
        });

        this.wallets = _wallets
    }

    public async generateNewPost(generateImage = false): Promise<boolean> {
        console.log("Generating new post");
        try {
            let homeTimeline = [];

            if (!fs.existsSync("postcache")) fs.mkdirSync("postcache");
            
            // TODO: fetch timeline for including in request

            const state = await this.runtime.composeState(
                {
                    userId: this.runtime.agentId,
                    roomId: stringToUuid("orb_generate_room"),
                    agentId: this.runtime.agentId,
                    content: { text: "", action: "" },
                },
                {
                    orbUserName:
                        this.runtime.getSetting("ORB_USERNAME"),
                    timeline: homeTimeline, // formattedHomeTimeline,
                }
            );
            // Generate new post
            const context = composeContext({
                state,
                template: newPostPrompt,
            });

            const datestr = new Date().toUTCString().replace(/:/g, "-");

            // log context to file
            log_to_file(
                `${this.runtime.getSetting("TWITTER_USERNAME")}_${datestr}_generate_context`,
                context
            );

            const newPostContent = await generateText({
                runtime: this.runtime,
                context,
                modelClass: ModelClass.SMALL,
            });
            console.log("New Orb Post:", newPostContent);
            log_to_file(
                `BONSA_AI_${datestr}_generate_response`,
                // `${this.runtime.getSetting("TWITTER_USERNAME")}_${datestr}_generate_response`,
                JSON.stringify(newPostContent)
            );

            const content = newPostContent.replaceAll(/\\n/g, "\n").trim();

            const conversationId = datestr + "-" + this.runtime.agentId;
            const roomId = stringToUuid(conversationId);

            let imageURL = undefined;
            if (generateImage) {
                const callback: HandlerCallback = async (content: Content) => {
                    imageURL = content.attachments[0]?.url
                    return []
                };
                const memory = {
                    id: stringToUuid(datestr + "-" + this.runtime.agentId),
                    userId: this.runtime.agentId,
                    agentId: this.runtime.agentId,
                    content: {
                        text: content.trim(),
                        source: "orb",
                        action: "GENERATE_IMAGE"
                    },
                    roomId,
                    embedding: embeddingZeroVector,
                }
                await this.runtime.processActions(
                    memory,
                    [memory],
                    state,
                    callback
                );
            }

            // const rating  = await this.contentJudgementService.judgeContent({text: content, imageUrl: imageURL})
            // console.log("rating", rating)

            // Send the new post
            if (!this.dryRun) {
                try {
                    const postResult: { txHash: string, txId: string } = await this.requestQueue.add(
                        async () => await createPost(this.wallets?.polygon, this.wallets?.profile.id, content, imageURL)
                    );

                    // TODO: come back to these values
                    const post = {
                        id: postResult.txHash,
                        text: content,
                        conversationId: null,
                        createdAt: Date.now() * 1000,
                        userId: this.wallets?.profile.id,
                        inReplyToStatusId: null,
                        permanentUrl: `https://hey.xyz/${this.wallets?.profile.id}/${postResult.txHash}`,
                        hashtags: [],
                        mentions: [],
                        photos: [],
                        thread: [],
                        urls: [],
                        videos: [],
                    };

                    const postId = post.id;
                    

                    // make sure the agent is in the room
                    await this.runtime.ensureRoomExists(roomId);
                    await this.runtime.ensureParticipantInRoom(
                        this.runtime.agentId,
                        roomId
                    );

                    // TODO: cache posts
                    // await this.cacheTweet(tweet);

                    await this.runtime.messageManager.createMemory({
                        id: stringToUuid(postId + "-" + this.runtime.agentId),
                        userId: this.runtime.agentId,
                        agentId: this.runtime.agentId,
                        content: {
                            text: content.trim(),
                            url: post.permanentUrl,
                            source: "orb",
                        },
                        roomId,
                        embedding: embeddingZeroVector,
                        createdAt: post.createdAt,
                    });

                    return true
                } catch (error) {
                    console.error("Error sending orb post:", error);
                    return false
                }
            } else {
                console.log("Dry run, not sending orb post:", newPostContent);
                return false
            }
        } catch (error) {
            console.error("Error generating new orb post:", error);
            return false
        }
    }
}
