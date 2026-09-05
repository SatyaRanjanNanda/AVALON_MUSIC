import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import { music, settings } from '../../core';
import { getConditions, interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';
import { ConditionChecker } from '../../utils/checks';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Toggle autoplay mode')
        .addBooleanOption((option) =>
            option.setName('enabled').setDescription('Enable or disable autoplay').setRequired(true)
        )
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        if (!guildId) return;

        const checker = new ConditionChecker(interaction.client, settings);
        const canUse = await checker.canUseMusic(guildId, interaction.user.id);
        if (!canUse) {
            await slashError(interaction, '❌ You need DJ permissions to change autoplay settings!');
            return;
        }

        const { ok, error } = await getConditions(guildId, interaction.user.id, interactionVoiceChannelId(interaction));
        if (!ok) {
            await slashError(interaction, error || '❌ Cannot toggle autoplay right now!');
            return;
        }

        const enabled = interaction.options.getBoolean('enabled', true);

        await settings.set(guildId, { autoplay: enabled });

        const player = music.getPlayer(guildId);
        if (player) {
            await music.setAutoplay(guildId, enabled);
        }

        await slashReply(interaction, `🎲 Autoplay **${enabled ? 'enabled' : 'disabled'}**`);
    }
};

export default command;