import { Message, Events } from 'discord.js';
import { commands } from '../handlers/commandHandler';
import { CommandContext } from '../structures/CommandContext';

export const name = Events.MessageCreate;
export const execute = async (message: Message) => {
    if (message.author.bot) return;
    
    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = commands.get(commandName);

    if (!command) return;

    try {
        const context = new CommandContext(message, args);
        await command.execute(context);
    } catch (error) {
        console.error(error);
        await message.reply('There was an error while executing this command!').catch(console.error);
    }
};
