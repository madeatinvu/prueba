const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const mysql = require('mysql2');

const app = express();
const port = 3030;

// Database connection
const db = mysql.createConnection({
  host: 'streamlittest.cluster-cxb7mqzhrxh1.us-east-1.rds.amazonaws.com',
  user: 'uptime',
  password: 'NbXpYdhj7D36uCBWaEws5f',
  database: 'uptime'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySql: ' + err.stack);
    return;
  }
  console.log('MySql Connected...');
});

// Serve static files (HTML, CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Function to sanitize table names
function sanitizeTableName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

// Run health check script every minute
cron.schedule('* * * * *', () => {
  exec('./health-check.sh', (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);

    // Process each line of the output
    const lines = stdout.trim().split('\n');
    lines.forEach(line => {
      const [url, dateTime, result] = line.split(',');
      const sanitizedTableName = sanitizeTableName(url);

      // Create table for the URL if it doesn't exist
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${sanitizedTableName} (
          id INT AUTO_INCREMENT PRIMARY KEY,
          url VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          result VARCHAR(50) NOT NULL
        )
      `;
      db.query(createTableQuery, (err) => {
        if (err) {
          console.error('Error creating table: ' + err.stack);
          return;
        }

        // Insert the result into the corresponding table
        const insertQuery = `INSERT INTO ${sanitizedTableName} (url, created_at, result) VALUES (?, ?, ?)`;
        db.query(insertQuery, [url, dateTime, result], (err, results) => {
          if (err) {
            console.error('Error inserting into database: ' + err.stack);
            return;
          }
          console.log(`Inserted health check result into database for URL: ${url}`);
        });
      });
    });
  });
});

app.get('/urls', (req, res) => {
  const urlsPath = path.join(__dirname, 'urls.cfg');
  if (fs.existsSync(urlsPath)) {
    const urls = fs.readFileSync(urlsPath, 'utf8');
    res.send(urls);
  } else {
    res.status(404).send('urls.cfg not found');
  }
});

// Read health check results from the database and serve it to the front-end
app.get('/status', (req, res) => {
  const query = 'SHOW TABLES';
  db.query(query, (err, tables) => {
    if (err) {
      console.error('Error querying database: ' + err.stack);
      res.status(500).send('Error querying database');
      return;
    }

    const tableNames = tables.map(table => Object.values(table)[0]);
    const results = [];

    tableNames.forEach((tableName, index) => {
      const tableQuery = `SELECT * FROM ${tableName}`;
      db.query(tableQuery, (err, tableResults) => {
        if (err) {
          console.error('Error querying table: ' + err.stack);
          return;
        }

        results.push(...tableResults);

        if (index === tableNames.length - 1) {
          res.json(results);
        }
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});