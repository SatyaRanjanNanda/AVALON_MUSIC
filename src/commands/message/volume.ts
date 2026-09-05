import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';

const command: MessageCommand = {
    name: 'volume',
    aliases: ['vol'],
    description: 'Set the music volume (0-100)',
    async execute(message, args) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId, true);
        if (!ok) {
            await msgError(message, error || '❌ Cannot change volume right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player) {
            await msgError(message, '❌ No music is currently playing!');
            return;
        }

        const volumeInput = parseInt(args[0] || '', 10);
        if (isNaN(volumeInput)) {
            await msgReply(message, `🔊 Current volume is **${player.volume}%**`, { color: 0x9bff00 });
            return;
        }

        const volume = Math.max(0, Math.min(100, volumeInput));
        await music.setVolume(guildId, volume);
        await msgReply(message, `🔊 Volume set to **${volume}%**`, { color: 0x9bff00 });
    }
};

export default command;