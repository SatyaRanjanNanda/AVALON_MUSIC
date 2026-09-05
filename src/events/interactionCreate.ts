import { Events, type Client, type Interaction } from 'discord.js';
import { slashCommands } from '../handlers/commandHandler';
import { handleFilterSelect, handleMusicButton } from '../handlers/buttonHandler';
import { createErrorEmbed } from '../utils/embedUtils';

export const name = Events.InteractionCreate;
export const once = false;

export async function execute(client: Client, interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand()) {
        const command = slashCommands.get(interaction.commandName);
        if (!command) {
            await interaction.reply({ content: '❌ Command not found!', ephemeral: true }).catch(() => undefined);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error executing slash command "${interaction.commandName}":`, error);
            const embed = createErrorEmbed('❌ An error occurred while executing that command.');
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [embed] }).catch(() => undefined);
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => undefined);
            }
        }
        return;
    }

    if (interaction.isButton()) {
        await handleMusicButton(interaction).catch((error) => {
            console.error('Button handler error:', error);
        });
        return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'filter') {
        await handleFilterSelect(interaction).catch((error) => {
            console.error('Filter select error:', error);
        });
    }
}