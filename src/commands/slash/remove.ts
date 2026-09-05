import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { music } from '../../core';
import { getConditions, interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from the queue by its position number')
        .addIntegerOption((option) =>
            option.setName('position').setDescription('Position of the song in the queue').setRequired(true)
        )
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, interaction.user.id, interactionVoiceChannelId(interaction), true);
        if (!ok) {
            await slashError(interaction, error || '❌ Cannot remove right now!');
            return;
        }

        const index = interaction.options.getInteger('position', true);
        const removed = await music.removeAt(guildId, index);

        if (!removed) {
            await slashError(interaction, `❌ No track found at position **${index}** in the queue!`);
            return;
        }

        await slashReply(interaction, `✅ Removed **${removed.info?.title || 'Unknown Track'}** from the queue!`);
    }
};

export default command;