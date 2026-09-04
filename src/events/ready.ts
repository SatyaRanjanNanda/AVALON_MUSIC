import { Client, Events } from 'discord.js';
import { registerCommands } from '../handlers/commandHandler';
import { prisma } from '../index';

export const name = Events.ClientReady;
export const once = true;
export const execute = async (client: Client) => {
    console.log(`Ready! Logged in as ${client.user?.tag}`);

    // Register commands globally (or you can register per-guild by passing guildId)
    if (client.token && client.user) {
        await registerCommands(client.token, client.user.id);
    }
    
    // Test prisma connection
    try {
        await prisma.$connect();
        console.log("Connected to Prisma / Supabase database");
    } catch (e) {
        console.error("Failed to connect to the database:", e);
    }
};
