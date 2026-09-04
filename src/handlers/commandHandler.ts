import { Client, Collection, REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { Command } from '../types';

export const commands = new Collection<string, Command>();
export const commandData: any[] = [];

export const loadCommands = async (client: Client) => {
    const commandsPath = path.join(__dirname, '../commands');
    
    // Read command categories (folders)
    if (!fs.existsSync(commandsPath)) return;
    
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;
        
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath).default as Command;
            
            if ('data' in command && 'execute' in command) {
                commands.set(command.data.name, command);
                commandData.push(command.data.toJSON());
                console.log(`[Loaded Command] ${command.data.name}`);
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }
};

export const registerCommands = async (token: string, clientId: string) => {
    const rest = new REST().setToken(token);
    try {
        console.log(`Started refreshing ${commandData.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data: any = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commandData },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
}
