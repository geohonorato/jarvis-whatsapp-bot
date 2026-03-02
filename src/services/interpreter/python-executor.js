/**
 * Python Code Interpreter
 * Executa código Python e detecta saída visual (gráficos matplotlib).
 * 
 * Funcionalidades:
 * - Execução segura com timeout de 30s
 * - Detecção automática de gráficos matplotlib → salva como PNG
 * - Retorna { text, imagePath } para envio via WhatsApp
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEMP_DIR = path.join(__dirname, '../../../temp/scripts');
const CHART_DIR = path.join(__dirname, '../../../temp/charts');

// Garante que as pastas temporárias existem
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}
if (!fs.existsSync(CHART_DIR)) {
    fs.mkdirSync(CHART_DIR, { recursive: true });
}

/**
 * Injeta código no script Python para auto-salvar gráficos matplotlib.
 * - Ativa backend Agg (não precisa de GUI)
 * - Faz monkey-patch do plt.show() para salvar em arquivo
 * - Salva com DPI alto (200) para qualidade HD
 */
function injectMatplotlibSave(code, chartPath) {
    // Só injeta se o código usa matplotlib
    if (!code.includes('matplotlib') && !code.includes('plt.') && !code.includes('plt ')) {
        return code;
    }

    const injection = `
# === AUTO-INJECT: Salvar gráficos em arquivo ===
import matplotlib
matplotlib.use('Agg')  # Backend sem GUI
import matplotlib.pyplot as plt

_original_show = plt.show
_chart_path = r"${chartPath.replace(/\\/g, '\\\\')}"
_chart_saved = False

def _custom_show(*args, **kwargs):
    global _chart_saved
    plt.savefig(_chart_path, dpi=300, bbox_inches='tight', facecolor='white', edgecolor='none')
    _chart_saved = True
    print("[CHART_SAVED]")

plt.show = _custom_show

# Se não chamar plt.show(), salvar no final
import atexit
def _save_on_exit():
    global _chart_saved
    if not _chart_saved and plt.get_fignums():
        plt.savefig(_chart_path, dpi=300, bbox_inches='tight', facecolor='white', edgecolor='none')
        print("[CHART_SAVED]")
atexit.register(_save_on_exit)
# === FIM AUTO-INJECT ===

`;
    return injection + code;
}

/**
 * Executa código Python arbitrário e retorna o resultado.
 * @param {string} code - O código Python a ser executado.
 * @returns {Promise<{text: string, imagePath: string|null}>}
 */
async function executePythonCode(code) {
    return new Promise((resolve, reject) => {
        const scriptId = crypto.randomBytes(4).toString('hex');
        const scriptName = `script_${scriptId}.py`;
        const scriptPath = path.join(TEMP_DIR, scriptName);
        const chartPath = path.join(CHART_DIR, `chart_${scriptId}.png`);

        // Remove blocos de código markdown se existirem
        let cleanCode = code.replace(/```python/g, '').replace(/```/g, '').trim();

        // Injeta lógica de salvar gráficos
        cleanCode = injectMatplotlibSave(cleanCode, chartPath);

        // Salva o código em arquivo
        fs.writeFileSync(scriptPath, cleanCode, 'utf-8');

        // Executa com timeout de 30 segundos
        const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
        exec(`${pythonCommand} "${scriptPath}"`, { timeout: 30000 }, (error, stdout, stderr) => {
            // Limpa o script temporário
            try {
                fs.unlinkSync(scriptPath);
            } catch (e) {
                console.error('Erro ao limpar script temporário:', e);
            }

            // Verifica se gerou gráfico
            let imagePath = null;
            if (fs.existsSync(chartPath)) {
                imagePath = chartPath;
                console.log(`📊 Gráfico detectado: ${chartPath}`);
            }

            if (error) {
                if (error.signal === 'SIGTERM') {
                    return resolve({
                        text: '⏱️ Timeout: O script demorou muito para executar (max 30s).',
                        imagePath
                    });
                }

                const errorMessage = stderr || error.message;
                return resolve({
                    text: `❌ Erro no código:\n${errorMessage.substring(0, 1500)}`,
                    imagePath
                });
            }

            const output = stdout.trim() || stderr.trim() || '✅ Código executado com sucesso.';
            resolve({
                text: output.substring(0, 2000),
                imagePath
            });
        });
    });
}

module.exports = { executePythonCode };
