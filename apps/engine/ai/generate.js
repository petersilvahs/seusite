/**
 * Gerador de Sites com IA (Google Gemini API)
 * Lê um briefing em texto livre e gera um site completo pronto para publicação.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SYSTEM_PROMPT_COPYWRITER } from './prompts.js';
import { compileClientSite } from '../compiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

/**
 * Carregador simples de variáveis do arquivo .env
 */
function loadEnv() {
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

/**
 * Chama a API do Gemini com fallback automático de modelos
 */
async function callGemini(apiKey, briefingText) {
  const candidateModels = [
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ];

  const prompt = `
Briefing do Cliente:
"""
${briefingText}
"""

Gere o JSON completo e válido para esse cliente seguindo rigorosamente as diretrizes e o schema especificado.
Responda APENAS com o bloco JSON puro, sem textos adicionais antes ou depois.
`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: SYSTEM_PROMPT_COPYWRITER },
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      responseMimeType: 'application/json'
    }
  };

  let lastError = null;

  for (const model of candidateModels) {
    try {
      console.log(`📡 Tentando modelo: ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25000)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`⚠️ Modelo ${model} retornou ${res.status}. Tentando próximo...`);
        lastError = new Error(`Falha no modelo ${model} (${res.status}): ${errorText}`);
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        lastError = new Error('A IA não retornou conteúdo válido.');
        continue;
      }

      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      return JSON.parse(cleanJson);

    } catch (err) {
      console.warn(`⚠️ Erro com ${model}: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error('Não foi possível gerar com nenhum dos modelos.');
}

async function main() {
  const env = loadEnv();
  const apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('\n❌ GEMINI_API_KEY não configurada no arquivo .env!');
    console.error('👉 Abra o arquivo .env e adicione sua chave: GEMINI_API_KEY=AIzaSy...');
    console.error('👉 Obtenha sua chave gratuita em: https://aistudio.google.com\n');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  let briefing = args.join(' ').trim();

  if (!briefing) {
    console.log('\n📝 Nenhum briefing passado. Usando exemplo de demonstração...');
    briefing = `Dr. Lucas Carvalho, Cirurgião-Dentista e Especialista em Implantes e Lentes de Contato Dental. Consultório em Copacabana, Rio de Janeiro - RJ. CRO-RJ 48920. Procedimentos: Implantes Guiados, Lentes de Resina e Porcelana, Clareamento a Laser, Próteses Dentárias. WhatsApp: 21991234567. Cores preferidas: Azul Marinho e Dourado. Foco em pacientes exigentes e sem dor.`;
  }

  console.log(`\n🤖 Conectando à IA do Gemini para gerar o site...`);
  console.log(`📋 Briefing: "${briefing}"\n`);

  try {
    const clientData = await callGemini(apiKey, briefing);
    
    const clientId = (clientData.id || clientData.profile?.name || 'cliente')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    clientData.id = clientId;

    const configPath = path.join(projectRoot, 'configs', 'clients', `${clientId}.json`);
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(clientData, null, 2), 'utf-8');
    console.log(`💾 Configuração gerada e salva em: configs/clients/${clientId}.json`);

    console.log(`🔨 Compilando páginas e estilos para ${clientId}...`);
    const result = compileClientSite(clientData, projectRoot);

    console.log(`\n🎉 Site gerado com sucesso pela IA!`);
    console.log(`📍 Arquivo: ${result.outputPath}`);
    console.log(`🌐 Para visualizar: npx serve sites-output/${clientId} -l 3000\n`);

  } catch (err) {
    console.error('\n❌ Erro durante a geração do site:', err.message);
    process.exit(1);
  }
}

main();
