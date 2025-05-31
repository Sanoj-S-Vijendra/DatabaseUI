import express from 'express';
import * as dataController from '../controllers/data.controller';
import upload from '../middleware/multer';

const router = express.Router();

router.get('/:dbId/tables/:tableName', dataController.getTableData);
router.post('/:dbId/tables/:tableName', dataController.addRow);
router.put('/:dbId/tables/:tableName/:pkValue', dataController.updateExistingRow);
router.delete('/:dbId/tables/:tableName/:pkValue', dataController.deleteExistingRow);
router.post(
    '/:dbId/tables/:tableName/upload',
    upload.single('file'),
    dataController.uploadTableData
);

export default router;