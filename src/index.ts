import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { Shoukaku, Connectors } from 'shoukaku';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

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
const Nodes = [{
    name: 'Wispbyte Private Node',
    url: process.env.LAVALINK_URL || '78.154.103.7:16134',
    auth: process.env.LAVALINK_AUTH || 'youshallnotpass',
    secure: process.env.LAVALINK_SECURE === 'true'
}];

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
