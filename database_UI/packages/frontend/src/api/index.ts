import axios, { AxiosError, AxiosProgressEvent } from 'axios';
import {
    ApiColumnSchema, ApiFetchDataResponse, NewColumnPayload,
    LoginCredentials, SignupCredentials, LoggedInUser,
    ApiDatabase, ApiTableInfo, AddTableResponse, RenameTableResponse,
    AddDatabaseResponse, RenameDatabaseResponse, FilterCondition
} from './types';

const API_BASE_URL = (import.meta.env as any).VITE_API_URL || '/api';
console.log("🌐 API Base URL:", API_BASE_URL);



const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000, 
    withCredentials: true 
});


const handleApiError = (error: AxiosError | Error, context: string): Error => {
    let errorMessage = `Unknown error in ${context}`;
    let statusCode: number | undefined = undefined;

    if (axios.isAxiosError(error)) {
        statusCode = error.response?.status;
        const backendError = error.response?.data?.error || error.response?.data?.message;
        errorMessage = backendError || error.message || `Request failed with status ${statusCode || 'unknown'}`;
        console.error(`🚫 API Error (${context}) - Status: ${statusCode}, Message: ${errorMessage}`, error.response?.data);
    } else if (error instanceof Error) {
        errorMessage = error.message;
        console.error(`🚫 Non-API Error (${context}):`, error);
    } else {
        console.error(`🚫 Unknown Error Type (${context}):`, error);
    }
    const customError = new Error(errorMessage);
    return customError;
};




export const checkLoginStatus = async (): Promise<{ loggedIn: boolean, user: LoggedInUser | null }> => {
    try {
        console.log("API: Checking login status...");
        const response = await apiClient.get<{ loggedIn: boolean, user: LoggedInUser | null }>('user/isLoggedIn');
        if (response.data?.user?.user_id) {
            response.data.user.user_id = BigInt(String(response.data.user.user_id));
        }

        if (response.data?.loggedIn && response.data?.user) {
            console.log(`API: User is logged in: ${response.data.user.username} (ID: ${response.data.user.user_id})`);
            return response.data as { loggedIn: true, user: LoggedInUser };
        } else {
             console.log("API: Response indicates user not logged in.", response.data);
             return { loggedIn: false, user: null };
        }
    } catch (err) {
        const axiosError = err as AxiosError;
        if (axiosError.response && axiosError.response.status === 401) {
            console.log("API: User not logged in (received 401).");
            return { loggedIn: false, user: null };
        }
        
        const processedError = handleApiError(axiosError, 'checkLoginStatus');
        console.error("API: Unexpected error checking login status:", processedError);
        return { loggedIn: false, user: null }; 
    }
};

export const loginUser = async (credentials: LoginCredentials): Promise<LoggedInUser> => {
    try {
        console.log("API: Attempting login...");
        const response = await apiClient.post<{ message: string, user: LoggedInUser }>('/user/login', credentials);
        console.log("API: Login successful.");
        
        if (response.data.user?.user_id) {
            const userIdValue = response.data.user.user_id;
            if (typeof userIdValue === 'bigint') {
                response.data.user.user_id = BigInt(parseInt(String(userIdValue)));
            } else {
                response.data.user.user_id = BigInt(parseInt(String(userIdValue)));
            }
        }
        if (!response.data.user) {
            throw new Error("Login response did not include user data.");
        }
        return response.data.user;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, 'loginUser');
    }
};

export const signupUser = async (credentials: SignupCredentials): Promise<any> => {
    
    if (!credentials.username || !credentials.email || !credentials.password) {
        throw new Error("Username, email, and password are required for signup.");
    }
    try {
        console.log("API: Attempting signup...");
        const response = await apiClient.post('/user/signup', credentials);
        console.log("API: Signup successful.");
        return response.data; 
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, 'signupUser');
    }
};

