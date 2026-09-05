import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';

const command: MessageCommand = {
    name: 'stop',
    aliases: [],
    description: 'Stop playing and clear the queue',
    async execute(message) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId, true);
        if (!ok) {
            await msgError(message, error || '❌ Cannot stop right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player) {
            await msgError(message, '❌ No music is currently playing!');
            return;
        }

        await music.stop(guildId);
        await msgReply(message, '⏹️ **Stopped and left the voice channel!**', { color: 0x9bff00 });
    }
};

export default command;