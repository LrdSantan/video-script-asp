import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { generateVideoScript } from "./scriptgen";

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

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "video-script-generator" }));

app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
app.listen(PORT, () => {
  console.log(`Video Script Generator MCP server listening on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
