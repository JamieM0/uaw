import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const bridgeDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(bridgeDirectory, '..', '..');
const workspecPackagePath = path.join(repositoryRoot, 'packages', 'workspec');
const workspecPackage = require(path.join(workspecPackagePath, 'index.js'));

const PORT = Number(process.env.UAW_AGENT_PORT || 4317);
const HOST = process.env.UAW_AGENT_HOST || '127.0.0.1';
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const agentWorkspaceRoot = process.env.UAW_AGENT_WORKDIR
    ? path.resolve(process.env.UAW_AGENT_WORKDIR)
    : path.join(os.tmpdir(), 'uaw-playground-agent');
const allowedOriginList = (process.env.UAW_AGENT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

let CodexConstructor = null;
let codexLoadError = null;
const projectThreads = new Map();

async function loadCodex() {
    if (CodexConstructor || codexLoadError) return CodexConstructor;
    try {
        const sdk = await import('@openai/codex-sdk');
        CodexConstructor = sdk.Codex;
        return CodexConstructor;
    } catch (error) {
        codexLoadError = error;
        return null;
    }
}

function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (allowedOriginList.includes(origin)) return true;
    if (origin === 'https://universalautomation.wiki') return true;
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function applyCors(request, response) {
    const origin = request.headers.origin;
    if (!isAllowedOrigin(origin)) return false;
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Cache-Control', 'no-store');
    return true;
}

function json(response, status, payload) {
    const body = JSON.stringify(payload);
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
    });
    response.end(body);
}

async function readJsonBody(request) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        request.on('data', (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('Request body exceeds the 8 MB limit.'));
                request.destroy();
                return;
            }
            chunks.push(chunk);
        });
        request.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
            } catch (error) {
                reject(new Error(`Invalid JSON request: ${error.message}`));
            }
        });
        request.on('error', reject);
    });
}

function safeProjectId(value) {
    const safe = String(value || 'project').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    return safe || 'project';
}

function validateWorkSpecText(text) {
    try {
        const documentValue = JSON.parse(text);
        const result = workspecPackage.validate(documentValue);
        return {
            validJson: true,
            valid: Boolean(result?.valid),
            problems: Array.isArray(result?.problems) ? result.problems : []
        };
    } catch (error) {
        return {
            validJson: false,
            valid: false,
            problems: [{
                metric_id: 'json.syntax',
                severity: 'error',
                title: 'Invalid JSON',
                detail: error.message,
                instance: '/'
            }]
        };
    }
}

async function prepareProjectWorkspace(payload) {
    const directory = path.join(agentWorkspaceRoot, safeProjectId(payload.projectId));
    await mkdir(directory, { recursive: true });

    const schema = await readFile(path.join(workspecPackagePath, 'v2.1.schema.json'), 'utf8');
    const readme = await readFile(path.join(workspecPackagePath, 'README.md'), 'utf8');
    const currentPath = path.join(directory, 'current.workspec.json');
    const proposalPath = path.join(directory, 'proposal.workspec.json');
    await writeFile(currentPath, payload.workSpec, 'utf8');
    await writeFile(proposalPath, payload.workSpec, 'utf8');
    await writeFile(path.join(directory, 'v2.1.schema.json'), schema, 'utf8');
    await writeFile(path.join(directory, 'WORKSPEC_REFERENCE.md'), [
        '# WorkSpec reference for the WorkSpec Studio Agent',
        '',
        'The JSON Schema in `v2.1.schema.json` and the canonical validator are authoritative.',
        'Never invent aliases or fields that conflict with those files.',
        '',
        readme
    ].join('\n'), 'utf8');

    const packageLiteral = JSON.stringify(path.join(workspecPackagePath, 'index.js'));
    await writeFile(path.join(directory, 'validate-workspec.cjs'), `
'use strict';
const fs = require('node:fs');
const WorkSpec = require(${packageLiteral});
const target = process.argv[2] || 'proposal.workspec.json';
try {
    const value = JSON.parse(fs.readFileSync(target, 'utf8'));
    const result = WorkSpec.validate(value);
    process.stdout.write(JSON.stringify(result, null, 2) + '\\n');
    process.exit(result.ok ? 0 : 1);
} catch (error) {
    process.stderr.write(error.message + '\\n');
    process.exit(2);
}
`.trimStart(), 'utf8');

    await writeFile(path.join(directory, 'AGENTS.md'), `
# WorkSpec Studio Agent

You are operating on one browser-provided WorkSpec Studio project snapshot.

- Read \`WORKSPEC_REFERENCE.md\`, \`v2.1.schema.json\`, and \`current.workspec.json\` before proposing changes.
- The canonical validation command is: \`node validate-workspec.cjs proposal.workspec.json\`.
- Never modify \`current.workspec.json\`.
- Put the complete proposed document in \`proposal.workspec.json\`.
- Validate after every substantive edit and report remaining problems honestly.
- Preserve valid WorkSpec syntax and IDs unless the user's request requires a change.
- Always author references as compact strings such as \`"@shipment.temperature"\`, \`"@inspect.end"\`, \`"@current.permissions"\`, or \`"@now"\`.
- Use \`@@\` for a literal ValueExpression string beginning with \`@\`. Never generate structured selector references, dotted property names, or nested reference paths.
- Do not access files outside this project workspace.
- Do not use the network.
`.trimStart(), 'utf8');

    return { directory, currentPath, proposalPath };
}

