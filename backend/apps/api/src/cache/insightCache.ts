import NodeCache from "node-cache";
import { env } from "../config/env.js";

export const insightCache = new NodeCache({
  stdTTL: env.INSIGHTS_CACHE_TTL_SECONDS,
  useClones: false
});

