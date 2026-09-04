import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { Player } from 'discord-player';
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

// Initialize discord-player
export const player = new Player(client);
player.extractors.loadDefault(); // Load default extractors (YouTube, Spotify, etc.)

import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';

// Load Commands and Events
loadCommands(client);
loadEvents(client);

client.login(process.env.DISCORD_TOKEN);
