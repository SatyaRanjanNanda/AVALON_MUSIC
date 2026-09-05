import { Interaction, Events } from 'discord.js';
import { commands } from '../handlers/commandHandler';
import { CommandContext } from '../structures/CommandContext';
import { handleButtonInteraction, handleSelectMenuInteraction } from '../handlers/buttonHandler';

export const name = Events.InteractionCreate;
export const execute = async (interaction: Interaction) => {
    if (interaction.isButton()) {
        return handleButtonInteraction(interaction);
    }
    if (interaction.isStringSelectMenu()) {
        return handleSelectMenuInteraction(interaction);
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);

    if (!command) {
        console.error(\No command matching \ was found.\);
        return;
    }

    try {
        const context = new CommandContext(interaction);
        await command.execute(context);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true }).catch(console.error);
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true }).catch(console.error);
        }
    }
};
