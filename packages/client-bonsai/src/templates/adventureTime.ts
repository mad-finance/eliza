import {
    elizaLogger,
    ModelClass,
    composeContext,
    generateObjectDeprecated,
    type IAgentRuntime,
    ModelProviderName,
    generateImage,
    generateObject,
} from "@elizaos/core";
import { ImageMetadata, MediaImageMimeType, URI } from "@lens-protocol/metadata";
import { uri, type Post, type TextOnlyMetadata } from "@lens-protocol/client";
import { base } from "viem/chains";
import { z } from "zod";
import {
    TemplateName,
    type SmartMedia,
    type Template,
    type TemplateHandlerResponse,
} from "../utils/types";
import { editPost, formatMetadata, uploadMetadata } from "../services/lens/createPost";
import { isMediaStale, getLatestComments, getVoteWeightFromBalance } from "../utils/utils";
import { parseAndUploadBase64Image, parseBase64Image, uploadJson } from "../utils/ipfs";
import { fetchAllCollectorsFor, fetchAllCommentsFor, fetchAllUpvotersFor } from "../services/lens/posts";
import { balanceOfBatched } from "../utils/viem";
import { privateKeyToAccount } from "viem/accounts";
import { storageClient } from "../services/lens/client";

export const nextPageTemplate = `
# Instructions
You are generating the next page in a choose-your-own-adventure story.
The story is defined by the Context (the overall setting and premise), Writing Style, and Previous Pages (each condensed into this format: CHAPTER_NAME; DECISION_TAKEN).
Based on this information, write the next page. If there are no Previous Pages, then simply produce the first page which sets up the rest of the story.
Each “page” should be roughly 1-2 short paragraphs (4-5 sentences each) describing the action or situation.
End the new page with two distinct decision choices that the reader can pick from. The decision should be related to the events of the current page.
Start the page with a descriptive chapter name that can be used for future prompts to summarize the page. Do not include the chapter number in the name.

Provide a prompt to use to generate an image that would be a good compliment to the content.
After you generate the page and image prompt, format your response into a JSON object with these properties:
 \`\`\`json
{
    chapterName: string,
    content: string,
    decisions: string[2],
    imagePrompt: string
}
}
\`\`\`

# Context
{{context}}

# Writing Style
{{writingStyle}}

# Previous Pages
{{previousPages}}

Do not acknowledge this request, simply respond with the JSON object.
`;

export const decisionTemplate = `
# Instructions
You must choose one of the two Decisions based on the Comments. When processing the comments, you must account for any references to the decisions. For example, a comment might say "option A", "option 1", or include part of a decision's text; all should map to the correct decision.
Each comment is formatted as: { content: string, votes: number }.
Important: For each comment that maps to a decision, use the vote count exactly as provided (i.e., the integer in the "votes" field) without applying any scaling, rounding, or additional arithmetic transformations. For example, if a decision receives a comment with { votes: 22 }, then add exactly 22 to that decision's total.
Map each comment to its corresponding decision by matching textual cues, then sum the votes for each decision by adding up the exact vote values from all matching comments.
Return the result as a JSON object with the decisions and their corresponding totalVotes, sorted in descending order by totalVotes.
The output should be a JSON block with the following format: \`\`\`json { "decisions": [{ "content": string, "totalVotes": number }] } \`\`\`

# Decisions
{{decisions}}

# Comments
{{comments}}

Do not acknowledge this request, simply respond with the JSON block wrapped in triple backticks with 'json' language identifier.
`;

const DecisionSchema = z.object({
    decisions: z.array(
        z.object({
            content: z.string(),
            totalVotes: z.number(),
        })
    )
});

type NextPageResponse = {
    chapterName: string;
    content: string;
    decisions: [string, string];
    imagePrompt: string;
}

type DecisionResponse = {
    decisions: {
        content: string;
        totalVotes: number;
    }[]
}

type TemplateData = {
    context: string;
    writingStyle: string;
    chapterName: string;
    decisions: string[];
    previousPages?: string[]; // maybe only store the last n pages?
    modelId?: string;
    stylePreset?: string;
    minCommentUpdateThreshold?: number;
}

const DEFAULT_MODEL_ID = "stable-diffusion-3.5"; // most creative
const DEFAULT_STYLE_PRESET = "Film Noir";
const DEFAULT_MIN_ENGAGEMENT_UPDATE_THREHOLD = 10; // at least 10 upvotes/comments before updating

/**
 * Handles the generation and updating of a "Choose Your Own Adventure" type post.
 * This function either generates a new adventure preview based on initial template data
 * or refreshes an existing adventure by evaluating new comments and votes to decide the next page.
 *
 * @param {IAgentRuntime} runtime - The eliza runtime environment providing utilities for generating content and images.
 * @param {boolean} refresh - Flag indicating whether to generate a new page or update an existing one.
 * @param {SmartMedia} [media] - The current, persisted media object associated with the adventure, used for updates.
 * @param {TemplateData} [_templateData] - Initial data for generating a new adventure preview, used when not refreshing.
 * @returns {Promise<TemplateHandlerResponse | null>} A promise that resolves to the response object containing the new page preview, uri (optional), and updated template data, or null if the operation cannot be completed.
 */
