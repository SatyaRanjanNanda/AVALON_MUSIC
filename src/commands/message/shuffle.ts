import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';

const command: MessageCommand = {
    name: 'shuffle',
    aliases: [],
    description: 'Shuffle the current queue',
    async execute(message) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId, true);
        if (!ok) {
            await msgError(message, error || '❌ Cannot shuffle right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player || player.queue.size < 2) {
            await msgError(message, '❌ Queue needs at least 2 songs to shuffle!');
            return;
        }

        await music.shuffle(guildId);
        await msgReply(message, '🔀 **Queue shuffled!**', { color: 0x9bff00 });
    }
};

export default command;