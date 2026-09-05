import { Client } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

export const loadEvents = async (client: Client) => {
    const eventsPath = path.join(__dirname, '../events');
    if (!fs.existsSync(eventsPath)) return;

    const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));
    let loaded = 0;

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        try {
            const imported = await import(filePath);
            const event = imported.default ?? imported;
            if (!event || !event.name) continue;
            if (event.once) {
                client.once(event.name, (...args: unknown[]) => event.execute(client, ...args));
            } else {
                client.on(event.name, (...args: unknown[]) => event.execute(client, ...args));
            }
            loaded++;
        } catch (error) {
            console.error(`Error loading event from ${filePath}:`, error);
        }
    }

    if (loaded > 0) console.log(`🔔 Loaded ${loaded} events!`);
};