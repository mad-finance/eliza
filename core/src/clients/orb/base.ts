import {
    Scraper,
    SearchMode,
    Tweet,
} from "agent-twitter-client";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
    IAgentRuntime,
    Memory,
    State,
} from "../../core/types.ts";
import ImageDescriptionService from "../../services/image.ts";

import { glob } from "glob";
import ContentJudgementService from "../../services/critic.ts";

export function extractAnswer(text: string): string {
    const startIndex = text.indexOf("Answer: ") + 8;
    const endIndex = text.indexOf("<|endoftext|>", 11);
    return text.slice(startIndex, endIndex);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RequestQueue {
    private queue: (() => Promise<any>)[] = [];
    private processing: boolean = false;

    async add<T>(request: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    const result = await request();
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
            this.processQueue();
        });
    }

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        this.processing = true;

        while (this.queue.length > 0) {
            const request = this.queue.shift()!;
            try {
                await request();
            } catch (error) {
                console.error("Error processing request:", error);
                this.queue.unshift(request);
                await this.exponentialBackoff(this.queue.length);
            }
            await this.randomDelay();
        }

        this.processing = false;
    }

    private async exponentialBackoff(retryCount: number): Promise<void> {
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    private async randomDelay(): Promise<void> {
        const delay = Math.floor(Math.random() * 2000) + 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}

export class ClientBase extends EventEmitter {
    static _twitterClient: Scraper;
    postClient: Scraper;
    runtime: IAgentRuntime;
    directions: string;
    lastCheckedPostId: number | null = null;
    postCacheFilePath = "postcache/latest_checked_post_id.txt";
    imageDescriptionService: ImageDescriptionService;
    contentJudgementService: ContentJudgementService;
    temperature: number = 0.5;
    dryRun: boolean = false;

    private postCache: Map<string, any /*Tweet*/> = new Map();
    requestQueue: RequestQueue = new RequestQueue();
    lensUserId: string;

    async cachePost(post: any /*Tweet*/): Promise<void> {
        if (!post) {
            console.warn("Lens post is undefined, skipping cache");
            return;
        }
        const cacheDir = path.join(
            __dirname,
            "../../../postcache",
            post.conversationId,
            `${post.id}.json`
        );
        await fs.promises.mkdir(path.dirname(cacheDir), { recursive: true });
        await fs.promises.writeFile(cacheDir, JSON.stringify(post, null, 2));
        this.postCache.set(post.id, post);
    }

    async getCachedPost(tweetId: string): Promise<Tweet | undefined> {
        if (this.postCache.has(tweetId)) {
            return this.postCache.get(tweetId);
        }

        const cacheFile = path.join(
            __dirname,
            "postcache",
            "*",
            `${tweetId}.json`
        );
        const files = await glob(cacheFile);
        if (files.length > 0) {
            const postData = await fs.promises.readFile(files[0], "utf-8");
            const post = JSON.parse(postData) /*as Tweet*/;
            this.postCache.set(post.id, post);
            return post;
        }

        return undefined;
    }

    async getPost(postId: string) {
        const cachedPost = await this.getCachedPost(postId);
        if (cachedPost) {
            return cachedPost;
        }

        // TODO: fetch post from lens api
        // TODO: cache post and return
        return null
    }

    callback: (self: ClientBase) => any = null;

    onReady() {
        throw new Error(
            "Not implemented in base class, please call from subclass"
        );
    }

    constructor({ runtime }: { runtime: IAgentRuntime }) {
        super();
        this.runtime = runtime;
        this.dryRun =
            this.runtime.getSetting("ORB_DRY_RUN")?.toLowerCase() ===
            "true";
        this.directions =
            "- " +
            this.runtime.character.style.all.join("\n- ") +
            "- " +
            this.runtime.character.style.post.join();
        this.contentJudgementService = ContentJudgementService.getInstance(this.runtime);

        try {
            if (fs.existsSync(this.postCacheFilePath)) {
                const data = fs.readFileSync(this.postCacheFilePath, "utf-8");
                this.lastCheckedPostId = parseInt(data.trim());
            } else {
                console.warn("Orb post cache file not found.");
            }
        } catch (error) {
            console.error(
                "Error loading latest checked orb post ID from file:",
                error
            );
        }
        const cookiesFilePath = path.join(
            __dirname,
            "../../../tweetcache/" +
                this.runtime.getSetting("TWITTER_USERNAME") +
                "_cookies.json"
        );

        const dir = path.dirname(cookiesFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async fetchHomeTimeline(
        // count = 25
    ) {
        // TODO: fetch timeline from lens api
    }

    async fetchSearchPosts(
        query: string,
        maxPosts: number,
        searchMode: SearchMode,
        cursor?: string
    ) {
        // TODO: implement this
        console.log(query, maxPosts, searchMode, cursor)
    }

    async saveRequestMessage(message: Memory, state: State) {
        if (message.content.text) {
            console.log(state)
            // TODO: implement?
        }
    }
}