function buildPrompt(payload, validation) {
    const diagnosticSummary = validation.problems.length
        ? validation.problems.slice(0, 30).map((problem) => `- ${problem.severity || 'error'} ${problem.metric_id || ''}: ${problem.detail || problem.title}`).join('\n')
        : '- No canonical validation problems.';

    return `
Work on the WorkSpec Studio project named "${String(payload.projectName || 'Untitled project').replace(/"/g, '\\"')}".

User request:
${payload.message}

Current canonical diagnostics:
${diagnosticSummary}

Use the project files and validation command described in AGENTS.md. If the user only asks a question, explain the answer and leave proposal.workspec.json unchanged. If the user requests a project change, update proposal.workspec.json, run the canonical validator, and summarize exactly what changed and any remaining problems. Do not return the entire JSON document in your final response; the bridge reads it from disk for review.
`.trim();
}

async function runAgent(payload) {
    if (!payload.message || typeof payload.message !== 'string') {
        throw new Error('A non-empty message is required.');
    }
    if (!payload.workSpec || typeof payload.workSpec !== 'string') {
        throw new Error('A WorkSpec project snapshot is required.');
    }

    const Codex = await loadCodex();
    if (!Codex) {
        throw new Error(`The Codex SDK is unavailable. Run npm install in web/agent-bridge. ${codexLoadError?.message || ''}`.trim());
    }

    const currentValidation = validateWorkSpecText(payload.workSpec);
    const workspace = await prepareProjectWorkspace(payload);
    const activities = [
        { tool: 'read_project', label: 'Read project snapshot', status: 'completed', detail: workspace.currentPath },
        { tool: 'validate_workspec', label: 'Validate current WorkSpec', status: 'completed', detail: `${currentValidation.problems.length} problem(s)` }
    ];

    let state = projectThreads.get(payload.projectId);
    if (!state) {
        const codex = new Codex();
        let thread;
        if (payload.threadId) {
            thread = codex.resumeThread(payload.threadId);
        } else {
            thread = codex.startThread({
                workingDirectory: workspace.directory,
                skipGitRepoCheck: true,
                sandboxMode: 'workspace-write',
                approvalPolicy: 'never'
            });
        }
        state = { codex, thread, directory: workspace.directory };
        projectThreads.set(payload.projectId, state);
    }

    activities.push({ tool: 'codex_thread', label: 'Run Codex thread', status: 'running', detail: payload.threadId ? 'Continue project thread' : 'Start project thread' });
    const result = await state.thread.run(buildPrompt(payload, currentValidation));
    activities[activities.length - 1].status = 'completed';

    const proposedWorkSpec = await readFile(workspace.proposalPath, 'utf8');
    const proposalChanged = proposedWorkSpec.trim() !== payload.workSpec.trim();
    const proposalValidation = validateWorkSpecText(proposedWorkSpec);
    activities.push({
        tool: 'validate_workspec',
        label: proposalChanged ? 'Validate proposed WorkSpec' : 'Confirm no document changes',
        status: proposalValidation.valid ? 'completed' : 'failed',
        detail: `${proposalValidation.problems.length} problem(s)`
    });

    return {
        finalResponse: result.finalResponse,
        threadId: state.thread.id || result.threadId || payload.threadId || null,
        proposedWorkSpec: proposalChanged && proposalValidation.validJson ? proposedWorkSpec : null,
        validation: proposalValidation,
        activities
    };
}

const server = http.createServer(async (request, response) => {
    if (!applyCors(request, response)) {
        json(response, 403, { error: 'Origin is not allowed by the UAW Agent bridge.' });
        return;
    }

    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
    }

    const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
    if (request.method === 'GET' && url.pathname === '/health') {
        const Codex = await loadCodex();
        json(response, 200, {
            ok: true,
            service: 'uaw-playground-agent-bridge',
            codexAvailable: Boolean(Codex),
            validator: 'packages/workspec/workspec-validator.js'
        });
        return;
    }

    if (request.method === 'POST' && url.pathname === '/v1/agent/run') {
        try {
            const payload = await readJsonBody(request);
            const result = await runAgent(payload);
            json(response, 200, result);
        } catch (error) {
            console.error(error);
            json(response, 500, { error: error.message || 'Codex run failed.' });
        }
        return;
    }

    json(response, 404, { error: 'Not found' });
});

server.listen(PORT, HOST, () => {
    console.log(`UAW Agent bridge listening on http://${HOST}:${PORT}`);
    console.log(`Project workspaces: ${agentWorkspaceRoot}`);
});
