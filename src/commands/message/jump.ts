import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';

const command: MessageCommand = {
    name: 'jump',
    aliases: ['skipto'],
    description: 'Jump to a specific song in the queue',
    async execute(message, args) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId, true);
        if (!ok) {
            await msgError(message, error || '❌ Cannot jump right now!');
            return;
        }

        const index = parseInt(args[0] || '', 10);
        const player = music.getPlayer(guildId);
        if (!player) {
            await msgError(message, '❌ No music is currently playing!');
            return;
        }

        if (isNaN(index) || index < 1 || index > player.queue.size) {
            await msgReply(
                message,
                `❌ Please provide a valid queue position between **1** and **${player.queue.size}**!`,
                { color: 0xff5555 }
            );
            return;
        }

        await music.jumpTo(guildId, index);
        await msgReply(message, `⏭️ Jumped to song at position **${index}**!`, { color: 0x9bff00 });
    }
};

export default command;