const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { initDatabase, queries } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, 'photo-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas (jpg, png, gif, webp)'));
        }
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// ============================================
// API Routes - Employees
// ============================================

// GET /api/employees - List all employees
app.get('/api/employees', (req, res) => {
    try {
        const employees = queries.getAllEmployees();
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/employees - Create employee (multipart/form-data)
app.post('/api/employees', upload.single('photo'), (req, res) => {
    try {
        const { name, role, department, email, admission_date } = req.body;

        if (!name || !role || !department || !email || !admission_date) {
            return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos' });
        }

        const photo = req.file ? req.file.filename : null;

        const result = queries.insertEmployee({
            name,
            role,
            department,
            email,
            admission_date,
            photo
        });

        const employee = queries.getEmployeeById(result.lastInsertRowid);
        res.status(201).json(employee);
    } catch (err) {
        // Clean up uploaded file on error
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/employees/:id - Delete employee
app.delete('/api/employees/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const employee = queries.getEmployeeById(id);

        if (!employee) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }

        // Delete photo file if exists
        if (employee.photo) {
            const photoPath = path.join(uploadsDir, employee.photo);
            fs.unlink(photoPath, () => {});
        }

        // Delete associated evaluations
        queries.deleteEvaluationsByEmployeeId(id);

        // Delete employee
        queries.deleteEmployee(id);

        res.json({ message: 'Funcionário excluído com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API Routes - Evaluations
// ============================================

// GET /api/evaluations - List all evaluations
app.get('/api/evaluations', (req, res) => {
    try {
        const evaluations = queries.getAllEvaluations();
        res.json(evaluations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/evaluations - Create evaluation
app.post('/api/evaluations', (req, res) => {
    try {
        const {
            employee_id, period,
            quality, productivity, technical, teamwork,
            initiative, punctuality, leadership, adaptability,
            communication, values_alignment,
            strengths, improvements, pdi
        } = req.body;

        if (!employee_id || !period) {
            return res.status(400).json({ error: 'Funcionário e período são obrigatórios' });
        }

        // Validate employee exists
        const employee = queries.getEmployeeById(parseInt(employee_id));
        if (!employee) {
            return res.status(404).json({ error: 'Funcionário não encontrado' });
        }

        // Validate all ratings
        const ratings = [quality, productivity, technical, teamwork, initiative,
            punctuality, leadership, adaptability, communication, values_alignment];

        if (ratings.some(r => !r || r < 1 || r > 5)) {
            return res.status(400).json({ error: 'Todos os critérios devem ser avaliados (1-5)' });
        }

        const final_score = ratings.reduce((sum, r) => sum + Number(r), 0) / 10;

        const result = queries.insertEvaluation({
            employee_id: Number(employee_id),
            period,
            quality: Number(quality),
            productivity: Number(productivity),
            technical: Number(technical),
            teamwork: Number(teamwork),
            initiative: Number(initiative),
            punctuality: Number(punctuality),
            leadership: Number(leadership),
            adaptability: Number(adaptability),
            communication: Number(communication),
            values_alignment: Number(values_alignment),
            final_score,
            strengths: strengths || null,
            improvements: improvements || null,
            pdi: pdi || null
        });

        const evaluation = queries.getEvaluationById(result.lastInsertRowid);
        res.status(201).json(evaluation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/evaluations/:id - Get evaluation details
app.get('/api/evaluations/:id', (req, res) => {
    try {
        const evaluation = queries.getEvaluationById(parseInt(req.params.id));
        if (!evaluation) {
            return res.status(404).json({ error: 'Avaliação não encontrada' });
        }
        res.json(evaluation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/evaluations/:id - Delete evaluation
app.delete('/api/evaluations/:id', (req, res) => {
    try {
        const evaluation = queries.getEvaluationById(parseInt(req.params.id));
        if (!evaluation) {
            return res.status(404).json({ error: 'Avaliação não encontrada' });
        }

        queries.deleteEvaluation(parseInt(req.params.id));
        res.json({ message: 'Avaliação excluída com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API Routes - Dashboard
// ============================================

// GET /api/dashboard - Dashboard metrics
app.get('/api/dashboard', (req, res) => {
    try {
        const totalEmployees = queries.countEmployees().total;
        const totalEvaluations = queries.countEvaluations().total;
        const avgResult = queries.averageScore();
        const averageScore = avgResult.avg_score ? Number(Number(avgResult.avg_score).toFixed(1)) : null;
        const evaluatedIds = queries.evaluatedEmployeeIds();
        const pendingEvaluations = totalEmployees - evaluatedIds.length;
        const recentEvaluations = queries.recentEvaluations();

        res.json({
            totalEmployees,
            totalEvaluations,
            pendingEvaluations: Math.max(0, pendingEvaluations),
            averageScore,
            recentEvaluations
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// Fallback - Serve SPA
// ============================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling for multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Arquivo muito grande. Máximo 5MB.' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(500).json({ error: err.message });
    }
    next();
});

// Initialize database and start server
async function start() {
    try {
        await initDatabase();
        console.log('Banco de dados SQLite inicializado com sucesso.');
        
        app.listen(PORT, () => {
            console.log(`Servidor rodando em http://localhost:${PORT}`);
            console.log(`Diretório de uploads: ${uploadsDir}`);
        });
    } catch (err) {
        console.error('Erro ao inicializar o banco de dados:', err);
        process.exit(1);
    }
}

start();
