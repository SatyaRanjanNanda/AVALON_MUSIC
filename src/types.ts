import { SlashCommandBuilder } from 'discord.js';
import { CommandContext } from './structures/CommandContext';

export interface Command {
    data: any;
    execute: (context: CommandContext) => Promise<void>;
}
