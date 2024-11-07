import express from "express";
import { AgentRuntime } from "../../core/runtime.ts";
import { getWallets } from "../../core/coinbase.ts";
// import createPost from "../../services/orb/createPost.ts";
import { tipPublication } from "../../services/orb/tip.ts";
import { OrbGenerationClient } from "../orb/generate.ts";
import { createAgentRuntime, createDirectRuntime, getTokenForProvider, initializeDatabase } from "../../cli/index.ts";
import  { DirectClient } from "../direct/index.ts";
import defaultCharacter from "../../core/defaultCharacter.ts";

class CronClient {
  private app: express.Application;
  private agents: Map<string, AgentRuntime>;

  constructor(app: express.Application, agents: Map<string, AgentRuntime>) {
    this.app = app;
    this.agents = agents;

    this.app.post("/cron/:agentId/post", async (req: express.Request, res: express.Response) => {
      // const token = req.headers['authorization'] as string;
      // if (token !== `Bearer ${process.env.CRON_SECRET!}`) {
      //   res.status(401).send("Invalid authorization header");
      //   return;
      // }

      const { agentId } = req.params;
      const wallets = await getWallets(agentId, true);

      if (!wallets?.polygon) res.status(500).send("failed to load polygon wallet");

      try {
        
        /* start character and runtime */
        const character = defaultCharacter;
        const directClient = new DirectClient();
        console.log(`Starting agent for character ${character.name}`);
        const token = getTokenForProvider(character.modelProvider, character);
        const db = initializeDatabase();
    
        const runtime = await createAgentRuntime(character, db, token);
        const directRuntime = createDirectRuntime(character, db, token);
    
        const client = new OrbGenerationClient(runtime, wallets);
        directClient.registerAgent(await directRuntime);

        /* create post */
        const generateImage = Math.random() < 0.15
        const success = await client.generateNewPost(generateImage)

        res.status(success ? 200 : 400).json();
      } catch (error) {
        console.log(error);
        res.status(400).send(error);
      }
    });
  }
}

export { CronClient };