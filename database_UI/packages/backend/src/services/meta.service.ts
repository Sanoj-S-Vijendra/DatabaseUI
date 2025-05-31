import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';
import * as metainterface from '../interface/meta.types'; 



const validateSqlIdentifier = (name: string, type: 'Table' | 'Column'): string => {
    if (!name || name.trim().length === 0) {
        throw new Error(`${type} name cannot be empty.`);
    }
    const trimmedName = name.trim();
    
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmedName)) {
        const error = new Error(`Invalid ${type} name format: "${trimmedName}". Use letters, numbers, underscores, and start with a letter or underscore.`);
        (error as any).statusCode = 400;
        throw error;
    }

    
    const reservedKeywords = [
        'ALL', 'ANALYSE', 'ANALYZE', 'AND', 'ANY', 'ARRAY', 'AS', 'ASC', 'ASYMMETRIC', 'AUTHORIZATION',
        'BINARY', 'BOTH', 'CASE', 'CAST', 'CHECK', 'COLLATE', 'COLLATION', 'COLUMN', 'CONCURRENTLY',
        'CONSTRAINT', 'CREATE', 'CROSS', 'CURRENT_CATALOG', 'CURRENT_DATE', 'CURRENT_ROLE', 'CURRENT_SCHEMA',
        'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'CURRENT_USER', 'DEFAULT', 'DEFERRABLE', 'DESC', 'DISTINCT',
        'DO', 'ELSE', 'END', 'EXCEPT', 'FALSE', 'FETCH', 'FOR', 'FOREIGN', 'FREEZE', 'FROM', 'FULL', 'GRANT',
        'GROUP', 'HAVING', 'ILIKE', 'IN', 'INITIALLY', 'INNER', 'INTERSECT', 'INTO', 'IS', 'ISNULL', 'JOIN',
        'LATERAL', 'LEADING', 'LEFT', 'LIKE', 'LIMIT', 'LOCALTIME', 'LOCALTIMESTAMP', 'NATURAL', 'NOT',
        'NOTNULL', 'NULL', 'OFFSET', 'ON', 'ONLY', 'OR', 'ORDER', 'OUTER', 'OVERLAPS', 'PLACING', 'PRIMARY',
        'REFERENCES', 'RETURNING', 'RIGHT', 'SELECT', 'SESSION_USER', 'SIMILAR', 'SOME', 'SYMMETRIC', 'TABLE',
        'TABLESAMPLE', 'THEN', 'TO', 'TRAILING', 'TRUE', 'UNION', 'UNIQUE', 'USER', 'USING', 'VARIADIC',
        'VERBOSE', 'WHEN', 'WHERE', 'WINDOW', 'WITH'
    ]; 
    if (reservedKeywords.includes(trimmedName.toUpperCase())) {
        const error = new Error(`${type} name "${trimmedName}" is a reserved SQL keyword.`);
        (error as any).statusCode = 400;
        throw error;
    }

    
    if (trimmedName.length > 63) {
        const error = new Error(`${type} name "${trimmedName}" is too long (max 63 characters).`);
        (error as any).statusCode = 400;
        throw error;
    }

    return trimmedName;
};


const validateUserFacingName = (name: string, type: 'Database'): string => {
    if (!name || name.trim().length === 0) {
        throw new Error(`${type} name cannot be empty.`);
    }
    const trimmedName = name.trim();
    
    if (!/^[a-zA-Z0-9_-\s]+$/.test(trimmedName)) { 
        const error = new Error(`Invalid ${type} name format: "${trimmedName}". Use letters, numbers, underscores, hyphens, spaces.`);
        (error as any).statusCode = 400;
        throw error;
    }
     
    const dangerousPatterns = /(\b(ALTER|CREATE|DELETE|DROP|EXEC|INSERT|MERGE|SELECT|UPDATE|UNION)\b)|(--|\/\*|\*\/|;)/i;
    if (dangerousPatterns.test(trimmedName)) {
        const error = new Error(`Invalid ${type} name: "${trimmedName}". Contains potentially dangerous characters or keywords.`);
        (error as any).statusCode = 400;
        throw error;
    }
    
    if (trimmedName.length > 50) {
        const error = new Error(`${type} name "${trimmedName}" is too long (max 50 characters recommended).`);
        (error as any).statusCode = 400;
        throw error;
    }
    return trimmedName;
};



