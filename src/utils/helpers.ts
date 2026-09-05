import type { Track } from '../types';

export function formatDuration(ms: number | undefined | null): string {
    if (!ms || isNaN(ms) || ms < 0) return '0:00';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingSeconds = seconds % 60;
    const remainingMinutes = minutes % 60;

    const secPart = String(remainingSeconds).padStart(2, '0');
    if (hours > 0) {
        return `${hours}:${String(remainingMinutes).padStart(2, '0')}:${secPart}`;
    }
    return `${remainingMinutes}:${secPart}`;
}

export function getTrackThumbnail(track: Track): string | null {
    if (!track?.info) return null;
    const info = track.info;
    if (typeof info.thumbnail === 'string' && info.thumbnail.trim() !== '') {
        return info.thumbnail;
    }
    if (info.sourceName === 'youtube' && info.identifier) {
        return `https://img.youtube.com/vi/${info.identifier}/maxresdefault.jpg`;
    }
    if (info.sourceName === 'soundcloud' && typeof info.thumbnail === 'string') {
        return info.thumbnail;
    }
    return null;
}

export function getProgressBar(position: number, duration: number, length = 16): string {
    if (!duration) return '▱'.repeat(length);
    const progress = Math.max(0, Math.min(1, position / duration));
    const filled = Math.round(progress * length);
    return '▰'.repeat(filled) + '▱'.repeat(length - filled);
}

export function isUrl(query: string): boolean {
    return /^https?:\/\//i.test(query);
}

export function normalizeQuery(query: string): string {
    if (!query) return query;
    if (isUrl(query)) return query;
    if (/^(ytsearch|ytmsearch|scsearch|spsearch|amsearch|dzsearch|ymsearch):/i.test(query)) return query;
    return `ytmsearch:${query}`;
}

export function mentionRequester(requester: unknown): string {
    if (!requester) return 'Unknown';
    if (typeof requester === 'object' && requester !== null && 'id' in requester) {
        const id = (requester as { id: string }).id;
        return `<@${id}>`;
    }
    return String(requester);
}

export async function autoDelete(message: { delete: () => Promise<unknown> } | null, ms = 4000): Promise<void> {
    if (!message) return;
    setTimeout(() => message.delete().catch(() => undefined), ms);
}