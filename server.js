const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
const port = 3030;

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
  
  
// Read logs from the log file and serve it to the front-end
app.get('/status', (req, res) => {
  const logs = fs.readFileSync('./logs/key_report.log', 'utf8');
  res.send(logs);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
