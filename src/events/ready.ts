import { Events, type Client } from 'discord.js';
import { riffy, status } from '../core';
import config from '../config';
import { registerSlashCommands } from '../handlers/commandHandler';
import { CentralEmbedHandler } from '../utils/centralEmbed';
import { settings } from '../core';
import { GarbageCollector } from '../utils/garbageCollector';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client): Promise<void> {
    console.log(`🎵 ${client.user?.tag} is online and ready!`);
    console.log(`🆔 Client ID: ${client.user?.id}`);

    try {
        riffy.init(client.user?.id || '');
        console.log('🌍 Riffy initialized!');
    } catch (error) {
        console.error('❌ Failed to initialize Riffy:', error);
    }

    const centralEmbed = new CentralEmbedHandler(client, settings);
    client.centralEmbed = centralEmbed;

    try {
        await centralEmbed.resetAllCentralEmbedsOnStartup();
    } catch (error) {
        console.error('❌ Failed to reset central embeds:', error);
    }

    try {
        await registerSlashCommands(config.discord.token, client.user?.id || '');
    } catch (error) {
        console.error('❌ Failed to register slash commands:', error);
    }

    if (status) {
        await status.setServerCountStatus(client.guilds.cache.size).catch(() => undefined);
    }

    const garbageCollector = new GarbageCollector(client);
    garbageCollector.start(60000);
}