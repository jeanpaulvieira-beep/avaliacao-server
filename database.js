const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'avaliacao.db');

let db = null;

async function initDatabase() {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            department TEXT NOT NULL,
            email TEXT NOT NULL,
            admission_date TEXT NOT NULL,
            photo TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            period TEXT NOT NULL,
            quality INTEGER NOT NULL,
            productivity INTEGER NOT NULL,
            technical INTEGER NOT NULL,
            teamwork INTEGER NOT NULL,
            initiative INTEGER NOT NULL,
            punctuality INTEGER NOT NULL,
            leadership INTEGER NOT NULL,
            adaptability INTEGER NOT NULL,
            communication INTEGER NOT NULL,
            values_alignment INTEGER NOT NULL,
            final_score REAL NOT NULL,
            strengths TEXT,
            improvements TEXT,
            pdi TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )
    `);

    saveDatabase();
    return db;
}

function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

// Helper: convert sql.js result to array of objects
function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

function queryOne(sql, params = []) {
    const results = queryAll(sql, params);
    return results.length > 0 ? results[0] : null;
}

function runSql(sql, params = []) {
    db.run(sql, params);
    saveDatabase();
    const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0];
    const changes = db.getRowsModified();
    return { lastInsertRowid: lastId, changes };
}

// Query functions
const queries = {
    // Employees
    getAllEmployees() {
        return queryAll('SELECT * FROM employees ORDER BY name ASC');
    },

    getEmployeeById(id) {
        return queryOne('SELECT * FROM employees WHERE id = ?', [id]);
    },

    insertEmployee(data) {
        return runSql(
            `INSERT INTO employees (name, role, department, email, admission_date, photo)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [data.name, data.role, data.department, data.email, data.admission_date, data.photo]
        );
    },

    deleteEmployee(id) {
        return runSql('DELETE FROM employees WHERE id = ?', [id]);
    },

    // Evaluations
    getAllEvaluations() {
        return queryAll(`
            SELECT e.*, emp.name as employee_name, emp.role as employee_role, emp.department as employee_department
            FROM evaluations e
            LEFT JOIN employees emp ON e.employee_id = emp.id
            ORDER BY e.created_at DESC
        `);
    },

    getEvaluationById(id) {
        return queryOne(`
            SELECT e.*, emp.name as employee_name, emp.role as employee_role, emp.department as employee_department
            FROM evaluations e
            LEFT JOIN employees emp ON e.employee_id = emp.id
            WHERE e.id = ?
        `, [id]);
    },

    insertEvaluation(data) {
        return runSql(
            `INSERT INTO evaluations (employee_id, period, quality, productivity, technical, teamwork,
                initiative, punctuality, leadership, adaptability, communication, values_alignment,
                final_score, strengths, improvements, pdi)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.employee_id, data.period, data.quality, data.productivity, data.technical, data.teamwork,
             data.initiative, data.punctuality, data.leadership, data.adaptability, data.communication,
             data.values_alignment, data.final_score, data.strengths, data.improvements, data.pdi]
        );
    },

    deleteEvaluation(id) {
        return runSql('DELETE FROM evaluations WHERE id = ?', [id]);
    },

    deleteEvaluationsByEmployeeId(employeeId) {
        return runSql('DELETE FROM evaluations WHERE employee_id = ?', [employeeId]);
    },

    // Dashboard
    countEmployees() {
        return queryOne('SELECT COUNT(*) as total FROM employees');
    },

    countEvaluations() {
        return queryOne('SELECT COUNT(*) as total FROM evaluations');
    },

    averageScore() {
        return queryOne('SELECT AVG(final_score) as avg_score FROM evaluations');
    },

    evaluatedEmployeeIds() {
        return queryAll('SELECT DISTINCT employee_id FROM evaluations');
    },

    recentEvaluations() {
        return queryAll(`
            SELECT e.*, emp.name as employee_name, emp.role as employee_role
            FROM evaluations e
            LEFT JOIN employees emp ON e.employee_id = emp.id
            ORDER BY e.created_at DESC
            LIMIT 5
        `);
    }
};

module.exports = { initDatabase, queries, saveDatabase };
