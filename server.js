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
      const [key, dateTime, result] = line.split(','); // Removed URL
      const tableName = key; // Use key directly as table name

      // Create table for the key if it doesn't exist
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id INT AUTO_INCREMENT PRIMARY KEY,
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
        const insertQuery = `INSERT INTO ${tableName} (created_at, result) VALUES (?, ?)`;
        db.query(insertQuery, [dateTime, result], (err, results) => {
          if (err) {
            console.error('Error inserting into database: ' + err.stack);
            return;
          }
          console.log(`Inserted health check result into database for key: ${key}`);
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

    let processedTables = 0;
    tableNames.forEach((tableName) => {
      const tableQuery = `SELECT * FROM ${tableName}`;
      db.query(tableQuery, (err, tableResults) => {
        if (err) {
          console.error('Error querying table: ' + err.stack);
          processedTables++;
          return;
        }

        // Add the table name (key) to each result
        tableResults.forEach(row => {
          results.push({ key: tableName, ...row });
        });

        processedTables++;
        if (processedTables === tableNames.length) {
          res.json(results);
        }
      });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});