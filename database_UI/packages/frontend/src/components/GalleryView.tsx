

import React, { useState, useEffect } from 'react';
import { Card, Spin, Alert, Empty, Pagination, Row, Col, Typography, Tooltip, Tag } from 'antd';
import * as api from '../api';
import { ApiColumnSchema } from '../api/types';
import dayjs from 'dayjs';

const { Text, Paragraph, Title } = Typography;

interface GalleryViewProps {
    dbId: number;
    tableName: string;
}

const GalleryView: React.FC<GalleryViewProps> = ({ dbId, tableName }) => {
    const [schema, setSchema] = useState<ApiColumnSchema[]>([]);
    const [data, setData] = useState<any[]>([]);
    const [totalRows, setTotalRows] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);
    const [loadingSchema, setLoadingSchema] = useState<boolean>(true);
    const [loadingData, setLoadingData] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [primaryKeyName, setPrimaryKeyName] = useState<string | null>(null);
    const [databaseName, setDatabaseName] = useState<string | null>(null);
    const [loadingDbName, setLoadingDbName] = useState<boolean>(false);
    const [dbNameError, setDbNameError] = useState<string | null>(null);

    useEffect(() => {
        setSchema([]); setData([]); setTotalRows(0); setCurrentPage(1); setError(null); setPrimaryKeyName(null);
        setLoadingSchema(true); setLoadingData(true);
        setDatabaseName(null); setLoadingDbName(false); setDbNameError(null);

        console.log(`GalleryView: Fetching schema for DB: ${dbId}, Table: ${tableName}`);
        api.fetchSchema(dbId, tableName)
            .then((fetchedSchema) => {
                if (!Array.isArray(fetchedSchema)) throw new Error("Invalid schema format.");
                setSchema(fetchedSchema);
                const pk = fetchedSchema.find(col => col.isPrimaryKey);
                setPrimaryKeyName(pk?.name || null);
            })
            .catch((err) => { setError(`Schema Error: ${err.message}`); setData([]); setTotalRows(0); })
            .finally(() => setLoadingSchema(false));

    }, [dbId, tableName]);

    
    useEffect(() => {
        if (!dbId) {
            setDatabaseName('Invalid DB ID');
            setLoadingDbName(false);
            setDbNameError(null);
            return;
        }
    
        let isMounted = true; 
        setLoadingDbName(true);
        setDbNameError(null);
        setDatabaseName(null); 
    
        const fetchName = async () => {
            console.log(`GalleryView Title: Attempting to fetch name for dbId: ${dbId}`);
            try {
                const name = await api.getDatabaseName(dbId);
                if (isMounted) {
                    console.log(`GalleryView Title: Successfully fetched name: ${name}`);
                    setDatabaseName(name);
                }
            } catch (error: any) {
                console.error("GalleryView Title: Error fetching database name:", error);
                if (isMounted) {
                    setDatabaseName('Error'); 
                    setDbNameError(error instanceof Error ? error.message : 'Failed to load DB name');
                }
            } finally {
                if (isMounted) {
                    setLoadingDbName(false);
                }
            }
        };
    
        fetchName();
    
        return () => {
            isMounted = false;
        };
    }, [dbId]);

    useEffect(() => {
        if (loadingSchema || error || !dbId || !tableName) {
             if (!loadingSchema && !error) setLoadingData(false);
            return;
        }

        setLoadingData(true);
        console.log(`GalleryView: Fetching data page ${currentPage}, size ${pageSize}`);
        const fetchParams = { page: currentPage, limit: pageSize };

        api.fetchData(dbId, tableName, fetchParams)
            .then((response) => {
                if (!response || !Array.isArray(response.data) || typeof response.total !== 'number') {
                    throw new Error("Invalid data format received.");
                }
                 const processedData = response.data.map((row, index) => ({
                    ...row,
                    gallery_view_key: primaryKeyName && row[primaryKeyName] != null
                        ? `gallery-${dbId}-${tableName}-${row[primaryKeyName]}`
                        : `gallery-idx-${dbId}-${tableName}-${currentPage}-${index}`
                }));
                setData(processedData);
                setTotalRows(response.total);
            })
            .catch((err) => { setError(`Data Error: ${err.message}`); setData([]); setTotalRows(0); })
            .finally(() => setLoadingData(false));

    }, [dbId, tableName, currentPage, pageSize, loadingSchema, schema, error, primaryKeyName]);
    
    
    const handlePaginationChange = (page: number, newPageSize?: number) => {
        if (newPageSize && newPageSize !== pageSize) {
            setPageSize(newPageSize);
            setCurrentPage(1); 
        } else {
            setCurrentPage(page);
        }
    };

    const formatDisplayValue = (value: any, columnType: string): string => {
        const colTypeLC = columnType.toLowerCase().split('(')[0].split(' ')[0];
        const dateTypesLC = ['date', 'timestamp', 'datetime', 'timestamptz', 'timestamp with time zone'];

        if (value === null || value === undefined) return 'NULL';
        if (dateTypesLC.includes(colTypeLC)) {
            try {
                const date = dayjs(value);
                if (date.isValid()) {
                    const showTime = colTypeLC.includes('timestamp') || colTypeLC.includes('datetime');
                    return date.format(showTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD');
                } else { return 'Invalid Date'; }
            } catch { /* fallback */ }
        }
        return String(value); 
    };

    
    if (loadingSchema) {
        return <div style={{ padding: 50, textAlign: 'center' }}><Spin tip="Loading schema..." /></div>;
    }
    if (error) {
        return <Alert message="Error" description={error} type="error" showIcon style={{ margin: 20 }}/>;
    }
     if (!loadingSchema && schema.length === 0 && !error) {
         return <Empty description={`Table "${tableName}" has no columns defined or schema load failed.`} style={{ marginTop: 50 }} />;
    }

    return (
        <div style={{ padding: '15px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Title level={4} style={{ margin: 0, padding: '0 0 15px 0', flexShrink: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px' }}>
                DB:{''}
                {loadingDbName ? (
                    <Spin size="small" style={{ marginRight: '5px' }}/>
                ) : dbNameError ? (
                    <Tooltip title={dbNameError}><Text type="danger" style={{ marginRight: '5px' }}>Error</Text></Tooltip>
                ) : (
                    <Text strong>{databaseName || `ID ${dbId}`}</Text> 
                )}
                <Text>/</Text>
                Table:{''}
                <Text strong>{tableName || 'Select Table'}</Text>
                {loadingSchema && <Spin size="small" style={{ marginLeft: '10px' }} />}
            </Title>

            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '0 5px' }}>
                <Spin spinning={loadingData && !error} tip="Loading data...">
                    {data.length === 0 && !loadingData ? (
                        <Empty description={`No data found for table "${tableName}".`} style={{ marginTop: 50 }} />
                    ) : (
                        <Row gutter={[16, 16]}> {/* Grid layout for cards */}
                            {data.map((row, index) => {
                                const frontendSNo = (currentPage - 1) * pageSize + index + 1;
                                return (
                                
                                <Col key={row.gallery_view_key} xs={24} sm={12} md={12} lg={8} xl={6}>
                                    <Card size="small" bordered hoverable style={{ height: '100%' }}>
                                        {/* Display Frontend Serial Number */}
                                        <div style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #f0f0f0' }}>
                                            <Text strong style={{ fontSize: '20px', color: '#007bff' }}>{frontendSNo}.</Text>
                                        </div>
                                        {/* Iterate over schema to display key-value pairs, excluding 'serial_num' */}
                                        {schema
                                            .filter(col => col.name !== 'serial_num') 
                                            .map((col) => (
                                            <div key={col.name} style={{ marginBottom: '6px', borderBottom: '1px dashed #eee', paddingBottom: '4px' }}>
                                                {/* Display Column Name (maybe highlight PK) */}
                                                <Text strong style={{ display: 'block', fontSize: '11px', color: '#555', marginBottom: '2px' }}>
                                                    {col.name}
                                                    {col.isPrimaryKey && <Tag color="blue" style={{ marginLeft: 4, transform: 'scale(0.8)' }}>PK</Tag>}
                                                </Text>
                                                {/* Display Formatted Value */}
                                                <Tooltip title={String(row[col.name] ?? 'NULL')} placement="topLeft">
                                                    <Paragraph style={{ margin: 0, fontSize: '12px', wordBreak: 'break-word' }} ellipsis={{ rows: 2, expandable: false }}>
                                                        {formatDisplayValue(row[col.name], col.type)}
                                                    </Paragraph>
                                                </Tooltip>
                                            </div>
                                        ))}
                                    </Card>
                                </Col>
                                );
                            })}
                        </Row>
                    )}
                </Spin>
            </div>

            {/* Pagination controls */}
            {!loadingData && totalRows > 0 && ( 
                <div style={{ marginTop: '16px', textAlign: 'center', flexShrink: 0, padding: '10px 0' }}>
                    <Pagination
                        current={currentPage}
                        pageSize={pageSize} 
                        total={totalRows}
                        onChange={handlePaginationChange} 
                        showSizeChanger={true} 
                        pageSizeOptions={['8', '12', '16', '20', '24']} 
                        showQuickJumper={true}
                        size="small"
                        disabled={loadingData}
                        showTotal={(total, range) => { 
                            const start = (currentPage - 1) * pageSize + 1;
                            const end = start + data.length - 1;
                            if (total === 0) return '0 items';
                            if (data.length === 0) return `0 of ${total} items`; 
                            return `${start}-${end} of ${total} items`;
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default GalleryView;