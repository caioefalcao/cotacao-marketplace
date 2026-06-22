import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function refineSearchQuery(
  name: string,
  description?: string | null,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return name;

  const input = description?.trim()
    ? `Nome: ${name}\nDescrição: ${description.trim()}`
    : `Nome: ${name}`;

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [
        {
          role: 'user',
          content: `Você é especialista em buscas em e-commerce brasileiro. Analise a especificação abaixo e retorne APENAS a consulta de busca ideal (2 a 5 palavras em português) para encontrar este produto em sites como Mercado Livre, Magalu, Netshoes e Decathlon. Foque no nome do produto e nas características que melhor o identificam para uma compra. Ignore dimensões exatas, materiais genéricos e jargões técnicos que não aparecem nos títulos de produtos. Retorne somente a consulta, sem explicações.

${input}

Consulta:`,
        },
      ],
    });

    const text =
      msg.content[0].type === 'text' ? msg.content[0].text.trim().replace(/^["']|["']$/g, '') : '';
    return text || name;
  } catch {
    return name;
  }
}
