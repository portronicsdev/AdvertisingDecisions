const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Converts Excel file to CSV
 * @param {string} excelPath - Path to Excel file
 * @param {string} outputDir - Directory to save CSV file
 * @returns {Promise<string>} Path to created CSV file
 */
async function excelToCsv(excelPath, outputDir) {
    try {
        // Read Excel file
        const workbook = XLSX.readFile(excelPath);
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to CSV
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        
        // Generate output filename
        const excelBasename = path.basename(excelPath, path.extname(excelPath));
        const csvPath = path.join(outputDir, `${excelBasename}.csv`);
        
        // Write CSV file
        fs.writeFileSync(csvPath, csv, 'utf8');
        
        // Verify file was created
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file was not created at ${csvPath}`);
        }
        
        const stats = fs.statSync(csvPath);
        console.log(`✅ Converted ${excelPath} to ${csvPath} (${stats.size} bytes)`);
        return csvPath;
    } catch (error) {
        console.error('❌ Error converting Excel to CSV:', error);
        throw error;
    }
}

module.exports = { excelToCsv };

