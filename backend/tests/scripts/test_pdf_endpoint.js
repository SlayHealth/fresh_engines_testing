const http = require('http');
const fs = require('fs');
const path = require('path');

const matchId = 'c3a69bb9-6a6f-4a61-82b5-ef505f800c9d';
const expectedFilePath = path.resolve(__dirname, '../../../frontend/pdf_reports/SlayHealth_Premarital_Report_c3a69bb9-6a6f-4a61-82b5-ef505f800c9d.pdf');

// Clean up any pre-existing file
if (fs.existsSync(expectedFilePath)) {
  fs.unlinkSync(expectedFilePath);
}

const options = {
  hostname: 'localhost',
  port: 3001,
  path: `/api/compatibility/matches/${matchId}/pdf`,
  method: 'GET'
};

console.log('Sending GET request to local Express PDF endpoint...');
const req = http.request(options, (res) => {
  console.log('STATUS CODE:', res.statusCode);
  console.log('HEADERS:', res.headers);
  
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  
  res.on('end', () => {
    console.log('Response stream ended.');
    
    // Check if the file was created in frontend/pdf_reports
    setTimeout(() => {
      if (fs.existsSync(expectedFilePath)) {
        const stats = fs.statSync(expectedFilePath);
        console.log(`SUCCESS: PDF file found at: ${expectedFilePath}`);
        console.log(`File Size: ${stats.size} bytes`);
        process.exit(0);
      } else {
        console.error(`FAILURE: PDF file was NOT created at: ${expectedFilePath}`);
        process.exit(1);
      }
    }, 1000); // Give it a second to finish writing
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
  process.exit(1);
});

req.end();
