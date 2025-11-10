# ⚠️ Importante: credentials.json

## O que é?

O arquivo `credentials.json` contém as credenciais da Service Account do Google Calendar. Este arquivo é **OBRIGATÓRIO** para que o bot acesse a agenda do Google Calendar.

---

## 🔒 Segurança

**NUNCA commite este arquivo no Git!**

O `.gitignore` já está configurado para ignorar `.env`, mas você também deve garantir que `credentials.json` não seja enviado para o GitHub.

---

## 📦 Como fazer deploy com credentials.json

### Opção 1: Variável de Ambiente (RECOMENDADO)

Converta o conteúdo do arquivo para uma string e adicione como variável de ambiente:

```bash
# No Railway, Render ou Fly.io, adicione:
GOOGLE_CREDENTIALS='{"type":"service_account","project_id":"..."}'
```

Depois, modifique o código para ler da variável:

```javascript
// src/services/api/calendar.js
const credentials = process.env.GOOGLE_CREDENTIALS 
  ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
  : require('../../credentials.json');
```

### Opção 2: Upload Manual (Railway/Render)

1. Faça deploy normalmente
2. Use a interface da plataforma para fazer upload do arquivo
3. Coloque-o na raiz do projeto

### Opção 3: Secret File (Fly.io)

```bash
flyctl secrets set GOOGLE_CREDENTIALS="$(cat credentials.json)"
```

---

## 🔧 Atualização Recomendada do Código

Para facilitar o deploy, vou criar uma versão do calendar.js que suporta variável de ambiente:

```javascript
// Início do arquivo src/services/api/calendar.js
const credentials = (() => {
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      return JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } catch (e) {
      console.error('❌ Erro ao parsear GOOGLE_CREDENTIALS:', e);
      process.exit(1);
    }
  }
  
  // Fallback para arquivo local
  const fs = require('fs');
  const path = require('path');
  const credPath = path.join(process.cwd(), 'credentials.json');
  
  if (!fs.existsSync(credPath)) {
    console.error('❌ credentials.json não encontrado e GOOGLE_CREDENTIALS não definida!');
    process.exit(1);
  }
  
  return require('../../credentials.json');
})();
```

---

## 📝 Passo a Passo para Railway

### 1. Converter credentials.json para string

**Windows PowerShell:**
```powershell
$content = Get-Content credentials.json -Raw
$content = $content -replace "`r`n", "" -replace "`n", ""
Write-Output $content
```

**Linux/Mac:**
```bash
cat credentials.json | tr -d '\n'
```

### 2. Copiar o output (toda a linha)

### 3. No Railway

1. Vá em **Variables**
2. Adicione nova variável:
   - **Key:** `GOOGLE_CREDENTIALS`
   - **Value:** Cole o conteúdo copiado (JSON minificado)
3. Clique em **Add**

### 4. Redeploy

O bot será reiniciado automaticamente e usará a variável de ambiente.

---

## ✅ Verificação

Após o deploy, verifique os logs:

```
✅ Google Calendar autenticado com sucesso!
```

Se aparecer erro como:
```
❌ credentials.json não encontrado
```

Significa que você precisa adicionar a variável `GOOGLE_CREDENTIALS`.

---

## 🆘 Troubleshooting

### Erro: "invalid_grant"
- As credenciais expiraram ou são inválidas
- Gere novas credenciais no Google Cloud Console

### Erro: "Permission denied"
- Verifique se a Service Account tem acesso ao calendário
- Compartilhe o calendário com o email da Service Account

### Erro: "JSON parse error"
- Verifique se a string GOOGLE_CREDENTIALS está correta
- Não deve ter quebras de linha ou caracteres especiais

---

## 📚 Links Úteis

- [Google Cloud Console](https://console.cloud.google.com/)
- [Criar Service Account](https://cloud.google.com/iam/docs/creating-managing-service-accounts)
- [Google Calendar API](https://developers.google.com/calendar)

---

**Dica:** Mantenha uma cópia de backup do `credentials.json` em local seguro!
