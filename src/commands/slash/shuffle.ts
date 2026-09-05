import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { music } from '../../core';
import { getConditions, interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffle the current queue')
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, interaction.user.id, interactionVoiceChannelId(interaction), true);
        if (!ok) {
            await slashError(interaction, error || '❌ Cannot shuffle right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player || player.queue.size < 2) {
            await slashError(interaction, '❌ Queue needs at least 2 songs to shuffle!');
            return;
        }

        await music.shuffle(guildId);
        await slashReply(interaction, '🔀 **Queue shuffled!**');
    }
};

export default command;