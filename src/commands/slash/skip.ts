import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { music } from '../../core';
import { getConditions, interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song')
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, interaction.user.id, interactionVoiceChannelId(interaction), true);
        if (!ok) {
            await slashError(interaction, error || '❌ Cannot skip right now!');
            return;
        }

        const skipped = await music.skip(guildId);
        if (!skipped) {
            await slashError(interaction, '❌ Nothing is currently playing to skip!');
            return;
        }

        await slashReply(interaction, '⏭️ **Skipped!**');
    }
};

export default command;