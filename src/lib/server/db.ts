import { createClient } from "@libsql/client";

export const db = createClient({
	url: "file:./src/data.db"
});

// Create tables if they don't exist
await db.execute(`CREATE TABLE IF NOT EXISTS user (
    id TEXT NOT NULL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
)`);

await db.execute(`CREATE TABLE IF NOT EXISTS session (
    id TEXT NOT NULL PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
)`);

await db.execute(`CREATE TABLE IF NOT EXISTS mission (
    id TEXT NOT NULL PRIMARY KEY,
    title TEXT NOT NULL,
    actions JSON NOT NULL,
    isLoaded BOOLEAN NOT NULL
)`);

export interface DatabaseUser {
	id: string;
	username: string;
	password_hash: string;
}
