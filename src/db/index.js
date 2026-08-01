import nodeDns from "dns";
import dns from "dns/promises";
import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const DNS_SERVERS = ["8.8.8.8", "1.1.1.1", "8.8.4.4"];

const normalizeUri = (uri) => uri.trim().replace(/\/+$/, "");

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("DNS lookup timed out")), ms)
    ),
  ]);

const resolveDns = async (lookup) => {
  for (const server of [null, ...DNS_SERVERS.map((s) => [s])]) {
    if (server) {
      nodeDns.setServers(server);
    }

    try {
      return await withTimeout(lookup(), 8000);
    } catch {
      // try next DNS server
    }
  }

  throw new Error("Could not resolve MongoDB cluster DNS");
};

const toStandardUri = async (srvUri) => {
  const cleaned = normalizeUri(srvUri);
  const withoutPrefix = cleaned.slice("mongodb+srv://".length);

  const atIndex = withoutPrefix.indexOf("@");
  const credentials = withoutPrefix.slice(0, atIndex + 1);
  const hostAndRest = withoutPrefix.slice(atIndex + 1);

  const slashIndex = hostAndRest.indexOf("/");
  const hostname =
    slashIndex === -1 ? hostAndRest : hostAndRest.slice(0, slashIndex);
  const query =
    slashIndex === -1
      ? ""
      : hostAndRest.slice(slashIndex + 1).replace(/^\?/, "");

  const srvRecords = await resolveDns(() =>
    dns.resolveSrv(`_mongodb._tcp.${hostname}`)
  );

  const txtRecords = await resolveDns(() => dns.resolveTxt(hostname)).catch(
    () => []
  );

  const hosts = srvRecords.map(({ name, port }) => `${name}:${port}`).join(",");
  const params = new URLSearchParams(
    txtRecords.flat().join("&") ||
      "authSource=admin&retryWrites=true&w=majority"
  );

  params.set("ssl", "true");

  if (query) {
    for (const [key, value] of new URLSearchParams(query)) {
      params.set(key, value);
    }
  }

  return `mongodb://${credentials}${hosts}/?${params.toString()}`;
};

const connectDB = async () => {
  try {
    const rawUri = process.env.MONGODB_URI || process.env.MONGODB_URL;

    if (!rawUri) {
      throw new Error("MONGODB_URI is not defined in .env");
    }

    const mongoUri = rawUri.startsWith("mongodb+srv://")
      ? await toStandardUri(rawUri)
      : normalizeUri(rawUri);

    await mongoose.connect(mongoUri, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 30000,
    });

    console.log(`MongoDB connected! DB: ${DB_NAME}`);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.warn("Continuing without a database connection for now.");
  }
};

export default connectDB;
