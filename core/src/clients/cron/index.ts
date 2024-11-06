import express from "express";
import { AgentRuntime } from "../../core/runtime.ts";
import { getWallets } from "../../core/coinbase.ts";
// import createPost from "../../services/orb/createPost.ts";
import { tipPublication } from "../../services/orb/tip.ts";

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

      // TODO: choose what to post right now; imageURL should be hosted by us
      // const text = "";
      // const imageURL = undefined;

      try {
        // const success = await createPost(wallets?.polygon, wallets?.profile.id, text, imageURL);

        const success = true;
        await tipPublication(wallets?.polygon, "0x0e76-0x03a6-DA-011927f3", 10, "hi from [REDACTED]");

        res.status(success ? 200 : 400).json();
      } catch (error) {
        console.log(error);
        res.status(400).send(error);
      }
    });
  }
}

export { CronClient };