export const logoutUser = async (): Promise<void> => {
    try {
        console.log("API: Logging out...");
        await apiClient.post('/user/logout', {}); 
        console.log("API: Logout successful.");
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, 'logoutUser');
    }
};




export const fetchDatabases = async (): Promise<ApiDatabase[]> => {
    try {
        console.log("API: Fetching databases...");
        const res = await apiClient.get<ApiDatabase[]>('/meta/databases');
        console.log(`API: Databases fetched successfully (${res.data.length} found).`);
        
        return res.data.map(db => ({
            ...db,
            user_id: Number(db.user_id),
            db_id: Number(db.db_id)
        }));
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, 'fetchDatabases');
    }
};


export const getDatabaseName = async (dbId: number): Promise<string> => {
    if (!dbId) throw new Error("Database ID is required.");
    console.log(`API: Fetching name for database ID ${dbId}...`);
    const res = await apiClient.get<{ dbName: string }>(`/meta/databases/${dbId}`);
    console.log(res);
    console.log(res.data);
    console.log("API Response data:", res.data);
    if (res.data && typeof res.data === 'string') {
        console.log(`API: Database name for ID ${dbId} is "${res.data}".`);
        return res.data;
    } else {
        console.error(`API: Unexpected response data type or empty value for ID ${dbId}:`, res.data);
        throw new Error(`Failed to fetch or parse database name for ID ${dbId}.`);
    }
};

export const addDatabase = async (dbName: string): Promise<AddDatabaseResponse> => {
    if (!dbName || dbName.trim().length === 0) throw new Error("Database name cannot be empty.");
    try {
        const trimmedDbName = dbName.trim();
        console.log(`API: Adding database "${trimmedDbName}"...`);
        const response = await apiClient.post<AddDatabaseResponse>(
            '/meta/databases',
            { dbName: trimmedDbName } 
        );
        console.log(`API: Database "${trimmedDbName}" added successfully.`);
        
        if (response.data.database) {
             response.data.database.user_id = Number(response.data.database.user_id);
             response.data.database.db_id = Number(response.data.database.db_id);
        }
        return response.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `addDatabase(${dbName})`);
    }
};

export const renameDatabase = async (dbId: number, newDbName: string): Promise<RenameDatabaseResponse> => {
    if (!dbId) throw new Error("Database ID is required for renaming.");
    if (!newDbName || newDbName.trim().length === 0) throw new Error("New database name cannot be empty.");
    try {
        const trimmedNewName = newDbName.trim();
        console.log(`API: Renaming database ID ${dbId} to "${trimmedNewName}"...`);
        
        const response = await apiClient.patch<RenameDatabaseResponse>(
            `/meta/databases/${dbId}`,
            { newDbName: trimmedNewName } 
        );
        console.log(`API: Database rename request sent successfully for ID ${dbId}.`);
        
        if (response.data.database) {
             response.data.database.user_id = Number(response.data.database.user_id);
             response.data.database.db_id = Number(response.data.database.db_id);
        }
        return response.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `renameDatabase(ID: ${dbId}, NewName: ${newDbName})`);
    }
};

export const deleteDatabase = async (dbId: number): Promise<void> => {
    if (!dbId) throw new Error("Database ID is required for deletion.");
    try {
        console.log(`API: Deleting database ID ${dbId}...`);
        await apiClient.delete(`/meta/databases/${dbId}`);
        console.log(`API: Database delete request sent successfully for ID ${dbId}.`);
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `deleteDatabase(ID: ${dbId})`);
    }
};




export const fetchTables = async (dbId: number): Promise<ApiTableInfo[]> => {
    if (!dbId) {
        console.warn("API: fetchTables called with invalid dbId.");
        return Promise.resolve([]);
    }
    try {
        console.log(`API: Fetching tables for database ID: ${dbId}...`);
        const res = await apiClient.get<ApiTableInfo[]>(`/meta/databases/${dbId}/tables`);
        console.log(`API: Tables fetched successfully for DB ${dbId} (${res.data.length} found).`);
        
        return res.data.map(table => ({
             ...table,
             table_id: Number(table.table_id) 
        }));
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `fetchTables(DB ID: ${dbId})`);
    }
};