export const getPhysicalTableName = (baseTableName: string, userId: number, dbId: number): string => {
    
    const safeBaseName = baseTableName
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, '_') 
        .substring(0, 40); 

    const physicalName = `${safeBaseName}_u${userId}_db${dbId}`;

    
    if (physicalName.length > 63) {
        console.error(`Generated physical table name exceeds 63 chars: ${physicalName} (Base: ${baseTableName}, User: ${userId}, DB: ${dbId})`);
        
        throw new Error("Generated physical table name is too long after adding user/db IDs.");
    }
    
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(physicalName)) {
         console.error(`Generated physical table name is invalid: ${physicalName}`);
         throw new Error("Generated physical table name does not follow SQL identifier rules.");
    }
    return physicalName;
};


export const getDbName = async (userId: number, dbId: number): Promise<Prisma.users_databaseGetPayload<{}>> => {
    console.log(`SERVICE: Fetching database name for User ID ${userId}, DB ID ${dbId}`);
    try {
        const db = await prisma.users_database.findUnique({
            where: {
                user_id_db_id: {
                    user_id: userId,
                    db_id: dbId,
                },
            },
        });
        if (!db) {
            const error = new Error(`Database with ID ${dbId} not found for user ${userId}.`);
            (error as any).statusCode = 404;
            throw error;
        }
        console.log(`SERVICE: Found database entry: User ${userId}, DB ID ${dbId}, Name "${db.db_name}"`);
        return db;
    } catch (error) {
        console.error(`SERVICE ERROR (getDbName): User ${userId}, DB ID ${dbId}`, error);
        throw new Error("Could not fetch database name.");
    }
}



export const addDatabase = async (userId: number, rawDbName: string): Promise<Prisma.users_databaseGetPayload<{}>> => {
    const dbName = validateUserFacingName(rawDbName, 'Database'); 
    console.log(`SERVICE: Attempting to add database "${dbName}" for User ID ${userId}`);

    const existingDb = await prisma.users_database.findFirst({
        where: { user_id: userId, db_name: dbName }
    });
    if (existingDb) {
        const error = new Error(`Database with name "${dbName}" already exists for this user.`);
        (error as any).statusCode = 409;
        throw error;
    }

    try {
        
        const lastDb = await prisma.users_database.findFirst({
            where: { user_id: userId },
            orderBy: { db_id: 'desc' },
            select: { db_id: true }
        });
        const nextDbId = (lastDb?.db_id ?? 0) + 1; 

        const newDb = await prisma.users_database.create({
            data: {
                user_id: userId,
                db_id: nextDbId, 
                db_name: dbName,
            },
        });
        console.log(`SERVICE: Successfully added database entry: User ${userId}, DB ID ${newDb.db_id}, Name "${dbName}"`);
        return newDb;
    } catch (error: any) {
        console.error(`SERVICE ERROR (addDatabase): User ${userId}, Name "${dbName}"`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            
            
            const conflictError = new Error(`Database name "${dbName}" conflict occurred or ID generation issue.`);
            (conflictError as any).statusCode = 409;
            throw conflictError;
        }
        throw new Error(`Could not create database "${dbName}".`);
    }
};

export const listDatabases = async (userId: number): Promise<Prisma.users_databaseGetPayload<{}>[]> => {
    console.log(`SERVICE: Fetching databases for User ID ${userId}`);
    try {
        const databases = await prisma.users_database.findMany({
            where: { user_id: userId },
            orderBy: { db_id: 'asc' }, 
        });
        console.log(`SERVICE: Found ${databases.length} databases for User ${userId}`);
        return databases;
    } catch (error) {
        console.error(`SERVICE ERROR (listDatabases): User ${userId}`, error);
        throw new Error("Could not fetch databases.");
    }
};

export const renameDatabase = async (userId: number, dbId: number, rawNewDbName: string): Promise<Prisma.users_databaseGetPayload<{}>> => {
    const newDbName = validateUserFacingName(rawNewDbName, 'Database'); 
    console.log(`SERVICE: Attempting to rename DB ID ${dbId} to "${newDbName}" for User ID ${userId}`);

    
    const existingDbWithNewName = await prisma.users_database.findFirst({
        where: {
            user_id: userId,
            db_name: newDbName,
            NOT: { db_id: dbId } 
        }
    });
    if (existingDbWithNewName) {
        const error = new Error(`Another database named "${newDbName}" already exists for this user.`);
        (error as any).statusCode = 409;
        throw error;
    }

    try {
        const updatedDb = await prisma.users_database.update({
            where: {
                user_id_db_id: { 
                    user_id: userId,
                    db_id: dbId,
                },
            },
            data: {
                db_name: newDbName,
            },
        });
        console.log(`SERVICE: Successfully renamed DB ID ${dbId} to "${newDbName}" for User ${userId}`);
        return updatedDb;
    } catch (error: any) {
        console.error(`SERVICE ERROR (renameDatabase): User ${userId}, DB ID ${dbId}, New Name "${newDbName}"`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            
            const notFoundError = new Error(`Database with ID ${dbId} not found for this user.`);
            (notFoundError as any).statusCode = 404;
            throw notFoundError;
        }
        
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const conflictError = new Error(`Database name "${newDbName}" conflict during rename.`);
            (conflictError as any).statusCode = 409;
            throw conflictError;
        }
        throw new Error(`Could not rename database ID ${dbId}.`);
    }
};

