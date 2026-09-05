import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types';
import { shoukaku } from '../../index';
import { CommandContext } from '../../structures/CommandContext';

const filterCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Apply audio filters to make the bot sound good')
        .addStringOption(option => 
            option.setName('preset')
                .setDescription('The filter preset to apply')
                .setRequired(true)
                .addChoices(
                    { name: 'Bassboost', value: 'bassboost' },
                    { name: 'Nightcore', value: 'nightcore' },
                    { name: '8D', value: '8d' },
                    { name: 'Vaporwave', value: 'vaporwave' },
                    { name: 'Clear', value: 'clear' }
                )
        ),
    execute: async (context: CommandContext) => {
        const player = shoukaku.players.get(context.guildId!);
        
        if (!player) {
            await context.reply({ content: 'No music is currently playing.', ephemeral: true });
            return;
        }

        let preset = '';
        if (context.isInteraction) {
            preset = context.interaction!.options.getString('preset', true);
        } else {
            preset = context.args[0]?.toLowerCase();
            if (!preset) {
                await context.reply('Please provide a filter preset (bassboost, nightcore, 8d, vaporwave, clear).');
                return;
            }
        }

        switch (preset) {
            case 'bassboost':
                await player.setFilters({
                    equalizer: [
                        { band: 0, gain: 0.2 },
                        { band: 1, gain: 0.15 },
                        { band: 2, gain: 0.1 },
                        { band: 3, gain: 0.05 },
                        { band: 4, gain: 0.0 },
                        { band: 5, gain: -0.05 },
                    ]
                });
                break;
            case 'nightcore':
                await player.setFilters({
                    timescale: { speed: 1.1, pitch: 1.2, rate: 1.0 }
                });
                break;
            case '8d':
                await player.setFilters({
                    rotation: { rotationHz: 0.2 }
                });
                break;
            case 'vaporwave':
                await player.setFilters({
                    timescale: { speed: 0.85, pitch: 0.8, rate: 1.0 }
                });
                break;
            case 'clear':
                await player.clearFilters();
                break;
            default:
                await context.reply('Unknown filter preset.');
                return;
        }

        await context.reply(`Applied filter: **${preset}**`);
    }
};

export default filterCommand;
