import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { music } from '../../core';
import { getConditions, interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear the entire music queue')
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, interaction.user.id, interactionVoiceChannelId(interaction), true);
        if (!ok) {
            await slashError(interaction, error || '❌ Cannot clear right now!');
            return;
        }

        const cleared = await music.clearQueue(guildId);
        if (cleared === 0) {
            await slashError(interaction, '❌ Queue is already empty!');
            return;
        }

        await slashReply(interaction, `🧹 **Cleared ${cleared} songs** from the queue!`);
    }
};

export default command;