export const deleteDatabase = async (userId: number, dbId: number): Promise<void> => {
    console.log(`SERVICE: Attempting to DELETE database ID ${dbId} and all its contents for User ID ${userId}`);

    const tablesToDelete = await prisma.users_database_tables.findMany({
        where: { user_id: userId, db_id: dbId },
        select: { table_name: true, table_id: true }
    });

    try {
        await prisma.$transaction(async (tx) => {
            for (const table of tablesToDelete) {
                const physicalTableName = getPhysicalTableName(table.table_name, userId, dbId);
                const dropTableSql = `DROP TABLE IF EXISTS "public"."${physicalTableName}";`;
                console.log(`TX: Executing SQL: ${dropTableSql}`);
                await tx.$executeRawUnsafe(dropTableSql);
                console.log(`TX: Physical table "${physicalTableName}" dropped (if existed).`);
            }
            console.log(`TX: Deleting table associations for User ${userId}, DB ID ${dbId}`);
            const deleteTableAssocResult = await tx.users_database_tables.deleteMany({
                where: { user_id: userId, db_id: dbId },
            });
            console.log(`TX: Deleted ${deleteTableAssocResult.count} table associations.`);
            console.log(`TX: Deleting database entry for User ${userId}, DB ID ${dbId}`);
            await tx.users_database.delete({
                where: {
                    user_id_db_id: {
                        user_id: userId,
                        db_id: dbId,
                    },
                },
            });
            console.log(`TX: Database entry deleted.`);
        });

        console.log(`SERVICE: Successfully deleted database ID ${dbId} and associated tables/data for User ID ${userId}.`);

    } catch (error: any) {
        console.error(`SERVICE ERROR (deleteDatabase transaction): User ${userId}, DB ID ${dbId}`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             console.warn(`Database with ID ${dbId} or its associations were not found during deletion for user ${userId}. Assuming already deleted.`);
             const notFoundError = new Error(`Database with ID ${dbId} not found for deletion.`);
             (notFoundError as any).statusCode = 404;
             throw notFoundError;
        }
        throw new Error(`Could not delete database ID ${dbId}. An error occurred during the process.`);
    }
};




