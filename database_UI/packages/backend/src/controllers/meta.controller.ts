//done_for_this
import { Request, Response, NextFunction } from 'express';
import * as metaService from '../services/meta.service';

export const createDatabase = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.warn('CONTROLLER: Attempt to add database without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { dbName } = req.body;
        if (!dbName || typeof dbName !== 'string' || dbName.trim().length === 0) {
            return res.status(400).json({ message: 'Database name is required in the request body.' });
        }
        const db_name = dbName.trim();
        console.log(`CONTROLLER: Attempting to CREATE database "${db_name}" for User ${userId}`);
        const newDb = await metaService.addDatabase(userId, db_name);
        console.log(`CONTROLLER: Database "${db_name}" (ID: ${newDb.db_id}) created successfully for User ${userId}`);
        res.status(201).json({
            message: `Database "${db_name}" created successfully.`,
            database: newDb
        });

    } catch (error: any) {
        console.error(`CONTROLLER ERROR (createDatabase):`, error);
        next(error);
    }
};

export const deleteTableColumn = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => { // Added | Response type
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.warn('CONTROLLER: Attempt to delete column without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { dbId: dbIdParam, tableName: baseTableNameParam, columnName: columnNameParam } = req.params;
        const dbId = parseInt(dbIdParam, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID provided.' });
        }
        if (!baseTableNameParam || typeof baseTableNameParam !== 'string' || baseTableNameParam.trim().length === 0) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }
        const baseTableName = baseTableNameParam.trim();
        if (!columnNameParam || typeof columnNameParam !== 'string' || columnNameParam.trim().length === 0) {
            return res.status(400).json({ message: 'Column name parameter is required.' });
        }
        const columnName = columnNameParam.trim();

        console.log(`CONTROLLER: Attempting DELETE column "${columnName}" from table "${baseTableName}" in DB ${dbId} for User ${userId}`);
        await metaService.deleteTableColumn(userId, dbId, baseTableName, columnName);

        console.log(`CONTROLLER: Column "${columnName}" deleted successfully from table "${baseTableName}" (DB ${dbId})`);
        res.status(200).json({
            message: `Column "${columnName}" deleted successfully from table "${baseTableName}".`
        });
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (deleteTableColumn): User ${req.session?.userId}, DB ${req.params.dbId}, Table "${req.params.tableName}", Column "${req.params.columnName}"`, error);
        next(error);
    }
};

export const getDatabases = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.warn('CONTROLLER: Attempt to list databases without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        console.log(`CONTROLLER: Listing databases for User ${userId}`);
        const databases = await metaService.listDatabases(userId);
        res.status(200).json(databases);
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (getDatabases):`, error);
        next(error);
    }
};

export const getDatabaseName = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.warn('CONTROLLER: Attempt to get database name without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const dbId = parseInt(req.params.dbId, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID.' });
        }
        console.log(`CONTROLLER: Getting database name for User ${userId}, DB ID ${dbId}`);
        const database = await metaService.getDbName(userId, dbId);
        if (!database) {
            return res.status(404).json({ message: 'Database not found.' });
        }
        console.log(`CONTROLLER: Database ID ${dbId} found for User ${userId}: "${database.db_name}"`);
        res.status(200).json(database.db_name);
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (getDatabaseName):`, error);
        next(error);
    }
};

export const renameUserDatabase = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.warn('CONTROLLER: Attempt to rename database without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const dbId = parseInt(req.params.dbId, 10);
        const { newDbName } = req.body;
        if (isNaN(dbId)) {
             return res.status(400).json({ message: 'Invalid Database ID.' });
        }
        if (!newDbName || typeof newDbName !== 'string' || newDbName.trim().length === 0) {
            return res.status(400).json({ message: 'New database name is required in the request body.' });
        }
        const new_db_name = newDbName.trim();
        console.log(`CONTROLLER: Attempting to RENAME database ID ${dbId} to "${new_db_name}" for User ${userId}`);
        const updatedDb = await metaService.renameDatabase(userId, dbId, new_db_name);
        console.log(`CONTROLLER: Database ID ${dbId} renamed to "${new_db_name}" successfully.`);
        res.status(200).json({
            message: `Database renamed to "${new_db_name}" successfully.`,
            database: updatedDb
        });
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (renameUserDatabase):`, error);
        next(error);
    }
};


export const deleteUserDatabase = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.warn('CONTROLLER: Attempt to delete database without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const dbId = parseInt(req.params.dbId, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID.' });
        }
        console.log(`CONTROLLER: Attempting to DELETE database ID ${dbId} for User ${userId}`);
        await metaService.deleteDatabase(userId, dbId);
        console.log(`CONTROLLER: Database ID ${dbId} and its contents deleted successfully.`);
        res.status(204).send();
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (deleteUserDatabase):`, error);
        next(error);
    }
};


export const addTable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.warn('CONTROLLER: Attempt to add table without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const dbId = parseInt(req.params.dbId, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID.' });
        }
        const { tableName } = req.body;
        if (!tableName || typeof tableName !== 'string' || tableName.trim().length === 0) {
            return res.status(400).json({ message: 'Table name is required in the request body.' });
        }
        const table_name = tableName.trim();
        console.log(`CONTROLLER: Attempting to CREATE table "${table_name}" in DB ${dbId} for User ${userId}`);
        const newTable = await metaService.createAndAssociateTable(userId, dbId, table_name);
        const physicalTableName = metaService.getPhysicalTableName(table_name, userId, dbId);
        console.log(`CONTROLLER: Table "${table_name}" (physical: ${physicalTableName}) created and associated successfully in DB ${dbId}`);
        res.status(201).json({
            message: `Table "${table_name}" created successfully in database.`,
            table: newTable,
            physicalName: physicalTableName
        });
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (addTable - Create): User ${req.session?.userId}, DB ${req.params.dbId}, Table "${req.body.tableName}"`, error);
        next(error);
    }
};

