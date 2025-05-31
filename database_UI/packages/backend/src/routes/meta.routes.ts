import express from 'express';
import * as metaController from '../controllers/meta.controller'; 

const router = express.Router();

router.get('/databases', metaController.getDatabases);
router.post('/databases', metaController.createDatabase);
router.get('/databases/:dbId', metaController.getDatabaseName);            
router.patch('/databases/:dbId', metaController.renameUserDatabase); 
router.delete('/databases/:dbId', metaController.deleteUserDatabase); 
router.get('/databases/:dbId/tables', metaController.listTables);                    
router.post('/databases/:dbId/tables', metaController.addTable);                     
router.get('/databases/:dbId/tables/:tableName/schema', metaController.getSchemaForTable); 
router.post('/databases/:dbId/tables/:tableName/columns', metaController.addColumnToTable); 
router.delete('/databases/:dbId/tables/:tableName', metaController.deleteTable);       
router.patch('/databases/:dbId/tables/:oldTableName', metaController.renameTable);     
router.delete('/databases/:dbId/tables/:tableName/columns/:columnName',metaController.deleteTableColumn);

export default router;