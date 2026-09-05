import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { music } from '../../core';
import { interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Make the bot join your voice channel')
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        if (!guildId) return;

        const voiceChannelId = interactionVoiceChannelId(interaction);
        if (!voiceChannelId) {
            await slashError(interaction, '❌ You need to be in a voice channel first!');
            return;
        }

        const player = await music.createPlayer(guildId, voiceChannelId, interaction.channel?.id || '');
        if (!player) {
            await slashError(interaction, '❌ Failed to join the voice channel!');
            return;
        }

        await slashReply(interaction, `📡 Joined <#${voiceChannelId}>!`);
    }
};

export default command;