import express from "express";
import { AgentRuntime } from "../../core/runtime.ts";
import { getWallets } from "../../core/coinbase.ts";
import { mintProfile } from "../../services/lens/mintProfile.ts";
import { getClient } from "../../core/mongo.ts";
import parseJwt from "../../services/lens/parseJwt.ts";
import { updateProfile } from "../../services/lens/updateProfile.ts";
import { addDelegators } from "../../services/lens/addDelegators.ts";

class AdminClient {
  private app: express.Application;
  private agents: Map<string, AgentRuntime>;

  constructor(app: express.Application, agents: Map<string, AgentRuntime>) {
    this.app = app;
    this.agents = agents;

    this.app.post("/admin/create/:agentId", async (req: express.Request, res: express.Response) => {
      // verify lens jwt token
      const { fundTxHash } = req.body;
      const { agentId } = req.params;
      const token = req.headers['lens-access-token'] as string;
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
      if (!wallets?.polygon) res.status(500).send("failed to load polygon wallet" );

      // TODO: verify `fundTxHash` was sent to this polygon wallet with value = 8 pol

      try {
        // mints the profile with agentId as the handle, if not already taken
        const { profileId, txHash } = await mintProfile(wallets!.polygon, agentId);

        const { collection } = await getClient();
        await collection.updateOne({ agentId }, { $set: { profileId, adminProfileId } });

        res.status(!!profileId ? 200 : 400).json({ profileId, txHash });
      } catch (error) {
        console.log(error);
        res.status(400).send(error);
      }
    });

    this.app.put("/admin/:agentId", async (req: express.Request, res: express.Response) => {
      // verify lens jwt token
      const { profileData, approveSignless } = req.body;
      const { agentId } = req.params;
      const token = req.headers['lens-access-token'] as string;
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
        const success = await updateProfile(wallets?.polygon, wallets?.profile.id, profileData, approveSignless);

        res.status(success ? 200 : 400).send();
      } catch (error) {
        console.log(error);
        res.status(400).send(error);
      }
    });

    this.app.get("/:agentId/info", async (req: express.Request, res: express.Response) => {
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

      res.status(200).json({ wallets: { polygon: polygon.getId(), base: base.getId() } });
    });
  }
}

export default AdminClient;