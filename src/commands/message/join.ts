import type { MessageCommand } from '../../types';
import { music } from '../../core';
import { msgError, msgReply } from '../../services/musicService';

const command: MessageCommand = {
    name: 'join',
    aliases: ['come'],
    description: 'Make the bot join your voice channel',
    async execute(message) {
        const guildId = message.guild?.id;
        if (!guildId) return;

        const voiceChannelId = message.member?.voice?.channelId;
        if (!voiceChannelId) {
            await msgError(message, '❌ You need to be in a voice channel first!');
            return;
        }

        const player = await music.createPlayer(guildId, voiceChannelId, message.channel.id);
        if (!player) {
            await msgError(message, '❌ Failed to join the voice channel!');
            return;
        }

        await msgReply(message, `📡 Joined <#${voiceChannelId}>!`, { color: 0x9bff00 });
    }
};

export default command;