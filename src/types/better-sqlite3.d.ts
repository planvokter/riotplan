declare module "better-sqlite3" {
    interface Statement {
        get(...params: unknown[]): unknown;
        run(...params: unknown[]): { changes: number };
    }

    class Database {
        constructor(path: string, options?: { fileMustExist?: boolean });
        prepare(sql: string): Statement;
        close(): void;
    }

    export default Database;
}
