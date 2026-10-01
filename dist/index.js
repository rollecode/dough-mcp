#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
// MCP server for Dough (https://github.com/rollecode/dough), for clients that start a local process
// (stdio) or want a separately hosted endpoint. It holds no tools of its own: they come from the
// Dough instance it points at, so an assistant can read (and, with a write-scoped key, edit) the
// household's finances with everything that instance can do.
//
// Configure via environment:
//   DOUGH_API_URL  base URL of the Dough instance, e.g. https://dough.example.com
//   DOUGH_API_KEY  an API key minted with scripts/create-api-key.ts in the Dough repo
const API_URL = (process.env.DOUGH_API_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.DOUGH_API_KEY || "";
const VERSION = "2.0.0";
if (!API_URL || !API_KEY) {
    console.error("dough-mcp: DOUGH_API_URL and DOUGH_API_KEY environment variables are required");
    process.exit(1);
}
// Every Dough instance from 4.4.0 serves its own tools at /mcp, built from the same code as its API.
// This server only carries them: it asks the instance which tools it has and passes each call on,
// so the tools, their fields and their rules are always exactly the instance's, never a copy here
// that falls behind.
async function connectInstance() {
    const client = new Client({ name: "dough-mcp", version: VERSION });
    const transport = new StreamableHTTPClientTransport(new URL(`${API_URL}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } },
    });
    try {
        await client.connect(transport);
    }
    catch (e) {
        throw new Error(`Could not reach ${API_URL}/mcp (${e instanceof Error ? e.message : String(e)}). ` +
            "dough-mcp needs Dough 4.4.0 or later and a valid API key.");
    }
    return client;
}
// One server per transport, each with its own connection to the instance.
function buildServer() {
    const server = new Server({ name: "dough-mcp", version: VERSION }, { capabilities: { tools: {} } });
    let instance = null;
    const remote = () => (instance ??= connectInstance().catch((e) => { instance = null; throw e; }));
    server.setRequestHandler(ListToolsRequestSchema, async (request) => (await remote()).listTools(request.params));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        try {
            return await (await remote()).callTool(request.params);
        }
        catch (e) {
            return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
        }
    });
    return server;
}
// The HTTP transport has no login of its own; auth-server.cjs sits in front of it. So it
// binds loopback only and refuses anything routable.
const LOCAL_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
async function serveHttp(host, port) {
    if (!LOCAL_HOSTS.has(host)) {
        throw new Error(`Refusing to listen on ${host}: this server has no login of its own. ` +
            "Keep it local and put auth-server.cjs in front of it.");
    }
    const sessions = new Map();
    async function openSession() {
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => {
                sessions.set(id, transport);
            },
        });
        transport.onclose = () => {
            if (transport.sessionId)
                sessions.delete(transport.sessionId);
        };
        await buildServer().connect(transport);
        return transport;
    }
    createServer((req, res) => {
        if (!req.url?.startsWith("/mcp")) {
            res.writeHead(404).end();
            return;
        }
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", async () => {
            try {
                const raw = Buffer.concat(chunks).toString();
                const body = raw ? JSON.parse(raw) : undefined;
                const sessionId = req.headers["mcp-session-id"];
                const transport = sessionId ? sessions.get(sessionId) : await openSession();
                if (!transport) {
                    res.writeHead(404).end();
                    return;
                }
                await transport.handleRequest(req, res, body);
            }
            catch {
                if (!res.headersSent)
                    res.writeHead(500).end();
            }
        });
    }).listen(port, host, () => {
        console.error(`dough-mcp listening on http://${host}:${port}/mcp, serving ${API_URL}`);
    });
}
async function main() {
    const args = process.argv.slice(2);
    const arg = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
    if (arg("--transport", "stdio") === "http") {
        await serveHttp(arg("--host", "127.0.0.1"), Number(arg("--port", "8490")));
        return;
    }
    await buildServer().connect(new StdioServerTransport());
    console.error("dough-mcp: connected via stdio, serving", API_URL);
}
main().catch((err) => {
    console.error("dough-mcp failed to start:", err);
    process.exit(1);
});
