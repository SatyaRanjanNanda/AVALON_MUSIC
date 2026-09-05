import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { music } from '../../core';
import { getConditions, interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';
import { normalizeQuery } from '../../utils/helpers';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or playlist from a query or URL')
        .addStringOption((option) =>
            option.setName('song').setDescription('Song name or URL to play').setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        const guildId = interaction.guildId;
        if (!guildId) return;

        const voiceChannelId = interactionVoiceChannelId(interaction);
        const { ok, error } = await getConditions(guildId, interaction.user.id, voiceChannelId);
        if (!ok) {
            await slashError(interaction, error || '❌ Cannot play right now!');
            return;
        }

        if (!voiceChannelId) {
            await slashError(interaction, '❌ You need to be in a voice channel first!');
            return;
        }

        const player = await music.createPlayer(guildId, voiceChannelId, interaction.channel?.id || '');
        if (!player) {
            await slashError(interaction, '❌ Failed to create voice connection! Please try again.');
            return;
        }

        const query = interaction.options.getString('song', true);
        const result = await music.playSong(player, normalizeQuery(query), interaction.user);

        if (result.type === 'error') {
            await slashError(interaction, `❌ ${result.message}`);
            return;
        }

        if (result.type === 'playlist') {
            await slashReply(interaction, `🎵 Added **${result.tracksCount}** songs from playlist **${result.name}** to the queue!`);
            return;
        }

        await slashReply(interaction, `🎵 Added **${result.track.info.title}** to the queue!`);
    }
};

export default command;