export const addTable = async (dbId: number, tableName: string): Promise<AddTableResponse> => {
    if (!dbId) throw new Error("Database ID is required to add a table.");
    if (!tableName || tableName.trim().length === 0) throw new Error("Table name cannot be empty.");
    try {
        const trimmedTableName = tableName.trim();
        console.log(`API: Adding table "${trimmedTableName}" to DB ID ${dbId}...`);
        const response = await apiClient.post<AddTableResponse>(
            `/meta/databases/${dbId}/tables`,
            { tableName: trimmedTableName } 
        );
        console.log(`API: Table "${trimmedTableName}" added successfully to DB ${dbId}.`);
        
         if (response.data.table) {
             response.data.table.user_id = Number(response.data.table.user_id);
             response.data.table.db_id = Number(response.data.table.db_id);
             response.data.table.table_id = Number(response.data.table.table_id);
         }
        return response.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `addTable(DB ID: ${dbId}, Name: ${tableName})`);
    }
};

export const deleteTable = async (dbId: number, tableName: string): Promise<void> => {
    if (!dbId || !tableName || tableName.trim().length === 0) throw new Error("DB ID and valid Table name are required.");
    try {
        const trimmedTableName = tableName.trim();
        const encodedTableName = encodeURIComponent(trimmedTableName);
        console.log(`API: Deleting table "${trimmedTableName}" from DB ID ${dbId}...`);
        await apiClient.delete(`/meta/databases/${dbId}/tables/${encodedTableName}`);
        console.log(`API: Table "${trimmedTableName}" delete request sent successfully for DB ${dbId}.`);
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `deleteTable(DB ID: ${dbId}, Table: ${tableName})`);
    }
};

export const renameTable = async (dbId: number, oldTableName: string, newTableName: string): Promise<RenameTableResponse> => {
    if (!dbId) throw new Error("Database ID is required.");
    if (!oldTableName || oldTableName.trim().length === 0) throw new Error("Current table name cannot be empty.");
    if (!newTableName || newTableName.trim().length === 0) throw new Error("New table name cannot be empty.");
    if (oldTableName.trim() === newTableName.trim()) throw new Error("New name cannot be the same as the old name.");

    try {
        const trimmedOldName = oldTableName.trim();
        const trimmedNewName = newTableName.trim();
        const encodedOldName = encodeURIComponent(trimmedOldName);

        console.log(`API: Renaming table "${trimmedOldName}" to "${trimmedNewName}" in DB ID ${dbId}...`);
        
        const response = await apiClient.patch<RenameTableResponse>(
            `/meta/databases/${dbId}/tables/${encodedOldName}`,
            { newTableName: trimmedNewName } 
        );
        console.log(`API: Table rename request sent successfully for "${trimmedOldName}" in DB ${dbId}.`);
        
        if (response.data.table) {
            response.data.table.user_id = Number(response.data.table.user_id);
            response.data.table.db_id = Number(response.data.table.db_id);
            response.data.table.table_id = Number(response.data.table.table_id);
        }
        return response.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `renameTable(DB ID: ${dbId}, Old: ${oldTableName}, New: ${newTableName})`);
    }
};




export const fetchSchema = async (dbId: number, tableName: string): Promise<ApiColumnSchema[]> => {
    if (!dbId || !tableName) {
        console.warn("API: fetchSchema called with invalid dbId or tableName.");
        return Promise.resolve([]);
    }
    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        console.log(`API: Fetching schema for table "${tableName}" in DB ID ${dbId}...`);
        const res = await apiClient.get<ApiColumnSchema[]>(`/meta/databases/${dbId}/tables/${encodedTableName}/schema`);
        console.log(`API: Schema for "${tableName}" (DB ${dbId}) fetched successfully.`);
        if (!Array.isArray(res.data)) {
            throw new Error("Invalid schema format received from server.");
        }
        
         return res.data.map(col => ({
             ...col,
             
             isPrimaryKey: Boolean(col.isPrimaryKey),
             isNullable: Boolean(col.isNullable),
             isForeignKey: Boolean(col.isForeignKey),
             isAutoGenerated: Boolean(col.isAutoGenerated) 
         }));
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `fetchSchema(DB ID: ${dbId}, Table: ${tableName})`);
    }
};

