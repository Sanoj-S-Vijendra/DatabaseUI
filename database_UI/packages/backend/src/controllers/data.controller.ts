//done_for_this
import { Request, Response, NextFunction } from 'express';
import * as dataService from '../services/data.service';
import * as metaService from '../services/meta.service';
import { convertBigIntsToStrings } from '../utils/jsonUtils';

interface FilterCondition {
    id?: number;
    column?: string;
    operator?: string;
    value?: any;
    logicalOperator?: 'AND' | 'OR';
}

export const getTableData = async (req: Request, res: Response, next: NextFunction) => { 
    try {
        const userId = req.session?.userId;
        if(!userId) {
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
        const page = parseInt(req.query.page as string || '1', 10) || 1;
        const pageSize = parseInt(req.query.limit as string || '20', 10) || 20;
        const limit = Math.min(Math.max(1, pageSize), 100);
        const offset = (page - 1) * limit;
        let filters: FilterCondition[] | undefined = undefined;
        const filtersQueryParam = req.query.filters as string;
        console.log("Filters query param:", filtersQueryParam);
        if (filtersQueryParam) {
            try {
                filters = JSON.parse(filtersQueryParam);
                if (!Array.isArray(filters)) {
                    console.warn("Parsed filters is not an array, ignoring.", filters);
                    filters = undefined;
                } else {
                    console.log("Received and parsed filters:", filters);
                }
            } catch (parseError) {
                console.error("Error parsing filters query parameter:", parseError);
                filters = undefined;
            }
        }

        const groupByColumn = req.query.group_by as string[];
        if (groupByColumn && typeof groupByColumn !== 'string') {
             console.warn("Ignoring invalid group_by parameter type:", groupByColumn);
        }
        const validatedGroupBy = (groupByColumn);
        console.log(`CONTROLLER: getTableData - User: ${userId}, DB: ${dbId}, Table: "${table_name}", Page: ${page}, Limit: ${limit}, GroupBy: ${validatedGroupBy}`); // Log it
        const result = await dataService.getData(userId, dbId, table_name, {
             limit,
             offset,
             filters,
             group_by: validatedGroupBy
            });

        const final = convertBigIntsToStrings(result);
        res.status(200).json(final);
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (getTableData): User ${req.session?.userId}, DB ${req.params.dbId}, Table "${req.params.tableName}"`, error);
        next(error);
    }
};

export const addRow = async (req: Request, res: Response, next: NextFunction) => {
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
        const rowData = req.body;
        if (!tableName || tableName.trim().length === 0 || !rowData || typeof rowData !== 'object') {
            return res.status(400).json({ message: 'Invalid request: Table name and row data object required.' });
        }
        const table_name = tableName.trim();
        console.log(`CONTROLLER: addRow - User: ${userId}, DB: ${dbId}, Table: "${table_name}"`, rowData);
        const newRow = await dataService.createRow(userId, dbId, table_name, rowData);
        if (!newRow) {
            return res.status(500).json({ message: 'Failed to add row. Please try again.' });
        }
        const final = convertBigIntsToStrings(newRow);
        console.log(`CONTROLLER: Row added successfully. New row ID: ${final.id}`);
        res.status(201).json(final);
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (addRow): User ${req.session?.userId}, DB ${req.params.dbId}, Table "${req.params.tableName}"`, error);
        next(error);
    }
};

export const updateExistingRow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const dbId = parseInt(req.params.dbId, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID.' });
        }
        const { tableName, pkValue } = req.params;
        const rowData = req.body;
        if (!tableName || tableName.trim().length === 0 || !pkValue || !rowData || typeof rowData !== 'object') {
            return res.status(400).json({ message: 'Invalid request: Table name, primary key value, and row data object required.' });
        }
        const table_name = tableName.trim();
        console.log(`CONTROLLER: updateExistingRow - User: ${userId}, DB: ${dbId}, Table: "${table_name}", PK: ${pkValue}`, rowData);
        const pkColumn = await dataService.getPrimaryKeyColumn(userId, dbId, table_name);
        if (!pkColumn) {
            const physicalTableName = metaService.getPhysicalTableName(table_name, userId, dbId); 
            return res.status(400).json({ message: `Cannot determine primary key for table "${table_name}" (physical: ${physicalTableName}). Update failed.` });
        }
        console.log(`CONTROLLER: Found PK column "${pkColumn}" for update.`);
        const updatedRow = await dataService.updateRow(userId, dbId, table_name, pkValue, pkColumn, rowData);
        const final = convertBigIntsToStrings(updatedRow);
        res.status(200).json(final);
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (updateExistingRow): User ${req.session?.userId}, DB ${req.params.dbId}, Table "${req.params.tableName}", PK ${req.params.pkValue}`, error);
        next(error);
    }
};

export const deleteExistingRow = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const dbId = parseInt(req.params.dbId, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID.' });
        }
        const { tableName, pkValue } = req.params;
        if (!tableName || tableName.trim().length === 0 || !pkValue) {
            return res.status(400).json({ message: 'Invalid request: Table name and primary key value required.' });
        }
        const table_name = tableName.trim();
        console.log(`CONTROLLER: deleteExistingRow - User: ${userId}, DB: ${dbId}, Table: "${table_name}", PK: ${pkValue}`);
        const pkColumn = await dataService.getPrimaryKeyColumn(userId, dbId, table_name);
        if (!pkColumn) {
            const physicalTableName = metaService.getPhysicalTableName(table_name, userId, dbId);
            return res.status(400).json({ message: `Cannot determine primary key for table "${table_name}" (physical: ${physicalTableName}). Delete failed.` });
        }
        console.log(`CONTROLLER: Found PK column "${pkColumn}" for delete.`);
        const result = await dataService.deleteRow(userId, dbId, table_name, pkValue, pkColumn);
        if (result.deleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: `Row with ${pkColumn} = ${pkValue} not found for deletion in table "${table_name}".` });
        }
    } catch (error: any) {
        console.error(`CONTROLLER ERROR (deleteExistingRow): User ${req.session?.userId}, DB ${req.params.dbId}, Table "${req.params.tableName}", PK ${req.params.pkValue}`, error);
        next(error);
    }
};

export const uploadTableData = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.userId;
        if (!userId) {
             return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }
        const { tableName } = req.params;
        const dbIdParam = req.params.dbId;
        const file = req.file;
        if (!tableName) {
            return res.status(400).json({ message: 'Table name parameter is required.' });
        }
        if (!dbIdParam) {
            return res.status(400).json({ message: 'Database ID parameter is required.' });
        }
        const dbId = parseInt(dbIdParam, 10);
        if (isNaN(dbId)) {
            return res.status(400).json({ message: 'Invalid Database ID format in URL.' });
        }
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded or file rejected by filter.' });
        }
        const baseTableName = tableName;

        console.log(`CONTROLLER: Upload request received for DB: ${dbId}, Table: ${baseTableName}, User: ${userId}, File: ${file.originalname}`);
        const result = await dataService.processCsvUpload(
            userId,
            dbId,
            baseTableName,
            file.buffer
        );
        res.status(result.tableRebuilt ? 201 : 200).json(result);

    } catch (error: any) {
        console.error(`CONTROLLER ERROR processing upload for table ${req.params.tableName} (DB: ${req.params.dbId}):`, error);
        const statusCode = (error as any).statusCode || 500;
        res.status(statusCode)
           .json({ message: error.message || 'Internal server error during file upload processing.' });
    }
};