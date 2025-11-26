import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Your project ID
const projectId = 'fruitsforyou-10acc';
const bucketName = 'gs://fruitsforyou-backups';
const date = new Date().toISOString().split('T')[0];

const command = `gcloud firestore export ${bucketName}/firestore-backup-${date} --project=${projectId}`;

console.log('Starting Firestore backup...');
exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Backup failed:', error);
    return;
  }
  console.log('✅ Backup successful!');
  console.log('Location:', `${bucketName}/firestore-backup-${date}`);
});