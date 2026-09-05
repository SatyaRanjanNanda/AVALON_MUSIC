import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';

const command: MessageCommand = {
    name: 'resume',
    aliases: [],
    description: 'Resume the paused song',
    async execute(message) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId, true);
        if (!ok) {
            await msgError(message, error || '❌ Cannot resume right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player?.paused) {
            await msgError(message, '❌ Music is not paused!');
            return;
        }

        await music.pause(guildId, false);
        await msgReply(message, '▶️ **Resumed!**', { color: 0x9bff00 });
    }
};

export default command;