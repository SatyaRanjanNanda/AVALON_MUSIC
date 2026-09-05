import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { music } from '../../core';
import { getConditions, interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the music volume (0-100)')
        .addIntegerOption((option) =>
            option.setName('level').setDescription('Volume level from 0 to 100').setRequired(false)
        )
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, interaction.user.id, interactionVoiceChannelId(interaction), true);
        if (!ok) {
            await slashError(interaction, error || '❌ Cannot change volume right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player) {
            await slashError(interaction, '❌ No music is currently playing!');
            return;
        }

        const level = interaction.options.getInteger('level');
        if (level === null) {
            await slashReply(interaction, `🔊 Current volume is **${player.volume}%**`);
            return;
        }

        const volume = Math.max(0, Math.min(100, level));
        await music.setVolume(guildId, volume);
        await slashReply(interaction, `🔊 Volume set to **${volume}%**`);
    }
};

export default command;