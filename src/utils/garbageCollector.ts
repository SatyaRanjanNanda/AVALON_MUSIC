import { ChannelType } from 'discord.js';
import type { Client } from 'discord.js';
import { music, riffy } from '../core';

export class GarbageCollector {
    private client: Client;
    private interval: NodeJS.Timeout | null = null;

    constructor(client: Client) {
        this.client = client;
    }

    async collect(): Promise<boolean> {
        const guilds = this.client.guilds.cache;
        const collected: string[] = [];

        for (const [, guild] of guilds) {
            const player = riffy.players.get(guild.id);
            if (!player?.voiceChannel) continue;

            const voiceChannel = guild.channels.cache.get(player.voiceChannel);
            if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) continue;

            const members = voiceChannel.members.filter((member) => !member.user.bot);
            if (members.size === 0) {
                await music.destroy(guild.id);
                collected.push(guild.id);
            }
        }

        if (collected.length > 0) {
            console.log(`[garbage] Collected ${collected.length} idle sessions.`);
        }
        return collected.length > 0;
    }

    start(ms = 60000): void {
        if (this.interval) return;
        this.interval = setInterval(() => {
            void this.collect();
        }, ms);
        console.log('[garbage] GarbageCollector started.');
    }
}