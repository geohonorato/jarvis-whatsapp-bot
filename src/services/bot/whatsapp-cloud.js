require('dotenv').config();
const axios = require('axios');

class WhatsAppCloudAPI {
    constructor() {
        this.token = process.env.WHATSAPP_TOKEN;
        this.phoneId = process.env.WHATSAPP_PHONE_ID;
        // Se caso esquecer de definir, avisa
        if (!this.token || !this.phoneId) {
            console.warn('⚠️ WhatsApp Cloud API missing config (WHATSAPP_TOKEN or WHATSAPP_PHONE_ID)');
        }
        
        this.client = axios.create({
            baseURL: \`https://graph.facebook.com/v21.0/\${this.phoneId}\`,
            headers: {
                'Authorization': \`Bearer \${this.token}\`,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Envia uma mensagem de texto simples
     * @param {string} to - Número no formato internacional (ex: 559199999999)
     * @param {string} text - Texto a ser enviado
     */
    async sendMessage(to, text) {
        try {
            const body = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: this._formatNumber(to),
                type: "text",
                text: { 
                    preview_url: true,
                    body: text 
                }
            };
            
            const response = await this.client.post('/messages', body);
            return response.data;
        } catch (error) {
            console.error('❌ Erro ao enviar mensagem Cloud API:', error.response?.data || error.message);
            throw error;
        }
    }
    
    /**
     * Marca uma mensagem recebida como lida
     * @param {string} messageId - ID da mensagem da Meta
     */
    async markAsRead(messageId) {
        try {
            const body = {
                messaging_product: "whatsapp",
                status: "read",
                message_id: messageId
            };
            await this.client.post('/messages', body);
        } catch (error) {
            console.warn('⚠️ Erro ao marcar como lida:', error.response?.data?.error?.message || error.message);
        }
    }

    /**
     * Formata um número para o padrão internacional (Remove @c.us etc)
     */
    _formatNumber(number) {
        return number.replace(/\D/g, ''); // Mantém apenas os dígitos da string
    }
}

// Wrapper instanciado igual ao client do whatsapp-web.js para minimizar impacto
const cloudClient = new WhatsAppCloudAPI();

module.exports = cloudClient;