export const createColumn = async (
    dbId: number,
    tableName: string,
    columnData: NewColumnPayload
): Promise<void> => {
    if (!dbId || !tableName) throw new Error("DB ID and Table name are required for adding a column.");
    if (!columnData || !columnData.name || !columnData.type) throw new Error("Column name and type are required.");
    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        console.log(`API: Creating column "${columnData.name}" in table "${tableName}" (DB ${dbId})...`, columnData);
        
        await apiClient.post(`/meta/databases/${dbId}/tables/${encodedTableName}/columns`, columnData);
        console.log(`API: Column "${columnData.name}" created in "${tableName}" (DB ${dbId}) successfully.`);
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `createColumn(DB ID: ${dbId}, Table: ${tableName})`);
    }
};




export const fetchData = async (
    dbId: number,
    tableName: string,
    params: {
        page: number;
        limit: number;
        filters?: FilterCondition[];
        search?: string;
        sort_by?: string;
        sort_order?: 'asc' | 'desc';
        group_by?: string[];
    }
): Promise<ApiFetchDataResponse> => {
    if (!dbId || !tableName) {
        console.warn("API: fetchData called with invalid dbId or tableName.");
        return Promise.resolve({ data: [], total: 0 });
    }

    
    const requestParams: Record<string, any> = {
        page: params.page,
        limit: params.limit,
        ...(params.search && { search: params.search }),
        ...(params.sort_by && { sort_by: params.sort_by }),
        ...(params.sort_order && { sort_order: params.sort_order }),
        ...(params.group_by && { group_by: params.group_by }),
    };
    if (params.filters && Array.isArray(params.filters) && params.filters.length > 0) {
        try {
            requestParams.filters = JSON.stringify(params.filters);
        } catch (e) {
            console.error("API: Error stringifying filters, sending request without them.", e);
        }
     }

    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        console.log(`API: Fetching data for table "${tableName}" (DB ${dbId}) with params:`, requestParams);
        
        const res = await apiClient.get<ApiFetchDataResponse>(
            `/data/${dbId}/tables/${encodedTableName}`, 
            { params: requestParams } 
        );
        console.log(`API: Data for "${tableName}" (DB ${dbId}) fetched successfully (Total: ${res.data?.total}).`);
        if (!res.data || !Array.isArray(res.data.data) || typeof res.data.total !== 'number') {
            throw new Error("Invalid data format received from server.");
        }
        
        return res.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `fetchData(DB ID: ${dbId}, Table: ${tableName})`);
    }
};

export const createRecord = async (
    dbId: number,
    tableName: string,
    data: Record<string, any>
): Promise<any> => {
    if (!dbId || !tableName) throw new Error("DB ID and Table name are required for creating a record.");
    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        console.log(`API: Creating record in table "${tableName}" (DB ${dbId})...`, data);
        
        const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
            if (value !== undefined) acc[key] = value;
            return acc;
        }, {} as Record<string, any>);

        
        const res = await apiClient.post<any>(`/data/${dbId}/tables/${encodedTableName}`, cleanData);
        console.log(`API: Record created in "${tableName}" (DB ${dbId}) successfully.`);
        
        return res.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `createRecord(DB ID: ${dbId}, Table: ${tableName})`);
    }
};


