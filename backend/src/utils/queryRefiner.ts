import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SYSTEM_PROMPT = `Você é especialista em buscas em e-commerce brasileiro (Mercado Livre, Magalu, Netshoes, Decathlon).

Dado um item com nome e descrição, retorne um JSON com uma lista de consultas de busca otimizadas.

REGRAS:
1. Se o item for simples (produto único): retorne 1 consulta de 2 a 5 palavras.
2. Se o item for um KIT, CONJUNTO, JOGO ou SET com múltiplos componentes listados: retorne UMA consulta para o kit completo + UMA consulta por componente principal (máximo 5 consultas no total).
3. Cada consulta: 2 a 5 palavras, em português, focando no nome comercial do produto.
4. Ignore dimensões exatas, materiais genéricos e jargões técnicos que não aparecem nos títulos de produto.
5. Retorne APENAS o JSON (array de strings), sem markdown, sem explicações.

EXEMPLOS:
- Kit arbitragem (apito, cronômetro, cartões, moeda) → ["kit arbitragem esportivo", "apito árbitro futebol", "cronômetro árbitro digital", "cartão árbitro amarelo vermelho", "moeda arbitragem futebol"]
- Cadeira ergonômica de escritório → ["cadeira ergonômica escritório"]
- Bola de futebol campo oficial → ["bola futebol campo"]
- Conjunto de primeiros socorros (curativo, atadura, esparadrapo) → ["kit primeiros socorros", "curativo adesivo", "atadura ortopédica", "esparadrapo hospitalar"]`;

export async function refineSearchQuery(
  name: string,
  description?: string | null,
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [name];

  const input = description?.trim()
    ? `Nome: ${name}\nDescrição: ${description.trim()}`
    : `Nome: ${name}`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: input,
        },
      ],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((q) => typeof q === 'string')) {
      return parsed.filter((q) => q.trim().length > 0);
    }
    return [name];
  } catch {
    return [name];
  }
}
