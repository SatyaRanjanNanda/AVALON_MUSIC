import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';

const command: MessageCommand = {
    name: 'clear',
    aliases: [],
    description: 'Clear the entire music queue',
    async execute(message) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId, true);
        if (!ok) {
            await msgError(message, error || '❌ Cannot clear right now!');
            return;
        }

        const cleared = await music.clearQueue(guildId);
        if (cleared === 0) {
            await msgError(message, '❌ Queue is already empty!');
            return;
        }

        await msgReply(message, `🧹 **Cleared ${cleared} songs** from the queue!`, { color: 0x9bff00 });
    }
};

export default command;