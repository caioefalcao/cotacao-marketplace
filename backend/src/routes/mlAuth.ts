import type { FastifyInstance } from 'fastify';
import axios from 'axios';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { createHash, randomBytes } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TOKENS_PATH = resolve(__dirname, '../../data/ml_tokens.json');

export interface MLTokens {
  access_token: string;
  refresh_token: string;
  user_id: number;
  expires_at: number;
}

export function loadTokens(): MLTokens | null {
  if (!existsSync(TOKENS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKENS_PATH, 'utf-8')) as MLTokens;
  } catch {
    return null;
  }
}

export function saveTokens(data: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
}): MLTokens {
  const tokens: MLTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user_id,
    expires_at: Date.now() + (data.expires_in - 120) * 1000,
  };
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  return tokens;
}

export async function refreshAccessToken(tokens: MLTokens): Promise<MLTokens> {
  const clientId = process.env.ML_CLIENT_ID!;
  const clientSecret = process.env.ML_CLIENT_SECRET!;

  const { data } = await axios.post<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user_id: number;
  }>(
    'https://api.mercadolibre.com/oauth/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 },
  );

  return saveTokens(data);
}

export async function getValidToken(): Promise<string | null> {
  let tokens = loadTokens();
  if (!tokens) return null;

  if (Date.now() >= tokens.expires_at) {
    try {
      tokens = await refreshAccessToken(tokens);
    } catch {
      return null;
    }
  }

  return tokens.access_token;
}

// PKCE helpers
function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// In-memory store for PKCE verifier (single-server, single-user flow)
let pendingVerifier: string | null = null;

export async function registerMlAuthRoute(app: FastifyInstance): Promise<void> {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  const REDIRECT_URI = 'http://localhost:3000/api/ml/callback';

  if (!clientId || !clientSecret) return;

  // Step 1 — redirect user to ML authorization page (with PKCE)
  app.get('/api/ml/auth', async (_req, reply) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    pendingVerifier = codeVerifier;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    reply.redirect(`https://auth.mercadolivre.com.br/authorization?${params}`);
  });

  // Step 2 — ML redirects back with ?code=
  app.get<{ Querystring: { code?: string; error?: string } }>(
    '/api/ml/callback',
    async (req, reply) => {
      const { code, error } = req.query;

      if (error || !code) {
        return reply
          .type('text/html')
          .send(`<h2>Erro na autorização: ${error ?? 'código ausente'}</h2>`);
      }

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: REDIRECT_URI,
      });

      // Include PKCE verifier if available
      if (pendingVerifier) {
        body.set('code_verifier', pendingVerifier);
        pendingVerifier = null;
      }

      try {
        const { data } = await axios.post<{
          access_token: string;
          refresh_token: string;
          expires_in: number;
          user_id: number;
        }>(
          'https://api.mercadolibre.com/oauth/token',
          body.toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 },
        );

        saveTokens(data);

        return reply.type('text/html').send(`
          <html><body style="font-family:sans-serif;padding:40px;text-align:center">
            <h2>✅ Mercado Livre autorizado com sucesso!</h2>
            <p>Tokens salvos. O adapter está ativo e pronto para buscar.</p>
            <p><a href="http://localhost:5173">Voltar ao sistema →</a></p>
          </body></html>
        `);
      } catch (err) {
        const msg = axios.isAxiosError(err) ? JSON.stringify(err.response?.data) : String(err);
        return reply
          .type('text/html')
          .send(`<h2>Erro ao trocar código por token</h2><pre>${msg}</pre>`);
      }
    },
  );

  // Status
  app.get('/api/ml/status', async () => {
    const tokens = loadTokens();
    if (!tokens) return { authorized: false };
    const expired = Date.now() >= tokens.expires_at;
    return { authorized: true, expired, user_id: tokens.user_id };
  });
}