export const createAndAssociateTable = async (userId: number, dbId: number, rawTableName: string): Promise<Prisma.users_database_tablesGetPayload<{}>> => {
    const baseTableName = validateSqlIdentifier(rawTableName, 'Table'); 
    console.log(`SERVICE: Attempting to CREATE table "${baseTableName}" in DB ID ${dbId} for User ID ${userId}`);

    const existingAssociation = await prisma.users_database_tables.findFirst({
        where: { user_id: userId, db_id: dbId, table_name: baseTableName }
    });
    if (existingAssociation) {
        const error = new Error(`Table "${baseTableName}" already exists in this database (DB ID: ${dbId}).`);
        (error as any).statusCode = 409;
        throw error;
    }

    const physicalTableName = getPhysicalTableName(baseTableName, userId, dbId);

    const lastTable = await prisma.users_database_tables.findFirst({
        where: { user_id: userId, db_id: dbId },
        orderBy: { table_id: 'desc' },
        select: { table_id: true }
    });
    const nextTableId = (lastTable?.table_id ?? 0) + 1; 
    const createTableSql = `CREATE TABLE "public"."${physicalTableName}" (serial_num BIGSERIAL PRIMARY KEY);`;

    try {
        const newTableEntry = await prisma.$transaction(async (tx) => {
            console.log("TX: Executing SQL:", createTableSql);
            await tx.$executeRawUnsafe(createTableSql);
            console.log(`TX: Successfully CREATED physical table "${physicalTableName}".`);

            console.log(`TX: Adding table association: User ${userId}, DB ${dbId}, TableID ${nextTableId}, Name "${baseTableName}"`);
            const createdEntry = await tx.users_database_tables.create({
                data: {
                    user_id: userId,
                    db_id: dbId,
                    table_id: nextTableId,
                    table_name: baseTableName,
                },
            });
            console.log(`TX: Successfully added table association entry.`);
            return createdEntry;
        });

        console.log(`SERVICE: Table "${baseTableName}" (physical: ${physicalTableName}) created and associated successfully in DB ${dbId} for User ${userId}.`);
        return newTableEntry;

    } catch (error: any) {
        console.error(`SERVICE ERROR (createAndAssociateTable): User ${userId}, DB ${dbId}, Table "${baseTableName}"`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const conflictError = new Error(`Table "${baseTableName}" is already associated with this database.`);
            (conflictError as any).statusCode = 409;
            try {
                await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "public"."${physicalTableName}";`);
                console.warn(`Cleaned up physical table "${physicalTableName}" after association conflict.`);
            } catch (cleanupError) {
                console.error(`CRITICAL: Failed to cleanup physical table "${physicalTableName}" after association conflict:`, cleanupError);
            }
            throw conflictError;
        }
        if (error.message?.includes('already exists') || (error.code === '42P07' && error.routine === 'DuplicateTable')) {
            const existsError = new Error(`Physical table "${physicalTableName}" already exists. Naming conflict or previous error?`);
            (existsError as any).statusCode = 409;
            throw existsError;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            const fkError = new Error(`Database ID ${dbId} does not exist for user ${userId}.`);
            (fkError as any).statusCode = 404; 
            throw fkError;
        }

        throw new Error(`Could not create table "${baseTableName}" in database ID ${dbId}.`);
    }
};

export const getTables = async (userId: number, dbId: number): Promise<Prisma.users_database_tablesGetPayload<{ select: { table_id: true, table_name: true } }>[]> => {
    console.log(`SERVICE: Fetching tables for User ID: ${userId}, DB ID: ${dbId}`);
    try {
        
        const dbExists = await prisma.users_database.findUnique({
             where: { user_id_db_id: { user_id: userId, db_id: dbId } },
             select: { db_id: true }
        });
        if (!dbExists) {
             const error = new Error(`Database with ID ${dbId} not found for user ${userId}.`);
             (error as any).statusCode = 404;
             throw error;
        }

        const userTablesResult = await prisma.users_database_tables.findMany({
            where: {
                user_id: userId,
                db_id: dbId, 
            },
            select: {
                table_id: true,    
                table_name: true,  
            },
            orderBy: {
                table_id: 'asc'   
            }
        });
        console.log(`SERVICE: Found ${userTablesResult.length} tables for user ${userId}, db ${dbId}.`);
        return userTablesResult;
    } catch (error: any) { 
        console.error(`SERVICE ERROR (getTables): User ${userId}, DB ${dbId}`, error);
        
        if ((error as any).statusCode === 404) {
             throw error;
        }
        throw new Error(`Could not fetch tables for database ID ${dbId}.`);
    }
};


interface AddColumnPayload {
    name: string;
    type: string;
    isNullable?: boolean;
    defaultValue?: any;
    isUnique?: boolean;
}

export const addColumn = async (userId: number, dbId: number, baseTableName: string, columnData: AddColumnPayload): Promise<void> => {
    const validatedBaseTableName = validateSqlIdentifier(baseTableName, 'Table');
    const physicalTableName = getPhysicalTableName(validatedBaseTableName, userId, dbId);
    const columnName = validateSqlIdentifier(columnData.name, 'Column'); 

    console.log(`SERVICE: Adding column "${columnName}" to physical table: ${physicalTableName}`, columnData);

    const allowedTypesPattern = /^(TEXT|VARCHAR|INTEGER|INT|BIGINT|SERIAL|BIGSERIAL|NUMERIC|DECIMAL|FLOAT|REAL|DOUBLE PRECISION|BOOLEAN|BOOL|DATE|TIMESTAMP|TIMESTAMP WITH TIME ZONE|DATETIME|JSON|JSONB|UUID)(\(\d+(,\d+)?\))?$/i;
    if (!allowedTypesPattern.test(columnData.type)) {
        const typeError = new Error(`Unsupported or invalid column type: ${columnData.type}`);
        (typeError as any).statusCode = 400;
        throw typeError;
    }

    let sql = `ALTER TABLE "public"."${physicalTableName}" ADD COLUMN "${columnName}" ${columnData.type}`;

    if (columnData.isNullable === false) {
        sql += ` NOT NULL`;
        if (columnData.defaultValue === undefined || columnData.defaultValue === null) {
            console.warn(`Adding NOT NULL column "${columnName}" without a default value might fail if table "${physicalTableName}" is not empty.`);
        }
    } else {
        sql += ` NULL`;
    }
    if (columnData.defaultValue !== undefined && columnData.defaultValue !== null) {
        let defaultValueSql: string;
        if (typeof columnData.defaultValue === 'string') {
             if (!['CURRENT_TIMESTAMP', 'NOW()', 'uuid_generate_v4()'].includes(columnData.defaultValue.toUpperCase())) {
                defaultValueSql = `'${columnData.defaultValue.replace(/'/g, "''")}'`;
             } else {
                 defaultValueSql = columnData.defaultValue;
             }
        } else if (typeof columnData.defaultValue === 'number' || typeof columnData.defaultValue === 'boolean') {
             defaultValueSql = `${columnData.defaultValue}`; 
        } else {
             console.warn(`Default value type for "${columnName}" not explicitly handled: ${typeof columnData.defaultValue}. Attempting to use directly.`);
             defaultValueSql = `${columnData.defaultValue}`;
        }
        sql += ` DEFAULT ${defaultValueSql}`;
    }

    
    if (columnData.isUnique === true) {
        sql += ` UNIQUE`; 
    }

    sql += `;`; 

    console.log("SERVICE: Executing SQL:", sql);
    try {
        const association = await prisma.users_database_tables.findFirst({
            where: { user_id: userId, db_id: dbId, table_name: validatedBaseTableName },
            select: { table_id: true }
        });
        if (!association) {
            const error = new Error(`Table "${validatedBaseTableName}" not found associated with database ID ${dbId} for this user.`);
            (error as any).statusCode = 404;
            throw error;
        }

        await prisma.$executeRawUnsafe(sql);
        console.log(`SERVICE: Column "${columnName}" added successfully to ${physicalTableName}.`);
    } catch (error: any) {
        console.error(`SERVICE ERROR (addColumn) to physical table "${physicalTableName}":`, error);
        if ((error.code === '42701' || error.message?.includes('already exists')) && error.message?.includes('column')) {
            const existsError = new Error(`Column "${columnName}" already exists in table "${validatedBaseTableName}".`);
            (existsError as any).statusCode = 409; 
            throw existsError;
        }
        if (error.code === '42P01' || error.message?.includes("does not exist")) { 
            throw new Error(`Physical table "${physicalTableName}" not found. Association might be incorrect.`);
        }
         if ((error as any).statusCode === 404) { 
             throw error;
         }
        throw new Error(`Could not add column "${columnName}" to table "${validatedBaseTableName}". Database error occurred: ${error.message}`);
    }
};

