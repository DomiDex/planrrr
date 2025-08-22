// Package: @repo/api
// Path: apps/api/src/routes/posts.ts
// Dependencies: hono

import { Hono, Context } from 'hono';

const posts = new Hono();

posts.get('/', async (c: Context) => {
  // TODO: Implement list posts
  return c.json({ success: true, data: [] });
});

posts.get('/:id', async (c: Context) => {
  const id = c.req.param('id');
  // TODO: Implement get post
  return c.json({ success: true, data: { id } });
});

posts.post('/', async (c: Context) => {
  // TODO: Implement create post
  return c.json({ success: true, message: 'Create post endpoint' });
});

posts.patch('/:id', async (c: Context) => {
  const id = c.req.param('id');
  // TODO: Implement update post
  return c.json({ success: true, data: { id } });
});

posts.delete('/:id', async (c: Context) => {
  const id = c.req.param('id');
  // TODO: Implement delete post
  return c.json({ success: true, message: `Post ${id} deleted` });
});

export default posts;