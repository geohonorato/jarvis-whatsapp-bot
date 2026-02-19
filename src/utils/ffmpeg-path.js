/**
 * Utilitário: detecta o caminho do FFmpeg
 * Funciona em Windows (ffmpeg-static npm) e Linux ARM (ffmpeg do sistema)
 */

const fs = require('fs');

function getFFmpegPath() {
    // 1. Variável de ambiente (prioridade máxima)
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
        return process.env.FFMPEG_PATH;
    }

    // 2. Tenta o pacote npm ffmpeg-static (funciona em Windows/x86 Linux)
    try {
        const staticPath = require('ffmpeg-static');
        if (staticPath && fs.existsSync(staticPath)) {
            return staticPath;
        }
    } catch (e) {
        // Pacote não instalado ou sem binário para esta arquitetura
    }

    // 3. Caminhos do sistema (Linux ARM / Docker)
    const systemPaths = ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
    for (const p of systemPaths) {
        if (fs.existsSync(p)) {
            console.log(`🎬 FFmpeg encontrado no sistema: ${p}`);
            return p;
        }
    }

    // 4. Fallback: assume que está no PATH
    console.warn('⚠️ FFmpeg não encontrado em caminhos conhecidos. Tentando "ffmpeg" do PATH...');
    return 'ffmpeg';
}

module.exports = { getFFmpegPath };