export const getTableSchema = async (userId: number, dbId: number, baseTableName: string): Promise<metainterface.ColumnSchema[]> => {
    const validatedBaseTableName = validateSqlIdentifier(baseTableName, 'Table');
    const physicalTableName = getPhysicalTableName(validatedBaseTableName, userId, dbId);
    console.log(`SERVICE: Fetching schema for physical table: ${physicalTableName} (Base: ${validatedBaseTableName}, User: ${userId}, DB: ${dbId})`);

    try {
        
        const association = await prisma.users_database_tables.findFirst({
            where: { user_id: userId, db_id: dbId, table_name: validatedBaseTableName },
             select: { table_id: true }
        });
        if (!association) {
             const error = new Error(`Table "${validatedBaseTableName}" not found associated with database ID ${dbId} for this user.`);
             (error as any).statusCode = 404;
             throw error;
        }

        
        const columnsResult: metainterface.ColumnSchema[] = await prisma.$queryRaw`
          SELECT
            c.column_name AS name,
            c.data_type AS type,
            CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END AS "isNullable",
            c.column_default AS "defaultValue",
            -- Check Primary Key
            (EXISTS (
              SELECT 1 FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = c.table_name AND tc.table_schema = c.table_schema AND kcu.column_name = c.column_name
            )) AS "isPrimaryKey",
            -- Check Foreign Key
            (EXISTS (
              SELECT 1 FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
              WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = c.table_name AND tc.table_schema = c.table_schema AND kcu.column_name = c.column_name
            )) AS "isForeignKey"
          FROM information_schema.columns c
          WHERE c.table_schema = 'public' -- Adjust if needed
            AND c.table_name = ${physicalTableName} -- Parameter binding for table name
          ORDER BY c.ordinal_position;
        `;
         return columnsResult.map(col => {
             const isPrimaryKey = Boolean(col.isPrimaryKey);
             let isAutoGenerated = false;
             if (isPrimaryKey && (col.type.toUpperCase().includes('SERIAL') || col.defaultValue?.toUpperCase().includes('NEXTVAL'))) {
                 isAutoGenerated = true;
             }
             return {
                 ...col,
                 isNullable: Boolean(col.isNullable),
                 isPrimaryKey: isPrimaryKey,
                 isForeignKey: Boolean(col.isForeignKey),
                 ...(isAutoGenerated && { isAutoGenerated: true })
             };
         });

    } catch (error: any) {
        console.error(`SERVICE ERROR (getTableSchema) for physical table "${physicalTableName}":`, error);
        if (error.code === '42P01' || error.message?.includes("does not exist")) {
            throw new Error(`Physical table "${physicalTableName}" not found, but association exists. Data inconsistency?`);
        }
         if ((error as any).statusCode === 404) {
             throw error;
         }
        throw new Error(`Could not fetch schema for table "${validatedBaseTableName}" (physical: ${physicalTableName}). DB Error: ${error.message}`);
    }
};


