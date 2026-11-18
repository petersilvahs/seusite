/**
 * CLI de Execução do Motor SeuSite
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileClientSite } from './compiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

function run() {
  const targetClient = process.argv[2]; // ex: node apps/engine/index.js dra-brenda-santos
  const clientsDir = path.join(projectRoot, 'configs', 'clients');

  if (!fs.existsSync(clientsDir)) {
    console.error(`❌ Diretório de clientes não encontrado: ${clientsDir}`);
    process.exit(1);
  }

  const clientFiles = fs.readdirSync(clientsDir).filter(f => f.endsWith('.json'));

  if (clientFiles.length === 0) {
    console.log('⚠️ Nenhum cliente configurado em configs/clients/');
    return;
  }

  console.log(`\n🚀 SeuSite Engine - Iniciando compilação de sites...\n`);

  let count = 0;
  for (const file of clientFiles) {
    const filePath = path.join(clientsDir, file);
    const clientData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (targetClient && clientData.id !== targetClient) {
      continue;
    }

    try {
      const result = compileClientSite(clientData, projectRoot);
      console.log(`✅ [${clientData.id}] Site gerado com sucesso!`);
      console.log(`   📂 Arquivo: ${result.outputPath}\n`);
      count++;
    } catch (err) {
      console.error(`❌ Erro ao compilar ${clientData.id}:`, err.message);
    }
  }

  console.log(`✨ Total de sites gerados: ${count}`);
  console.log(`👉 Para visualizar localmente o site da Dra. Brenda, execute:`);
  console.log(`   npm run preview\n`);
}

run();
