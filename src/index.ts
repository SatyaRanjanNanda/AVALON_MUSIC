import { Client } from 'discord.js';
import { Riffy } from 'riffy';
import * as dotenv from 'dotenv';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { IntentsForClient, setClient, setMusic, setRiffy, setSettings, setStatus } from './core';
import { settingsStore } from './utils/settings';
import { CentralEmbedHandler } from './utils/centralEmbed';
import { PlayerManager } from './manager/PlayerManager';
import { StatusManager } from './utils/statusManager';
import { loadCommands } from './handlers/commandHandler';
import { loadEvents } from './handlers/eventHandler';
import config from './config';

dotenv.config();

export const prisma = new PrismaClient();

const app = express();
app.get('/', (req, res) => res.send('🎵 Avalon Music is healthy and running!'));
app.listen(config.keepAlive.healthPort, () => console.log(`✅ Health server listening on port ${config.keepAlive.healthPort}`));

export const client = new Client({ intents: IntentsForClient });

setClient(client);
setSettings(settingsStore);

client.riffy = new Riffy(client, config.lavalink.nodes, {
    send: (payload) => {
        const guild = client.guilds.cache.get(payload.d.guild_id);
        if (guild) guild.shard.send(payload);
    },
    defaultSearchPlatform: config.lavalink.defaultSearchPlatform,
    restVersion: 'v4',
    bypassChecks: { nodeFetchInfo: true },
    migrateOnDisconnect: true
});
setRiffy(client.riffy);

client.on('raw', (data) => client.riffy.updateVoiceState(data));

const centralEmbed = new CentralEmbedHandler(client, settingsStore);
const music = new PlayerManager(client, centralEmbed, settingsStore);
setMusic(music);

const status = new StatusManager(client, (guildId) => music.getPlayerInfo(guildId));
setStatus(status);
client.statusManager = status;

music.initializeEvents();

async function start(): Promise<void> {
    try {
        console.log('🖥️ Initializing settings store...');
        await settingsStore.init();
        console.log('🗄️ Settings store ready');
    } catch (error) {
        console.error('⚠️ Settings store init failed (falling back to in-memory):', (error as Error)?.message);
    }

    console.log('📦 Loading commands...');
    await loadCommands();

    console.log('🔔 Loading events...');
    await loadEvents(client);
    console.log('🔔 Events loaded');

    const keepAlive = setInterval(() => {
        if (config.keepAlive.healthUrl) {
            fetch(config.keepAlive.healthUrl).catch(() => undefined);
        }
    }, 240000);
    void keepAlive;

    console.log('🔑 Logging in...');
    try {
        await client.login(config.discord.token);
    } catch (error) {
        console.error('❌ Failed to login:', error);
        process.exit(1);
    }
    console.log('🔑 Login resolved');
}

void start();