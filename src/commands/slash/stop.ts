import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { music } from '../../core';
import { getConditions, interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playing and clear the queue')
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, interaction.user.id, interactionVoiceChannelId(interaction), true);
        if (!ok) {
            await slashError(interaction, error || '❌ Cannot stop right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player) {
            await slashError(interaction, '❌ No music is currently playing!');
            return;
        }

        await music.stop(guildId);
        await slashReply(interaction, '⏹️ **Stopped and left the voice channel!**');
    }
};

export default command;