export const deleteTableAndAssociation = async (userId: number, dbId: number, baseTableName: string): Promise<void> => {
    const validatedBaseTableName = validateSqlIdentifier(baseTableName, 'Table');
    const physicalTableName = getPhysicalTableName(validatedBaseTableName, userId, dbId);
    console.log(`SERVICE: Attempting to DELETE table "${validatedBaseTableName}" (physical: ${physicalTableName}) in DB ${dbId} for User ${userId}`);
    const association = await prisma.users_database_tables.findFirst({
        where: {
            user_id: userId,
            db_id: dbId,
            table_name: validatedBaseTableName,
        },
        select: { table_id: true }
    });

    if (!association) {
        const error = new Error(`Table "${validatedBaseTableName}" not found in database ID ${dbId} for this user.`);
        (error as any).statusCode = 404;
        throw error;
    }

    const tableId = association.table_id;

    try {
        await prisma.$transaction(async (tx) => {
            console.log(`TX: Deleting association for User ${userId}, DB ${dbId}, Table ID ${tableId}, Name "${validatedBaseTableName}"`);
            await tx.users_database_tables.delete({
                where: {
                    user_id_db_id_table_id: {
                        user_id: userId,
                        db_id: dbId,
                        table_id: tableId
                    }
                },
            });
            console.log(`TX: Association deleted.`);
            const dropTableSql = `DROP TABLE IF EXISTS "public"."${physicalTableName}";`;
            console.log("TX: Executing SQL:", dropTableSql);
            await tx.$executeRawUnsafe(dropTableSql);
            console.log(`TX: Physical table "${physicalTableName}" dropped (if it existed).`);
        });

        console.log(`SERVICE: Successfully deleted table "${validatedBaseTableName}" (physical: ${physicalTableName}) and its association.`);

    } catch (error: any) {
        console.error(`SERVICE ERROR (deleteTable transaction): User ${userId}, DB ${dbId}, Table "${validatedBaseTableName}"`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
             console.warn(`Table association for "${validatedBaseTableName}" (ID: ${tableId}) vanished before deletion completed.`);
             try {
                 await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "public"."${physicalTableName}";`);
                 console.warn(`Attempted to drop physical table "${physicalTableName}" after association deletion failed/vanished.`);
             } catch (dropErr) {
                 console.error(`Failed to drop potentially orphaned physical table "${physicalTableName}" during error recovery:`, dropErr);
             }
             const notFoundError = new Error(`Table association for "${validatedBaseTableName}" could not be found during deletion.`);
            (notFoundError as any).statusCode = 404;
             throw notFoundError;
        }
        throw new Error(`Could not delete table "${validatedBaseTableName}". An error occurred during the process.`);
    }
};

export const renameTableAndAssociation = async (userId: number, dbId: number, oldTableNameRaw: string, newTableNameRaw: string): Promise<Prisma.users_database_tablesGetPayload<{}>> => {
    const oldBaseTableName = validateSqlIdentifier(oldTableNameRaw, 'Table');
    const newBaseTableName = validateSqlIdentifier(newTableNameRaw, 'Table');

    if (oldBaseTableName === newBaseTableName) {
        console.log(`SERVICE: Rename request ignored: old name "${oldBaseTableName}" and new name "${newBaseTableName}" are the same.`);
        const currentTable = await prisma.users_database_tables.findFirst({
            where: { user_id: userId, db_id: dbId, table_name: oldBaseTableName },
        });
        if (!currentTable) {
            const error = new Error(`Table "${oldBaseTableName}" not found in database ID ${dbId} for this user.`);
            (error as any).statusCode = 404;
            throw error;
        }
        return currentTable;
    }

    console.log(`SERVICE: Attempting to RENAME table "${oldBaseTableName}" to "${newBaseTableName}" in DB ${dbId} for User ${userId}`);
    const oldAssociation = await prisma.users_database_tables.findFirst({
        where: { user_id: userId, db_id: dbId, table_name: oldBaseTableName },
    });
    if (!oldAssociation) {
        const error = new Error(`Table "${oldBaseTableName}" not found in database ID ${dbId} for this user.`);
        (error as any).statusCode = 404;
        throw error;
    }
    const tableIdToUpdate = oldAssociation.table_id;
    const existingNewAssociation = await prisma.users_database_tables.findFirst({
        where: { user_id: userId, db_id: dbId, table_name: newBaseTableName },
        select: { table_id: true } 
   });
   if (existingNewAssociation) {
       const error = new Error(`A table named "${newBaseTableName}" already exists in this database (DB ID: ${dbId}).`);
       (error as any).statusCode = 409; 
       throw error;
   }

    const oldPhysicalTableName = getPhysicalTableName(oldBaseTableName, userId, dbId);
    const newPhysicalTableName = getPhysicalTableName(newBaseTableName, userId, dbId);
    try {
        const tableExistsCheckSql = `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1);`;
        const newTableExistsResult = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(tableExistsCheckSql, newPhysicalTableName);
        if (newTableExistsResult?.[0]?.exists) {
            const error = new Error(`A physical table named "${newPhysicalTableName}" already exists. Cannot rename due to conflict.`);
            (error as any).statusCode = 409;
            throw error;
        }
    } catch (checkError: any) {
        console.error(`SERVICE ERROR checking existence of potential new physical table name "${newPhysicalTableName}":`, checkError);
        throw new Error(`Failed to verify availability of the new physical table name.`);
    }
    try {
        const updatedAssociation = await prisma.$transaction(async (tx) => {
            const renameTableSql = `ALTER TABLE "public"."${oldPhysicalTableName}" RENAME TO "${newPhysicalTableName}";`;
            console.log("TX: Executing SQL:", renameTableSql);
            await tx.$executeRawUnsafe(renameTableSql);
            console.log(`TX: Physical table "${oldPhysicalTableName}" renamed to "${newPhysicalTableName}".`);
            console.log(`TX: Updating association for User ${userId}, DB ${dbId}, Table ID ${tableIdToUpdate} from "${oldBaseTableName}" to "${newBaseTableName}"`);
            const updateResult = await tx.users_database_tables.update({
                where: {
                    user_id_db_id_table_id: {
                        user_id: userId,
                        db_id: dbId,
                        table_id: tableIdToUpdate,
                    },
                },
                data: {
                    table_name: newBaseTableName,
                },
            });

            console.log(`TX: Association updated.`);
            return updateResult;
        });

        console.log(`SERVICE: Successfully renamed table "${oldBaseTableName}" to "${newBaseTableName}" (physical: ${newPhysicalTableName}) and updated association.`);
        return updatedAssociation;

    } catch (error: any) {
        console.error(`SERVICE ERROR (renameTable transaction): User ${userId}, DB ${dbId}, "${oldBaseTableName}" -> "${newBaseTableName}"`, error);
        const attemptPhysicalRollback = async () => {
             try {
                 const checkNewExistsSql = `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1);`;
                 const newExists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(checkNewExistsSql, newPhysicalTableName);
                 if (newExists?.[0]?.exists) {
                     const rollbackRenameSql = `ALTER TABLE "public"."${newPhysicalTableName}" RENAME TO "${oldPhysicalTableName}";`;
                     console.warn(`Attempting to roll back physical table rename: ${rollbackRenameSql}`);
                     await prisma.$executeRawUnsafe(rollbackRenameSql);
                     console.warn(`Rolled back physical table rename from ${newPhysicalTableName} to ${oldPhysicalTableName}.`);
                 } else {
                     console.warn(`Could not roll back physical table rename: target "${newPhysicalTableName}" does not exist.`);
                 }
             } catch (rollbackError) {
                 console.error(`CRITICAL: Failed to roll back physical table rename from ${newPhysicalTableName} to ${oldPhysicalTableName} after error! Manual intervention may be needed.`, rollbackError);
             }
         };

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2002') {
                 const conflictError = new Error(`Rename failed: The name "${newBaseTableName}" became associated concurrently.`);
                 (conflictError as any).statusCode = 409;
                 await attemptPhysicalRollback();
                 throw conflictError;
            }
             if (error.code === 'P2025') {
                 const notFoundError = new Error(`Rename failed: Original table association "${oldBaseTableName}" vanished before update completed.`);
                 (notFoundError as any).statusCode = 404;
                  await attemptPhysicalRollback();
                 throw notFoundError;
             }
        } else if (error.message?.includes('already exists') || (error.code === '42P07' && error.routine === 'RenameTable')) {
             const conflictError = new Error(`Rename failed: Target physical table "${newPhysicalTableName}" already exists (possibly created concurrently).`);
             (conflictError as any).statusCode = 409;
             throw conflictError;
        } else if (error.code === '42P01' || error.message?.includes('does not exist')) {
             const sourceMissingError = new Error(`Rename failed: Source physical table "${oldPhysicalTableName}" does not exist.`);
             (sourceMissingError as any).statusCode = 404;
             try {
                 await prisma.users_database_tables.delete({
                     where: { user_id_db_id_table_id: { user_id: userId, db_id: dbId, table_id: tableIdToUpdate } }
                 });
                 console.warn(`Deleted orphaned association for missing physical table ${oldPhysicalTableName}`);
             } catch (deleteErr) {
                 console.error(`Failed to delete orphaned association for ${oldPhysicalTableName}:`, deleteErr);
             }
             throw sourceMissingError;
        }
        throw new Error(`Could not rename table "${oldBaseTableName}" to "${newBaseTableName}". An error occurred: ${error.message}`);
    }
};



export const deleteTableColumn = async (
    userId: number,
    dbId: number,
    baseTableName: string,
    columnName: string
): Promise<void> => {

    const physicalTableName = getPhysicalTableName(baseTableName, userId, dbId);
    
    const safePhysicalTableName = `"${physicalTableName}"`;
    const safeColumnName = `"${columnName}"`;

    console.log(`SERVICE: Validating request to delete column ${safeColumnName} from physical table ${safePhysicalTableName}`);
    try {
        const tableCheck = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
            `SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' -- Adjust schema if needed
                AND table_name = $1
            );`,
            physicalTableName
        );
        if (!tableCheck || !tableCheck[0]?.exists) {
            console.error(`Table "${baseTableName}" (physical: ${physicalTableName}) not found.`, 404);
        }
    } catch(err: any) {
        console.error(`SERVICE ERROR: Failed to check existence of table ${physicalTableName}`, err);
        console.error(`Failed to verify table "${baseTableName}" existence.`, 500);
    }

    let isPrimaryKey = false;
    try {
        const columnCheck = await prisma.$queryRawUnsafe<Array<{ column_name: string, is_primary_key: string | null }>>(
            `SELECT
                col.column_name,
                kcu.constraint_name AS is_primary_key
            FROM information_schema.columns col
            LEFT JOIN information_schema.key_column_usage kcu
                ON col.table_schema = kcu.table_schema
                AND col.table_name = kcu.table_name
                AND col.column_name = kcu.column_name
            LEFT JOIN information_schema.table_constraints tc
                ON kcu.constraint_name = tc.constraint_name
                AND kcu.table_schema = tc.table_schema
                AND kcu.table_name = tc.table_name
                AND tc.constraint_type = 'PRIMARY KEY'
            WHERE col.table_schema = 'public' -- Adjust schema if needed
            AND col.table_name = $1
            AND col.column_name = $2;`,
            physicalTableName,
            columnName
        );

        if (!columnCheck || columnCheck.length === 0) {
            console.error(`Column "${columnName}" not found in table "${baseTableName}".`, 404);
        }
        isPrimaryKey = !!columnCheck[0].is_primary_key;

    } catch(err: any) {
        console.error(`SERVICE ERROR: Failed to check existence/PK status of column ${columnName} in ${physicalTableName}`, err);
        console.error(`Failed to verify column "${columnName}" existence.`, 500);
    }

    try {
        console.log(`SERVICE: Executing ALTER TABLE ${safePhysicalTableName} DROP COLUMN ${safeColumnName}`);
        await prisma.$executeRawUnsafe(`ALTER TABLE ${safePhysicalTableName} DROP COLUMN ${safeColumnName}`);

        console.log(`SERVICE: Column ${safeColumnName} successfully dropped from ${safePhysicalTableName}`);

    } catch (dbError: any) {
        console.error(`SERVICE ERROR: Failed to drop column ${safeColumnName} from ${safePhysicalTableName}`, dbError);
        if (dbError.code === '42703') {
            console.error(`Column "${columnName}" could not be found during delete operation.`, 404);
        }
        console.error(`Database error while deleting column "${columnName}": ${dbError.message || 'Unknown DB error'}`, 500);
    }
};