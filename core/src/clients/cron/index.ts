import express from "express";
import { AgentRuntime } from "../../core/runtime.ts";
import { getWallets } from "../../core/coinbase.ts";
import createPost from "../../services/orb/createPost.ts";

class AdminClient {
  private app: express.Application;
  private agents: Map<string, AgentRuntime>;

  constructor(app: express.Application, agents: Map<string, AgentRuntime>) {
    this.app = app;
    this.agents = agents;

    this.app.post("/cron/:agentId/post", async (req: express.Request, res: express.Response) => {
      const token = req.headers['authorization'] as string;
      if (token !== `Bearer ${process.env.CRON_SECRET!}`) {
        res.status(401).send("Invalid authorization header");
        return;
      }

      const { agentId } = req.params;
      const wallets = await getWallets(agentId, true);

      if (!wallets?.polygon) res.status(500).send("failed to load polygon wallet");

      // TODO: choose what to post right now; imageURL should be hosted by us
      const text = undefined;
      const imageURL = undefined;

      try {
        const success = await createPost(wallets?.polygon, wallets?.profile.id, text, imageURL);

        res.status(!!success ? 200 : 400).json();
      } catch (error) {
        console.log(error);
        res.status(400).send(error);
      }
    });
  }
}

export default AdminClient;