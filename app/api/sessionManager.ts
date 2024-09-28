// sessionManager.ts
import { v4 as uuidv4 } from 'uuid';
import NodeCache from 'node-cache';

// Export the ChatMessage interface with updated roles
export interface ChatMessage {
    role: 'user' | 'model'; // Changed from 'assistant' to 'model'
    content: string;
}

class SessionManager {
    private cache: NodeCache;

    constructor() {
        // Sessions expire after 1 hour of inactivity
        this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
    }

    createSession(initialHistory: ChatMessage[]): string {
        const sessionId = uuidv4();
        this.cache.set(sessionId, initialHistory);
        return sessionId;
    }

    getSession(sessionId: string): ChatMessage[] | undefined {
        return this.cache.get<ChatMessage[]>(sessionId);
    }

    updateSession(sessionId: string, message: ChatMessage): void {
        const session = this.getSession(sessionId) || [];
        session.push(message);
        // Optionally limit the history to the last N messages
        const MAX_HISTORY = 10;
        if (session.length > MAX_HISTORY) {
            session.splice(0, session.length - MAX_HISTORY);
        }
        this.cache.set(sessionId, session);
    }
}

export const sessionManager = new SessionManager();