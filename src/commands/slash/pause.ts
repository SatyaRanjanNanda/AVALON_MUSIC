import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { music } from '../../core';
import { getConditions, interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the current song')
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, interaction.user.id, interactionVoiceChannelId(interaction), true);
        if (!ok) {
            await slashError(interaction, error || '❌ Cannot pause right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player?.playing) {
            await slashError(interaction, '❌ Nothing is currently playing to pause!');
            return;
        }

        await music.pause(guildId, true);
        await slashReply(interaction, '⏸️ **Paused!**');
    }
};

export default command;