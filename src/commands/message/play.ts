import type { Message } from 'discord.js';
import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';
import { normalizeQuery } from '../../utils/helpers';

async function handlePlay(message: Message, query: string): Promise<void> {
    const guildId = message.guild?.id;
    if (!guildId) return;

    const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId);
    if (!ok) {
        await msgError(message, error || '❌ Cannot play right now!');
        return;
    }

    const voiceChannelId = message.member?.voice?.channelId;
    if (!voiceChannelId) {
        await msgError(message, '❌ You need to be in a voice channel to use music commands!');
        return;
    }

    const player = await music.createPlayer(guildId, voiceChannelId, message.channel.id);
    if (!player) {
        await msgError(message, '❌ Failed to create voice connection! Please try again.');
        return;
    }

    const result = await music.playSong(player, normalizeQuery(query), message.author);

    if (result.type === 'error') {
        await msgError(message, `❌ ${result.message}`);
        return;
    }

    if (result.type === 'playlist') {
        await msgReply(message, `🎵 Added **${result.tracksCount}** songs from playlist **${result.name}** to the queue!`, {
            color: 0x9bff00
        });
        return;
    }

    await msgReply(message, `🎵 Added **${result.track.info.title}** to the queue!`, { color: 0x9bff00 });
}

const command: MessageCommand = {
    name: 'play',
    aliases: ['p', 'music', 'song', 'add'],
    description: 'Play a song or playlist from a query or URL',
    async execute(message, args) {
        const query = args.join(' ').trim();
        if (!query) {
            await msgError(message, '❌ Please provide a song name or URL! Usage: `!play <song name or URL>`');
            return;
        }
        await handlePlay(message, query);
    }
};

export default command;