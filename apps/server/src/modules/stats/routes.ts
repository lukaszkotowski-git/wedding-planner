import { Router } from "express";
import { computeStats } from "./service";

export const statsRouter = Router({ mergeParams: true });

statsRouter.get("/", async (req, res) => {
  res.json(await computeStats(req.wedding!.id));
});
