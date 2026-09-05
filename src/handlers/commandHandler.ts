import { Collection, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import type { MessageCommand, SlashCommand } from '../types';

export const messageCommands = new Collection<string, MessageCommand>();
export const slashCommands = new Collection<string, SlashCommand>();

async function loadFromDirectory(dir: string): Promise<string> {
    let loaded = 0;
    if (!fs.existsSync(dir)) return '0';
    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));
    for (const file of files) {
        const filePath = path.join(dir, file);
        try {
            delete require.cache[require.resolve(filePath)];
            const command = (await import(filePath)).default;
            if (!command) continue;
            if ('data' in command) {
                if (!slashCommands.has(command.data.name)) {
                    slashCommands.set(command.data.name, command as SlashCommand);
                    loaded++;
                }
            } else if (command.name) {
                messageCommands.set(command.name, command as MessageCommand);
                for (const alias of command.aliases ?? []) {
                    if (!messageCommands.has(alias)) messageCommands.set(alias, command as MessageCommand);
                }
                loaded++;
            }
        } catch (error) {
            console.error(`Error loading command from ${filePath}:`, error);
        }
    }
    return String(loaded);
}

export async function loadCommands(): Promise<{ message: number; slash: number }> {
    messageCommands.clear();
    slashCommands.clear();
    const message = await loadFromDirectory(path.join(__dirname, '..', 'commands', 'message'));
    const slash = await loadFromDirectory(path.join(__dirname, '..', 'commands', 'slash'));
    console.log(`⚡ Loaded ${message} message commands and ${slash} slash commands!`);
    return { message: Number(message), slash: Number(slash) };
}

export async function registerSlashCommands(token: string, clientId: string): Promise<void> {
    const commands = slashCommands.map((cmd) => cmd.data.toJSON());
    if (commands.length === 0) return;
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationCommands(clientId), { body: commands });
        console.log(`✅ Registered ${commands.length} slash commands successfully!`);
    } catch (error) {
        console.error('❌ Failed to register slash commands:', error);
    }
}