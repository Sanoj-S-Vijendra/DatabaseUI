

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import { Layout, Typography, Spin, Alert, message,Empty , Tag} from 'antd'; 
import { DatabaseOutlined, TableOutlined } from '@ant-design/icons';
import Sidebar from './components/Sidebar/Sidebar';
import DataGrid from './components/DataGrid/DataGrid';
import GalleryView from './components/GalleryView';
import * as api from './api'; 
import './css_files/dashboard.css';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
    const navigate = useNavigate();

    
    const [selectedDbId, setSelectedDbId] = useState<number | null>(null);
    const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false); 
    const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
    const [authError, setAuthError] = useState<string | null>(null);
    const [currentViewType, setCurrentViewType] = useState<'grid' | 'gallery'>('grid'); 

    
    useEffect(() => {
        let isMounted = true;
        const checkAuthStatus = async () => {
            setIsCheckingAuth(true);
            setAuthError(null);
            try {
                const status = await api.checkLoginStatus();
                if (!isMounted) return;
                if (!status.loggedIn) {
                    console.log("Dashboard: User not logged in, redirecting to Login.");
                    navigate("/login");
                } else {
                    console.log("Dashboard: User is logged in. Rendering.");
                }
            } catch (error) {
                if (!isMounted) return;
                console.error("Dashboard: Error checking authentication status:", error);
                setAuthError("Could not verify authentication. Please try logging in again.");
                navigate("/login"); 
            } finally {
                if (isMounted) setIsCheckingAuth(false);
            }
        };
        checkAuthStatus();
        return () => { isMounted = false; };
    }, [navigate]);

    
    const handleSelectDatabase = useCallback((dbId: number | null) => {
        console.log("Dashboard: Database selected:", dbId);
        setSelectedDbId(dbId);
        setSelectedTableName(null);
        setCurrentViewType('grid');
    }, []);

    const handleSelectTable = useCallback((dbId: number | null, tableName: string | null) => {
        console.log(`Dashboard: Table selected: ${tableName} in DB: ${dbId}`);
        if (tableName && dbId) {
            if (dbId !== selectedDbId) {
                 setSelectedDbId(dbId);
            }
            setSelectedTableName(tableName);
            setCurrentViewType('grid');
        } else {
            setSelectedTableName(null);
        }
    }, [selectedDbId]); 

    const handleSetViewType = useCallback((dbId: number, tableName: string, viewType: 'grid' | 'gallery') => {
         if (dbId !== selectedDbId || tableName !== selectedTableName) {
              console.warn(`View type change requested for non-selected table/db (${dbId}/${tableName}). Context may be out of sync. Applying anyway.`);
         }
         console.log(`Dashboard: Setting view type to ${viewType} for ${selectedDbId}/${selectedTableName}`);
         setCurrentViewType(viewType); 
         message.info(`Switched to ${viewType} view.`);
    }, [selectedDbId, selectedTableName]); 

    
    const handleDatabaseListChange = useCallback(() => { console.log("Dashboard: DB list possibly changed."); }, []);
    const handleTableListChange = useCallback((dbId: number) => { console.log(`Dashboard: Table list possibly changed for DB ${dbId}.`); }, []);

    

    
    if (isCheckingAuth) {
        return (
            <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Spin size="large" tip="Verifying authentication..." />
            </Layout>
        );
    }
    if (authError) {
        return (
            <Layout style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
                <Alert message="Authentication Error" description={authError} type="error" showIcon />
            </Layout>
        );
    }

     
     return (
      <Layout className="app-layout">
          <Header className="app-header">
              <Title level={3} style={{ color: 'white', margin: 0 }}>Database UI</Title>
          </Header>
          <Layout>
              <Sider
                  className="app-sider" width={250} theme="light" collapsible collapsed={collapsed}
                  onCollapse={setCollapsed} breakpoint="lg" collapsedWidth={80}
                  style={{ background: '#fff', height: 'calc(100vh - 64px)', overflow: 'auto' }}
              >
                   <Sidebar
                       selectedDatabaseId={selectedDbId}
                       selectedTableName={selectedTableName}
                       onSelectDatabase={handleSelectDatabase}
                       onSelectTable={handleSelectTable}
                       onCreateView={handleSetViewType}
                       onDatabaseListChange={handleDatabaseListChange}
                       onTableListChange={handleTableListChange}
                   />
              </Sider>

              {/* Main Content Area */}
              <Layout style={{ padding: '0' }}>
                  <Content className="app-content">
                      {/* Info Bar */}
                      <div style={{ padding: '10px 15px', borderBottom: '1px solid #eee', background: '#f9f9f9', flexShrink: 0, fontSize: 'small' }}>
                         View: <span style={{textTransform: 'capitalize'}}>{currentViewType}</span>
                      </div>

                      {/* Scrollable Data View Container */}
                      <div className="data-view-container" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                          {/* --- START: Enhanced Placeholders --- */}
                          {!selectedDbId && (
                              <div className="content-placeholder">
                                  <Empty
                                      image={<DatabaseOutlined style={{ fontSize: 60, color: '#1890ff' }}/>} 
                                      imageStyle={{ height: 80 }} 
                                      description={
                                          <Text style={{ fontSize: '16px', color: '#555' }}>
                                              Please select a <strong>Database</strong> from the sidebar.
                                          </Text>
                                      }
                                  />
                              </div>
                          )}

                          {selectedDbId && !selectedTableName && (
                              <div className="content-placeholder">
                                   <Empty
                                      image={<TableOutlined style={{ fontSize: 60, color: '#52c41a' }}/>} 
                                      imageStyle={{ height: 80 }}
                                      description={
                                          <Text style={{ fontSize: '16px', color: '#555' }}>
                                              Database <Tag color="blue">{selectedDbId}</Tag> selected. <br/>
                                              Now, please select a <strong>Table</strong>.
                                          </Text>
                                      }
                                  />
                              </div>
                          )}
                          {/* --- END: Enhanced Placeholders --- */}


                          {/* Conditional Rendering of DataGrid or GalleryView */}
                          {selectedDbId && selectedTableName && currentViewType === 'grid' && (
                              <DataGrid dbId={selectedDbId} tableName={selectedTableName} />
                          )}
                          {selectedDbId && selectedTableName && currentViewType === 'gallery' && (
                              <GalleryView dbId={selectedDbId} tableName={selectedTableName} />
                          )}
                      </div>
                  </Content>
              </Layout>
          </Layout>
      </Layout>
  );
};

export default Dashboard;