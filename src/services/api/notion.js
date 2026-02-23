require('dotenv').config();
const axios = require('axios');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = '2022-06-28';
const BASE_URL = 'https://api.notion.com/v1';

const getHeaders = () => ({
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
});

/**
 * Busca blocos textuais de uma página recursivamente
 * Lida com toggles, colunas, callouts e blocos não suportados (ex: Transcrição AI)
 */
async function getPageTextContent(blockId, depth = 0) {
    if (depth > 2) return ''; // Previne recursão infinita (limita a 3 níveis)

    try {
        const response = await axios.get(`${BASE_URL}/blocks/${blockId}/children`, { headers: getHeaders() });
        const blocks = response.data.results;

        let textContent = '';
        for (const block of blocks) {
            // Processa o texto do próprio bloco (se suportado)
            if (block.type === 'paragraph' && block.paragraph.rich_text) {
                textContent += block.paragraph.rich_text.map(t => t.plain_text).join('') + '\n';
            } else if (block.type.includes('heading') && block[block.type].rich_text) {
                textContent += '\n' + block[block.type].rich_text.map(t => t.plain_text).join('') + '\n';
            } else if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
                if (block[block.type].rich_text) {
                    textContent += '- ' + block[block.type].rich_text.map(t => t.plain_text).join('') + '\n';
                }
            } else if (block.type === 'to_do') {
                if (block.to_do.rich_text) {
                    const checked = block.to_do.checked ? '[x]' : '[ ]';
                    textContent += `${checked} ` + block.to_do.rich_text.map(t => t.plain_text).join('') + '\n';
                }
            } else if (block.type === 'code') {
                if (block.code.rich_text) {
                    textContent += '\n`' + block.code.rich_text.map(t => t.plain_text).join('') + '`\n';
                }
            } else if (block.type === 'quote' || block.type === 'callout') {
                if (block[block.type].rich_text) {
                    textContent += '> ' + block[block.type].rich_text.map(t => t.plain_text).join('') + '\n';
                }
            } else if (block.type === 'toggle') {
                if (block.toggle.rich_text) {
                    textContent += '> ' + block.toggle.rich_text.map(t => t.plain_text).join('') + '\n';
                }
            } else if (block.type === 'unsupported') {
                textContent += '\n[MÍDIA/RECURSO NÃO SUPORTADO PELA API DO NOTION NESTE BLOCO]\n';
            }

            // Busca os filhos, se houver (ex: blocos dentro de Colunas, Toggles ou Synced Blocks)
            if (block.has_children && block.type !== 'child_page' && block.type !== 'child_database') {
                const childText = await getPageTextContent(block.id, depth + 1);
                if (childText) {
                    textContent += childText + '\n';
                }
            }
        }
        return textContent.trim();
    } catch (e) {
        // Trata erro de extração onde a API do Notion emite Validation Error (ex: transcription blocks não autorizados)
        if (e.response && e.response.status === 400 && e.response.data.code === 'validation_error') {
            return '\n[CONTEÚDO BLOQUEADO PELO NOTION: ' + e.response.data.message + ']\n';
        }
        console.error(`Erro ao ler conteúdo do bloco ${blockId}:`, e.message);
        return null;
    }
}

/**
 * Pesquisa global no Notion
 */
async function search(query) {
    try {
        const response = await axios.post(`${BASE_URL}/search`, { query }, { headers: getHeaders() });
        const results = response.data.results;

        // Extrai conteúdo das 2 primeiras páginas para ter contexto nas respostas
        if (results && results.length > 0) {
            let extractedCount = 0;
            for (let i = 0; i < results.length && extractedCount < 2; i++) {
                if (results[i].object === 'page') {
                    const content = await getPageTextContent(results[i].id);
                    if (content) {
                        results[i].extracted_content = content;
                    }
                    extractedCount++;
                }
            }
        }

        return { success: true, data: results };
    } catch (e) {
        console.error('Erro na pesquisa do Notion:', e.response?.data || e.message);
        return { success: false, error: e.response?.data?.message || e.message };
    }
}

/**
 * Cria uma nova página em um banco de dados
 */
async function createPage(databaseId, title, properties = {}) {
    try {
        const payload = {
            parent: { database_id: databaseId },
            properties: {
                Name: { title: [{ text: { content: title } }] },
                ...properties
            }
        };
        const response = await axios.post(`${BASE_URL}/pages`, payload, { headers: getHeaders() });
        return { success: true, data: response.data };
    } catch (e) {
        console.error('Erro ao criar página no Notion:', e.response?.data || e.message);
        return { success: false, error: e.response?.data?.message || e.message };
    }
}

/**
 * Adiciona blocos (conteúdo) a uma página existente
 */
async function appendBlocks(pageId, children) {
    try {
        const payload = { children };
        const response = await axios.patch(`${BASE_URL}/blocks/${pageId}/children`, payload, { headers: getHeaders() });
        return { success: true, data: response.data };
    } catch (e) {
        console.error('Erro ao adicionar blocos no Notion:', e.response?.data || e.message);
        return { success: false, error: e.response?.data?.message || e.message };
    }
}

/**
 * Consulta um banco de dados com filtros opcionais
 */
async function queryDatabase(databaseId, filter = null, sorts = null) {
    try {
        const payload = {};
        if (filter) payload.filter = filter;
        if (sorts) payload.sorts = sorts;

        const response = await axios.post(`${BASE_URL}/databases/${databaseId}/query`, payload, { headers: getHeaders() });
        return { success: true, data: response.data.results };
    } catch (e) {
        console.error('Erro ao consultar banco de dados no Notion:', e.response?.data || e.message);
        return { success: false, error: e.response?.data?.message || e.message };
    }
}

module.exports = {
    search,
    createPage,
    appendBlocks,
    queryDatabase,
    isReady: () => !!NOTION_API_KEY
};