export const listTables = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.warn('CONTROLLER: Attempt to list tables without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const dbId = parseInt(req.params.dbId, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID.' });
        }
        console.log(`CONTROLLER: Listing tables for User ${userId}, DB ${dbId}`);
        const tables = await metaService.getTables(userId, dbId);
        res.status(200).json(tables);
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (listTables): User ${req.session?.userId}, DB ${req.params.dbId}`, error);
        next(error);
    }
};


export const getSchemaForTable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
       }
        const dbId = parseInt(req.params.dbId, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID.' });
        }
        const { tableName } = req.params;
        if (!tableName || tableName.trim().length === 0) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }
        const table_name = tableName.trim();
        console.log(`CONTROLLER: Getting schema for table "${table_name}" in DB ${dbId}, User ${userId}`);
        const schema = await metaService.getTableSchema(userId, dbId, table_name);
        res.status(200).json(schema);

    } catch (error: any) {
        console.error(`CONTROLLER Error fetching schema for Table "${req.params.tableName}", DB ${req.params.dbId}, User ${req.session?.userId}:`, error);
        next(error);
    }
};


export const addColumnToTable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
       }
        const dbId = parseInt(req.params.dbId, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID.' });
        }
        const { tableName } = req.params;
        const columnData = req.body;
        if (!tableName || tableName.trim().length === 0) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }
        if (!columnData || typeof columnData !== 'object' || !columnData.name || !columnData.type) {
            return res.status(400).json({ message: 'Invalid request body. Column name and type are required.' });
        }
        const table_name = tableName.trim();
        console.log(`CONTROLLER: Attempting to add column to table "${table_name}" in DB ${dbId}`, columnData);
        await metaService.addColumn(userId, dbId, table_name, columnData);
        const physicalTableName = metaService.getPhysicalTableName(table_name, userId, dbId);
        console.log(`CONTROLLER: Column added successfully via service to physical table ${physicalTableName}.`);
        res.status(201).json({ message: `Column "${columnData.name}" added successfully to table "${table_name}".` });

    } catch (error: any) {
        console.error(`CONTROLLER ERROR (addColumnToTable): Table "${req.params.tableName}", DB ${req.params.dbId}, User ${req.session?.userId}`, error);
        next(error);
    }
};


export const deleteTable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.warn('CONTROLLER: Attempt to delete table without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const dbId = parseInt(req.params.dbId, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID.' });
        }
        const { tableName } = req.params;
        if (!tableName || typeof tableName !== 'string' || tableName.trim().length === 0) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }
        const table_name = tableName.trim();
        const physicalTableName = metaService.getPhysicalTableName(table_name, userId, dbId);
        console.log(`CONTROLLER: Attempting to DELETE table "${table_name}" (physical: ${physicalTableName}) in DB ${dbId} for User ${userId}`);
        await metaService.deleteTableAndAssociation(userId, dbId, table_name);
        console.log(`CONTROLLER: Table "${table_name}" deleted successfully from DB ${dbId}.`);
        res.status(204).send();
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (deleteTable): Table "${req.params.tableName}", DB ${req.params.dbId}, User ${req.session?.userId}`, error);
        next(error);
    }
};


export const renameTable = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            console.warn('CONTROLLER: Attempt to rename table without authentication.');
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const dbId = parseInt(req.params.dbId, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID.' });
       }
        const { oldTableName } = req.params;
        const { newTableName } = req.body;
        if (!oldTableName || typeof oldTableName !== 'string' || oldTableName.trim().length === 0) {
            return res.status(400).json({ message: 'Current table name parameter is required.' });
        }
        if (!newTableName || typeof newTableName !== 'string' || newTableName.trim().length === 0) {
            return res.status(400).json({ message: 'New table name is required in the request body.' });
        }
        const old_name = oldTableName.trim();
        const new_name = newTableName.trim();
        const oldPhysical = metaService.getPhysicalTableName(old_name, userId, dbId);
        const newPhysical = metaService.getPhysicalTableName(new_name, userId, dbId);
        console.log(`CONTROLLER: Attempting to RENAME table "${old_name}" to "${new_name}" (physically ${oldPhysical} -> ${newPhysical}) in DB ${dbId} for User ${userId}`);
        const updatedTable = await metaService.renameTableAndAssociation(userId, dbId, old_name, new_name);
        console.log(`CONTROLLER: Table "${old_name}" renamed to "${new_name}" successfully.`);
        res.status(200).json({
            message: `Table "${old_name}" renamed to "${new_name}" successfully.`,
            table: updatedTable
        });
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (renameTable): Old: "${req.params.oldTableName}", New: "${req.body.newTableName}", DB ${req.params.dbId}, User ${req.session?.userId}`, error);
        next(error);
    }
};