/**
 * Finance Charts — gera gráficos financeiros usando matplotlib via python-executor
 * Produz gráficos de pizza (categorias), barras (top gastos) e linha (acumulado)
 */

const { executePythonCode } = require('../interpreter/python-executor');

/**
 * Gera gráficos financeiros a partir dos dados do FinanceTracker
 * @param {object} chartData - Dados de generateChartData()
 * @returns {Promise<string[]>} - Array de caminhos das imagens geradas
 */
async function gerarGraficosFinanceiros(chartData) {
    const imagePaths = [];

    if (!chartData || chartData.transactionCount === 0) {
        console.log('📊 Sem dados suficientes para gráficos');
        return imagePaths;
    }

    // --- 1. Gráfico de Pizza: Gastos por Categoria ---
    try {
        const catLabels = Object.keys(chartData.byCategory);
        const catValues = Object.values(chartData.byCategory);

        if (catLabels.length > 0) {
            const pizzaCode = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

# Dados
labels = ${JSON.stringify(catLabels)}
values = ${JSON.stringify(catValues)}
total = sum(values)

# Ordena por valor (maior primeiro)
sorted_data = sorted(zip(values, labels), reverse=True)
values = [v for v, l in sorted_data]
labels = [l for v, l in sorted_data]

# Cores premium
colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
          '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
          '#F8C471', '#82E0AA', '#F1948A', '#AED6F1', '#D7BDE2']

# Percentuais
percentages = [(v/total)*100 for v in values]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 7), gridspec_kw={'width_ratios': [1, 1]})
fig.patch.set_facecolor('#1a1a2e')

# Pizza
wedges, texts, autotexts = ax1.pie(values, labels=None, autopct='', 
    colors=colors[:len(values)], startangle=90, pctdistance=0.85,
    wedgeprops=dict(width=0.5, edgecolor='#1a1a2e', linewidth=2))

# Texto central
ax1.text(0, 0, f'R$ {{total:,.0f}}'.replace(',', '.'), ha='center', va='center',
    fontsize=18, fontweight='bold', color='white')
ax1.set_title('Gastos por Categoria', fontsize=16, fontweight='bold', color='white', pad=20)

# Legenda lateral
legend_texts = []
for i, (label, value, pct) in enumerate(zip(labels, values, percentages)):
    legend_texts.append(f'{label}: R$ {value:,.2f} ({pct:.1f}%)')

ax2.axis('off')
for i, txt in enumerate(legend_texts[:10]):
    color = colors[i] if i < len(colors) else '#ffffff'
    ax2.text(0.05, 0.9 - i * 0.08, '●', fontsize=14, color=color, transform=ax2.transAxes, va='center')
    ax2.text(0.12, 0.9 - i * 0.08, txt, fontsize=11, color='white', transform=ax2.transAxes, va='center')

ax2.set_title('Detalhamento', fontsize=16, fontweight='bold', color='white', pad=20)

