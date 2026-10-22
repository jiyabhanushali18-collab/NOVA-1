import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createDecartClient } from '@decartai/sdk';

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());

app.get('/api/token', async (req, res) => {
    try {
        const apiKey = process.env.DECART_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "DECART_API_KEY is not configured on the server." });
        }

        const decartClient = createDecartClient({ apiKey });
        
        const token = await decartClient.tokens.create({
            expiresIn: 3600,
        });
        res.json(token);
    } catch (error) {
        console.error("Error creating token:", error);
        res.status(500).json({ error: "Failed to create token. Check server configuration." });
    }
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
