import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { music } from '../../core';
import { getConditions, interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused song')
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, interaction.user.id, interactionVoiceChannelId(interaction), true);
        if (!ok) {
            await slashError(interaction, error || '❌ Cannot resume right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player?.paused) {
            await slashError(interaction, '❌ Music is not paused!');
            return;
        }

        await music.pause(guildId, false);
        await slashReply(interaction, '▶️ **Resumed!**');
    }
};

export default command;