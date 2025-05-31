
import multer from 'multer';

const storage = multer.memoryStorage();


const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    
    console.log(`[Multer Filter] Processing file: name='${file.originalname}', mimetype='${file.mimetype}'`);
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
        console.log(`[Multer Filter] Accepting file.`);
        cb(null, true);
    } else {
        console.log(`[Multer Filter] REJECTING file.`);
        
        cb(null, false); 
        
    }
};
const limits = {
    fileSize: 50 * 1024 * 1024,
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: limits,
});

export default upload;