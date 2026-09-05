import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';

const command: MessageCommand = {
    name: 'skip',
    aliases: ['s', 'next', 'fs', 'forceskip'],
    description: 'Skip the current song',
    async execute(message) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId, true);
        if (!ok) {
            await msgError(message, error || '❌ Cannot skip right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player || !player.playing) {
            await msgError(message, '❌ Nothing is currently playing to skip!');
            return;
        }

        const skipped = await music.skip(guildId);
        if (!skipped) {
            await msgError(message, '❌ Nothing is currently playing to skip!');
            return;
        }

        await msgReply(message, '⏭️ **Skipped!**', { color: 0x9bff00 });
    }
};

export default command;