plt.tight_layout()
plt.show()
`;
            const result = await executePythonCode(pizzaCode);
            if (result.imagePath) {
                imagePaths.push(result.imagePath);
                console.log('📊 Gráfico de pizza gerado');
            }
        }
    } catch (err) {
        console.error('❌ Erro no gráfico de pizza:', err.message);
    }

    // --- 2. Gráfico de Barras: Top Gastos + Necessidade ---
    try {
        const topItems = chartData.topExpenses.slice(0, 8);
        const necessityData = chartData.byNecessity;

        if (topItems.length > 0) {
            const barCode = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 7))
fig.patch.set_facecolor('#1a1a2e')

# --- Top Gastos ---
descriptions = ${JSON.stringify(topItems.map(t => t.description.substring(0, 25)))}
amounts = ${JSON.stringify(topItems.map(t => t.amount))}

colors_bar = ['#FF6B6B', '#FF8E8E', '#FFB4B4', '#FFD4D4', '#E8E8E8', '#D0D0D0', '#B8B8B8', '#A0A0A0']
bars = ax1.barh(range(len(descriptions)), amounts, color=colors_bar[:len(amounts)], edgecolor='none', height=0.6)

ax1.set_yticks(range(len(descriptions)))
ax1.set_yticklabels(descriptions, fontsize=9, color='white')
ax1.invert_yaxis()
ax1.set_xlabel('Valor (R$)', color='white', fontsize=11)
ax1.set_title('Top Maiores Gastos', fontsize=14, fontweight='bold', color='white', pad=15)
ax1.set_facecolor('#16213e')
ax1.tick_params(colors='white')
ax1.spines['top'].set_visible(False)
ax1.spines['right'].set_visible(False)
ax1.spines['bottom'].set_color('#444')
ax1.spines['left'].set_color('#444')

for bar, val in zip(bars, amounts):
    ax1.text(bar.get_width() + max(amounts)*0.02, bar.get_y() + bar.get_height()/2,
        f'R$ {val:,.2f}', va='center', fontsize=9, color='white')

# --- Necessidade ---
nec_labels = ${JSON.stringify(Object.keys(necessityData))}
nec_values = ${JSON.stringify(Object.values(necessityData))}
nec_colors = ['#FF4444', '#FF8800', '#FFD700', '#44BB44', '#4488FF']

nec_nonzero = [(l, v, c) for l, v, c in zip(nec_labels, nec_values, nec_colors) if v > 0]
if nec_nonzero:
    labels_nz, values_nz, colors_nz = zip(*nec_nonzero)
    wedges, texts, autotexts = ax2.pie(values_nz, labels=labels_nz, autopct='%1.1f%%',
        colors=colors_nz, startangle=90, textprops={'color': 'white', 'fontsize': 10})
    for t in autotexts:
        t.set_fontsize(9)
        t.set_fontweight('bold')

ax2.set_title('Nível de Necessidade', fontsize=14, fontweight='bold', color='white', pad=15)
ax2.set_facecolor('#1a1a2e')

plt.tight_layout()
plt.show()
`;
            const result = await executePythonCode(barCode);
            if (result.imagePath) {
                imagePaths.push(result.imagePath);
                console.log('📊 Gráfico de barras/necessidade gerado');
            }
        }
    } catch (err) {
        console.error('❌ Erro no gráfico de barras:', err.message);
    }

    // --- 3. Gráfico de Linha: Gastos Acumulados ---
    try {
        const dailyData = chartData.dailyAccumulated;

        if (dailyData.length > 1) {
            const lineCode = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

fig, ax = plt.subplots(figsize=(12, 5))
fig.patch.set_facecolor('#1a1a2e')
ax.set_facecolor('#16213e')

days = ${JSON.stringify(dailyData.map(d => d.day))}
accumulated = ${JSON.stringify(dailyData.map(d => d.accumulated))}
daily = ${JSON.stringify(dailyData.map(d => d.daily))}
budget = ${chartData.budget || 0}

# Área preenchida + linha do acumulado
ax.fill_between(days, accumulated, alpha=0.3, color='#FF6B6B')
ax.plot(days, accumulated, color='#FF6B6B', linewidth=2.5, marker='o', markersize=4, label='Gasto Acumulado')

# Linha do orçamento
if budget > 0:
    ax.axhline(y=budget, color='#FFD700', linestyle='--', linewidth=2, label=f'Orçamento: R$ {budget:,.0f}')
    ax.fill_between(days, budget, max(max(accumulated), budget)*1.1, alpha=0.1, color='red')

# Barras diárias (em segundo plano)
ax.bar(days, daily, alpha=0.2, color='#4ECDC4', width=0.6, label='Gasto Diário')

ax.set_xlabel('Dia do Mês', color='white', fontsize=11)
ax.set_ylabel('Valor (R$)', color='white', fontsize=11)
ax.set_title('Evolução dos Gastos no Mês', fontsize=14, fontweight='bold', color='white', pad=15)
ax.tick_params(colors='white')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['bottom'].set_color('#444')
ax.spines['left'].set_color('#444')
ax.legend(facecolor='#1a1a2e', edgecolor='#444', labelcolor='white', fontsize=10)
ax.grid(axis='y', alpha=0.2, color='#666')

# Anotação do valor atual
ax.annotate(f'R$ {accumulated[-1]:,.2f}', xy=(days[-1], accumulated[-1]),
    fontsize=11, fontweight='bold', color='#FF6B6B',
    xytext=(10, 10), textcoords='offset points')

plt.tight_layout()
plt.show()
`;
            const result = await executePythonCode(lineCode);
            if (result.imagePath) {
                imagePaths.push(result.imagePath);
                console.log('📊 Gráfico de linha gerado');
            }
        }
    } catch (err) {
        console.error('❌ Erro no gráfico de linha:', err.message);
    }

    return imagePaths;
}

module.exports = { gerarGraficosFinanceiros };
