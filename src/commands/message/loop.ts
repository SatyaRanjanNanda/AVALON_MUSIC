import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { getConditions, msgError, msgReply } from '../../services/musicService';
import type { LoopMode } from '../../types';

const command: MessageCommand = {
    name: 'loop',
    aliases: ['repeat', 'l'],
    description: 'Toggle loop mode (off / track / queue)',
    async execute(message) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, message.author.id, message.member?.voice?.channelId, true);
        if (!ok) {
            await msgError(message, error || '❌ Cannot change loop right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player) {
            await msgError(message, '❌ No music is currently playing!');
            return;
        }

        const modes: LoopMode[] = ['none', 'track', 'queue'];
        const current = (player.loop as LoopMode) || 'none';
        const next = modes[(modes.indexOf(current) + 1) % modes.length];
        await music.setLoop(guildId, next);

        const labels: Record<LoopMode, string> = {
            none: '❌ **OFF**',
            track: '🔂 **TRACK**',
            queue: '🔁 **QUEUE**'
        };

        await msgReply(message, `🔁 Loop mode set to ${labels[next]}`, { color: 0x9bff00 });
    }
};

export default command;