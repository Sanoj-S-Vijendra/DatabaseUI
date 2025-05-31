import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';
import stream from 'stream';
import csvParser from 'csv-parser';
import * as metaService from './meta.service';
import { ColumnSchema } from '../interface/meta.types';

interface FilterCondition {
    id?: number;
    column?: string;
    operator?: string;
    value?: any;
    logicalOperator?: 'AND' | 'OR';
}

interface PaginationOptions {
  limit: number;
  offset: number;
}

interface GetDataOptions extends PaginationOptions {
    filters?: FilterCondition[];
    group_by?: string[];
}

export const getData = async (
  userId: number,
  dbId: number,
  baseTableName: string,
  options: GetDataOptions
): Promise<{ data: any[]; total: number }> => {
    const physicalTableName = metaService.getPhysicalTableName(baseTableName, userId, dbId);
    console.log(`DATA SERVICE: Fetching data for physical table: ${physicalTableName} (Base: ${baseTableName}, User: ${userId}, DB: ${dbId}) with options:`, options);
    const safePhysicalTableName = `"${physicalTableName}"`;

    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    try {
        const currentSchema = await metaService.getTableSchema(userId, dbId, baseTableName);
        if (!currentSchema || currentSchema.length === 0) {
            throw new Error(`Schema definition could not be retrieved for table "${baseTableName}" (User: ${userId}, DB: ${dbId}).`);
        }
        const validColumnNames = new Set(currentSchema.map(col => col.name));
        const pkColumn = currentSchema.find(col => col.isPrimaryKey)?.name || null;
        if (options.filters && options.filters.length > 0) {
            options.filters.forEach((filter, index) => {
                if (!filter.column || !validColumnNames.has(filter.column)) {
                    console.warn(`DATA SERVICE: Skipping filter - invalid/missing column: ${filter.column}`);
                    return;
                }
                if (!filter.operator) {
                     console.warn(`DATA SERVICE: Skipping filter - missing operator for column: ${filter.column}`);
                     return;
                }
                const safeColumn = `"${filter.column}"`;
                let conditionStr = '';

                switch (filter.operator.toUpperCase()) {
                    case '=':
                    case '!=':
                    case '>':
                    case '>=':
                    case '<':
                    case '<=':
                        queryParams.push(filter.value);
                        conditionStr = `${safeColumn} ${filter.operator} $${paramIndex++}`;
                        break;
                    case 'LIKE':
                    case 'NOT LIKE':
                        queryParams.push(`%${filter.value}%`);
                        conditionStr = `${safeColumn} ${filter.operator.toUpperCase()} $${paramIndex++}`;
                        break;
                    case 'IS NULL':
                    case 'IS NOT NULL':
                        conditionStr = `${safeColumn} ${filter.operator.toUpperCase()}`;
                        break;
                    default:
                        console.warn(`DATA SERVICE: Skipping filter - unsupported operator: ${filter.operator}`);
                        return;
                }
                const logicalOp = index > 0 ? ` ${filter.logicalOperator?.toUpperCase() || 'AND'} ` : '';
                whereConditions.push(`${logicalOp}${conditionStr}`);
            });
        }
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join('')}` : '';
       let groupByClause = '';
       let orderByClause = '';
       let selectClause = '';
       let countSelectClause = '';
       let columnList = '';

       let isGrouping = false;
       let validatedGroupByColumns: string[] = [];

       if (options.group_by && Array.isArray(options.group_by) && options.group_by.length > 0) {
           validatedGroupByColumns = options.group_by.filter(colName => {
               const isValid = validColumnNames.has(colName);
               if (!isValid) console.warn(`DATA SERVICE: Ignoring invalid group_by column: ${colName}`);
               return isValid;
           });

           if (validatedGroupByColumns.length > 0) {
               isGrouping = true;
               const safeGroupByColumns = validatedGroupByColumns.map(colName => `"${colName}"`);
               groupByClause = `GROUP BY ${safeGroupByColumns.join(', ')}`;
               columnList = `${safeGroupByColumns.join(', ')}, COUNT(*) as "group_count"`;
               orderByClause = `ORDER BY ${safeGroupByColumns.join(', ')} ASC`;
               countSelectClause = `SELECT COUNT(*) as count FROM (SELECT DISTINCT ${safeGroupByColumns.join(', ')} FROM ${safePhysicalTableName} ${whereClause}) AS distinct_groups`;
               console.log(`DATA SERVICE: Applying GROUP BY on columns: ${safeGroupByColumns.join(', ')}`);
           } else {
                console.warn(`DATA SERVICE: No valid columns provided for group_by after validation. Proceeding without grouping.`);
           }
       }
       if (!isGrouping) {
           if (!pkColumn) {
               console.error(`DATA SERVICE: No primary key found for ${physicalTableName}. Cannot guarantee stable pagination order.`);
               throw new Error(`Data fetching requires a primary key on table "${baseTableName}" for stable ordering.`);
           }
           const safeOrderByColumn = `"${pkColumn}"`;
           orderByClause = `ORDER BY ${safeOrderByColumn} ASC`;
           columnList = currentSchema.map(col => `"${col.name}"`).join(', ');
           countSelectClause = `SELECT COUNT(*) as count FROM ${safePhysicalTableName}`;
       }

       selectClause = `SELECT ${columnList} FROM ${safePhysicalTableName}`;
       const finalCountSql = isGrouping ? countSelectClause : `${countSelectClause} ${whereClause}`;

       console.log(`DATA SERVICE (Count SQL): ${finalCountSql}`);
       console.log("Params for Count:", queryParams);
       const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(finalCountSql, ...queryParams);
       const total = Number(countResult[0]?.count ?? 0);
       console.log("Total items/groups matching:", total);
       const dataQueryParams = [...queryParams];
       let dataParamIndex = queryParams.length + 1;
       dataQueryParams.push(options.limit);
       dataQueryParams.push(options.offset);
       const limitPlaceholder = `$${dataParamIndex++}`;
       const offsetPlaceholder = `$${dataParamIndex++}`;

       const dataSql = `${selectClause} ${whereClause} ${groupByClause} ${orderByClause} LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`;
       console.log(`DATA SERVICE (Data SQL): ${dataSql} (Limit: ${options.limit}, Offset: ${options.offset})`);
       console.log("Params for Data:", dataQueryParams);

       const data = await prisma.$queryRawUnsafe<any[]>(dataSql, ...dataQueryParams);
       console.log(`Fetched ${data.length} rows/groups for page.`);
       return { data, total };

   } catch (error: any) {
       console.error(`DATA SERVICE ERROR fetching data for physical table ${physicalTableName}:`, error);
       if ((error as any).statusCode === 404) { throw error; }
       if (error.code === '42P01' || error.message?.includes("does not exist")) {
           throw new Error(`Table "${baseTableName}" (physical: ${physicalTableName}) not found in database.`);
       }
       if (error.code === '42803') {
           throw new Error(`Grouping error for table "${baseTableName}". Ensure selected columns are valid for GROUP BY. Error: ${error.message}`);
       }
       if (error.code === '42703' && error.message?.includes('column')) {
           throw new Error(`Query failed: Invalid column specified in filter or grouping for table "${baseTableName}".`);
       }
       throw new Error(`Could not fetch data for table "${baseTableName}". DB Error: ${error.message || error}`);
   }
};



export const getPrimaryKeyColumn = async (userId: number, dbId: number, baseTableName: string): Promise<string | null> => {
    const physicalTableName = metaService.getPhysicalTableName(baseTableName, userId, dbId);
    console.log(`DATA SERVICE: Finding PK for physical table: ${physicalTableName}`);

    try {
        
        await metaService.getTableSchema(userId, dbId, baseTableName); 

        const result = await prisma.$queryRaw<{ column_name: string }[]>`
          SELECT kcu.column_name
          FROM information_schema.key_column_usage AS kcu
          JOIN information_schema.table_constraints AS tc ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = ${physicalTableName}
            AND tc.table_schema = 'public' -- Adjust if needed
          LIMIT 1;
        `;
        const pkName = result[0]?.column_name || null;
        console.log(`DATA SERVICE: PK for ${physicalTableName} is: ${pkName}`);
        return pkName;
    } catch (error: any) {
        console.error(`DATA SERVICE ERROR finding primary key for physical table ${physicalTableName}:`, error);
         if ((error as any).statusCode === 404) { 
             console.warn(`Table association not found for "${baseTableName}" (User: ${userId}, DB: ${dbId}) while getting PK.`);
             return null;
         }
         if (error.code === '42P01' || error.message?.includes("does not exist")) { 
             console.warn(`Physical table ${physicalTableName} not found while searching for PK.`);
             return null;
         }
        
        return null;
    }
};



export const createRow = async (
  userId: number,
  dbId: number,
  baseTableName: string,
  rowData: Record<string, any>
): Promise<any> => {
    const physicalTableName = metaService.getPhysicalTableName(baseTableName, userId, dbId);
    console.log(`DATA SERVICE: Creating row in physical table: ${physicalTableName}`, rowData);
    const safePhysicalTableName = `"${physicalTableName}"`; 

    let pkName: string | null = null;
    let isPkAutoGenerated = false;

    
    let currentSchema: ColumnSchema[];
    try {
        currentSchema = await metaService.getTableSchema(userId, dbId, baseTableName);
        const pkCol = currentSchema.find(c => c.isPrimaryKey);
        pkName = pkCol?.name || null;
        isPkAutoGenerated = pkCol?.isAutoGenerated ?? false;
        if (pkName && isPkAutoGenerated) {
            console.log(`DATA SERVICE: PK "${pkName}" is auto-generated. Excluding if present in payload.`);
        }
    } catch (schemaError: any) {
        console.error(`DATA SERVICE ERROR: Cannot create row - Failed to get schema for ${baseTableName} (User: ${userId}, DB: ${dbId}):`, schemaError);
        if ((schemaError as any).statusCode === 404) {
             throw schemaError; 
        }
        throw new Error(`Could not verify table schema before creating row in "${baseTableName}".`);
    }

    const validColumnNames = new Set(currentSchema.map(col => col.name));
    const columnsToInsert: string[] = [];
    const valuesToInsert: any[] = [];

    
    for (const key in rowData) {
        if (key === pkName && isPkAutoGenerated) {
            continue; 
        }
        if (Object.prototype.hasOwnProperty.call(rowData, key) && rowData[key] !== undefined) {
            if (!validColumnNames.has(key)) {
                console.warn(`DATA SERVICE: Skipping column "${key}" during insert - not found in schema for ${physicalTableName}.`);
                continue; 
            }
            columnsToInsert.push(key);
            valuesToInsert.push(rowData[key]);
        }
    }

    if (columnsToInsert.length === 0) {
        if (pkName && isPkAutoGenerated) {
            console.log(`DATA SERVICE: Inserting default row into ${physicalTableName} (only auto-gen PK)`);
            const insertSql = `INSERT INTO ${safePhysicalTableName} DEFAULT VALUES RETURNING *`;
            try {
                 const result = await prisma.$queryRawUnsafe<any[]>(insertSql);
                 if (!result || result.length === 0) { throw new Error("Insert default failed."); }
                 console.log(`DATA SERVICE: Default row created in ${physicalTableName}:`, result[0]);
                 return result[0];
            } catch (defaultInsertError: any) { /* ... error handling ... */ }
        } else {
            throw new Error('No valid data provided for insertion.');
        }
    }

    
    const columnList = columnsToInsert.map((col) => `"${col}"`).join(', '); 
    const placeholders = columnsToInsert.map((_, i) => `$${i + 1}`).join(', ');
    const insertSql = `INSERT INTO ${safePhysicalTableName} (${columnList}) VALUES (${placeholders}) RETURNING *`;

    console.log(`DATA SERVICE: Executing SQL: ${insertSql} with ${valuesToInsert.length} values.`);
    try {
        const result = await prisma.$queryRawUnsafe<any[]>(insertSql, ...valuesToInsert);
        if (!result || result.length === 0) {
            throw new Error(`Insert query executed but returned no data from ${physicalTableName}.`);
        }
        console.log(`DATA SERVICE: Row created successfully in ${physicalTableName}:`, result[0]);
        return result[0];
    } catch (error: any) {
        
        console.error(`DATA SERVICE ERROR creating row in physical table ${physicalTableName}:`, error);
        
        if (error instanceof Prisma.PrismaClientKnownRequestError || error.meta?.code) {
            const dbCode = error.meta?.code;
            if (error.code === 'P2002' || dbCode === '23505') { /* Unique constraint */ }
            if (error.code === 'P2003' || dbCode === '23503') { /* FK constraint */ }
            
        }
        throw new Error(`Could not insert data into table "${baseTableName}". Original error: ${error.message || error}`);
    }
};



export const updateRow = async (
  userId: number,
  dbId: number,
  baseTableName: string,
  pkValue: any,       
  pkColumn: string,    
  rowData: Record<string, any>
): Promise<any> => {
    const physicalTableName = metaService.getPhysicalTableName(baseTableName, userId, dbId);
    console.log(`DATA SERVICE: Updating row in physical table: ${physicalTableName} where ${pkColumn}=${pkValue}`, rowData);
    const safePhysicalTableName = `"${physicalTableName}"`;
    const safePkColumn = `"${pkColumn}"`; 

    
    let currentSchema: ColumnSchema[];
    let pkType: string | undefined;
    try {
        currentSchema = await metaService.getTableSchema(userId, dbId, baseTableName);
        const pkColSchema = currentSchema.find(c => c.name === pkColumn);
        if (!pkColSchema) {
             throw new Error(`Primary key column "${pkColumn}" not found in schema for table "${baseTableName}".`);
        }
        pkType = pkColSchema.type.toUpperCase();
    } catch (schemaError: any) {
        console.error(`DATA SERVICE ERROR: Cannot update row - Failed to get schema for ${baseTableName}:`, schemaError);
        if ((schemaError as any).statusCode === 404) throw schemaError;
        throw new Error(`Could not verify table schema before updating row in "${baseTableName}".`);
    }

    const validColumnNames = new Set(currentSchema.map(col => col.name));
    const columnsToUpdate: string[] = [];
    const valuesToUpdate: any[] = [];

    
    for (const key in rowData) {
        if (key === pkColumn) continue; 
        if (Object.prototype.hasOwnProperty.call(rowData, key) && rowData[key] !== undefined) {
            if (!validColumnNames.has(key)) {
                console.warn(`DATA SERVICE: Skipping column "${key}" during update - not found in schema for ${physicalTableName}.`);
                continue;
            }
            columnsToUpdate.push(key);
            valuesToUpdate.push(rowData[key]);
        }
    }

    
    if (columnsToUpdate.length === 0) {
        console.warn(`DATA SERVICE: No valid fields provided to update for ${physicalTableName} PK ${pkValue}. Fetching current row.`);
        
         try {
             let typedPkValueForSelect = pkValue;
             
             if (pkType?.includes('INT') || pkType?.includes('SERIAL')) typedPkValueForSelect = BigInt(pkValue);
             else if (pkType?.includes('NUMERIC') || pkType?.includes('DECIMAL') || pkType?.includes('FLOAT') || pkType?.includes('REAL')) typedPkValueForSelect = parseFloat(pkValue);
             

             const selectSql = `SELECT * FROM ${safePhysicalTableName} WHERE ${safePkColumn} = $1 LIMIT 1`;
             const currentRow = await prisma.$queryRawUnsafe<any[]>(selectSql, typedPkValueForSelect);
             if (!currentRow || currentRow.length === 0) {
                 throw new Error(`Record with ${pkColumn} = ${pkValue} not found in table "${baseTableName}".`);
             }
             return currentRow[0];
         } catch (fetchErr: any) { /* ... error handling ... */ }
    }

    
    const setClause = columnsToUpdate.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
    const pkValuePlaceholderIndex = columnsToUpdate.length + 1;
    const updateSql = `UPDATE ${safePhysicalTableName} SET ${setClause} WHERE ${safePkColumn} = $${pkValuePlaceholderIndex} RETURNING *`;

    
    let typedPkValueForUpdate = pkValue;
    if (pkType?.includes('INT') || pkType?.includes('SERIAL')) typedPkValueForUpdate = BigInt(pkValue);
    else if (pkType?.includes('NUMERIC') || pkType?.includes('DECIMAL') || pkType?.includes('FLOAT') || pkType?.includes('REAL')) typedPkValueForUpdate = parseFloat(pkValue);
    

    const allUpdateValues = [...valuesToUpdate, typedPkValueForUpdate];
    console.log(`DATA SERVICE: Executing SQL: ${updateSql} with ${allUpdateValues.length} values.`);

    try {
        const result = await prisma.$queryRawUnsafe<any[]>(updateSql, ...allUpdateValues);
        if (!result || result.length === 0) {
            
            throw new Error(`Record with ${pkColumn} = ${pkValue} not found for update in table "${baseTableName}".`);
        }
        console.log(`DATA SERVICE: Row updated successfully in ${physicalTableName}:`, result[0]);
        return result[0]; 
    } catch (error: any) {
        console.error(`DATA SERVICE ERROR updating row in physical table ${physicalTableName} (PK: ${pkValue}):`, error);
        
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'){
             throw new Error(`Record with ${pkColumn} = ${pkValue} not found for update in table "${baseTableName}".`);
        }
         if (error.code === '22P02') { 
              throw new Error(`Update failed: Invalid data type provided for update in table "${baseTableName}". (DB Code: 22P02)`);
         }
        throw new Error(`Could not update record ${pkValue} in table "${baseTableName}". Original error: ${error.message || error}`);
    }
};



export const deleteRow = async (
  userId: number,
  dbId: number,
  baseTableName: string,
  pkValue: any,
  pkColumn: string 
): Promise<{ deleted: boolean }> => {
    const physicalTableName = metaService.getPhysicalTableName(baseTableName, userId, dbId);
    console.log(`DATA SERVICE: Deleting row from physical table: ${physicalTableName} where ${pkColumn}=${pkValue}`);
    const safePhysicalTableName = `"${physicalTableName}"`;
    const safePkColumn = `"${pkColumn}"`;

    
    let typedPkValueForDelete = pkValue;
    try {
        
        const schema = await metaService.getTableSchema(userId, dbId, baseTableName);
        const pkColSchema = schema.find(c => c.name === pkColumn);
        const pkType = pkColSchema?.type.toUpperCase();
        if (pkType?.includes('INT') || pkType?.includes('SERIAL')) typedPkValueForDelete = BigInt(pkValue);
        else if (pkType?.includes('NUMERIC') || pkType?.includes('DECIMAL') || pkType?.includes('FLOAT') || pkType?.includes('REAL')) typedPkValueForDelete = parseFloat(pkValue);
        
    } catch (schemaError: any) {
         console.warn(`DATA SERVICE WARN: Could not get schema for PK type casting in delete for ${physicalTableName}. Using original value type.`);
         
         if (typeof pkValue === 'string' && /^\d+$/.test(pkValue)) { try { typedPkValueForDelete = BigInt(pkValue); } catch {} }
    }

    
    const deleteSql = `DELETE FROM ${safePhysicalTableName} WHERE ${safePkColumn} = $1`;
    console.log(`DATA SERVICE: Executing SQL: ${deleteSql} with value:`, typedPkValueForDelete);
    try {
        const affectedRows = await prisma.$executeRawUnsafe(deleteSql, typedPkValueForDelete);
        console.log(`DATA SERVICE: Delete operation completed for ${physicalTableName}, PK ${pkValue}. Rows affected: ${affectedRows}`);

        if (affectedRows === 0) {
            console.log(`DATA SERVICE: Row with PK ${pkValue} not found for deletion in ${physicalTableName}.`);
        }
        return { deleted: affectedRows > 0 }; 

    } catch (error: any) {
        console.error(`DATA SERVICE ERROR deleting row from physical table ${physicalTableName} (PK: ${pkValue}):`, error);
        
         if (error.code === '42P01') { /* Table not found */ }
         if ((error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') || error.meta?.code === '23503') { /* FK violation */ }
         if (error.code === '22P02') { /* Type mismatch on PK */ }
        throw new Error(`Could not delete record ${pkValue} from table "${baseTableName}". Original error: ${error.message || error}`);
    }
};



export const processCsvUpload = async (
  userId: number,
  dbId: number,
  baseTableName: string,
  fileBuffer: Buffer
): Promise<{ message: string; rowsProcessed: number; tableRebuilt: boolean }> => {
  const physicalTableName = metaService.getPhysicalTableName(baseTableName, userId, dbId);
  console.log(`DATA SERVICE: Processing CSV upload (REBUILD - TEXT COLS + Auto PK MODE) for physical table: ${physicalTableName} (Base: ${baseTableName}, User: ${userId}, DB: ${dbId})`);
  const safePhysicalTableName = `"${physicalTableName}"`; 

  const csvData: any[] = [];
  let csvHeaders: string[] = [];
  let sanitizedHeaders: string[] = [];
  const autoPrimaryKeyName = "serial_num"; 

  
  try {
    await new Promise((resolve, reject) => {
      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileBuffer);
      bufferStream
        .pipe(csvParser())
        .on('headers', (headers: string[]) => {
          console.log('CSV Headers Raw:', headers);
          if (!headers || headers.length === 0 || headers.some(h => !h || h.trim() === '')) {
             console.warn("CSV Warning: Headers are empty or invalid. Will create table with only auto-PK if no valid headers found.");
             csvHeaders = headers || [];
          } else {
              csvHeaders = headers;
          }
          sanitizedHeaders = csvHeaders.map(h =>
            (h || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
          ).map(h => /^[a-z_]/.test(h) ? h : `_${h}`)
           .filter(h => h.length > 0);

          const headerSet = new Set(sanitizedHeaders);
          if (headerSet.size !== sanitizedHeaders.length) {
            return reject(new Error("CSV contains duplicate header names after sanitization."));
          }
          
          console.log('CSV Headers Sanitized (excluding potential empty ones):', sanitizedHeaders);

          
          if (sanitizedHeaders.includes(autoPrimaryKeyName)) {
              return reject(new Error(`CSV header conflicts with the automatically generated primary key column name '${autoPrimaryKeyName}'. Please rename the column in the CSV.`));
          }
        })
        .on('data', (data: Record<string, string>) => {
            const row: Record<string, any> = {};
            sanitizedHeaders.forEach((sHeader, index) => {
                const originalHeader = csvHeaders.find((h, i) =>
                     (h || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/^([^a-z_])/, '_$1') === sHeader);

                if (originalHeader && data[originalHeader] !== undefined && data[originalHeader] !== null && data[originalHeader] !== '') {
                     row[sHeader] = String(data[originalHeader]);
                } else {
                     row[sHeader] = null;
                }
            });
            csvData.push(row);
        })
        .on('end', () => {
             console.log(`CSV Parsed successfully: ${csvData.length} data rows processed.`);
             resolve(true);
         })
        .on('error', (error: Error) => reject(error));
    });

  } catch (parseError: any) {
    console.error("CSV Parsing failed:", parseError);
    throw new Error(`Failed to parse CSV file: ${parseError.message}`);
  }


  
  let tableWasRebuilt = false;
  try {
    await prisma.$executeRawUnsafe(`BEGIN`);

    
    console.log(`Attempting to drop existing physical table (if exists) ${safePhysicalTableName} for rebuild...`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${safePhysicalTableName}`);
    console.log(`Ensured ${safePhysicalTableName} is dropped (or didn't exist).`);
    tableWasRebuilt = true;
    const createCsvColumns = sanitizedHeaders
        .map(h => `"${h}" TEXT`)
        .join(', ');
    const createTableQuery = `CREATE TABLE ${safePhysicalTableName} (
            "${autoPrimaryKeyName}" BIGSERIAL PRIMARY KEY${sanitizedHeaders.length > 0 ? ',' : ''}
            ${createCsvColumns}
        )`;
    console.log(`Creating new physical table ${safePhysicalTableName} with auto PK '${autoPrimaryKeyName}' and TEXT columns for others...`);
    await prisma.$executeRawUnsafe(createTableQuery);
    console.log(`Physical table ${safePhysicalTableName} created.`);


    
    if (csvData.length > 0) {
        if (sanitizedHeaders.length === 0) {
             console.log("CSV contained data rows but no valid headers to insert into. Skipping insert.");
        } else {
            console.log(`Inserting ${csvData.length} new rows into ${safePhysicalTableName} (excluding auto PK)...`);
            const columnList = sanitizedHeaders.map(h => `"${h}"`).join(', ');

            const valuesToInsert: any[] = [];
            const valuePlaceholdersSegments: string[] = [];
            let paramCounter = 1;

            csvData.forEach(row => {
                const rowPlaceholders: string[] = [];
                sanitizedHeaders.forEach(header => {
                    rowPlaceholders.push(`$${paramCounter++}`);
                    valuesToInsert.push(row[header] ?? null);
                });
                valuePlaceholdersSegments.push(`(${rowPlaceholders.join(', ')})`);
            });

            if (valuesToInsert.length > 0) {
                const insertSql = `INSERT INTO ${safePhysicalTableName} (${columnList}) VALUES ${valuePlaceholdersSegments.join(', ')}`;
                console.log(`Executing Insert SQL for CSV columns with ${valuesToInsert.length} parameters.`);
                await prisma.$executeRawUnsafe(insertSql, ...valuesToInsert);
            }
        }
    } else {
         console.log("CSV data array is empty, no rows to insert.");
    }

    
    await prisma.$executeRawUnsafe(`COMMIT`);
    console.log(`Transaction committed for ${safePhysicalTableName}.`);

    const message = `Successfully uploaded ${csvData.length} rows to table '${baseTableName}'. Table was rebuilt with auto-incrementing '${autoPrimaryKeyName}' PRIMARY KEY and other columns from CSV as TEXT.`;
    return { message, rowsProcessed: csvData.length, tableRebuilt: tableWasRebuilt };

  } catch (dbError: any) {
    console.error(`Database operation failed during CSV processing (Rebuild Mode) for ${physicalTableName}:`, dbError);
    try {
        await prisma.$executeRawUnsafe(`ROLLBACK`);
        console.log("Transaction rolled back due to error.");
    } catch (rollbackError) {
        console.error("Failed to rollback transaction:", rollbackError);
    }
    throw new Error(`Database operation failed during rebuild for table "${baseTableName}": ${dbError.message}`);
  }
};