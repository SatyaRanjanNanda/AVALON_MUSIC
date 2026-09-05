import { SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../types';
import type { LoopMode } from '../../types';
import { music } from '../../core';
import { getConditions, interactionVoiceChannelId, slashError, slashReply } from '../../services/musicService';

const command: SlashCommand = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Set the loop mode')
        .addStringOption((option) =>
            option
                .setName('mode')
                .setDescription('Loop mode: off, track, or queue')
                .setRequired(false)
                .addChoices(
                    { name: 'Off', value: 'none' },
                    { name: 'Track', value: 'track' },
                    { name: 'Queue', value: 'queue' }
                )
        )
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        if (!guildId) return;

        const { ok, error } = await getConditions(guildId, interaction.user.id, interactionVoiceChannelId(interaction), true);
        if (!ok) {
            await slashError(interaction, error || '❌ Cannot change loop right now!');
            return;
        }

        const player = music.getPlayer(guildId);
        if (!player) {
            await slashError(interaction, '❌ No music is currently playing!');
            return;
        }

        const selected = interaction.options.getString('mode') as LoopMode | null;
        const modes: LoopMode[] = ['none', 'track', 'queue'];
        const current = (player.loop as LoopMode) || 'none';
        const next: LoopMode = selected ?? modes[(modes.indexOf(current) + 1) % modes.length];

        await music.setLoop(guildId, next);

        const labels: Record<LoopMode, string> = {
            none: '❌ **OFF**',
            track: '🔂 **TRACK**',
            queue: '🔁 **QUEUE**'
        };

        await slashReply(interaction, `🔁 Loop mode set to ${labels[next]}`);
    }
};

export default command;