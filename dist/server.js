"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const zod_1 = require("zod");
const scriptgen_1 = require("./scriptgen");
function buildServer() {
    const server = new mcp_js_1.McpServer({
        name: "video-script-generator",
        version: "1.0.0",
    });
    server.tool("generate_video_script", "Generate a broadcast-ready short-form video script for a given topic. Returns a structured script with a hook, scene-by-scene narration, visual direction, music cues, and a call to action — ready to hand to a video editor, TTS engine, or content pipeline. Ideal for content-creation agents, news summarizer bots, and social media automation.", {
        topic: zod_1.z.string().min(3).describe("The subject of the video, e.g. 'The Siege of Leningrad' or 'How CRISPR works'"),
        duration_minutes: zod_1.z.number().positive().max(20).optional().describe("Target spoken duration in minutes, defaults to 3"),
        tone: zod_1.z
            .enum(["educational", "entertaining", "news", "dramatic", "casual"])
            .optional()
            .describe("Overall tone of the script, defaults to 'educational'"),
        language: zod_1.z.string().optional().describe("Script language, defaults to English"),
        audience: zod_1.z.string().optional().describe("Target audience description, defaults to 'general audience'"),
    }, async (args) => {
        try {
            const script = await (0, scriptgen_1.generateVideoScript)(args);
            return { content: [{ type: "text", text: JSON.stringify(script) }] };
        }
        catch (err) {
            return {
                content: [{ type: "text", text: JSON.stringify({ success: false, error: err.message }) }],
                isError: true,
            };
        }
    });
    return server;
}
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get("/health", (_req, res) => res.json({ status: "ok", service: "video-script-generator" }));
app.post("/mcp", async (req, res) => {
    const server = buildServer();
    const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
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
