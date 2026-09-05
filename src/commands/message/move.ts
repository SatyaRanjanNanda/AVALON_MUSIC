import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';

const command: MessageCommand = {
    name: 'move',
    aliases: [],
    description: 'Move a song to a different position in the queue',
    async execute(message, args) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId, true);
        if (!ok) {
            await msgError(message, error || '❌ Cannot move right now!');
            return;
        }

        const from = parseInt(args[0] || '', 10);
        const to = parseInt(args[1] || '', 10);
        if (isNaN(from) || isNaN(to) || from < 1 || to < 1) {
            await msgError(message, '❌ Please provide valid positions! Usage: `!move <from> <to>`');
            return;
        }

        const moved = await music.moveTrack(guildId, from, to);
        if (!moved) {
            await msgError(message, `❌ Could not move track from position **${from}** to **${to}**!`);
            return;
        }

        await msgReply(message, `🎵 Moved track from position **${from}** to **${to}**!`, { color: 0x9bff00 });
    }
};

export default command;