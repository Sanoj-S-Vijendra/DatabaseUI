import React, { useState, useEffect, useCallback } from 'react';
import { Menu, Spin, Alert, Empty, Button, Modal, Form, Input, message, Dropdown, Space, Typography } from 'antd';
import { PlusOutlined, EllipsisOutlined, AppstoreOutlined, TableOutlined, DeleteOutlined, EditOutlined, DatabaseOutlined, DownOutlined, UserOutlined, LogoutOutlined, LoadingOutlined } from '@ant-design/icons';  
import * as api from '../../api';
import { ApiDatabase, ApiTableInfo, LoggedInUser } from '../../api/types';
import { useNavigate } from 'react-router-dom';

const { confirm } = Modal;
const { SubMenu } = Menu;
const { Text } = Typography;

interface SidebarProps {
    selectedDatabaseId: number | null;
    selectedTableName: string | null;
    onSelectDatabase: (dbId: number | null) => void;
    onSelectTable: (dbId: number | null, tableName: string | null) => void;  
 
    onCreateView?: (dbId: number, tableName: string, viewType: 'grid' | 'gallery') => void;
    onDatabaseListChange?: () => void;  
    onTableListChange?: (dbId: number) => void;  
}

const Sidebar: React.FC<SidebarProps> = ({
    selectedDatabaseId,
    selectedTableName,
    onSelectDatabase,
    onSelectTable,
    onCreateView,
    onDatabaseListChange,
    onTableListChange
}) => {

 
    const [databases, setDatabases] = useState<ApiDatabase[]>([]);
    const [loadingDatabases, setLoadingDatabases] = useState<boolean>(false);
    const [databaseError, setDatabaseError] = useState<string | null>(null);
    const [openDatabaseKeys, setOpenDatabaseKeys] = useState<string[]>([]);  

 
    const [tablesByDb, setTablesByDb] = useState<Record<number, { loading: boolean; error: string | null; data: ApiTableInfo[] }>>({});

 
    const [isAddDbModalVisible, setIsAddDbModalVisible] = useState<boolean>(false);
    const [confirmLoadingAddDb, setConfirmLoadingAddDb] = useState<boolean>(false);
    const [addDbForm] = Form.useForm();
    const [isRenameDbModalVisible, setIsRenameDbModalVisible] = useState<boolean>(false);
    const [confirmLoadingRenameDb, setConfirmLoadingRenameDb] = useState<boolean>(false);
    const [renameDbForm] = Form.useForm();
    const [renamingDbInfo, setRenamingDbInfo] = useState<ApiDatabase | null>(null);

 
    const [isAddTableModalVisible, setIsAddTableModalVisible] = useState<boolean>(false);
    const [confirmLoadingAddTable, setConfirmLoadingAddTable] = useState<boolean>(false);
    const [addTableForm] = Form.useForm();
    const [addingTableToDbId, setAddingTableToDbId] = useState<number | null>(null);  
    const [isRenameTableModalVisible, setIsRenameTableModalVisible] = useState<boolean>(false);
    const [confirmLoadingRenameTable, setConfirmLoadingRenameTable] = useState<boolean>(false);
    const [renameTableForm] = Form.useForm();
    const [renamingTableInfo, setRenamingTableInfo] = useState<{ dbId: number; oldName: string } | null>(null);

 
    const [currentUser, setCurrentUser] = useState<LoggedInUser | null>(null);
    const [loadingUser, setLoadingUser] = useState<boolean>(true);

    const navigate = useNavigate();

 
    const stringToColor = (str: string): string => {/* ... */
        let hash = 0; for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); hash = hash & hash; } const colors = ['#F56A00', '#7265E6', '#FFBF00', '#00A2AE', '#1890ff', '#f5222d', '#52c41a', '#faad14', '#eb2f96', '#2f54eb', '#fa8c16', '#a0d911']; const index = Math.abs(hash) % colors.length; return colors[index];
    };
    const getInitials = (name: string): string => {/* ... */
        if (!name) return '?'; const trimmedName = name.trim(); if (trimmedName.length === 0) return '?'; const parts = trimmedName.split(' '); if (parts.length >= 2) { return (parts[0][0] + parts[1][0]).toUpperCase(); } if (trimmedName.length >= 2) { return trimmedName.substring(0, 2).toUpperCase(); } return trimmedName.substring(0, 1).toUpperCase();
    };

 

 
    useEffect(() => {
        let isMounted = true;
        setLoadingUser(true);
        api.checkLoginStatus()
            .then(status => { if (isMounted) { setCurrentUser(status.user); setLoadingUser(false); } })
            .catch(err => { if (isMounted) { console.error("Login check failed", err); setDatabaseError("Failed login check"); setCurrentUser(null); setLoadingUser(false); } });
        return () => { isMounted = false; };
    }, []);

 
    const fetchUserDatabases = useCallback(async (): Promise<void> => {
        setLoadingDatabases(true);
        setDatabaseError(null);
        console.log("Sidebar: Fetching databases...");
        try {
            const data = await api.fetchDatabases();  
            if (!Array.isArray(data)) throw new Error("Invalid database list format received.");
            setDatabases(data);
            setDatabaseError(null);
            if (onDatabaseListChange) onDatabaseListChange();
        } catch (err: any) {
            console.error("Sidebar: Fetch databases error:", err);
            const errorMsg = err.message || 'Unknown error';
            setDatabaseError(`Failed to load databases: ${errorMsg}`);
            setDatabases([]);
        } finally {
            setLoadingDatabases(false);
        }
    }, [onDatabaseListChange]);

    useEffect(() => {
        if (!loadingUser && currentUser) {  
            console.log("Sidebar: User loaded, fetching databases...");
            fetchUserDatabases().catch(() => console.error("Initial DB fetch failed."));
        } else if (!loadingUser && !currentUser) {
 
            setDatabases([]);
            setTablesByDb({});
            setDatabaseError("Please log in.");
        }
    }, [fetchUserDatabases, currentUser, loadingUser]);

    
    const fetchTablesForDb = useCallback(async (dbId: number) => {
        if (!dbId) return;
        console.log(`Sidebar: Fetching tables for DB ID: ${dbId}`);
        setTablesByDb(prev => ({
            ...prev,
            [dbId]: { loading: true, error: null, data: prev[dbId]?.data || [] }  
        }));

        try {
            const tablesData = await api.fetchTables(dbId);
            if (!Array.isArray(tablesData)) throw new Error("Invalid table list format received.");
            setTablesByDb(prev => ({
                ...prev,
                [dbId]: { loading: false, error: null, data: tablesData.sort((a, b) => a.table_name.localeCompare(b.table_name)) }
            }));
            if (onTableListChange) onTableListChange(dbId);
        } catch (err: any) {
            console.error(`Sidebar: Fetch tables error for DB ${dbId}:`, err);
            const errorMsg = err.message || 'Unknown error';
            setTablesByDb(prev => ({
                ...prev,
                [dbId]: { loading: false, error: `Failed to load tables: ${errorMsg}`, data: [] }
            }));
        }
    }, [onTableListChange]);

        useEffect(() => {
          if (selectedDatabaseId) {
              const currentTableState = tablesByDb[selectedDatabaseId]; 
              let shouldFetch = false;
  
              if (!currentTableState) {
                  shouldFetch = true;
                  console.log(`---> useEffect[${selectedDatabaseId}]: Should fetch. Reason: No previous state.`);
              } else if (currentTableState.error && !currentTableState.loading) {
                  shouldFetch = true;
                   console.log(`---> useEffect[${selectedDatabaseId}]: Should fetch. Reason: Retrying after error.`);
              } else {
                   console.log(`---> useEffect[${selectedDatabaseId}]: Skipping fetch. State:`, currentTableState);
              }
              if (shouldFetch) {
                  fetchTablesForDb(selectedDatabaseId);
              }
              if (!openDatabaseKeys.includes(String(selectedDatabaseId))) {
                   console.log(`---> useEffect[${selectedDatabaseId}]: Ensuring submenu is open.`);
                   setOpenDatabaseKeys(prevKeys => {
                      if (!prevKeys.includes(String(selectedDatabaseId))) {
                          return [...new Set([...prevKeys, String(selectedDatabaseId)])];
                      }
                      return prevKeys;
                  });
              }
          }
      }, [selectedDatabaseId, tablesByDb, fetchTablesForDb, openDatabaseKeys]);

 

    const handleDatabaseSubMenuOpenChange = (keys: string[]) => {
        setOpenDatabaseKeys(keys);
 
        const lastOpenedKey = keys[keys.length - 1];
        if (lastOpenedKey) {
            const dbId = parseInt(lastOpenedKey, 10);
            if (dbId && !tablesByDb[dbId]?.data?.length && !tablesByDb[dbId]?.loading) {
              console.log(`---> Calling fetchTablesForDb(${dbId}) from onOpenChange`); 

                 fetchTablesForDb(dbId);
            }
        }
    };

    const handleSelectDatabase = (dbId: number) => {
        onSelectDatabase(dbId);  
        onSelectTable(dbId, null);  
 
        if (!tablesByDb[dbId]?.data?.length && !tablesByDb[dbId]?.loading) { 
          console.log(`---> Calling fetchTablesForDb(${dbId}) from onTitleClick`); 
          fetchTablesForDb(dbId);
         }
 
         if (!openDatabaseKeys.includes(String(dbId))) {
             setOpenDatabaseKeys(prev => [...prev, String(dbId)]);
         }
    };

    const handleSelectTable = (dbId: number, tableName: string) => {
        onSelectTable(dbId, tableName);  
    };

 
    const showAddDbModal = () => { addDbForm.resetFields(); setIsAddDbModalVisible(true); };
    const handleAddDbCancel = () => { setIsAddDbModalVisible(false); };
    const handleAddDbOk = async () => {
        try {
            const values = await addDbForm.validateFields();
            const newDbName = values.dbName.trim();
            if (!newDbName) { message.error("Database name cannot be empty."); return; }
            if (databases.some(db => db.db_name === newDbName)) {
                message.error(`Database "${newDbName}" already exists.`); return;
            }

            setConfirmLoadingAddDb(true);
            console.log(`Sidebar: Attempting to create database: ${newDbName}`);
            const response = await api.addDatabase(newDbName);
            message.success(response?.message || `Database "${newDbName}" created successfully!`);
            setIsAddDbModalVisible(false);
            await fetchUserDatabases();  
        } catch (errorInfo: any) {
            console.error('Sidebar: Create Database Failed:', errorInfo);
            const errorMsg = errorInfo.message || 'Please try again.';
            message.error(`Failed to create database: ${errorMsg}`);
        } finally {
            setConfirmLoadingAddDb(false);
        }
    };

    const showRenameDbModal = (db: ApiDatabase) => {
        setRenamingDbInfo(db);
        renameDbForm.setFieldsValue({ newDbName: db.db_name });
        setIsRenameDbModalVisible(true);
    };
    const handleRenameDbCancel = () => { setIsRenameDbModalVisible(false); setRenamingDbInfo(null); };
    const handleRenameDbOk = async () => {
        if (!renamingDbInfo) return;
        const { db_id: dbId, db_name: oldName } = renamingDbInfo;
        try {
            const values = await renameDbForm.validateFields();
            const newDbName = values.newDbName.trim();
            if (newDbName === oldName) { message.info("No changes made."); handleRenameDbCancel(); return; }
             if (databases.some(db => db.db_name === newDbName && db.db_id !== dbId)) {
                 message.error(`Another database named "${newDbName}" already exists.`); return;
             }

            setConfirmLoadingRenameDb(true);
            const messageKey = `rename-db-${dbId}`;
            message.loading({ content: `Renaming database...`, key: messageKey, duration: 0 });
            await api.renameDatabase(dbId, newDbName);
            message.success({ content: `Database renamed successfully!`, key: messageKey, duration: 3 });
            handleRenameDbCancel();
            await fetchUserDatabases();  
 
            if (selectedDatabaseId === dbId) {
 
            }
        } catch (errorInfo: any) {
            console.error(`Sidebar: Rename Database Failed for ID ${dbId}:`, errorInfo);
            const errorMsg = errorInfo.message || 'Please try again.';
            message.error(`Failed to rename database: ${errorMsg}`);
        } finally {
            setConfirmLoadingRenameDb(false);
            message.destroy(`rename-db-${renamingDbInfo?.db_id}`);
        }
    };

    const handleDeleteDatabase = (db: ApiDatabase) => {
        confirm({
            title: `Delete Database "${db.db_name}"?`,
            icon: <DeleteOutlined style={{ color: 'red' }} />,
            content: 'This will permanently delete the database and ALL tables and data within it. This action cannot be undone.',
            okText: 'Yes, Delete Permanently', okType: 'danger', cancelText: 'Cancel', maskClosable: false,
            onOk: async () => {
                setLoadingDatabases(true);  
                const messageKey = `delete-db-${db.db_id}`;
                message.loading({ content: `Deleting database "${db.db_name}"...`, key: messageKey, duration: 0 });
                try {
                    console.log(`Sidebar: Attempting to delete database: ${db.db_name} (ID: ${db.db_id})`);
                    await api.deleteDatabase(db.db_id);
                    message.success({ content: `Database "${db.db_name}" deleted.`, key: messageKey, duration: 3 });
                    if (selectedDatabaseId === db.db_id) {
                        onSelectDatabase(null);
                        onSelectTable(null, null);
                    }
                    setTablesByDb(prev => {
                        const newState = { ...prev };
                        delete newState[db.db_id];
                        return newState;
                    });
                    await fetchUserDatabases();  
                } catch (err: any) {
                    console.error(`Sidebar: Error deleting database ID ${db.db_id}:`, err);
                    const errorMsg = err.message || 'Unknown error';
                    setDatabaseError(`Failed to delete DB: ${errorMsg}`);  
                    message.error({ content: `Failed to delete database: ${errorMsg}`, key: messageKey, duration: 5 });
                } finally {
                    setLoadingDatabases(false);  
                }
            },
        });
    };

    const showAddTableModal = (dbId: number) => {
        if (!dbId) return;
        setAddingTableToDbId(dbId);
        addTableForm.resetFields();
        setIsAddTableModalVisible(true);
    };
    const handleAddTableCancel = () => { setIsAddTableModalVisible(false); setAddingTableToDbId(null); };
    const handleAddTableOk = async () => {
        if (!addingTableToDbId) return;
        const currentDbId = addingTableToDbId;  
        try {
            const values = await addTableForm.validateFields();
            const newTableName = values.tableName.trim();
            if (!newTableName) { message.error("Table name cannot be empty."); return; }
            const currentTables = tablesByDb[currentDbId]?.data || [];
            if (currentTables.some(t => t.table_name === newTableName)) {
                message.error(`Table "${newTableName}" already exists in this database.`); return;
            }

            setConfirmLoadingAddTable(true);
            console.log(`Sidebar: Attempting to create table "${newTableName}" in DB ID ${currentDbId}`);
            const response = await api.addTable(currentDbId, newTableName);
            message.success(response?.message || `Table "${newTableName}" created successfully!`);
            setIsAddTableModalVisible(false);
            setAddingTableToDbId(null);
            await fetchTablesForDb(currentDbId);  

        } catch (errorInfo: any) {
            console.error(`Sidebar: Create Table Failed in DB ${currentDbId}:`, errorInfo);
            const errorMsg = errorInfo.message || 'Please try again.';
            message.error(`Failed to create table: ${errorMsg}`);
        } finally {
            setConfirmLoadingAddTable(false);
        }
    };


    const showRenameTableModal = (dbId: number, oldTableName: string) => {
        if (!dbId || !oldTableName) return;
        setRenamingTableInfo({ dbId, oldName: oldTableName });
        renameTableForm.setFieldsValue({ newTableName: oldTableName });
        setIsRenameTableModalVisible(true);
    };
    
    const handleRenameTableCancel = () => { setIsRenameTableModalVisible(false); setRenamingTableInfo(null); };
    const handleRenameTableOk = async () => {
        if (!renamingTableInfo) return;
        const { dbId, oldName } = renamingTableInfo;

        try {
            const values = await renameTableForm.validateFields();
            const newTableName = values.newTableName.trim();
            if (newTableName === oldName) { message.info("No changes made."); handleRenameTableCancel(); return; }
            const currentTables = tablesByDb[dbId]?.data || [];
            if (currentTables.some(t => t.table_name === newTableName)) {
                message.error(`Another table named "${newTableName}" already exists in this database.`); return;
            }

            setConfirmLoadingRenameTable(true);
            const messageKey = `rename-table-${dbId}-${oldName}`;
            message.loading({ content: `Renaming table...`, key: messageKey, duration: 0 });
            await api.renameTable(dbId, oldName, newTableName);
            message.success({ content: `Table renamed successfully!`, key: messageKey, duration: 3 });
            handleRenameTableCancel();
            await fetchTablesForDb(dbId);  
            if (selectedDatabaseId === dbId && selectedTableName === oldName) {
                onSelectTable(dbId, newTableName);
            }

        } catch (errorInfo: any) {
            console.error(`Sidebar: Rename Table Failed for ${oldName} in DB ${dbId}:`, errorInfo);
            const errorMsg = errorInfo.message || 'Please try again.';
            message.error(`Failed to rename table: ${errorMsg}`);
        } finally {
            setConfirmLoadingRenameTable(false);
             if (renamingTableInfo) {  
                message.destroy(`rename-table-${renamingTableInfo.dbId}-${renamingTableInfo.oldName}`);
             }
        }
    };

    const handleDeleteTable = (dbId: number, tableNameToDelete: string) => {
         if (!dbId || !tableNameToDelete) return;
        confirm({
            title: `Delete Table "${tableNameToDelete}"?`,
            icon: <DeleteOutlined style={{ color: 'red' }} />,
            content: 'This will permanently delete the table and all its data. This action cannot be undone.',
            okText: 'Yes, Delete Permanently', okType: 'danger', cancelText: 'Cancel', maskClosable: false,
            onOk: async () => {
 
                setTablesByDb(prev => ({
                     ...prev,
                     [dbId]: { ...(prev[dbId] || { data: [] }), loading: true, error: null }
                 }));
                const messageKey = `delete-table-${dbId}-${tableNameToDelete}`;
                message.loading({ content: `Deleting table "${tableNameToDelete}"...`, key: messageKey, duration: 0 });
                try {
                    console.log(`Sidebar: Attempting to delete table "${tableNameToDelete}" from DB ID ${dbId}`);
                    await api.deleteTable(dbId, tableNameToDelete);
                    message.success({ content: `Table "${tableNameToDelete}" deleted.`, key: messageKey, duration: 3 });
 
                    if (selectedDatabaseId === dbId && selectedTableName === tableNameToDelete) {
                        onSelectTable(dbId, null);  
                    }
                    await fetchTablesForDb(dbId);  
                } catch (err: any) {
                    console.error(`Sidebar: Error deleting table ${tableNameToDelete} from DB ${dbId}:`, err);
                    const errorMsg = err.message || 'Unknown error';
 
                     setTablesByDb(prev => ({
                         ...prev,
                         [dbId]: { ...(prev[dbId] || { data: [] }), loading: false, error: `Failed to delete table: ${errorMsg}` }
                     }));
                    message.error({ content: `Failed to delete table: ${errorMsg}`, key: messageKey, duration: 5 });
                }
 
            },
        });
    };
 
    const handleCreateView = (targetDbId: number, targetTable: string, viewType: 'grid' | 'gallery') => {
        if (!targetDbId || !targetTable) return;
        console.log(`Sidebar: Create ${viewType} view for table: ${targetTable} in DB: ${targetDbId}`);
        message.info(`Initiated create ${viewType} view for "${targetTable}".`);
        if (onCreateView) onCreateView(targetDbId, targetTable, viewType);
 
        onSelectDatabase(targetDbId);
        onSelectTable(targetDbId, targetTable);
    };

    const renderTableActions = useCallback((dbId: number, tableName: string) => (
      <Menu onClick={({ domEvent }) => { domEvent.stopPropagation(); }}>
          {/* --- Add/Modify View Switch SubMenu --- */}
          <Menu.SubMenu key="switch-view" title="Switch View" icon={<AppstoreOutlined />}>
            <Menu.Item
                key="view-grid"
                icon={<TableOutlined />}
                
                onClick={() => { if (onCreateView) onCreateView(dbId, tableName, 'grid'); }}
            >
                Grid View
            </Menu.Item>
            <Menu.Item
                key="view-gallery"
                icon={<AppstoreOutlined />} 
                  
                onClick={() => { if (onCreateView) onCreateView(dbId, tableName, 'gallery'); }}
            >
                Gallery View
            </Menu.Item>
          </Menu.SubMenu>
          {/* --- End View Switch SubMenu --- */}
          <Menu.Divider />
        <Menu.Item key="rename-table" icon={<EditOutlined />} onClick={(e) => showRenameTableModal(dbId, tableName)} > Rename Table </Menu.Item>
        <Menu.Divider />
        <Menu.Item key="delete-table" danger icon={<DeleteOutlined />} onClick={(e) => handleDeleteTable(dbId, tableName)} > Delete Table </Menu.Item>
    </Menu>
    ), [onCreateView, showRenameTableModal, handleDeleteTable]);

    const renderDatabaseActions = (db: ApiDatabase) => (
         <Menu onClick={({ domEvent }) => { domEvent.stopPropagation(); }}>
             <Menu.Item key="add-table" icon={<PlusOutlined />} onClick={() => showAddTableModal(db.db_id)}> Add Table </Menu.Item>
             <Menu.Divider />
             <Menu.Item key="rename-db" icon={<EditOutlined />} onClick={() => showRenameDbModal(db)}> Rename Database </Menu.Item>
             <Menu.Divider />
             <Menu.Item key="delete-db" danger icon={<DeleteOutlined />} onClick={() => handleDeleteDatabase(db)}> Delete Database </Menu.Item>
         </Menu>
     );

     const renderSidebarContent = () => {
      if (loadingDatabases && databases.length === 0) {
          return <div style={{ padding: '20px', textAlign: 'center' }}><Spin tip="Loading databases..." /></div>;
      }
      if (!loadingDatabases && databaseError && databases.length === 0) {
          return <div style={{ padding: '10px' }}>
              <Alert message={databaseError} type="error" showIcon action={<Button size="small" type="link" onClick={fetchUserDatabases}>Retry</Button>} />
          </div>;
      }
      if (!loadingDatabases && databases.length === 0 && !databaseError) { 
          return <div style={{ padding: '20px', textAlign: 'center' }}>
              <Empty description={currentUser ? "No databases found" : "Please log in to view databases"} image={Empty.PRESENTED_IMAGE_SIMPLE}>
                 {currentUser && <Button type="primary" icon={<PlusOutlined />} onClick={showAddDbModal}>Create Database</Button>}
                 {!currentUser && <Button type="primary" onClick={() => navigate('/login')}>Go to Login</Button>}
              </Empty>
          </div>;
      }
  
      const currentSelectedKeys: string[] = [];
      if (selectedDatabaseId && selectedTableName) {
           currentSelectedKeys.push(`table-${selectedDatabaseId}-${selectedTableName}`);
      }
      
  
      return (
          <Menu
              theme="light"
              mode="inline"
              selectedKeys={currentSelectedKeys} 
              openKeys={openDatabaseKeys}
              onOpenChange={handleDatabaseSubMenuOpenChange}
              style={{ height: '100%', borderRight: 0, overflowY: 'auto', paddingBottom: '20px' }} 
          >
              {databases.map(db => {
                  const tablesState = tablesByDb[db.db_id];
                  const isLoadingTables = tablesState?.loading ?? false;
                  const tablesError = tablesState?.error;
                  const tablesData = tablesState?.data || [];
                  const isDbSelected = selectedDatabaseId === db.db_id;
  
                  return (
                      <SubMenu
                           key={String(db.db_id)}
                           
                           onTitleClick={() => handleSelectDatabase(db.db_id)}
                           icon={<DatabaseOutlined />}
                           title={
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                   <Text ellipsis style={{ flexGrow: 1, marginRight: '8px', cursor: 'pointer', fontWeight: isDbSelected && !selectedTableName ? 600 : 400 }} title={db.db_name}>
                                       {db.db_name}
                                   </Text>
                                   <Dropdown
                                       overlay={() => renderDatabaseActions(db)}
                                       trigger={['click']}
                                       placement="bottomRight"
                                      >
                                       <Button
                                           type="text"
                                           icon={<EllipsisOutlined />}
                                           size="small"
                                           onClick={(e) => e.stopPropagation()} 
                                           aria-label={`Actions for database ${db.db_name}`}
                                           style={{ flexShrink: 0 }}
                                          />
                                   </Dropdown>
                               </div>
                           }
                       >
  
                          {isLoadingTables && (
                              
                              <div style={{ padding: '8px 24px 8px 48px', textAlign: 'center' }}>
                                  <Spin size="small" />
                              </div>
                          )}
  
                          {!isLoadingTables && tablesError && (
                              
                              <div style={{ padding: '5px 24px 5px 48px' }}>
                                 <Alert
                                      message="Error"
                                      description={tablesError} 
                                      type="error"
                                      showIcon
                                      size="small"
                                      action={
                                          
                                          <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); fetchTablesForDb(db.db_id); }}>
                                              Retry
                                          </Button>
                                      }
                                  />
                             </div>
                          )}
  
                          {!isLoadingTables && !tablesError && tablesData.length === 0 && (
                              <Menu.Item key={`empty-${db.db_id}`} disabled style={{ paddingLeft: '48px', height: 'auto', lineHeight: 'normal', cursor: 'default' }}>
                                  <Empty
                                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                                      description={<span style={{fontSize: '12px', color: '#888'}}>No tables</span>}
                                      style={{ padding: '8px 0' }}
                                  >
                                  </Empty>
                              </Menu.Item>
                          )}
  
                          {!isLoadingTables && !tablesError && tablesData.length > 0 && (
                              
                              tablesData.map(table => (
                                  <Menu.Item
                                      key={`table-${db.db_id}-${table.table_name}`}
                                      icon={<TableOutlined />}
                                      style={{ paddingLeft: '48px', display: 'flex', alignItems: 'center' }} 
                                      onClick={() => handleSelectTable(db.db_id, table.table_name)}
                                      title={table.table_name}
                                  >
                                       {/* Wrap content in a flex container */}
                                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                           <Text ellipsis style={{ flexGrow: 1, marginRight: '5px' }}>
                                               {table.table_name}
                                           </Text>
                                           {/* Ensure stopPropagation on the table actions Dropdown trigger */}
                                           <Dropdown
                                              overlay={() => renderTableActions(db.db_id, table.table_name)} 
                                              trigger={['click']}
                                              placement="bottomRight"
                                          >
                                               <Button
                                                   type="text"
                                                   icon={<EllipsisOutlined />}
                                                   size="small"
                                                   onClick={(e) => e.stopPropagation()} 
                                                   aria-label={`Actions for table ${table.table_name}`}
                                                   style={{ flexShrink: 0 }}
                                                  />
                                           </Dropdown>
                                       </div>
                                  </Menu.Item>
                              ))
                          )}
  
                          {/* === END: Improved Content Rendering Inside SubMenu === */}
                       </SubMenu>
                  );
              })}
          </Menu>
      );
  };
 
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #f0f0f0', background: '#fff' }}>

            {/* User Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {loadingUser ? <Spin size="small" /> : currentUser ? (
                    <span aria-label={`Avatar for ${currentUser.username}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', backgroundColor: stringToColor(currentUser.username || 'default'), color: '#fff', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>
                        {getInitials(currentUser.username || '?')}
                    </span>
                ) : <UserOutlined style={{ fontSize: '16px', color: '#bfbfbf' }} />}
                <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loadingUser ? 'Loading...' : (currentUser ? `Hi, ${currentUser.username.slice(0,-1)}` : 'Not logged in')}
                </span>
            </div>

            {/* Main Content Area (Databases/Tables Menu) */}
            <div style={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                {renderSidebarContent()}
            </div>

             {/* Footer Area */}
             <div style={{ flexShrink: 0, borderTop: '1px solid #f0f0f0' }}>
                 {/* Add Database Button */}
                 <div style={{ padding: '8px' }}>
                     <Button type="primary" icon={<PlusOutlined />} block onClick={showAddDbModal} disabled={loadingDatabases}>
                         Add Database
                     </Button>
                 </div>
                  {/* Profile Dropdown */}
                 <div style={{ padding: '0 8px 8px 8px' }}>
                      <Dropdown
                         overlay={
                             <Menu>
                                 <Menu.Item key="logout" danger icon={<LogoutOutlined />}
                                     onClick={async () => {
                                         try { await api.logoutUser(); message.success('Logged out'); navigate('/login'); }
                                         catch (error) { message.error('Failed to logout'); }
                                     }}> Logout </Menu.Item>
                             </Menu>
                         }
                         trigger={['click']} placement="topCenter" >
                         <Button type="text" icon={<UserOutlined />} block style={{ textAlign: 'left' }}> Profile </Button>
                     </Dropdown>
                 </div>
             </div>


            {/* --- Modals --- */}

            {/* Add Database Modal */}
            {isAddDbModalVisible && (
                <Modal title="Create New Database" visible={isAddDbModalVisible} onOk={handleAddDbOk} confirmLoading={confirmLoadingAddDb} onCancel={handleAddDbCancel} okText="Create" destroyOnClose maskClosable={!confirmLoadingAddDb}>
                    <Form form={addDbForm} layout="vertical" name="add_db_form">
                        <Form.Item name="dbName" label="Database Name" rules={[{ required: true, message: 'Required' }, { whitespace: true, message: 'Cannot be empty' }, { max: 50, message: 'Too long (max 50)' },
 
                              ({ getFieldValue }) => ({
                                validator(_, value) {
                                  const trimmedValue = value?.trim();
                                  if (!trimmedValue) return Promise.resolve();
                                  if (databases.some(db => db.db_name === trimmedValue)) {
                                      return Promise.reject(new Error('This database name already exists.'));
                                  }
 
                                   if (!/^[a-zA-Z0-9_-\s]+$/.test(trimmedValue)) {
                                       return Promise.reject(new Error('Invalid characters. Use letters, numbers, _, -, space.'));
                                   }
                                  return Promise.resolve();
                                },
                              }),
                        ]}>
                            <Input placeholder="e.g., Personal Projects or Client Data" />
                        </Form.Item>
                    </Form>
                </Modal>
            )}

            {/* Rename Database Modal */}
            {isRenameDbModalVisible && renamingDbInfo && (
                <Modal title={`Rename Database "${renamingDbInfo.db_name}"`} visible={isRenameDbModalVisible} onOk={handleRenameDbOk} confirmLoading={confirmLoadingRenameDb} onCancel={handleRenameDbCancel} okText="Rename" destroyOnClose maskClosable={!confirmLoadingRenameDb}>
                    <Form form={renameDbForm} layout="vertical" name="rename_db_form" initialValues={{ newDbName: renamingDbInfo.db_name }}>
                        <Form.Item name="newDbName" label="New Database Name" rules={[{ required: true, message: 'Required' }, { whitespace: true, message: 'Cannot be empty' }, { max: 50, message: 'Too long (max 50)' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    const trimmedValue = value?.trim();
                                    if (!trimmedValue) return Promise.resolve();
                                    if (trimmedValue === renamingDbInfo.db_name) { return Promise.reject(new Error('New name must be different.')); }
                                     if (databases.some(db => db.db_name === trimmedValue && db.db_id !== renamingDbInfo.db_id)) {
                                         return Promise.reject(new Error('This database name already exists.'));
                                     }
                                     if (!/^[a-zA-Z0-9_-\s]+$/.test(trimmedValue)) {
                                         return Promise.reject(new Error('Invalid characters. Use letters, numbers, _, -, space.'));
                                     }
                                    return Promise.resolve();
                                },
                            }),
                        ]}>
                            <Input placeholder="Enter new database name" />
                        </Form.Item>
                    </Form>
                </Modal>
            )}


            {/* Add Table Modal */}
            {isAddTableModalVisible && addingTableToDbId && (
                <Modal title={`Add New Table to Database "${databases.find(db=>db.db_id === addingTableToDbId)?.db_name || '...'}"`} visible={isAddTableModalVisible} onOk={handleAddTableOk} confirmLoading={confirmLoadingAddTable} onCancel={handleAddTableCancel} okText="Create Table" destroyOnClose maskClosable={!confirmLoadingAddTable}>
                     <p style={{ marginBottom: '15px', fontSize: '13px', color: '#666' }}> Enter a unique name for your new table within this database. </p>
                     <Form form={addTableForm} layout="vertical" name="add_table_form">
                         <Form.Item name="tableName" label="New Table Name" rules={[{ required: true, message: 'Required' }, { whitespace: true, message: 'Cannot be empty' }, { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid format (letters, numbers, _, starts with letter or _)' }, { max: 50, message: 'Too long (max 50)' },
                              ({ getFieldValue }) => ({  
                                 validator(_, value) {
                                   const trimmedValue = value?.trim();
                                   if (!trimmedValue || !addingTableToDbId) return Promise.resolve();
                                   const currentTables = tablesByDb[addingTableToDbId]?.data || [];
                                   if (currentTables.some(t => t.table_name === trimmedValue)) {
                                        return Promise.reject(new Error('This table name already exists in this database.'));
                                   }
                                   return Promise.resolve();
                                 },
                               }),
                         ]}>
                             <Input placeholder="e.g., tasks or project_milestones" />
                         </Form.Item>
                     </Form>
                 </Modal>
            )}

             {/* Rename Table Modal */}
             {isRenameTableModalVisible && renamingTableInfo && (
                 <Modal title={`Rename Table "${renamingTableInfo.oldName}"`} visible={isRenameTableModalVisible} onOk={handleRenameTableOk} confirmLoading={confirmLoadingRenameTable} onCancel={handleRenameTableCancel} okText="Rename Table" destroyOnClose maskClosable={!confirmLoadingRenameTable}>
                     <Form form={renameTableForm} layout="vertical" name="rename_table_form" initialValues={{ newTableName: renamingTableInfo.oldName }}>
                         <Form.Item name="newTableName" label="New Table Name" rules={[{ required: true, message: 'Required' }, { whitespace: true, message: 'Cannot be empty' }, { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: 'Invalid format' }, { max: 50, message: 'Too long (max 50)' },
                              ({ getFieldValue }) => ({
                                validator(_, value) {
                                    const trimmedValue = value?.trim();
                                    if (!trimmedValue || !renamingTableInfo) return Promise.resolve();
                                    if (trimmedValue === renamingTableInfo.oldName) return Promise.reject(new Error('New name must be different.'));
                                    const currentTables = tablesByDb[renamingTableInfo.dbId]?.data || [];
                                     if (currentTables.some(t => t.table_name === trimmedValue)) {
                                         return Promise.reject(new Error('This table name already exists in this database.'));
                                     }
                                    return Promise.resolve();
                                },
                            }),
                         ]}>
                             <Input placeholder="Enter new table name" />
                         </Form.Item>
                     </Form>
                 </Modal>
             )}

        </div>
    );
};

export default Sidebar;