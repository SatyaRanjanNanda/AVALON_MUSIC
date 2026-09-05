import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { queueEmbed } from '../../utils/embedUtils';
import { MessageFlags } from 'discord.js';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current queue')
        .addIntegerOption((option) =>
            option.setName('page').setDescription('Page number of the queue').setRequired(false)
        )
        .setDMPermission(false),
    async execute(interaction) {
        const guildId = interaction.guildId;
        if (!guildId) return;

        const page = interaction.options.getInteger('page') ?? 1;
        const embed = await queueEmbed(guildId, page);

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => undefined);
        setTimeout(() => interaction.deleteReply().catch(() => undefined), 15000);
    }
};

export default command;