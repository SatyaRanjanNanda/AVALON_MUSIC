import { Interaction, Events } from 'discord.js';
import { commands } from '../handlers/commandHandler';

export const name = Events.InteractionCreate;
export const execute = async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true }).catch(console.error);
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(console.error);
        }
    }
};
