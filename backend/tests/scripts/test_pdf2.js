const fs = require('fs');
const pdf = require('pdf-parse');

const dataBuffer = fs.readFileSync('../contexts/sample_report.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text.substring(0, 2000));
}).catch(e => console.log("Error:", e));
