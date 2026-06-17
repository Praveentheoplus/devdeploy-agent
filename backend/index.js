const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const OpenAI = require('openai').default;
const axios = require('axios');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// ── Tool Functions ────────────────────────────────────────────────────────────
async function fetchRepoStructure({ owner, repo }) {
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
      { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
    );
    return res.data.tree.map(f => f.path).join('\n');
  } catch {
    try {
      const res = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`,
        { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
      );
      return res.data.tree.map(f => f.path).join('\n');
    } catch (e) {
      return `Error fetching repo: ${e.message}`;
    }
  }
}

async function detectFramework({ owner, repo }) {
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/package.json`,
      { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
    );
    const pkg = JSON.parse(Buffer.from(res.data.content, 'base64').toString());
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['next']) return 'Next.js';
    if (deps['vite']) return 'React + Vite';
    if (deps['react']) return 'React (CRA)';
    if (deps['vue']) return 'Vue.js';
    if (deps['@angular/core']) return 'Angular';
    if (deps['svelte']) return 'Svelte';
    if (deps['express']) return 'Express (Node.js)';
    return 'Unknown JS project';
  } catch {
    return 'No package.json found — possibly static HTML';
  }
}

async function generateDeployConfig({ framework }) {
  const configs = {
    'Next.js':      { buildCommand: 'npm run build', outputDir: '.next',  nodeVersion: '18.x' },
    'React + Vite': { buildCommand: 'npm run build', outputDir: 'dist',   nodeVersion: '18.x' },
    'React (CRA)':  { buildCommand: 'npm run build', outputDir: 'build',  nodeVersion: '18.x' },
    'Vue.js':       { buildCommand: 'npm run build', outputDir: 'dist',   nodeVersion: '18.x' },
    'Angular':      { buildCommand: 'npm run build', outputDir: 'dist',   nodeVersion: '18.x' },
    'Svelte':       { buildCommand: 'npm run build', outputDir: 'public', nodeVersion: '18.x' },
    'Static HTML':  { buildCommand: '',              outputDir: './',      nodeVersion: '18.x' },
  };
  return configs[framework] || { buildCommand: 'npm run build', outputDir: 'dist', nodeVersion: '18.x' };
}

async function scanEnvVariables({ owner, repo }) {
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/.env.example`,
      { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` } }
    );
    const content = Buffer.from(res.data.content, 'base64').toString();
    const keys = content.split('\n')
      .filter(line => line.includes('=') && !line.startsWith('#'))
      .map(line => line.split('=')[0].trim());
    return keys.length > 0 ? keys : ['No .env.example found'];
  } catch {
    return ['No .env.example found'];
  }
}

async function triggerDeployment({ owner, repo, vercelToken, buildCommand, outputDir, envVars = {} }) {
  try {
    const deployRes = await axios.post(
      'https://api.vercel.com/v13/deployments',
      {
        name: repo,
        gitSource: { type: 'github', org: owner, repo, ref: 'main' },
        buildCommand: buildCommand || undefined,
        outputDirectory: outputDir || undefined,
      },
      { headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' } }
    );
    return {
      url: `https://${deployRes.data.url}`,
      id: deployRes.data.id,
      status: deployRes.data.readyState,
    };
  } catch (e) {
    return { error: e.response?.data?.error?.message || e.message };
  }
}

// ── Tool Definitions ──────────────────────────────────────────────────────────
const tools = [
  {
    type: 'function',
    function: {
      name: 'fetchRepoStructure',
      description: 'Fetches the file tree of a GitHub repository',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo:  { type: 'string' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detectFramework',
      description: 'Detects the framework by reading package.json',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo:  { type: 'string' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generateDeployConfig',
      description: 'Generates deployment config based on framework',
      parameters: {
        type: 'object',
        properties: {
          framework: { type: 'string' },
        },
        required: ['framework'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scanEnvVariables',
      description: 'Scans .env.example for required environment variables',
      parameters: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo:  { type: 'string' },
        },
        required: ['owner', 'repo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'triggerDeployment',
      description: 'Deploys the repository to Vercel',
      parameters: {
        type: 'object',
        properties: {
          owner:        { type: 'string' },
          repo:         { type: 'string' },
          vercelToken:  { type: 'string' },
          buildCommand: { type: 'string' },
          outputDir:    { type: 'string' },
        },
        required: ['owner', 'repo', 'vercelToken'],
      },
    },
  },
];

// ── Tool Executor ─────────────────────────────────────────────────────────────
async function executeTool(name, args) {
  const fns = { fetchRepoStructure, detectFramework, generateDeployConfig, scanEnvVariables, triggerDeployment };
  return fns[name] ? JSON.stringify(await fns[name](args)) : JSON.stringify({ error: 'Unknown tool' });
}

// ── Main Deploy Route ─────────────────────────────────────────────────────────
app.post('/api/deploy', async (req, res) => {
  const { repoUrl, vercelToken, envVars = {} } = req.body;

  if (!repoUrl || !vercelToken) {
    return res.status(400).json({ error: 'repoUrl and vercelToken are required' });
  }

  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return res.status(400).json({ error: 'Invalid GitHub URL' });
  const [, owner, repo] = match;
  const cleanRepo = repo.replace('.git', '');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (type, message) => {
    res.write(`data: ${JSON.stringify({ type, message })}\n\n`);
  };

  try {
    send('log', `Starting deployment for ${owner}/${cleanRepo}...`);

    const messages = [
      {
        role: 'system',
        content: `You are DevDeploy Agent, an autonomous deployment assistant. 
Deploy GitHub repositories to Vercel step by step using the provided tools.
Always follow this exact order:
1. fetchRepoStructure
2. detectFramework  
3. generateDeployConfig
4. scanEnvVariables
5. triggerDeployment
Call one tool at a time and wait for results before proceeding.`,
      },
      {
        role: 'user',
        content: `Deploy the GitHub repository "${owner}/${cleanRepo}" to Vercel.
Vercel token: "${vercelToken}"
Start now by fetching the repo structure.`,
      },
    ];

    // Agentic loop
    let iterations = 0;
    while (iterations < 10) {
      iterations++;

      const response = await openai.chat.completions.create({
        model: 'openrouter/auto',
        messages,
        tools,
        tool_choice: 'auto',
      });

      const message = response.choices[0].message;
      messages.push(message);

      if (message.content) {
        send('log', message.content);
      }

      if (!message.tool_calls || message.tool_calls.length === 0) break;

      for (const toolCall of message.tool_calls) {
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        send('tool', `Calling ${name}()...`);

        const result = await executeTool(name, { ...args, vercelToken, envVars });
        const parsed = JSON.parse(result);

        if (name === 'triggerDeployment') {
          if (parsed.error) {
            send('error', `Deployment failed: ${parsed.error}`);
          } else {
            send('success', `Deployed! Live at: ${parsed.url}`);
            send('url', parsed.url);
          }
        } else {
          send('log', `${name} result: ${result}`);
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        });
      }
    }

    send('done', 'Agent finished.');
    res.end();
  } catch (e) {
    send('error', `Server error: ${e.message}`);
    res.end();
  }
});

app.get('/', (req, res) => res.json({ status: 'DevDeploy Agent running' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));