import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';

const command: MessageCommand = {
    name: 'remove',
    aliases: ['rm'],
    description: 'Remove a song from the queue by its position number',
    async execute(message, args) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId, true);
        if (!ok) {
            await msgError(message, error || '❌ Cannot remove right now!');
            return;
        }

        const index = parseInt(args[0] || '', 10);
        if (isNaN(index) || index < 1) {
            await msgError(message, '❌ Please provide a valid queue position! Usage: `!remove <position>`');
            return;
        }

        const removed = await music.removeAt(guildId, index);
        if (!removed) {
            await msgError(message, `❌ No track found at position **${index}** in the queue!`);
            return;
        }

        await msgReply(message, `✅ Removed **${removed.info?.title || 'Unknown Track'}** from the queue!`, { color: 0x9bff00 });
    }
};

export default command;