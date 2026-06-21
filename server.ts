import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import chatRouter from './server/chatRouter';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api', chatRouter);

const PORT = Number(process.env.PORT || 3000);

async function start() {
  try {
    // Create Vite server for development
    const vite = await createViteServer({
      server: { middlewareMode: true }
    });

    // Use Vite's connect instance as middleware
    app.use(vite.middlewares);

    // Fallback to index.html for SPA
    app.get('/', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'index.html'));
    });

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`\n✨ Server running at http://localhost:${PORT}\n`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
}

start();