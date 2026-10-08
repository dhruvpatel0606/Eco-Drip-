import fs from 'fs';
import path from 'path';

function getFilesList(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const files = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.endsWith(':-')) {
      files.push(line.slice(0, -2));
    }
  }
  return files;
}

const allCodeFiles = getFilesList('all_code.txt');
const allAppCodeFiles = getFilesList('all_app_code.txt');

console.log('all_code.txt files count:', allCodeFiles.length);
console.log('all_code.txt files list:', allCodeFiles);
console.log('all_app_code.txt files count:', allAppCodeFiles.length);
console.log('all_app_code.txt files list:', allAppCodeFiles);
