import { promises as fs } from 'fs';

export async function readTxtFile(filePath: string): Promise<string> {
    if (!filePath.endsWith('.txt')) {
        throw new Error('Only .txt files are supported.');
    }
    return await fs.readFile(filePath, 'utf-8');
}