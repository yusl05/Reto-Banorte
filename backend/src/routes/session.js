import { Router } from "express";
import { createDemoSession } from "../auth/session.js";

export const sessionRouter = Router();
sessionRouter.post("/demo", createDemoSession);
