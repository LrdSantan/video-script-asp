import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { generateVideoScript } from "./scriptgen";
import { paymentMiddleware, x402ResourceServer } from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";

function buildServer() {
  const server = new McpServer({
    name: "video-script-generator",
    version: "1.0.0",
  });

  server.tool(
    "generate_video_script",
    "Generate a broadcast-ready short-form video script for a given topic. Returns a structured script with a hook, scene-by-scene narration, visual direction, music cues, and a call to action — ready to hand to a video editor, TTS engine, or content pipeline. Ideal for content-creation agents, news summarizer bots, and social media automation.",
    {
      topic: z.string().min(3).describe("The subject of the video, e.g. 'The Siege of Leningrad' or 'How CRISPR works'"),
      duration_minutes: z.number().positive().max(20).optional().describe("Target spoken duration in minutes, defaults to 3"),
      tone: z
        .enum(["educational", "entertaining", "news", "dramatic", "casual"])
        .optional()
        .describe("Overall tone of the script, defaults to 'educational'"),
      language: z.string().optional().describe("Script language, defaults to English"),
      audience: z.string().optional().describe("Target audience description, defaults to 'general audience'"),
    },
    async (args) => {
      try {
        const script = await generateVideoScript(args);
        return { content: [{ type: "text", text: JSON.stringify(script) }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, error: err.message }) }],
          isError: true,
        };
      }
    }
  );

  return server;
}

const NETWORK = "eip155:196" as const;
const PAY_TO = process.env.PAY_TO_ADDRESS || "0xb303077bf3a3877d0e1614487334919a8b349840";

const facilitator = new OKXFacilitatorClient({
  apiKey: process.env.OKX_API_KEY || "",
  secretKey: process.env.OKX_SECRET_KEY || "",
  passphrase: process.env.OKX_PASSPHRASE || "",
});

const resourceServer = new x402ResourceServer(facilitator)
  .register(NETWORK, new ExactEvmScheme());

const priced = {
  scheme: "exact" as const,
  network: NETWORK,
  payTo: PAY_TO,
  price: "$0.03" as const,
  syncSettle: true as const,
};

const app = express();
app.use(express.json());

// Adapter layer to branch on JSON-RPC tool name before matching a route key in OKX SDK
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/mcp" && req.body?.method === "tools/call") {
    const toolName = req.body.params?.name;
    if (toolName) {
      req.url = `/mcp/${toolName}`;
    }
  }
  next();
});

app.use(
  paymentMiddleware(
    {
      "POST /mcp/generate_video_script": { accepts: [priced], description: "Generate video script" },
    },
    resourceServer,
    undefined,
    undefined,
    false,
  ),
);

app.get("/health", (_req, res) => res.json({ status: "ok", service: "video-script-generator" }));

app.post("/mcp*", async (req, res, next) => {
  // Restore URL to /mcp so StreamableHTTPServerTransport sees the base path
  req.url = "/mcp";
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    next(err);
  }
});

// Express error handler — surfaces the actual error message in logs & response
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled Express error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message ?? "Internal Server Error" });
  }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
app.listen(PORT, async () => {
  try {
    await resourceServer.initialize();
    console.log("OKX x402 Resource Server initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize OKX x402 Resource Server:", err);
  }
  console.log(`Video Script Generator MCP server listening on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
