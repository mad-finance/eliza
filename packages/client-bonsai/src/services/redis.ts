import { createNodeRedisClient } from "handy-redis";

const { REDIS_URL } = process.env;

// volatile-lru
const client = createNodeRedisClient(`${REDIS_URL as string}?family=0`);

export default client;