export const updateRecord = async (
    dbId: number,
    tableName: string,
    pkValue: string | number,
    data: Record<string, any>
): Promise<any> => {
    if (!dbId || !tableName || pkValue === undefined || pkValue === null) {
        throw new Error("DB ID, Table name and primary key value are required for updating a record.");
    }
    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        const encodedPk = encodeURIComponent(String(pkValue));
        console.log(`API: Updating record in table "${tableName}" (DB: ${dbId}, PK: ${pkValue})...`, data);
        const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
            if (value !== undefined) acc[key] = value;
            return acc;
        }, {} as Record<string, any>);

        const res = await apiClient.put<any>(`/data/${dbId}/tables/${encodedTableName}/${encodedPk}`, cleanData);
        console.log(`API: Record updated in "${tableName}" (DB: ${dbId}, PK: ${pkValue}) successfully.`);
        
        return res.data;
    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `updateRecord(DB ID: ${dbId}, Table: ${tableName}, PK: ${pkValue})`);
    }
};




export const deleteColumn = async (
  dbId: number,
  tableName: string,
  columnName: string
): Promise<any> => {
  if (!dbId || !tableName || !columnName) {
      throw new Error("DB ID, Table name, and Column name are required for deleting a column.");
  }

  try {
      const encodedTableName = encodeURIComponent(tableName.trim());
      const encodedColumnName = encodeURIComponent(columnName.trim());

      console.log(`API: Deleting column "${columnName}" from table "${tableName}" (DB ${dbId})...`);
      const url = `/meta/databases/${dbId}/tables/${encodedTableName}/columns/${encodedColumnName}`;
      const res = await apiClient.delete<any>(url);
      console.log(`API: Column "${columnName}" deleted from "${tableName}" (DB ${dbId}) successfully.`);
      return res.data;

  } catch (err) {
      throw handleApiError(
          err as AxiosError | Error,
          `deleteColumn(DB ID: ${dbId}, Table: ${tableName}, Column: ${columnName})` 
      );
  }
};


export const deleteRecord = async (
    dbId: number,
    tableName: string,
    pkValue: string | number
): Promise<void> => {
   if (!dbId || !tableName || pkValue === undefined || pkValue === null) {
       throw new Error("DB ID, Table name and primary key value are required for deleting a record.");
   }
   try {
       const encodedTableName = encodeURIComponent(tableName.trim());
       const encodedPk = encodeURIComponent(String(pkValue));
       console.log(`API: Deleting record from table "${tableName}" (DB: ${dbId}, PK: ${pkValue})...`);
       await apiClient.delete(`/data/${dbId}/tables/${encodedTableName}/${encodedPk}`);
       console.log(`API: Record deleted from "${tableName}" (DB: ${dbId}, PK: ${pkValue}) successfully.`);
   } catch (err) {
       throw handleApiError(err as AxiosError | Error, `deleteRecord(DB ID: ${dbId}, Table: ${tableName}, PK: ${pkValue})`);
   }
};


export const uploadData = async (
    dbId: number,
    tableName: string,
    formData: FormData,
    onUploadProgress?: (progressEvent: AxiosProgressEvent) => void
): Promise<any> => {
    if (!dbId) {
         throw new Error("Database ID is required for uploading data.");
    }
    if (!tableName) {
        throw new Error("Table name is required for uploading data.");
    }
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      throw new Error("FormData must contain a valid 'file' entry.");
  }

    try {
        const encodedTableName = encodeURIComponent(tableName.trim());
        console.log(`API: Uploading data for table "${tableName}" in DB ID ${dbId}...`);
        console.log(formData);   
        const response = await apiClient.post<any>(
            `/data/${dbId}/tables/${encodedTableName}/upload`,
            formData,
            {
                onUploadProgress: onUploadProgress
            }
        );

        console.log(`API: Data upload for "${tableName}" (DB ${dbId}) successful.`);
        return response.data;

    } catch (err) {
        throw handleApiError(err as AxiosError | Error, `uploadData(DB ID: ${dbId}, Table: ${tableName})`);
    }
};