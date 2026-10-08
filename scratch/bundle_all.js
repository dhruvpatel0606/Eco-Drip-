import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

// Directories to ignore completely
const ignoredDirs = new Set([
  'node_modules',
  '.git',
  '.idea',
  '.vscode',
  'dist',
  'android',
  'scratch',
  'artifacts'
]);

// Files to ignore completely
const ignoredFiles = new Set([
  'package-lock.json',
  'all_code.txt',
  'all_app_code.txt',
  'docx_output.txt',
  'docx_output_utf8.txt',
  'ts_errors.txt',
  'app-debug.apk'
]);

// Allowed extensions
const allowedExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.rules', '.mjs', '.env', '.example', '.local', '.md'
]);

function getFilesRecursively(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const relPath = path.relative(rootDir, fullPath);
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      if (!ignoredDirs.has(file)) {
        getFilesRecursively(fullPath, fileList);
      }
    } else if (stats.isFile()) {
      const ext = path.extname(file);
      const isEnvFile = file.startsWith('.env');
      if (!ignoredFiles.has(file) && (allowedExtensions.has(ext) || isEnvFile)) {
        fileList.push(relPath);
      }
    }
  }
  return fileList;
}

const allFiles = getFilesRecursively(rootDir).sort();

console.log('Found files:', allFiles.length);
console.log(allFiles);

// Now write all files to all_code.txt
let bundleContent = '';
for (const file of allFiles) {
  const fullPath = path.join(rootDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  const headerPath = file.replace(/\//g, '\\');
  bundleContent += `${headerPath}:-\nCode:-\n${content}\n\n---\n\n`;
}

fs.writeFileSync('all_code.txt', bundleContent, 'utf8');
fs.writeFileSync('all_app_code.txt', bundleContent, 'utf8');
console.log('Successfully wrote to both all_code.txt and all_app_code.txt');
