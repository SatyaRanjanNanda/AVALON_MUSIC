import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { Shoukaku, Connectors } from 'shoukaku';
import * as dotenv from 'dotenv';
import express from 'express';
import { PrismaClient } from '@prisma/client';

dotenv.config();

// Keep-alive server for Render
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is healthy and running!'));
app.listen(port, () => console.log(`Health server listening on port ${port}`));

// Initialize Prisma
export const prisma = new PrismaClient();

// Initialize Discord Client
export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Configure Lavalink nodes
const Nodes = [
    {
        name: 'Railway Private Node',
        url: (process.env.LAVALINK_URL || '').replace(/['"]/g, '').replace(':2333', ':443'),
        auth: (process.env.LAVALINK_AUTH || '').replace(/['"]/g, ''),
        secure: process.env.LAVALINK_SECURE !== 'false'
    }
];

// Initialize Shoukaku
export const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes);

import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';

shoukaku.on('error', (_, error) => console.error('Shoukaku Error:', error));
shoukaku.on('ready', (name) => console.log(`Lavalink Node: ${name} is now connected`));

// Load Commands and Events
loadCommands(client);
loadEvents(client);

client.login(process.env.DISCORD_TOKEN);
