import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';

const command: MessageCommand = {
    name: 'pause',
    aliases: [],
    description: 'Pause the current song',
    async execute(message) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId, true);
        if (!ok) {
            await msgError(message, error || '❌ Cannot pause right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player?.playing) {
            await msgError(message, '❌ Nothing is currently playing to pause!');
            return;
        }

        await music.pause(guildId, true);
        await msgReply(message, '⏸️ **Paused!**', { color: 0x9bff00 });
    }
};

export default command;