const adventureTime = {
    name: TemplateName.ADVENTURE_TIME,
    description: "Choose your own adventure. Creator sets the context and inits the post with the first page. The comment with the most votes dictates the direction of the story.",
    handler: async (
        runtime: IAgentRuntime,
        refresh: boolean,
        media?: SmartMedia,
        _templateData?: TemplateData,
    ): Promise<TemplateHandlerResponse | undefined> => {
        elizaLogger.log("Running template:", TemplateName.ADVENTURE_TIME);

        // either we are refreshing the persisted `media` object or we're generating a preview using `_templateData`
        const templateData = refresh ? media?.templateData as TemplateData : _templateData;
        if (!templateData) {
            elizaLogger.error("Missing template data");
            return;
        }

        try {
            if (refresh) {
                elizaLogger.info("running refresh");
                let comments: Post[]; // latest comments to evaluate for the next decision

                // if the post not stale, check if we've passed the min comment threshold
                if (isMediaStale(media as SmartMedia)) {
                    elizaLogger.info("is stale");
                    const allComments = await fetchAllCommentsFor(media?.postId as string);
                    comments = getLatestComments(media as SmartMedia, allComments);
                    const threshold = (media?.templateData as TemplateData).minCommentUpdateThreshold ||
                        DEFAULT_MIN_ENGAGEMENT_UPDATE_THREHOLD;
                    if (comments.length < threshold) {
                        elizaLogger.info(`adventureTime:: media ${media?.agentId} is not stale and has not met comment threshold; skipping`);
                        return;
                    }
                } else {
                    elizaLogger.info("not stale");
                    // do not update if the media isn't stale; we're paying for generations
                    return;
                }

                // fetch the token balances for each comment / upvote to use weighted votes
                const allCollectors = await fetchAllCollectorsFor(media?.postId as string);
                const commentsWeighted = await Promise.all(comments.map(async (comment) => {
                    const voters = await fetchAllUpvotersFor(comment.id);
                    const balances = await balanceOfBatched(
                        base,
                        [
                            comment.author.address,
                            ...voters.filter((account) => allCollectors.includes(account))
                        ],
                        media?.tokenAddress as `0x${string}`
                    );
                    return {
                        content: (comment.metadata as TextOnlyMetadata).content,
                        votes: balances.reduce((acc, b) => acc + getVoteWeightFromBalance(b), 0),
                    };
                }));

                console.log({ decisions: templateData.decisions, comments: JSON.stringify(commentsWeighted) });
                const context = composeContext({
                    // @ts-expect-error State
                    state: { decisions: templateData.decisions, comments: JSON.stringify(commentsWeighted) },
                    template: decisionTemplate,
                });

                // evaluate next decision
                elizaLogger.info("generating decision results:: generateObjectDeprecated");
                const results = (await generateObjectDeprecated({
                    runtime,
                    context,
                    modelClass: ModelClass.LARGE,
                    // modelProvider: ModelProviderName.VENICE,
                })) as unknown as DecisionResponse;
                elizaLogger.info("generated", results);

                // push to templateData.previousPages to be immediately used for a new generation
                if (templateData.previousPages) {
                    templateData.previousPages.push(`${templateData.chapterName}; ${results.decisions[0].content}`);
                } else {
                    templateData.previousPages = [`${templateData.chapterName}; ${results.decisions[0].content}`];
                }
                console.log("templateData.previousPages", templateData.previousPages);
            }

            const context = composeContext({
                // @ts-expect-error we don't need the full State object here to produce the context
                state: {
                    context: templateData.context,
                    previousPages: templateData.previousPages || '',
                    writingStyle: templateData.writingStyle
                },
                template: nextPageTemplate,
            });

            elizaLogger.info("generating page:: generateObjectDeprecated");
            const page = (await generateObjectDeprecated({
                runtime,
                context,
                modelClass: ModelClass.SMALL,
                // modelProvider: ModelProviderName.VENICE,
            })) as NextPageResponse;
            elizaLogger.info("generated", page);

            const imageResponse = await generateImage(
                {
                    prompt: page.imagePrompt,
                    width: 1024,
                    height: 1024,
                    imageModelProvider: ModelProviderName.OPENAI,
                    // TODO: somehow venice fails on some prompts
                    // imageModelProvider: ModelProviderName.VENICE,
                    // modelId: templateData.modelId || DEFAULT_MODEL_ID,
                    // stylePreset: templateData.stylePreset || DEFAULT_STYLE_PRESET,
                },
                runtime
            );

            const text = `
${page.chapterName}
${page.content}

Option A) ${page.decisions[0]}
Option B) ${page.decisions[1]}
`;

            let metadata: ImageMetadata | undefined;
            let updatedUri: string | undefined;
            if (refresh) {
                const url = await storageClient.resolve(media?.uri as URI);
                const json: ImageMetadata = await fetch(url).then(res => res.json());
                const imageUri = json.lens.image.item;

                // edit the image and format the metadata to be used to update
                await storageClient.editFile(
                    imageUri,
                    parseBase64Image(imageResponse) as File,
                    privateKeyToAccount(process.env.LENS_STORAGE_NODE_PRIVATE_KEY as `0x${string}`)
                );
                metadata = formatMetadata({
                    text,
                    image: {
                        url: imageUri,
                        type: MediaImageMimeType.PNG // see generation.ts the provider
                    }
                }) as ImageMetadata;

                // upload version to storj for versioning
                updatedUri = await uploadJson(formatMetadata({
                    text,
                    image: {
                        url: await parseAndUploadBase64Image(imageResponse) as string,
                        type: MediaImageMimeType.PNG // see generation.ts the provider
                    }
                }));
            }

            return {
                preview: {
                    text,
                    image: imageResponse.success ? imageResponse.data?.[0] : undefined,
                },
                metadata,
                updatedTemplateData: { ...templateData, decisions: page.decisions, chapterName: page.chapterName },
                updatedUri,
            }
        } catch (error) {
            elizaLogger.error("handler failed", error);
        }
    }
} as Template;

export default adventureTime;
