import type { FastifyInstance } from 'fastify';
import { itemsDb } from '../db.js';

export async function registerItemsRoute(app: FastifyInstance): Promise<void> {
  app.get('/api/items', async () => {
    return itemsDb.list();
  });

  app.post<{ Body: { name: string; description?: string; category?: string } }>(
    '/api/items',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 },
            description: { type: 'string' },
            category: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const { name, description, category } = req.body;
      const item = itemsDb.create(name.trim(), description?.trim(), category?.trim());
      reply.code(201);
      return item;
    },
  );

  app.get<{ Params: { id: string } }>('/api/items/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });
    const item = itemsDb.findByIdWithStats(id);
    if (!item) return reply.code(404).send({ error: 'Item não encontrado' });
    return item;
  });

  app.patch<{ Params: { id: string }; Body: { name?: string; description?: string; category?: string } }>(
    '/api/items/:id',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });
      const updated = itemsDb.update(id, req.body);
      if (!updated) return reply.code(404).send({ error: 'Item não encontrado' });
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/items/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (isNaN(id)) return reply.code(400).send({ error: 'ID inválido' });
    const deleted = itemsDb.delete(id);
    if (!deleted) return reply.code(404).send({ error: 'Item não encontrado' });
    reply.code(204);
  });
}
