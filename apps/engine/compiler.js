/**
 * Compilador de Templates do SeuSite
 * Injeta o JSON do cliente no template HTML com suporte a loops e variáveis aninhadas.
 */

import fs from 'fs';
import path from 'path';

/**
 * Obtém valor aninhado em um objeto usando notação de ponto (ex: 'profile.name')
 */
function getNestedValue(obj, pathStr) {
  if (pathStr === '.') return obj;
  return pathStr.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : ''), obj);
}

/**
 * Renderiza loops simples no formato {{#lista}}...{{/lista}}
 */
function renderLoops(template, data) {
  const loopRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

  return template.replace(loopRegex, (match, arrayKey, innerContent) => {
    const list = data[arrayKey];
    if (!Array.isArray(list) || list.length === 0) return '';

    return list.map(item => {
      let itemHtml = innerContent;

      // Suporte a loops aninhados dentro do item (ex: highlights dentro de services)
      const nestedLoopRegex = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
      itemHtml = itemHtml.replace(nestedLoopRegex, (nMatch, nKey, nInner) => {
        const nestedList = item[nKey];
        if (!Array.isArray(nestedList)) return '';
        return nestedList.map(nestedItem => {
          if (typeof nestedItem === 'string') {
            return nInner.replace(/\{\{\.\}\}/g, nestedItem);
          }
          return renderVariables(nInner, nestedItem, data);
        }).join('');
      });

      // Substitui variáveis do próprio item
      itemHtml = renderVariables(itemHtml, item, data);

      return itemHtml;
    }).join('');
  });
}

/**
 * Substitui tags {{caminho.da.variavel}}
 */
function renderVariables(template, currentContext, rootContext = currentContext) {
  const varRegex = /\{\{([\w\.]+)\}\}/g;

  return template.replace(varRegex, (match, varPath) => {
    if (varPath === '.') return currentContext;

    // Primeiro tenta buscar no contexto atual (item da iteração)
    let val = getNestedValue(currentContext, varPath);
    if (val !== '') return val;

    // Depois tenta buscar no contexto raiz
    val = getNestedValue(rootContext, varPath);
    return val !== undefined ? val : '';
  });
}

/**
 * Compila o site do cliente e salva em sites-output/<cliente-id>/index.html
 */
export function compileClientSite(clientConfig, baseDir) {
  // Prepara dados derivados (como o link completo do WhatsApp)
  const phoneClean = clientConfig.contact.whatsapp ? clientConfig.contact.whatsapp.replace(/\D/g, '') : '';
  const phoneWithCountry = phoneClean.startsWith('55') ? phoneClean : `55${phoneClean}`;
  const encodedMsg = encodeURIComponent(clientConfig.contact.whatsappMessage || 'Olá! Gostaria de mais informações.');
  const encodedRentMsg = encodeURIComponent(clientConfig.contact.whatsappRentMessage || clientConfig.contact.whatsappMessage || 'Olá! Gostaria de alugar o estúdio.');
  const encodedProdMsg = encodeURIComponent(clientConfig.contact.whatsappProductionMessage || clientConfig.contact.whatsappMessage || 'Olá! Gostaria de solicitar um orçamento para produção audiovisual.');
  
  const enrichedData = {
    ...clientConfig,
    contact: {
      ...clientConfig.contact,
      whatsappClean: phoneWithCountry,
      whatsappUrl: `https://wa.me/${phoneWithCountry}?text=${encodedMsg}`,
      whatsappRentUrl: `https://wa.me/${phoneWithCountry}?text=${encodedRentMsg}`,
      whatsappProductionUrl: `https://wa.me/${phoneWithCountry}?text=${encodedProdMsg}`
    }
  };

  const templatePath = path.join(baseDir, 'templates', enrichedData.template, 'template.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template não encontrado: ${templatePath}`);
  }

  const templateHtml = fs.readFileSync(templatePath, 'utf-8');

  // 1. Processa loops primeiro
  let compiledHtml = renderLoops(templateHtml, enrichedData);

  // 2. Processa variáveis restantes
  compiledHtml = renderVariables(compiledHtml, enrichedData);

  // 3. Salva no diretório de saída
  const outputDir = path.join(baseDir, 'sites-output', enrichedData.id);
  fs.mkdirSync(outputDir, { recursive: true });

  // Copia assets dedicados do cliente se existirem
  const clientAssetsDir = path.join(baseDir, 'configs', 'clients', 'assets', enrichedData.id);
  const outputAssetsDir = path.join(outputDir, 'assets');
  if (fs.existsSync(clientAssetsDir)) {
    fs.mkdirSync(outputAssetsDir, { recursive: true });
    fs.cpSync(clientAssetsDir, outputAssetsDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(outputPath, compiledHtml, 'utf-8');

  // Salva também o site-data.json junto para fácil edição/backup
  fs.writeFileSync(path.join(outputDir, 'site-data.json'), JSON.stringify(enrichedData, null, 2), 'utf-8');

  return {
    outputDir,
    outputPath,
    clientId: enrichedData.id
  };
}

